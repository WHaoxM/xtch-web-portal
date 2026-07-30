import { fetchDestinations, type Destination } from '../clients/destinationsClient';
import { fetchRoutes, type RouteTour } from '../clients/routesClient';

export type { Destination, RouteTour };

/**
 * Live-mutated arrays populated once by `ensureContentDataLoaded()`. Kept as
 * plain arrays (not React state) so pages and utility helpers that used to
 * import `destinationMeta` / `routeTours` directly from `siteData.ts` need
 * only an import-path change; every existing `.find()` / `.filter()` /
 * `.map()` call site keeps working against the same array reference once it
 * has been populated. `App.tsx` gates rendering on `ensureContentDataLoaded()`
 * so pages never render before the arrays are filled.
 */
export const destinationMeta: Destination[] = [];
export const routeTours: RouteTour[] = [];

let loadPromise: Promise<void> | null = null;

export function ensureContentDataLoaded(): Promise<void> {
  if (!loadPromise) {
    loadPromise = Promise.all([fetchDestinations(), fetchRoutes()])
      .then(([destinations, routes]) => {
        destinationMeta.length = 0;
        destinationMeta.push(...destinations);
        routeTours.length = 0;
        routeTours.push(...routes);
      })
      .catch((error) => {
        loadPromise = null;
        throw error;
      });
  }
  return loadPromise;
}

export const getDestinationHref = (slug: string) => `/destinations/${slug}`;

export const getDestinationBySlug = (slug: string) =>
  destinationMeta.find((destination) => destination.slug === slug);

export const getToursByDestination = (slug: string) =>
  routeTours.filter((tour) => tour.destinationSlugs.includes(slug));

export const getRouteTourBySlug = (slug: string) => routeTours.find((tour) => tour.slug === slug);

export const getRouteTourHref = (tour: Pick<RouteTour, 'slug'>) => `/tours/${tour.slug}`;
