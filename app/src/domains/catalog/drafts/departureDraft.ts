import type { Destination } from '@/lib/destinationsClient';
import type { RouteRecord } from '@/lib/routesClient';

export type DepartureEditDraft = {
  publicId: string;
  routeSlug: string;
  routeTitle: string;
  destinationSlug: string;
  departureCity: string;
  startDate: string;
  endDate: string;
  status: string;
  guaranteed: boolean;
  adultUnitPriceUsd: string;
  capacity: string;
  featuredOnHome: boolean;
  featuredPriority: string;
  refillChainKey: string;
  refillSequence: string;
  refillEnabled: boolean;
  refillMaxAutoActivations: string;
  confirmationRule: string;
  includedText: string;
  excludedText: string;
  notesText: string;
};

export type AdminDepartureRecord = {
  public_id: string;
  status: string;
  route_slug: string;
  route_title: string;
  destination_slug?: string | null;
  departure_city: string;
  start_date: string;
  end_date: string;
  available_seats: number;
  capacity: number;
  adult_unit_price_cents: number;
  guaranteed?: boolean;
  featured_on_home?: boolean;
  featured_priority?: number;
  refill_chain_key?: string | null;
  refill_sequence?: number | null;
  refill_enabled?: boolean;
  refill_max_auto_activations?: number | null;
  refill_activation_count?: number;
  confirmation_rule?: string;
  included_core_items?: unknown[];
  excluded_core_items?: unknown[];
  important_notes?: unknown[];
};

function destinationName(destinations: Destination[], slug: string): string {
  return destinations.find((item) => item.slug === slug)?.name ?? slug;
}

export function emptyDepartureDraft(
  routes: RouteRecord[],
  destinations: Destination[] = [],
): DepartureEditDraft {
  const firstRoute = routes[0];
  const destSlug = firstRoute?.destinationSlugs[0] ?? '';
  return {
    publicId: '',
    routeSlug: firstRoute?.slug ?? '',
    routeTitle: firstRoute?.title ?? '',
    destinationSlug: destSlug,
    departureCity: destSlug ? destinationName(destinations, destSlug) : '',
    startDate: '',
    endDate: '',
    status: 'draft',
    guaranteed: true,
    adultUnitPriceUsd: '',
    capacity: '8',
    featuredOnHome: false,
    featuredPriority: '0',
    refillChainKey: '',
    refillSequence: '1',
    refillEnabled: false,
    refillMaxAutoActivations: '1',
    confirmationRule:
      'Minimum travelers may apply. If the minimum is not met, you will be offered a full refund or a date change.',
    includedText: 'Hotel accommodation\nDaily breakfast\nLocal guide\nEntrance fees',
    excludedText: 'International flights\nTravel insurance\nPersonal expenses',
    notesText: '',
  };
}

export function departureToDraft(departure: AdminDepartureRecord): DepartureEditDraft {
  return {
    publicId: departure.public_id,
    routeSlug: departure.route_slug,
    routeTitle: departure.route_title,
    destinationSlug: departure.destination_slug || '',
    departureCity: departure.departure_city,
    startDate: departure.start_date.slice(0, 10),
    endDate: departure.end_date.slice(0, 10),
    status: departure.status || 'sellable',
    guaranteed: Boolean(departure.guaranteed),
    adultUnitPriceUsd: (departure.adult_unit_price_cents / 100).toFixed(2),
    capacity: String(departure.capacity),
    featuredOnHome: Boolean(departure.featured_on_home),
    featuredPriority: String(departure.featured_priority ?? 0),
    refillChainKey: departure.refill_chain_key ?? '',
    refillSequence: String(departure.refill_sequence ?? 1),
    refillEnabled: Boolean(departure.refill_enabled),
    refillMaxAutoActivations: String(departure.refill_max_auto_activations ?? 1),
    confirmationRule: departure.confirmation_rule || '',
    includedText: (departure.included_core_items ?? []).map(String).join('\n'),
    excludedText: (departure.excluded_core_items ?? []).map(String).join('\n'),
    notesText: (departure.important_notes ?? []).map(String).join('\n'),
  };
}

export { destinationName };
