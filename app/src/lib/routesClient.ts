import { assembleDayText } from './itineraryText';

export type ContentStatus = 'published' | 'draft' | 'archived';
export type RoutePrimaryType = 'private' | 'group-tour' | 'customizable' | 'fixed-departure';
export type RoutePriceMode = 'on-request' | 'fixed-from' | 'seasonal-table' | 'per-person-range' | 'unavailable';

export type ItineraryDay = {
  dayNumber: number;
  title: string;
  city: string;
  summary: string;
  attractions: string[];
  meals: string;
  accommodation: string;
  transport: string;
  notes: string[];
};

export type RouteRecord = {
  slug: string;
  legacyNumericId: number | null;
  title: string;
  subtitle: string;
  summary: string;
  durationDays: number;
  groupSizeDisplay: string;
  category: string;
  themes: string[];
  status: ContentStatus;
  featured: boolean;
  heroImage: string;
  pdfUrl: string;
  priceMode: RoutePriceMode;
  priceDisplay: string;
  primaryType: RoutePrimaryType;
  availableTypes: RoutePrimaryType[];
  destinationSlugs: string[];
  experience: string[];
  moments: string[];
  includedSupport: string[];
  itineraryDays: ItineraryDay[];
};

/**
 * Assembled from a route's structured `itineraryDays` (see
 * `app/src/lib/itineraryText.ts`) when present. Shaped to drop straight into
 * the existing `RoutePdfDetail`-consuming render code on RouteDetail.tsx /
 * ChinaTripsMobile.tsx without changing that JSX.
 */
export type StructuredItinerary = {
  experience: string[];
  moments: string[];
  days: { title: string; text: string }[];
  includedSupport: string[];
};

/**
 * Card-level route shape shaped to match the pre-migration `routeTours`
 * export from `siteData.ts`, so page components that consumed that array
 * need minimal changes. `id` is the legacy numeric id used by
 * `routePdfDetails.ts`; routes created after this migration will not have
 * one and fall back to `0` (no day-by-day content, same as before).
 */
export type RouteTour = {
  id: number;
  slug: string;
  title: string;
  desc: string;
  image: string;
  duration: string;
  durationDays: number;
  groupSize: string;
  price: string;
  category: string;
  themes: string[];
  featured: boolean;
  pdfUrl: string;
  destinationSlugs: string[];
  heroKicker: string;
  highlights: string[];
  itinerarySummary: string[];
  includedSupport: string[];
  structuredItinerary: StructuredItinerary | null;
  primaryType: RoutePrimaryType;
  availableTypes: RoutePrimaryType[];
};

export function toRouteTour(route: RouteRecord): RouteTour {
  const duration = `${route.durationDays} Day${route.durationDays === 1 ? '' : 's'}`;
  const structuredItinerary: StructuredItinerary | null =
    route.itineraryDays.length > 0
      ? {
          experience: route.experience,
          moments: route.moments,
          days: route.itineraryDays.map((day) => ({
            title: day.title || `Day ${day.dayNumber}`,
            text: assembleDayText(day),
          })),
          includedSupport: route.includedSupport,
        }
      : null;

  return {
    id: route.legacyNumericId ?? 0,
    slug: route.slug,
    title: route.title,
    desc: route.summary,
    image: route.heroImage,
    duration,
    durationDays: route.durationDays,
    groupSize: route.groupSizeDisplay,
    price: route.priceDisplay,
    category: route.category,
    themes: route.themes,
    featured: route.featured,
    pdfUrl: route.pdfUrl,
    destinationSlugs: route.destinationSlugs,
    heroKicker: `${duration} / ${route.category}`,
    highlights: [
      `${duration} route shaped for ${route.groupSizeDisplay.toLowerCase()}`,
      `Focused on ${route.category.toLowerCase()} travel with private planning support`,
      'Can be adjusted around season, hotel level, transport, guides, and pace',
    ],
    itinerarySummary: [
      'Arrival, pickup, and route orientation based on your entry city and timing.',
      `Core sightseeing days built around ${route.summary}`,
      'Flexible buffer for weather, transport, photo stops, and traveler energy.',
      'Departure transfer or onward connection coordinated with the final route plan.',
    ],
    includedSupport: [
      'Private itinerary planning',
      'Driver, guide, hotel, train, flight, and ticket coordination where needed',
      'Pre-trip communication with the China-based planning team',
      'On-trip support for timing changes and practical questions',
    ],
    structuredItinerary,
    primaryType: route.primaryType,
    availableTypes: route.availableTypes,
  };
}

export async function fetchRoutes(destinationSlug?: string): Promise<RouteTour[]> {
  const query = destinationSlug ? `?destination=${encodeURIComponent(destinationSlug)}` : '';
  const response = await fetch(`/api/routes${query}`);
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'Unexpected routes response.',
  }))) as { ok: boolean; routes?: RouteRecord[]; error?: string };

  if (!response.ok || !result.ok || !Array.isArray(result.routes)) {
    throw new Error(result.error || 'We could not load routes.');
  }

  return result.routes.map(toRouteTour);
}

export async function fetchAdminRoutes(
  token: string,
  options?: { status?: string; search?: string },
): Promise<RouteRecord[]> {
  const params = new URLSearchParams();
  if (options?.status) params.set('status', options.status);
  if (options?.search) params.set('search', options.search);
  const qs = params.toString();
  const response = await fetch(`/api/admin/routes${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'Unexpected admin routes response.',
  }))) as { ok: boolean; routes?: RouteRecord[]; error?: string };

  if (!response.ok || !result.ok || !Array.isArray(result.routes)) {
    throw new Error(result.error || 'We could not load admin routes.');
  }

  return result.routes;
}

export async function postAdminRoute(
  token: string,
  body: Record<string, unknown>,
): Promise<{ routes: RouteRecord[] }> {
  const response = await fetch('/api/admin/routes', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'Unexpected admin routes response.',
  }))) as { ok: boolean; routes?: RouteRecord[]; error?: string };

  if (!response.ok || !result.ok) {
    throw new Error(result.error || 'Admin request failed.');
  }

  return { routes: result.routes ?? [] };
}
