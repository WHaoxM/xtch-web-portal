/**
 * Real-Postgres integration: concurrent hold + checkout rate limits + refund/cancel gates.
 * Loads env/local; fails clearly if POSTGRES_URL missing.
 * Does not print secrets. Cleans up departure rows created for this run.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { loadTargetEnv } from '../../../scripts/env/targetEnv.ts';

loadTargetEnv('local', { override: true });

if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL missing for PG integration tests (env/local).');
}

const { ensureBookingTables } = await import('./bookingSchema.ts');
const { sql } = await import('./db.ts');
const { createPendingOrderAndHold, findDepartureByPublicId } = await import('./orders.ts');
const {
  expireExpiredHolds,
  failOrderAndReleaseHold,
  recordCancellationRequest,
  confirmOrderAndConsumeHold,
  applyFullRefundAndReleaseSeats,
  releaseInventoryHoldByOrderId,
} = await import('./orderQueries.ts');
const { assertCheckoutRateLimits, resetCheckoutRateLimitTableFlagForTests } =
  await import('./checkoutRateLimit.ts');

const RUN = `itg${Date.now().toString(36)}`;
const PUBLIC_ID = `test-hold-${RUN}`;
const EMAIL = `hold-${RUN}@example.com`;

let departureId = '';

before(async () => {
  await ensureBookingTables();
  resetCheckoutRateLimitTableFlagForTests();

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
      'test-route-integrity',
      'Integrity Test Route',
      'shanghai',
      'Shanghai',
      ${start},
      ${end},
      'sellable',
      true,
      10000,
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
      DELETE FROM checkout_rate_buckets
      WHERE subject_key LIKE ${'%' + RUN + '%'}
         OR subject_key = ${PUBLIC_ID}
         OR subject_key = ${EMAIL}
    `;
  } finally {
    await sql.end();
  }
});

test('PG: same email+departure second active hold is rejected', async () => {
  const departure = await findDepartureByPublicId(PUBLIC_ID);
  assert.ok(departure);

  const holdExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
  const first = await createPendingOrderAndHold({
    departure,
    adultQuantity: 1,
    leadName: 'Traveler One',
    leadEmail: EMAIL,
    leadPhone: '',
    travelers: [{ name: 'Traveler One', gender: 'female' }],
    holdExpiresAt,
  });
  assert.equal(first.hold.status, 'active');

  await assert.rejects(
    () =>
      createPendingOrderAndHold({
        departure,
        adultQuantity: 1,
        leadName: 'Traveler One',
        leadEmail: EMAIL,
        leadPhone: '',
        travelers: [{ name: 'Traveler One', gender: 'female' }],
        holdExpiresAt,
      }),
    /already have an open checkout/i,
  );

  const holds = await sql<{ count: string }>`
    SELECT COUNT(*)::text AS count
    FROM inventory_holds
    WHERE departure_id = ${departureId}
      AND status = 'active'
      AND expires_at > NOW()
  `;
  assert.equal(Number(holds.rows[0].count), 1);

  await failOrderAndReleaseHold(first.order.id);
});

test('PG: failOrderAndReleaseHold releases active hold after Stripe-create failure path', async () => {
  const departure = await findDepartureByPublicId(PUBLIC_ID);
  assert.ok(departure);
  const created = await createPendingOrderAndHold({
    departure,
    adultQuantity: 1,
    leadName: 'Fail Path',
    leadEmail: `fail-${RUN}@example.com`,
    leadPhone: '',
    travelers: [{ name: 'Fail Path', gender: 'male' }],
    holdExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });

  await failOrderAndReleaseHold(created.order.id);

  const order = await sql<{ status: string; payment_status: string }>`
    SELECT status, payment_status FROM orders WHERE id = ${created.order.id}
  `;
  const hold = await sql<{ status: string }>`
    SELECT status FROM inventory_holds WHERE order_id = ${created.order.id}
  `;
  assert.equal(order.rows[0].status, 'failed');
  assert.equal(order.rows[0].payment_status, 'failed');
  assert.equal(hold.rows[0].status, 'released');
});

test('PG: A1 expireExpiredHolds expires overdue hold + pending_payment order', async () => {
  const departure = await findDepartureByPublicId(PUBLIC_ID);
  assert.ok(departure);
  const created = await createPendingOrderAndHold({
    departure,
    adultQuantity: 1,
    leadName: 'Expire Path',
    leadEmail: `expire-${RUN}@example.com`,
    leadPhone: '',
    travelers: [{ name: 'Expire Path', gender: 'female' }],
    holdExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });

  await sql`
    UPDATE inventory_holds
    SET expires_at = NOW() - INTERVAL '1 minute'
    WHERE order_id = ${created.order.id}
  `;

  const n = await expireExpiredHolds(departureId);
  assert.ok(n >= 1);

  const order = await sql<{ status: string }>`
    SELECT status FROM orders WHERE id = ${created.order.id}
  `;
  const hold = await sql<{ status: string }>`
    SELECT status FROM inventory_holds WHERE order_id = ${created.order.id}
  `;
  assert.equal(order.rows[0].status, 'expired');
  assert.equal(hold.rows[0].status, 'expired');
});

test('PG: checkout rate limit blocks after email bucket hits 5 / 10min', async () => {
  const email = `rate-${RUN}@example.com`;
  const ip = `203.0.113.${(Date.now() % 200) + 1}`;

  for (let i = 0; i < 5; i++) {
    const ok = await assertCheckoutRateLimits({
      ip,
      email,
      departurePublicId: PUBLIC_ID,
    });
    assert.equal(ok.ok, true, `hit ${i + 1} should pass`);
  }

  const blocked = await assertCheckoutRateLimits({
    ip,
    email,
    departurePublicId: PUBLIC_ID,
  });
  assert.equal(blocked.ok, false);
  assert.match(blocked.error ?? '', /Too many checkout attempts/i);
});

test('PG: cancellation gate confirmed+paid only; partial/refunded denied; idempotent', async () => {
  const departure = await findDepartureByPublicId(PUBLIC_ID);
  assert.ok(departure);
  const created = await createPendingOrderAndHold({
    departure,
    adultQuantity: 1,
    leadName: 'Cancel Path',
    leadEmail: `cancel-${RUN}@example.com`,
    leadPhone: '',
    travelers: [{ name: 'Cancel Path', gender: 'male' }],
    holdExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });

  assert.equal((await recordCancellationRequest(created.order.id)).status, 'not_allowed');

  assert.equal(
    await confirmOrderAndConsumeHold(created.order.id, `pi_${RUN}`, `ch_${RUN}`),
    true,
  );

  assert.equal((await recordCancellationRequest(created.order.id)).status, 'recorded');
  assert.equal((await recordCancellationRequest(created.order.id)).status, 'already_requested');

  await sql`
    UPDATE orders
    SET status = 'confirmed',
        payment_status = 'partially_refunded',
        refund_status = 'partially_refunded',
        cancellation_requested_at = NULL
    WHERE id = ${created.order.id}
  `;
  assert.equal((await recordCancellationRequest(created.order.id)).status, 'not_allowed');

  await sql`
    UPDATE orders
    SET status = 'refunded', payment_status = 'refunded', refund_status = 'refunded'
    WHERE id = ${created.order.id}
  `;
  assert.equal((await recordCancellationRequest(created.order.id)).status, 'not_allowed');

  await releaseInventoryHoldByOrderId(created.order.id);
});

test('PG: full refund releases consumed hold; repeat apply is idempotent', async () => {
  const departure = await findDepartureByPublicId(PUBLIC_ID);
  assert.ok(departure);
  const created = await createPendingOrderAndHold({
    departure,
    adultQuantity: 1,
    leadName: 'Refund Path',
    leadEmail: `refund-${RUN}@example.com`,
    leadPhone: '',
    travelers: [{ name: 'Refund Path', gender: 'female' }],
    holdExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });
  assert.equal(
    await confirmOrderAndConsumeHold(created.order.id, `pi_r_${RUN}`, `ch_r_${RUN}`),
    true,
  );

  const holdBefore = await sql<{ status: string }>`
    SELECT status FROM inventory_holds WHERE order_id = ${created.order.id}
  `;
  assert.equal(holdBefore.rows[0].status, 'consumed');

  assert.equal(await applyFullRefundAndReleaseSeats(created.order.id, `re_${RUN}`), 'applied');
  assert.equal(await applyFullRefundAndReleaseSeats(created.order.id, `re_${RUN}`), 'already');

  const order = await sql<{ status: string; payment_status: string }>`
    SELECT status, payment_status FROM orders WHERE id = ${created.order.id}
  `;
  const hold = await sql<{ status: string }>`
    SELECT status FROM inventory_holds WHERE order_id = ${created.order.id}
  `;
  assert.equal(order.rows[0].status, 'refunded');
  assert.equal(order.rows[0].payment_status, 'refunded');
  assert.equal(hold.rows[0].status, 'released');
});
