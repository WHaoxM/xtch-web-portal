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
  applyFullRefundAndReleaseSeats,
  confirmOrderAndConsumeHold,
} = await import('./orderQueries.ts');

const RUN = `refill${Date.now().toString(36)}`;
const ROUTE_SLUG = `test-refill-${RUN}`;
const publicIds = [1, 2, 3].map((sequence) => `${RUN}-${sequence}`);
const departureIds: string[] = [];
const orderIds: string[] = [];
let chainId = '';

async function createOrder(publicId: string, suffix: string) {
  const departure = await findDepartureByPublicId(publicId);
  assert.ok(departure);
  const created = await createPendingOrderAndHold({
    departure,
    adultQuantity: 1,
    leadName: `Refill ${suffix}`,
    leadEmail: `${RUN}-${suffix}@example.com`,
    leadPhone: '',
    travelers: [{ name: `Refill ${suffix}`, gender: 'female' }],
    holdExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });
  orderIds.push(created.order.id);
  return created;
}

before(async () => {
  await ensureBookingTables();
  const startBase = Date.now() + 90 * 24 * 60 * 60 * 1000;

  for (let index = 0; index < publicIds.length; index += 1) {
    const start = new Date(startBase + index * 14 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const end = new Date(startBase + (index * 14 + 3) * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const inserted = await sql<{ id: string }>`
      INSERT INTO departures (
        public_id, route_slug, route_title, destination_slug, departure_city,
        start_date, end_date, status, guaranteed, adult_unit_price_cents, currency,
        capacity, featured_on_home, featured_priority, included_core_items,
        excluded_core_items, important_notes, cancellation_policy_snapshot,
        policy_version, confirmation_rule
      ) VALUES (
        ${publicIds[index]}, ${ROUTE_SLUG}, 'Refill Integration Route', 'beijing', 'Beijing',
        ${start}, ${end}, ${index === 0 ? 'sellable' : 'draft'}, true, 10000, 'usd',
        2, ${index === 0}, 7, '["Hotel"]'::jsonb, '["Flights"]'::jsonb, '[]'::jsonb,
        '{"summary":"test"}'::jsonb, 'v-test', 'Guaranteed test departure'
      )
      RETURNING id
    `;
    departureIds.push(inserted.rows[0].id);
  }

  const chain = await sql<{ id: string }>`
    INSERT INTO departure_refill_chains (chain_key, route_slug, enabled, max_auto_activations)
    VALUES (${RUN}, ${ROUTE_SLUG}, true, 1)
    RETURNING id
  `;
  chainId = chain.rows[0].id;

  for (let index = 0; index < departureIds.length; index += 1) {
    await sql`
      INSERT INTO departure_refill_chain_members (chain_id, departure_id, sequence)
      VALUES (${chainId}, ${departureIds[index]}, ${index + 1})
    `;
  }
});

after(async () => {
  try {
    if (chainId) {
      await sql`DELETE FROM departure_refill_events WHERE chain_id = ${chainId}`;
      await sql`DELETE FROM departure_refill_chain_members WHERE chain_id = ${chainId}`;
      await sql`DELETE FROM departure_refill_chains WHERE id = ${chainId}`;
    }
    if (departureIds.length) {
      await sql`DELETE FROM inventory_holds WHERE departure_id = ANY(${departureIds}::uuid[])`;
      await sql`DELETE FROM orders WHERE departure_id = ANY(${departureIds}::uuid[])`;
      await sql`DELETE FROM departures WHERE id = ANY(${departureIds}::uuid[])`;
    }
  } finally {
    await sql.end();
  }
});

test('PG refill: active holds do not activate; concurrent last seats activate once', async () => {
  const first = await createOrder(publicIds[0], 'first');
  const second = await createOrder(publicIds[0], 'second');

  const beforeConfirmation = await sql<{ status: string }>`
    SELECT status FROM departures WHERE id = ${departureIds[1]}
  `;
  assert.equal(beforeConfirmation.rows[0].status, 'draft');

  const results = await Promise.all([
    confirmOrderAndConsumeHold(first.order.id, `pi_${RUN}_1`, `ch_${RUN}_1`),
    confirmOrderAndConsumeHold(second.order.id, `pi_${RUN}_2`, `ch_${RUN}_2`),
  ]);
  assert.deepEqual(results.sort(), [true, true]);

  const activated = await sql<{
    status: string;
    featured_on_home: boolean;
    featured_priority: number;
  }>`
    SELECT status, featured_on_home, featured_priority
    FROM departures
    WHERE id = ${departureIds[1]}
  `;
  assert.equal(activated.rows[0].status, 'sellable');
  assert.equal(activated.rows[0].featured_on_home, true);
  assert.equal(activated.rows[0].featured_priority, 7);

  const events = await sql<{ count: string }>`
    SELECT COUNT(*)::text AS count
    FROM departure_refill_events
    WHERE chain_id = ${chainId} AND outcome = 'activated'
  `;
  assert.equal(Number(events.rows[0].count), 1);

  assert.equal(
    await confirmOrderAndConsumeHold(first.order.id, `pi_${RUN}_retry`, `ch_${RUN}_retry`),
    false,
  );
  const retryEvents = await sql<{ count: string }>`
    SELECT COUNT(*)::text AS count
    FROM departure_refill_events
    WHERE chain_id = ${chainId} AND outcome = 'activated'
  `;
  assert.equal(Number(retryEvents.rows[0].count), 1);
});

test('PG refill: activation limit is audited and leaves later departure inactive', async () => {
  const first = await createOrder(publicIds[1], 'next-first');
  const second = await createOrder(publicIds[1], 'next-second');
  await Promise.all([
    confirmOrderAndConsumeHold(first.order.id, `pi_${RUN}_3`, `ch_${RUN}_3`),
    confirmOrderAndConsumeHold(second.order.id, `pi_${RUN}_4`, `ch_${RUN}_4`),
  ]);

  const later = await sql<{ status: string }>`
    SELECT status FROM departures WHERE id = ${departureIds[2]}
  `;
  assert.equal(later.rows[0].status, 'draft');

  const limitEvents = await sql<{ count: string }>`
    SELECT COUNT(*)::text AS count
    FROM departure_refill_events
    WHERE chain_id = ${chainId} AND outcome = 'limit_reached'
  `;
  assert.equal(Number(limitEvents.rows[0].count), 1);
});

test('PG refill: refund releases source seat without retracting activated departure', async () => {
  assert.equal(await applyFullRefundAndReleaseSeats(orderIds[0], `re_${RUN}`), 'applied');

  const activated = await sql<{ status: string }>`
    SELECT status FROM departures WHERE id = ${departureIds[1]}
  `;
  assert.equal(activated.rows[0].status, 'sellable');
});
