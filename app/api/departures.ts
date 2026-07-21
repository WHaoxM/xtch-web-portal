import { URL } from 'node:url';
import { ensureBookingTables, type CustomerDeparture } from './lib/bookingSchema';
import { listAvailableDepartures, listFeaturedHomeDepartures } from './lib/availability';

type VercelRequestLike = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  url?: string;
  body?: unknown;
};

type VercelResponseLike = {
  status: (code: number) => VercelResponseLike;
  json: (body: unknown) => void;
};

function toCustomerDeparture(d: {
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
  confirmed_roster: {
    male: number;
    female: number;
    unknown: number;
    total: number;
  };
  included_core_items: unknown[];
  excluded_core_items: unknown[];
  important_notes: unknown[];
  cancellation_policy_snapshot: unknown;
  confirmation_rule: string;
}): CustomerDeparture {
  return {
    public_id: d.public_id,
    route_slug: d.route_slug,
    route_title: d.route_title,
    destination_slug: d.destination_slug,
    departure_city: d.departure_city,
    start_date: d.start_date,
    end_date: d.end_date,
    guaranteed: d.guaranteed,
    adult_unit_price_cents: d.adult_unit_price_cents,
    currency: d.currency,
    capacity: d.capacity,
    available_seats: d.available_seats,
    confirmed_roster: {
      male: d.confirmed_roster.male,
      female: d.confirmed_roster.female,
      unknown: d.confirmed_roster.unknown,
      total: d.confirmed_roster.total,
    },
    included_core_items: d.included_core_items,
    excluded_core_items: d.excluded_core_items,
    important_notes: d.important_notes,
    cancellation_policy_snapshot: d.cancellation_policy_snapshot,
    confirmation_rule: d.confirmation_rule,
  };
}

export default async function handler(req: VercelRequestLike, res: VercelResponseLike) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }

  try {
    await ensureBookingTables();
    const query = parseQuery(req.url);
    const featured = query.get('featured') === '1' || query.get('featured') === 'true';
    const departures = featured
      ? await listFeaturedHomeDepartures(3)
      : await listAvailableDepartures();

    res.status(200).json({
      ok: true,
      departures: departures.map(toCustomerDeparture),
    });
  } catch (error) {
    console.error('Departures list failed:', error);
    res.status(500).json({ ok: false, error: 'We could not load departures. Please try again.' });
  }
}

function parseQuery(url: string | undefined): URLSearchParams {
  if (!url) return new URLSearchParams();
  const parsed = new URL(url, 'http://localhost');
  return parsed.searchParams;
}
