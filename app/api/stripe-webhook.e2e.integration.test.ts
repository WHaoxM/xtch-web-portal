/**
 * Stripe test webhook E2E against real local Postgres.
 *
 * Uses locally signed Stripe events (whsec + generateTestHeaderString).
 * Does NOT call Stripe live/test network APIs (no sk_test in env).
 * Covered HTTP paths: checkout.session.expired, charge.refunded (partial/full/idempotent),
 * checkout.session.completed unpaid (no PI → must not confirm).
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import Stripe from 'stripe';
import { loadTargetEnv } from '../../scripts/env/targetEnv.ts';

loadTargetEnv('local', { override: true });

if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL missing for Stripe webhook E2E (env/local).');
}

// Placeholder test key: only used for local webhook signing / constructEvent.
// Not a real Stripe secret; no network calls in these scenarios.
if (!process.env.STRIPE_SECRET_KEY) {
  process.env.STRIPE_SECRET_KEY = 'sk_test_booking_integrity_local_placeholder';
}
process.env.STRIPE_WEBHOOK_SECRET =
  process.env.STRIPE_WEBHOOK_SECRET || 'whsec_booking_integrity_local_e2e_secret';

const { ensureBookingTables } = await import('./domains/booking/bookingSchema.ts');
const { sql } = await import('./platform/db.ts');
const { createPendingOrderAndHold, findDepartureByPublicId, attachStripeSessionToOrder } =
  await import('./domains/booking/orders/orders.ts');
const { confirmOrderAndConsumeHold } = await import('./domains/booking/orders/orderQueries.ts');
const webhookHandler = (await import('./stripe-webhook.ts')).default;

const RUN = `wh${Date.now().toString(36)}`;
const PUBLIC_ID = `test-wh-${RUN}`;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

let departureId = '';
const createdOrderIds: string[] = [];

type FakeRes = {
  statusCode: number;
  body: unknown;
  status: (code: number) => FakeRes;
  json: (payload: unknown) => void;
  send: (payload: string) => void;
};

function createRes(): FakeRes {
  const res: FakeRes = {
    statusCode: 200,
    body: null,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
    },
    send(payload: string) {
      res.body = payload;
    },
  };
  return res;
}

async function postWebhook(event: Stripe.Event): Promise<FakeRes> {
  const payload = JSON.stringify(event);
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: WEBHOOK_SECRET,
  });
  const res = createRes();
  await webhookHandler(
    {
      method: 'POST',
      headers: { 'stripe-signature': signature },
      body: payload,
    },
    res,
  );
  return res;
}

before(async () => {
  await ensureBookingTables();
  const start = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const end = new Date(Date.now() + 63 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const inserted = await sql<{ id: string }>`
    INSERT INTO departures (
      public_id, route_slug, route_title, destination_slug, departure_city,
      start_date, end_date, status, guaranteed, adult_unit_price_cents, currency,
      capacity, included_core_items, excluded_core_items, important_notes,
      cancellation_policy_snapshot, policy_version, confirmation_rule
    ) VALUES (
      ${PUBLIC_ID},
      'test-route-webhook',
      'Webhook Test Route',
      'shanghai',
      'Shanghai',
      ${start},
      ${end},
      'sellable',
      true,
      25000,
      'usd',
      8,
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      '{"test":true}'::jsonb,
      'v-test',
      'test'
    )
    RETURNING id
  `;
  departureId = inserted.rows[0].id;
});

after(async () => {
  try {
    if (departureId) {
      await sql`DELETE FROM inventory_holds WHERE departure_id = ${departureId}`;
      await sql`DELETE FROM orders WHERE departure_id = ${departureId}`;
      await sql`DELETE FROM departures WHERE id = ${departureId}`;
    }
    await sql`
      DELETE FROM stripe_webhook_events
      WHERE stripe_event_id LIKE ${'evt_test_' + RUN + '%'}
    `;
  } finally {
    await sql.end();
  }
});

test('webhook E2E: checkout.session.expired releases pending hold', async () => {
  const departure = await findDepartureByPublicId(PUBLIC_ID);
  assert.ok(departure);
  const sessionId = `cs_test_exp_${RUN}`;
  const created = await createPendingOrderAndHold({
    departure,
    adultQuantity: 1,
    leadName: 'Expire WH',
    leadEmail: `exp-wh-${RUN}@example.com`,
    leadPhone: '',
    travelers: [{ name: 'Expire WH', gender: 'female' }],
    holdExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });
  createdOrderIds.push(created.order.id);
  await attachStripeSessionToOrder(created.order.id, created.hold.id, sessionId);

  const event = {
    id: `evt_test_${RUN}_expired`,
    object: 'event',
    api_version: '2024-11-20.acacia',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 0,
    request: null,
    type: 'checkout.session.expired',
    data: {
      object: {
        id: sessionId,
        object: 'checkout.session',
        payment_status: 'unpaid',
        payment_intent: null,
        status: 'expired',
      },
    },
  } as unknown as Stripe.Event;

  const res = await postWebhook(event);
  assert.equal(res.statusCode, 200);
  assert.equal((res.body as { processed?: boolean }).processed, true);

  const order = await sql<{ status: string }>`
    SELECT status FROM orders WHERE id = ${created.order.id}
  `;
  const hold = await sql<{ status: string }>`
    SELECT status FROM inventory_holds WHERE order_id = ${created.order.id}
  `;
  assert.equal(order.rows[0].status, 'expired');
  assert.equal(hold.rows[0].status, 'released');
});

test('webhook E2E: unpaid checkout.session.completed without PI does not confirm', async () => {
  const departure = await findDepartureByPublicId(PUBLIC_ID);
  assert.ok(departure);
  const sessionId = `cs_test_unpaid_${RUN}`;
  const created = await createPendingOrderAndHold({
    departure,
    adultQuantity: 1,
    leadName: 'Unpaid WH',
    leadEmail: `unpaid-wh-${RUN}@example.com`,
    leadPhone: '',
    travelers: [{ name: 'Unpaid WH', gender: 'male' }],
    holdExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });
  createdOrderIds.push(created.order.id);
  await attachStripeSessionToOrder(created.order.id, created.hold.id, sessionId);

  const event = {
    id: `evt_test_${RUN}_unpaid_completed`,
    object: 'event',
    api_version: '2024-11-20.acacia',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 0,
    request: null,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: sessionId,
        object: 'checkout.session',
        payment_status: 'unpaid',
        payment_intent: null,
        status: 'complete',
      },
    },
  } as unknown as Stripe.Event;

  const res = await postWebhook(event);
  assert.equal(res.statusCode, 200);

  const order = await sql<{ status: string; payment_status: string }>`
    SELECT status, payment_status FROM orders WHERE id = ${created.order.id}
  `;
  assert.equal(order.rows[0].status, 'pending_payment');
  assert.equal(order.rows[0].payment_status, 'unpaid');

  await sql`
    UPDATE inventory_holds SET status = 'released', released_at = NOW()
    WHERE order_id = ${created.order.id} AND status = 'active'
  `;
  await sql`
    UPDATE orders SET status = 'failed', payment_status = 'failed'
    WHERE id = ${created.order.id}
  `;
});

test('webhook E2E: charge.refunded partial then cumulative full; duplicate event idempotent', async () => {
  const departure = await findDepartureByPublicId(PUBLIC_ID);
  assert.ok(departure);
  const chargeId = `ch_test_${RUN}`;
  const piId = `pi_test_${RUN}`;
  const created = await createPendingOrderAndHold({
    departure,
    adultQuantity: 1,
    leadName: 'Refund WH',
    leadEmail: `refund-wh-${RUN}@example.com`,
    leadPhone: '',
    travelers: [{ name: 'Refund WH', gender: 'female' }],
    holdExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });
  createdOrderIds.push(created.order.id);
  await attachStripeSessionToOrder(created.order.id, created.hold.id, `cs_test_ref_${RUN}`);
  assert.equal(await confirmOrderAndConsumeHold(created.order.id, piId, chargeId), true);

  const total = 25000;

  const partialEvent = {
    id: `evt_test_${RUN}_charge_partial`,
    object: 'event',
    api_version: '2024-11-20.acacia',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 0,
    request: null,
    type: 'charge.refunded',
    data: {
      object: {
        id: chargeId,
        object: 'charge',
        amount: total,
        amount_refunded: 5000,
        refunded: false,
        payment_intent: piId,
        refunds: { object: 'list', data: [{ id: `re_partial_${RUN}`, object: 'refund', amount: 5000 }] },
      },
    },
  } as unknown as Stripe.Event;

  const partialRes = await postWebhook(partialEvent);
  assert.equal(partialRes.statusCode, 200);

  let order = await sql<{ status: string; payment_status: string; refund_status: string }>`
    SELECT status, payment_status, refund_status FROM orders WHERE id = ${created.order.id}
  `;
  assert.equal(order.rows[0].status, 'confirmed');
  assert.equal(order.rows[0].payment_status, 'partially_refunded');
  assert.equal(order.rows[0].refund_status, 'partially_refunded');

  const fullEvent = {
    id: `evt_test_${RUN}_charge_full`,
    object: 'event',
    api_version: '2024-11-20.acacia',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 0,
    request: null,
    type: 'charge.refunded',
    data: {
      object: {
        id: chargeId,
        object: 'charge',
        amount: total,
        amount_refunded: total,
        refunded: true,
        payment_intent: piId,
        refunds: { object: 'list', data: [{ id: `re_full_${RUN}`, object: 'refund', amount: total }] },
      },
    },
  } as unknown as Stripe.Event;

  const fullRes = await postWebhook(fullEvent);
  assert.equal(fullRes.statusCode, 200);

  order = await sql<{ status: string; payment_status: string; refund_status: string }>`
    SELECT status, payment_status, refund_status FROM orders WHERE id = ${created.order.id}
  `;
  const hold = await sql<{ status: string }>`
    SELECT status FROM inventory_holds WHERE order_id = ${created.order.id}
  `;
  assert.equal(order.rows[0].status, 'refunded');
  assert.equal(order.rows[0].payment_status, 'refunded');
  assert.equal(order.rows[0].refund_status, 'refunded');
  assert.equal(hold.rows[0].status, 'released');

  // Duplicate full event: webhook ledger short-circuits.
  const dupRes = await postWebhook(fullEvent);
  assert.equal(dupRes.statusCode, 200);
  assert.equal((dupRes.body as { processed?: boolean }).processed, false);

  // Replay with new event id but same charge already refunded — still stable.
  const replayEvent = {
    ...fullEvent,
    id: `evt_test_${RUN}_charge_full_replay`,
  } as unknown as Stripe.Event;
  const replayRes = await postWebhook(replayEvent);
  assert.equal(replayRes.statusCode, 200);

  order = await sql<{ status: string }>`
    SELECT status FROM orders WHERE id = ${created.order.id}
  `;
  assert.equal(order.rows[0].status, 'refunded');
});

test('webhook E2E: charge.refunded must not treat Charge.amount as refund amount', async () => {
  const departure = await findDepartureByPublicId(PUBLIC_ID);
  assert.ok(departure);
  const chargeId = `ch_test_bug_${RUN}`;
  const piId = `pi_test_bug_${RUN}`;
  const created = await createPendingOrderAndHold({
    departure,
    adultQuantity: 1,
    leadName: 'Bug WH',
    leadEmail: `bug-wh-${RUN}@example.com`,
    leadPhone: '',
    travelers: [{ name: 'Bug WH', gender: 'male' }],
    holdExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });
  createdOrderIds.push(created.order.id);
  await attachStripeSessionToOrder(created.order.id, created.hold.id, `cs_test_bug_${RUN}`);
  assert.equal(await confirmOrderAndConsumeHold(created.order.id, piId, chargeId), true);

  // Old bug: casting Charge as Refund used charge.amount (25000) as refund → false full.
  // Correct path uses amount_refunded=1000 → partial.
  const event = {
    id: `evt_test_${RUN}_charge_amount_trap`,
    object: 'event',
    api_version: '2024-11-20.acacia',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 0,
    request: null,
    type: 'charge.refunded',
    data: {
      object: {
        id: chargeId,
        object: 'charge',
        amount: 25000,
        amount_refunded: 1000,
        refunded: false,
        payment_intent: piId,
        refunds: { object: 'list', data: [{ id: `re_bug_${RUN}`, object: 'refund', amount: 1000 }] },
      },
    },
  } as unknown as Stripe.Event;

  const res = await postWebhook(event);
  assert.equal(res.statusCode, 200);

  const order = await sql<{ status: string; payment_status: string }>`
    SELECT status, payment_status FROM orders WHERE id = ${created.order.id}
  `;
  const hold = await sql<{ status: string }>`
    SELECT status FROM inventory_holds WHERE order_id = ${created.order.id}
  `;
  assert.equal(order.rows[0].status, 'confirmed');
  assert.equal(order.rows[0].payment_status, 'partially_refunded');
  assert.equal(hold.rows[0].status, 'consumed');
});
