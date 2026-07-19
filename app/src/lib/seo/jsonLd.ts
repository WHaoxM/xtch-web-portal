import { brand } from '@/lib/siteData';
import { destinationMeta, routeTours } from '@/lib/contentStore';
import type { FaqItem } from '@/lib/seo/faqPacks';
import { getSiteOrigin, toAbsoluteAssetUrl, toCanonicalUrl } from '@/lib/seo/siteOrigin';

const SOCIAL_PROFILES = [
  'https://www.facebook.com/profile.php?id=61569741602830',
  'https://www.instagram.com/xunting_dake',
  'https://youtube.com/@xunting-dake',
  'http://www.tiktok.com/@xuntingtrip',
] as const;

export function buildOrganizationNode() {
  const origin = getSiteOrigin();
  const destinations = destinationMeta.map((destination) => destination.name);

  return {
    '@type': 'TravelAgency',
    '@id': `${origin}/#organization`,
    name: brand.name,
    alternateName: brand.fullName,
    legalName: brand.legalName,
    url: `${origin}/`,
    email: brand.email,
    telephone: brand.phone,
    description: brand.description,
    sameAs: [...SOCIAL_PROFILES],
    address: {
      '@type': 'PostalAddress',
      streetAddress:
        'Room 201, 2/F, Block C, Yibin Big Data Industrial Park Phase II, Guoxing Avenue, Lingang Economic Zone',
      addressLocality: 'Yibin',
      addressRegion: 'Sichuan',
      addressCountry: 'CN',
    },
    areaServed: destinations.length
      ? destinations.map((destination) => ({
          '@type': 'AdministrativeArea',
          name: destination,
        }))
      : 'China',
    knowsAbout: [
      'Private China tours',
      'Group tours in China',
      'Custom China itinerary planning',
      'China travel guide',
      ...destinations,
    ],
  };
}

export function buildWebSiteNode() {
  const origin = getSiteOrigin();
  return {
    '@type': 'WebSite',
    '@id': `${origin}/#website`,
    name: brand.name,
    url: `${origin}/`,
    publisher: { '@id': `${origin}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: toCanonicalUrl('/search', '?q={search_term_string}'),
      'query-input': 'required name=search_term_string',
    },
  };
}

export function buildWebPageNode(meta: {
  title: string;
  description: string;
  canonicalUrl: string;
}) {
  const origin = getSiteOrigin();
  return {
    '@type': 'WebPage',
    name: meta.title,
    description: meta.description,
    url: meta.canonicalUrl,
    isPartOf: { '@id': `${origin}/#website` },
  };
}

export function buildFaqPageNode(faqs: FaqItem[]) {
  return {
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

export function buildBreadcrumbNode(
  items: Array<{ name: string; path: string }>,
) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: toCanonicalUrl(item.path),
    })),
  };
}

export function buildTourListNode() {
  const origin = getSiteOrigin();
  return {
    '@type': 'ItemList',
    name: 'Syncing Travel China tour routes',
    itemListElement: routeTours.slice(0, 12).map((tour, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'TouristTrip',
        name: tour.title,
        description: tour.desc,
        image: toAbsoluteAssetUrl(tour.image),
        url: toCanonicalUrl(`/tours/${tour.slug}`),
      },
    })),
    numberOfItems: Math.min(routeTours.length, 12),
    url: toCanonicalUrl('/china-trips'),
    provider: { '@id': `${origin}/#organization` },
  };
}

export function buildTouristTripNode(tour: {
  title: string;
  desc: string;
  image: string;
  slug: string;
}) {
  return {
    '@type': 'TouristTrip',
    name: tour.title,
    description: tour.desc,
    image: toAbsoluteAssetUrl(tour.image),
    url: toCanonicalUrl(`/tours/${tour.slug}`),
    provider: { '@id': `${getSiteOrigin()}/#organization` },
  };
}

export function buildJsonLdGraph(nodes: unknown[]) {
  return {
    '@context': 'https://schema.org',
    '@graph': nodes,
  };
}
