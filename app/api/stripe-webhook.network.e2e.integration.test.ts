/**
 * Stripe *network* webhook E2E (test mode).
 * Requires STRIPE_SECRET_KEY = sk_test_* or rk_test_* with read/write for PI/charges/refunds.
 * Signs webhooks locally with STRIPE_WEBHOOK_SECRET (default local test secret).
 * Does not print secrets. Skips if key missing or not test-mode.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import Stripe from 'stripe';
import { loadTargetEnv } from '../../scripts/env/targetEnv.ts';

// Preserve shell-provided test key across loadTargetEnv(override).
const shellStripeKey = process.env.STRIPE_SECRET_KEY || '';
const shellWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

loadTargetEnv('local', { override: true });

if (shellStripeKey.startsWith('sk_test_') || shellStripeKey.startsWith('rk_test_')) {
  process.env.STRIPE_SECRET_KEY = shellStripeKey;
}
if (shellWebhookSecret) {
  process.env.STRIPE_WEBHOOK_SECRET = shellWebhookSecret;
}

const secret = process.env.STRIPE_SECRET_KEY || '';
const isTestKey = secret.startsWith('sk_test_') || secret.startsWith('rk_test_');

if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL missing (env/local).');
}
if (!isTestKey) {
  test('skip: no Stripe test key in STRIPE_SECRET_KEY', { skip: 'Set rk_test_/sk_test_ for network E2E' }, () => {});
} else {
  process.env.STRIPE_WEBHOOK_SECRET =
    process.env.STRIPE_WEBHOOK_SECRET || 'whsec_booking_integrity_local_e2e_secret';

  const { ensureBookingTables } = await import('./lib/bookingSchema.ts');
  const { sql } = await import('./lib/db.ts');
  const { createPendingOrderAndHold, findDepartureByPublicId, attachStripeSessionToOrder } =
    await import('./lib/orders.ts');
  const webhookHandler = (await import('./stripe-webhook.ts')).default;

  const stripe = new Stripe(secret);
  const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
  const RUN = `net${Date.now().toString(36)}`;
  const PUBLIC_ID = `test-net-${RUN}`;

  let departureId = '';
  let createdPiId = '';
  let createdChargeId = '';
  let createdRefundId = '';

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
      status(code) {
        res.statusCode = code;
        return res;
      },
      json(payload) {
        res.body = payload;
      },
      send(payload) {
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
        ${PUBLIC_ID}, 'test-route-net', 'Network Webhook Route', 'shanghai', 'Shanghai',
        ${start}, ${end}, 'sellable', true, 2000, 'usd', 8,
        '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{"test":true}'::jsonb, 'v-test', 'test'
      )
      RETURNING id
    `;
    departureId = inserted.rows[0].id;

    // Real test-mode PaymentIntent (visa test PM) — exercises PI retrieve on webhook.
    const pi = await stripe.paymentIntents.create({
      amount: 2000,
      currency: 'usd',
      payment_method: 'pm_card_visa',
      payment_method_types: ['card'],
      confirm: true,
      description: `booking-integrity-net-${RUN}`,
    });
    createdPiId = pi.id;
    assert.equal(pi.status, 'succeeded');
    createdChargeId =
      typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id || '';
    assert.ok(createdChargeId, 'expected latest_charge on succeeded PI');
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
        WHERE stripe_event_id LIKE ${'evt_net_' + RUN + '%'}
      `;
    } finally {
      await sql.end();
    }
  });

  test('network: paid checkout.session.completed retrieves PI and confirms order', async () => {
    const departure = await findDepartureByPublicId(PUBLIC_ID);
    assert.ok(departure);
    const sessionId = `cs_net_paid_${RUN}`;
    const created = await createPendingOrderAndHold({
      departure,
      adultQuantity: 1,
      leadName: 'Net Paid',
      leadEmail: `net-paid-${RUN}@example.com`,
      leadPhone: '',
      travelers: [{ name: 'Net Paid' }],
      holdExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });
    await attachStripeSessionToOrder(created.order.id, created.hold.id, sessionId);

    const event = {
      id: `evt_net_${RUN}_paid_completed`,
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
          payment_status: 'paid',
          payment_intent: createdPiId,
          status: 'complete',
        },
      },
    } as unknown as Stripe.Event;

    const res = await postWebhook(event);
    assert.equal(res.statusCode, 200, String(res.body));

    const order = await sql<{ status: string; payment_status: string; stripe_payment_intent_id: string }>`
      SELECT status, payment_status, stripe_payment_intent_id
      FROM orders WHERE id = ${created.order.id}
    `;
    const hold = await sql<{ status: string }>`
      SELECT status FROM inventory_holds WHERE order_id = ${created.order.id}
    `;
    assert.equal(order.rows[0].status, 'confirmed');
    assert.equal(order.rows[0].payment_status, 'paid');
    assert.equal(order.rows[0].stripe_payment_intent_id, createdPiId);
    assert.equal(hold.rows[0].status, 'consumed');
  });

  test('network: refund.updated retrieves Charge.amount_refunded and fully refunds', async () => {
    const departure = await findDepartureByPublicId(PUBLIC_ID);
    assert.ok(departure);

    // Fresh PI + charge for refund path (previous PI already linked to first order).
    const pi = await stripe.paymentIntents.create({
      amount: 2000,
      currency: 'usd',
      payment_method: 'pm_card_visa',
      payment_method_types: ['card'],
      confirm: true,
      description: `booking-integrity-refund-${RUN}`,
    });
    const piId = pi.id;
    const chargeId =
      typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id || '';
    assert.ok(chargeId);

    const sessionId = `cs_net_ref_${RUN}`;
    const created = await createPendingOrderAndHold({
      departure,
      adultQuantity: 1,
      leadName: 'Net Refund',
      leadEmail: `net-ref-${RUN}@example.com`,
      leadPhone: '',
      travelers: [{ name: 'Net Refund' }],
      holdExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });
    await attachStripeSessionToOrder(created.order.id, created.hold.id, sessionId);

    // Confirm via paid completed (network PI retrieve).
    const paidEvent = {
      id: `evt_net_${RUN}_ref_paid`,
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
          payment_status: 'paid',
          payment_intent: piId,
          status: 'complete',
        },
      },
    } as unknown as Stripe.Event;
    assert.equal((await postWebhook(paidEvent)).statusCode, 200);

    const refund = await stripe.refunds.create({ charge: chargeId });
    createdRefundId = refund.id;
    assert.ok(refund.status === 'succeeded' || refund.status === 'pending');

    const refundEvent = {
      id: `evt_net_${RUN}_refund_updated`,
      object: 'event',
      api_version: '2024-11-20.acacia',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      pending_webhooks: 0,
      request: null,
      type: 'refund.updated',
      data: {
        object: {
          id: refund.id,
          object: 'refund',
          amount: refund.amount,
          charge: chargeId,
          payment_intent: piId,
          status: refund.status,
        },
      },
    } as unknown as Stripe.Event;

    const res = await postWebhook(refundEvent);
    assert.equal(res.statusCode, 200, String(res.body));

    const order = await sql<{ status: string; payment_status: string; refund_status: string }>`
      SELECT status, payment_status, refund_status FROM orders WHERE id = ${created.order.id}
    `;
    const hold = await sql<{ status: string }>`
      SELECT status FROM inventory_holds WHERE order_id = ${created.order.id}
    `;
    assert.equal(order.rows[0].status, 'refunded');
    assert.equal(order.rows[0].payment_status, 'refunded');
    assert.equal(order.rows[0].refund_status, 'refunded');
    assert.equal(hold.rows[0].status, 'released');

    // Prove charges.retrieve was the cumulative source: charge is fully refunded on Stripe.
    const charge = await stripe.charges.retrieve(chargeId);
    assert.equal(charge.amount_refunded, charge.amount);
    void createdChargeId;
    void createdRefundId;
  });
}
