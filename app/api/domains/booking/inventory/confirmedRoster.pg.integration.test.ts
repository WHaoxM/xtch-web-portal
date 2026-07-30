import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { loadTargetEnv } from '../../../../scripts/env/targetEnv.ts';

loadTargetEnv('local', { override: true });

if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL missing for PG integration tests (env/local).');
}

const { ensureBookingTables } = await import('../bookingSchema.ts');
const { listAvailableDepartures } = await import('./availability.ts');
const { sql } = await import('../../../platform/db.ts');
const { createPendingOrderAndHold, findDepartureByPublicId } = await import('../orders/orders.ts');
const { confirmOrderAndConsumeHold } = await import('../orders/orderQueries.ts');

const RUN = `roster${Date.now().toString(36)}`;
const PUBLIC_ID = `${RUN}-departure`;
let departureId = '';

before(async () => {
  await ensureBookingTables();
  const inserted = await sql<{ id: string }>`
    INSERT INTO departures (
      public_id, route_slug, route_title, destination_slug, departure_city,
      start_date, end_date, status, guaranteed, adult_unit_price_cents, currency,
      capacity, included_core_items, excluded_core_items, important_notes,
      cancellation_policy_snapshot, policy_version, confirmation_rule
    ) VALUES (
      ${PUBLIC_ID}, ${RUN}, 'Roster Integration Route', 'beijing', 'Beijing',
      CURRENT_DATE + 60, CURRENT_DATE + 64, 'sellable', true, 10000, 'usd',
      6, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
      '{"summary":"test"}'::jsonb, 'v-test', 'Guaranteed test departure'
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
  } finally {
    await sql.end();
  }
});

async function createOrder(
  suffix: string,
  gender: 'male' | 'female',
  confirm: boolean,
) {
  const departure = await findDepartureByPublicId(PUBLIC_ID);
  assert.ok(departure);
  const created = await createPendingOrderAndHold({
    departure,
    adultQuantity: 1,
    leadName: `Roster ${suffix}`,
    leadEmail: `${RUN}-${suffix}@example.com`,
    leadPhone: '',
    travelers: [{ name: `Roster ${suffix}`, gender }],
    holdExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });
  if (confirm) {
    await confirmOrderAndConsumeHold(
      created.order.id,
      `pi_${RUN}_${suffix}`,
      `ch_${RUN}_${suffix}`,
    );
  }
  return created.order.id;
}

test('roster counts confirmed historical genders and excludes active holds', async () => {
  await createOrder('female', 'female', true);
  const historicalOrderId = await createOrder('history', 'male', true);
  await sql`
    UPDATE orders
    SET travelers = '[{"name":"Historical traveler"}]'::jsonb,
        status = 'cancellation_requested'
    WHERE id = ${historicalOrderId}
  `;
  await createOrder('hold', 'male', false);

  const departure = (await listAvailableDepartures()).find(
    (item) => item.public_id === PUBLIC_ID,
  );
  assert.ok(departure);
  assert.deepEqual(departure.confirmed_roster, {
    male: 0,
    female: 1,
    unknown: 1,
    total: 2,
  });
  assert.equal(departure.available_seats, 3);
});
