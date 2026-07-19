/**
 * Canonical public SEO routes shared by sitemap generation and prerender.
 * Keep in sync with App.tsx indexable paths (see docs/superpowers/specs/2026-07-19-seo-geo-design.md).
 * Do not list noindex shells: /admin, /account, /auth/*, /orders/*, /search.
 * Do not list alias /china-tours (redirects to /china-trips).
 */

export const SITE_ORIGIN = 'https://www.xuntingtravel.com';

export const DESTINATION_SLUGS = [
  'beijing',
  'shanghai',
  'chengdu',
  'western-sichuan',
  'chongqing',
  'yunnan',
  'guangxi',
  'qinghai',
  'gansu',
  'xinjiang',
  'tibet',
  'xian',
];

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

/**
 * Published route titles from content backfill (id + slugify(title)).
 * Evidence: app/scripts/backfill-content.ts realTours.
 */
export const TOUR_ENTRIES = [
  { id: 1, title: 'One Day Shanghai City Tour' },
  { id: 2, title: '3 Days and 2 Nights in Shanghai' },
  { id: 3, title: '5 Days and 4 Nights in Beijing' },
  { id: 4, title: 'Forbidden City and Temple of Heaven Day Tour' },
  { id: 5, title: 'Chengdu, Jiuzhaigou and Huanglong' },
  { id: 6, title: 'Where Yading Meets Jiuzhaigou' },
  { id: 7, title: 'Panoramic Sichuan and Chongqing' },
  { id: 8, title: 'Chongqing Custom City Route' },
  { id: 9, title: 'Lijiang, Dali and Shangri-La' },
  { id: 10, title: 'Xishuangbanna Pure Travel Route' },
  { id: 11, title: 'Colorful Guilin' },
  { id: 12, title: 'Guangxi 7-Day Tour' },
  { id: 13, title: 'Encounter Qinghai and Gansu Grand Circuit' },
  { id: 14, title: 'Qinghai Lake, Chaka and Dunhuang Route' },
  { id: 15, title: 'Wild Ili Northern Xinjiang' },
  { id: 16, title: 'Kashgar and Ili Pure Travel Route' },
  { id: 17, title: "Xi'an and Huashan Boutique Tour" },
  { id: 18, title: 'Tibet Ali Southern Line' },
  { id: 19, title: 'Northern Tibet 317 Legend' },
  { id: 20, title: 'Panoramic Gansu-Qinghai 8-Day Tour' },
];

export function tourSlug(entry) {
  return `${entry.id}-${slugifyTourTitle(entry.title)}`;
}

export const TOUR_SLUGS = TOUR_ENTRIES.map(tourSlug);

/** Static + destination + guide paths prerendered at build time. */
export function getPrerenderRoutes() {
  return [
    '/',
    '/china-trips',
    '/destinations',
    ...DESTINATION_SLUGS.map((slug) => `/destinations/${slug}`),
    '/custom-trip',
    '/travel-guide',
    ...GUIDE_SLUGS.map((slug) => `/travel-guide/${slug}`),
    '/china-private-tour-cost',
    '/featured-services',
    '/about',
    '/contact',
    '/privacy-policy',
  ];
}

/**
 * Full indexable sitemap paths (prerender set + /tours/:slug from published backfill).
 * @returns {{ path: string, priority: string }[]}
 */
export function getSitemapEntries() {
  const entries = [
    { path: '/', priority: '1.0' },
    { path: '/china-trips', priority: '0.9' },
    { path: '/destinations', priority: '0.8' },
    ...DESTINATION_SLUGS.map((slug) => ({
      path: `/destinations/${slug}`,
      priority: slug === 'guangxi' ? '0.7' : '0.8',
    })),
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
    ...TOUR_SLUGS.map((slug) => ({
      path: `/tours/${slug}`,
      priority: '0.8',
    })),
  ];

  return entries;
}
