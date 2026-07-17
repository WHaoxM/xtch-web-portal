import { sql } from './db';

/**
 * Normalize DB Date / ISO / date strings to calendar `YYYY-MM-DD`.
 * Never JSON-serialize a Date into route_snapshot — use this first.
 */
export function formatDate(value: unknown): string {
  if (value instanceof Date) {
    const iso = value.toISOString();
    // DATE mapped at UTC midnight (common on UTC servers)
    if (/T00:00:00(\.\d+)?Z$/.test(iso)) return iso.slice(0, 10);
    // DATE mapped at local midnight (e.g. UTC+8 → …T16:00:00.000Z)
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const str = String(value ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) return formatDate(new Date(str));
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  return str;
}

export type DepartureInventoryRow = {
  id: string;
  public_id: string;
  route_slug: string;
  route_title: string;
  destination_slug: string | null;
  departure_city: string;
  start_date: string;
  end_date: string;
  guaranteed: boolean;
  adult_unit_price_cents: number;
  currency: string;
  capacity: number;
  available_seats: number;
  included_core_items: unknown[];
  excluded_core_items: unknown[];
  important_notes: unknown[];
  cancellation_policy_snapshot: unknown;
  confirmation_rule: string;
};

export type AdminDepartureRow = DepartureInventoryRow & {
  status: string;
  featured_on_home: boolean;
  featured_priority: number;
  policy_version: string;
};

function mapDepartureInventoryRow(row: Record<string, unknown>): DepartureInventoryRow {
  return {
    id: String(row.id),
    public_id: String(row.public_id),
    route_slug: String(row.route_slug),
    route_title: String(row.route_title),
    destination_slug: row.destination_slug ? String(row.destination_slug) : null,
    departure_city: String(row.departure_city),
    start_date: formatDate(row.start_date),
    end_date: formatDate(row.end_date),
    guaranteed: Boolean(row.guaranteed),
    adult_unit_price_cents: Number(row.adult_unit_price_cents),
    currency: String(row.currency),
    capacity: Number(row.capacity),
    available_seats: Number(row.available_seats),
    included_core_items: (row.included_core_items as unknown[]) ?? [],
    excluded_core_items: (row.excluded_core_items as unknown[]) ?? [],
    important_notes: (row.important_notes as unknown[]) ?? [],
    cancellation_policy_snapshot: row.cancellation_policy_snapshot as unknown,
    confirmation_rule: String(row.confirmation_rule),
  };
}

export async function getAvailableSeats(departureId: string): Promise<number> {
  const result = await sql<{ available_seats: string }>`
    SELECT
      d.capacity
      - COALESCE(confirmed.adults, 0)
      - COALESCE(held.adults, 0) AS available_seats
    FROM departures d
    LEFT JOIN (
      SELECT departure_id, SUM(adult_quantity) AS adults
      FROM orders
      WHERE status IN ('confirmed', 'cancellation_requested')
      GROUP BY departure_id
    ) confirmed ON confirmed.departure_id = d.id
    LEFT JOIN (
      SELECT departure_id, SUM(adult_quantity) AS adults
      FROM inventory_holds
      WHERE status = 'active' AND expires_at > NOW()
      GROUP BY departure_id
    ) held ON held.departure_id = d.id
    WHERE d.id = ${departureId}
  `;

  return Number(result.rows[0]?.available_seats ?? 0);
}

export async function listAvailableDepartures(): Promise<DepartureInventoryRow[]> {
  const result = await sql`
    SELECT
      d.id,
      d.public_id,
      d.route_slug,
      d.route_title,
      d.destination_slug,
      d.departure_city,
      d.start_date,
      d.end_date,
      d.guaranteed,
      d.adult_unit_price_cents,
      d.currency,
      d.capacity,
      d.included_core_items,
      d.excluded_core_items,
      d.important_notes,
      d.cancellation_policy_snapshot,
      d.confirmation_rule,
      GREATEST(
        d.capacity
        - COALESCE(confirmed.adults, 0)
        - COALESCE(held.adults, 0),
        0
      ) AS available_seats
    FROM departures d
    LEFT JOIN (
      SELECT departure_id, SUM(adult_quantity) AS adults
      FROM orders
      WHERE status IN ('confirmed', 'cancellation_requested')
      GROUP BY departure_id
    ) confirmed ON confirmed.departure_id = d.id
    LEFT JOIN (
      SELECT departure_id, SUM(adult_quantity) AS adults
      FROM inventory_holds
      WHERE status = 'active' AND expires_at > NOW()
      GROUP BY departure_id
    ) held ON held.departure_id = d.id
    WHERE d.status = 'sellable'
    ORDER BY d.start_date ASC, d.route_title ASC
  `;

  return result.rows.map((row) => mapDepartureInventoryRow(row as Record<string, unknown>));
}

/** Public home rail: sellable, has seats, featured, top N by priority then start date. */
export async function listFeaturedHomeDepartures(limit = 3): Promise<DepartureInventoryRow[]> {
  const safeLimit = Math.min(Math.max(Number(limit) || 3, 1), 12);
  const result = await sql`
    SELECT
      d.id,
      d.public_id,
      d.route_slug,
      d.route_title,
      d.destination_slug,
      d.departure_city,
      d.start_date,
      d.end_date,
      d.guaranteed,
      d.adult_unit_price_cents,
      d.currency,
      d.capacity,
      d.included_core_items,
      d.excluded_core_items,
      d.important_notes,
      d.cancellation_policy_snapshot,
      d.confirmation_rule,
      GREATEST(
        d.capacity
        - COALESCE(confirmed.adults, 0)
        - COALESCE(held.adults, 0),
        0
      ) AS available_seats
    FROM departures d
    LEFT JOIN (
      SELECT departure_id, SUM(adult_quantity) AS adults
      FROM orders
      WHERE status IN ('confirmed', 'cancellation_requested')
      GROUP BY departure_id
    ) confirmed ON confirmed.departure_id = d.id
    LEFT JOIN (
      SELECT departure_id, SUM(adult_quantity) AS adults
      FROM inventory_holds
      WHERE status = 'active' AND expires_at > NOW()
      GROUP BY departure_id
    ) held ON held.departure_id = d.id
    WHERE d.status = 'sellable'
      AND d.featured_on_home = true
      AND GREATEST(
        d.capacity
        - COALESCE(confirmed.adults, 0)
        - COALESCE(held.adults, 0),
        0
      ) > 0
    ORDER BY d.featured_priority ASC, d.start_date ASC, d.route_title ASC
    LIMIT ${safeLimit}
  `;

  return result.rows.map((row) => mapDepartureInventoryRow(row as Record<string, unknown>));
}

export async function listAdminDepartures(): Promise<AdminDepartureRow[]> {
  const result = await sql`
    SELECT
      d.id,
      d.public_id,
      d.route_slug,
      d.route_title,
      d.destination_slug,
      d.departure_city,
      d.start_date,
      d.end_date,
      d.status,
      d.guaranteed,
      d.adult_unit_price_cents,
      d.currency,
      d.capacity,
      d.featured_on_home,
      d.featured_priority,
      d.included_core_items,
      d.excluded_core_items,
      d.important_notes,
      d.cancellation_policy_snapshot,
      d.policy_version,
      d.confirmation_rule,
      GREATEST(
        d.capacity
        - COALESCE(confirmed.adults, 0)
        - COALESCE(held.adults, 0),
        0
      ) AS available_seats
    FROM departures d
    LEFT JOIN (
      SELECT departure_id, SUM(adult_quantity) AS adults
      FROM orders
      WHERE status IN ('confirmed', 'cancellation_requested')
      GROUP BY departure_id
    ) confirmed ON confirmed.departure_id = d.id
    LEFT JOIN (
      SELECT departure_id, SUM(adult_quantity) AS adults
      FROM inventory_holds
      WHERE status = 'active' AND expires_at > NOW()
      GROUP BY departure_id
    ) held ON held.departure_id = d.id
    ORDER BY d.featured_on_home DESC, d.featured_priority ASC, d.start_date ASC, d.route_title ASC
  `;

  return result.rows.map((row) => ({
    ...mapDepartureInventoryRow(row as Record<string, unknown>),
    status: String(row.status),
    featured_on_home: Boolean(row.featured_on_home),
    featured_priority: Number(row.featured_priority ?? 0),
    policy_version: String(row.policy_version ?? ''),
  }));
}
