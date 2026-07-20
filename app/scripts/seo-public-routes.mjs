/**
 * Canonical public SEO routes shared by sitemap generation and prerender.
 * Dynamic destination/tour paths come from seo-build-content.json (published only).
 * Keep static paths aligned with App.tsx indexable routes
 * (see docs/superpowers/specs/2026-07-19-seo-geo-design.md).
 * Do not list noindex shells: /admin, /account, /auth/*, /orders/*, /search.
 * Do not list alias /china-tours (redirects to /china-trips).
 */
import { loadSeoBuildContent, toLastmodDate } from './seo-build-content.mjs';

export const SITE_ORIGIN = 'https://www.xuntingtravel.com';

export const GUIDE_SLUGS = [
  'china-visa-entry-basics',
  'mobile-payments-in-china',
  'best-time-to-visit-china',
];

/** Same slugify as backfill-content.ts / historical siteData getTourSlug(). */
export function slugifyTourTitle(value) {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const STATIC_SITEMAP_ENTRIES = [
  { path: '/', priority: '1.0' },
  { path: '/china-trips', priority: '0.9' },
  { path: '/destinations', priority: '0.8' },
  { path: '/custom-trip', priority: '0.9' },
  { path: '/travel-guide', priority: '0.7' },
  ...GUIDE_SLUGS.map((slug) => ({
    path: `/travel-guide/${slug}`,
    priority: '0.7',
  })),
  { path: '/china-private-tour-cost', priority: '0.8' },
  { path: '/featured-services', priority: '0.6' },
  { path: '/about', priority: '0.7' },
  { path: '/contact', priority: '0.8' },
  { path: '/privacy-policy', priority: '0.3' },
];

function loadSnapshot() {
  return loadSeoBuildContent();
}

/** Destination slugs from the committed publish snapshot. */
export function getDestinationSlugs() {
  return loadSnapshot().destinations.map((destination) => destination.slug);
}

/** Tour slugs from the committed publish snapshot. */
export function getTourSlugs() {
  return loadSnapshot().routes.map((route) => route.slug);
}

/**
 * Full set of paths prerendered at build time — must match sitemap indexables.
 * @returns {string[]}
 */
export function getPrerenderRoutes() {
  const snapshot = loadSnapshot();
  return [
    ...STATIC_SITEMAP_ENTRIES.map((entry) => entry.path),
    ...snapshot.destinations.map((destination) => `/destinations/${destination.slug}`),
    ...snapshot.routes.map((route) => `/tours/${route.slug}`),
  ];
}

/**
 * Full indexable sitemap paths from the same snapshot as prerender.
 * @returns {{ path: string, priority: string, lastmod?: string }[]}
 */
export function getSitemapEntries() {
  const snapshot = loadSnapshot();
  const updatedAtByPath = snapshot.updatedAtByPath || {};

  const destinationEntries = snapshot.destinations.map((destination) => ({
    path: `/destinations/${destination.slug}`,
    priority: destination.slug === 'guangxi' ? '0.7' : '0.8',
  }));

  const tourEntries = snapshot.routes.map((route) => ({
    path: `/tours/${route.slug}`,
    priority: '0.8',
  }));

  return [...STATIC_SITEMAP_ENTRIES, ...destinationEntries, ...tourEntries].map((entry) => {
    const lastmod = toLastmodDate(updatedAtByPath[entry.path]);
    return lastmod ? { ...entry, lastmod } : { ...entry };
  });
}

/**
 * Public indexable path list for runtime HTTP 404 allowlisting (role 2).
 * Stable for the same snapshot input (no wall-clock fields).
 */
export function getPublicIndexablePaths() {
  return getSitemapEntries().map((entry) => entry.path);
}

export function buildPublicRouteManifest() {
  const snapshot = loadSnapshot();
  const paths = getPublicIndexablePaths();
  return {
    version: 1,
    siteOrigin: SITE_ORIGIN,
    contentHash: snapshot.contentHash,
    sourceEnv: snapshot.sourceEnv,
    exportedAt: snapshot.exportedAt,
    pathCount: paths.length,
    paths,
  };
}
