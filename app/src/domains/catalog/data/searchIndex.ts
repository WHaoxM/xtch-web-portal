import { destinationMeta, getRouteTourHref, routeTours } from '@/lib/contentStore';
import { guideArticles } from '@/lib/siteData';

export type SearchResultType = 'Destination' | 'Tour' | 'Guide' | 'Service' | 'Company';

export type SearchResult = {
  id: string;
  type: SearchResultType;
  title: string;
  description: string;
  href: string;
  image?: string;
  keywords: string[];
};

const staticSearchEntries: SearchResult[] = [
  {
    id: 'service-custom-trip',
    type: 'Service',
    title: 'Custom China Trip Planning',
    description:
      'Build a private China itinerary around your dates, interests, hotel level, route pace, guides, vehicles, and tickets.',
    href: '/custom-trip',
    image: '/images/ref-banner-misty-river.jpg',
    keywords: ['custom China trip', 'tailor-made China tour', 'private itinerary', 'trip planner'],
  },
  {
    id: 'guide-visa-entry',
    type: 'Guide',
    title: 'China Travel Guide',
    description:
      'Practical China travel topics including visa basics, mobile payments, high-speed rail, connectivity, safety, and best seasons.',
    href: '/travel-guide',
    image: '/images/hero-bambooraft.jpg',
    keywords: ['China travel guide', 'visa', 'payments', 'high-speed rail', 'best time to visit China'],
  },
  {
    id: 'service-featured-services',
    type: 'Service',
    title: 'Traveler Stories — Real China Experiences',
    description:
      'Watch real travel videos from Syncing Travel trips: hands-on culture workshops, remote landscapes, local performances, and everyday moments we arrange for your private China tour.',
    href: '/featured-services',
    image: '/images/route-sichuan-yading.jpg',
    keywords: [
      'traveler stories',
      'real China experiences',
      'featured services',
      'China travel videos',
      'hands-on culture',
      'China adventure',
      'local life China',
      'private China tour experiences',
    ],
  },
  {
    id: 'service-tour-cost',
    type: 'Service',
    title: 'China Private Tour Cost',
    description:
      'Understand what affects a private China tour quote, including hotels, transport, guides, tickets, season, and group size.',
    href: '/china-private-tour-cost',
    image: '/images/route-guilin.jpg',
    keywords: ['China tour cost', 'private China tour price', 'quote', 'budget'],
  },
  {
    id: 'company-about',
    type: 'Company',
    title: 'About Syncing Travel',
    description:
      'Syncing Travel is a China-based inbound travel brand operated by Sichuan Xunting Chuhai Technology Co., Ltd.',
    href: '/about',
    image: '/images/about-hero.jpg',
    keywords: ['Syncing Travel', 'Xunting Travel', 'China inbound travel agency', 'local China travel team'],
  },
  {
    id: 'company-contact',
    type: 'Company',
    title: 'Contact Syncing Travel',
    description:
      'Contact the China-based team by WhatsApp, email, phone, or inquiry form for private China tour planning.',
    href: '/contact',
    image: '/images/about-hero.jpg',
    keywords: ['contact China travel expert', 'China tour inquiry', 'WhatsApp China travel'],
  },
];

/**
 * Rebuilt on every call instead of exported as a static array, because
 * `destinationMeta` / `routeTours` are only populated once
 * `ensureContentDataLoaded()` resolves (see `contentStore.ts`).
 */
export function buildSearchIndex(): SearchResult[] {
  return [
    ...destinationMeta.map((destination) => ({
      id: `destination-${destination.slug}`,
      type: 'Destination' as const,
      title: `${destination.name} China Tours`,
      description: destination.description,
      href: `/destinations/${destination.slug}`,
      image: destination.image,
      keywords: [destination.name, 'China destination', 'private China tour', 'custom itinerary'],
    })),
    ...routeTours.map((tour) => ({
      id: `tour-${tour.slug}`,
      type: 'Tour' as const,
      title: tour.title,
      description: tour.desc,
      href: getRouteTourHref(tour),
      image: tour.image,
      keywords: [tour.category, tour.duration, tour.groupSize, 'China tour', 'private tour', 'group tour', 'small group tour'],
    })),
    ...guideArticles.map((article) => ({
      id: `guide-${article.slug}`,
      type: 'Guide' as const,
      title: article.title,
      description: article.summary,
      href: `/travel-guide/${article.slug}`,
      image: article.image,
      keywords: [article.eyebrow, 'China travel guide', 'private China trip planning'],
    })),
    ...staticSearchEntries,
  ];
}

export function searchSite(query: string, limit?: number) {
  const searchIndex = buildSearchIndex();
  const normalized = query.trim().toLowerCase();
  const source = normalized
    ? searchIndex
        .map((item) => {
          const haystack = [item.title, item.description, item.type, ...item.keywords].join(' ').toLowerCase();
          const title = item.title.toLowerCase();
          const keywordHit = item.keywords.some((keyword) => keyword.toLowerCase().includes(normalized));
          const score =
            (title.includes(normalized) ? 5 : 0) +
            (keywordHit ? 3 : 0) +
            (haystack.includes(normalized) ? 1 : 0);

          return { item, score };
        })
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .map(({ item }) => item)
    : searchIndex;

  return typeof limit === 'number' ? source.slice(0, limit) : source;
}
