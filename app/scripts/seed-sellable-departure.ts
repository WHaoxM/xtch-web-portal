import { ensureBookingTables } from '../api/domains/booking/bookingSchema';
import { sql } from '../api/platform/db';
import { loadTargetEnv } from '../../scripts/env/targetEnv';

loadTargetEnv('local', { override: false });

const sampleDepartures = [
  {
    public_id: 'sha-2026-10-03',
    route_slug: '2-3-days-and-2-nights-in-shanghai',
    route_title: '3 Days and 2 Nights in Shanghai',
    destination_slug: 'shanghai',
    departure_city: 'Shanghai',
    start_date: '2026-10-03',
    end_date: '2026-10-05',
    guaranteed: true,
    adult_unit_price_cents: 120000,
    capacity: 8,
    included_core_items: ['Hotel accommodation', 'Daily breakfast', 'Local guide', 'Entrance fees'],
    excluded_core_items: ['International flights', 'Travel insurance', 'Personal expenses'],
    important_notes: ['Minimum 4 travelers to guarantee departure.', 'Itinerary may adjust due to weather.'],
    cancellation_policy_snapshot: {
      full_refund_until: '2026-09-03',
      partial_refund_until: '2026-09-18',
      non_refundable_after: '2026-09-19',
    },
    policy_version: 'v2026-01',
    confirmation_rule: 'Minimum 4 travelers. If the minimum is not met, you will be offered a full refund or a date change.',
  },
  {
    public_id: 'bjs-2026-10-12',
    route_slug: '3-5-days-and-4-nights-in-beijing',
    route_title: '5 Days and 4 Nights in Beijing',
    destination_slug: 'beijing',
    departure_city: 'Beijing',
    start_date: '2026-10-12',
    end_date: '2026-10-16',
    guaranteed: true,
    adult_unit_price_cents: 180000,
    capacity: 8,
    included_core_items: ['Hotel accommodation', 'Daily breakfast', 'Local guide', 'Entrance fees', 'Great Wall transfer'],
    excluded_core_items: ['International flights', 'Travel insurance', 'Dinners unless specified'],
    important_notes: ['Moderate walking required at the Great Wall.', 'Passport required for hotel check-in.'],
    cancellation_policy_snapshot: {
      full_refund_until: '2026-09-12',
      partial_refund_until: '2026-09-27',
      non_refundable_after: '2026-09-28',
    },
    policy_version: 'v2026-01',
    confirmation_rule: 'Minimum 4 travelers. If the minimum is not met, you will be offered a full refund or a date change.',
  },
];

async function seed() {
  await ensureBookingTables();

  for (const departure of sampleDepartures) {
    await sql`
      INSERT INTO departures (
        public_id, route_slug, route_title, destination_slug, departure_city,
        start_date, end_date, status, guaranteed, adult_unit_price_cents, currency,
        capacity, included_core_items, excluded_core_items, important_notes,
        cancellation_policy_snapshot, policy_version, confirmation_rule
      ) VALUES (
        ${departure.public_id}, ${departure.route_slug}, ${departure.route_title},
        ${departure.destination_slug}, ${departure.departure_city},
        ${departure.start_date}, ${departure.end_date}, 'sellable', ${departure.guaranteed},
        ${departure.adult_unit_price_cents}, 'usd', ${departure.capacity},
        ${JSON.stringify(departure.included_core_items)}::jsonb,
        ${JSON.stringify(departure.excluded_core_items)}::jsonb,
        ${JSON.stringify(departure.important_notes)}::jsonb,
        ${JSON.stringify(departure.cancellation_policy_snapshot)}::jsonb,
        ${departure.policy_version}, ${departure.confirmation_rule}
      )
      ON CONFLICT (public_id) DO UPDATE SET
        route_slug = EXCLUDED.route_slug,
        route_title = EXCLUDED.route_title,
        destination_slug = EXCLUDED.destination_slug,
        departure_city = EXCLUDED.departure_city,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        status = EXCLUDED.status,
        guaranteed = EXCLUDED.guaranteed,
        adult_unit_price_cents = EXCLUDED.adult_unit_price_cents,
        currency = EXCLUDED.currency,
        capacity = EXCLUDED.capacity,
        included_core_items = EXCLUDED.included_core_items,
        excluded_core_items = EXCLUDED.excluded_core_items,
        important_notes = EXCLUDED.important_notes,
        cancellation_policy_snapshot = EXCLUDED.cancellation_policy_snapshot,
        policy_version = EXCLUDED.policy_version,
        confirmation_rule = EXCLUDED.confirmation_rule,
        updated_at = NOW()
    `;
    console.log(`Upserted sellable departure: ${departure.public_id}`);
  }

  const result = await sql`SELECT public_id, route_slug, route_title, status, capacity, adult_unit_price_cents FROM departures WHERE status = 'sellable'`;
  console.log('Sellable departures:', result.rows);

  await sql.end();
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
