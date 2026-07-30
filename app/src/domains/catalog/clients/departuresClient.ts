export type PublicDeparture = {
  publicId: string;
  routeSlug: string;
  routeTitle: string;
  destinationSlug: string | null;
  departureCity: string;
  startDate: string;
  endDate: string;
  guaranteed: boolean;
  adultPriceCents: number;
  currency: string;
  capacity: number;
  availableSeats: number;
  confirmedRoster: ConfirmedRosterSummary;
};

export type ConfirmedRosterSummary = {
  male: number;
  female: number;
  unknown: number;
  total: number;
};

type ApiDeparture = {
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
  confirmed_roster?: Partial<ConfirmedRosterSummary>;
};

export type DepartureRouteGroup = {
  routeSlug: string;
  routeTitle: string;
  departures: PublicDeparture[];
};

function mapPublicDeparture(departure: ApiDeparture): PublicDeparture {
  return {
    publicId: departure.public_id,
    routeSlug: departure.route_slug,
    routeTitle: departure.route_title,
    destinationSlug: departure.destination_slug,
    departureCity: departure.departure_city,
    startDate: departure.start_date,
    endDate: departure.end_date,
    guaranteed: Boolean(departure.guaranteed),
    adultPriceCents: Number(departure.adult_unit_price_cents),
    currency: departure.currency || 'usd',
    capacity: Number(departure.capacity),
    availableSeats: Math.max(0, Number(departure.available_seats)),
    confirmedRoster: normalizeConfirmedRoster(departure.confirmed_roster),
  };
}

export function normalizeConfirmedRoster(
  value: Partial<ConfirmedRosterSummary> | null | undefined,
): ConfirmedRosterSummary {
  const male = nonNegativeCount(value?.male);
  const female = nonNegativeCount(value?.female);
  const total = Math.max(male + female, nonNegativeCount(value?.total));
  return {
    male,
    female,
    unknown: Math.max(0, total - male - female),
    total,
  };
}

function nonNegativeCount(value: unknown): number {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
}

export async function fetchPublicDepartures(signal?: AbortSignal): Promise<PublicDeparture[]> {
  const response = await fetch('/api/departures', { signal });
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'Unexpected departures response.',
  }))) as { ok: boolean; departures?: ApiDeparture[]; error?: string };

  if (!response.ok || !result.ok || !Array.isArray(result.departures)) {
    throw new Error(result.error || 'We could not load departures.');
  }

  return result.departures.map(mapPublicDeparture);
}

export function departureAvailability(departure: Pick<PublicDeparture, 'availableSeats'>) {
  if (departure.availableSeats <= 0) {
    return { label: 'Sold out', bookable: false };
  }
  return {
    label: `${departure.availableSeats} seat${departure.availableSeats === 1 ? '' : 's'} left`,
    bookable: true,
  };
}

export function formatDeparturePrice(
  departure: Pick<PublicDeparture, 'adultPriceCents' | 'currency'>,
): string {
  const amount = departure.adultPriceCents / 100;
  const hasFraction = departure.adultPriceCents % 100 !== 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: departure.currency.toUpperCase(),
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function groupDeparturesByRoute(
  departures: PublicDeparture[],
): DepartureRouteGroup[] {
  const groups = new Map<string, DepartureRouteGroup>();

  departures.forEach((departure) => {
    const existing = groups.get(departure.routeSlug);
    if (existing) {
      existing.departures.push(departure);
      return;
    }
    groups.set(departure.routeSlug, {
      routeSlug: departure.routeSlug,
      routeTitle: departure.routeTitle,
      departures: [departure],
    });
  });

  return [...groups.values()];
}
