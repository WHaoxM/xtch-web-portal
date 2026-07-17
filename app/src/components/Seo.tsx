import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { brand } from '@/lib/siteData';
import { destinationMeta, routeTours } from '@/lib/contentStore';

const baseUrl = brand.website.replace(/\/$/, '');

const routeMeta = {
  '/': {
    title: 'Syncing Travel | Private China Tours & Custom Trips',
    description:
      'Plan private China tours and group tour routes with a China-based local travel team. Custom itinerary planning, guides, vehicles, hotels, tickets, and on-trip support.',
    image: '/images/route-beijing-forbidden.jpg',
  },
  '/destinations': {
    title: 'Top China Destinations | Syncing Travel',
    description:
      'Explore top China destinations including Beijing, Shanghai, Chengdu, Yunnan, Guangxi, Qinghai, Gansu, Xinjiang, Tibet, and Xi’an for private China tours.',
    image: '/images/hero-greatwall.jpg',
  },
  '/china-tours': {
    title: 'China Tours & Real Route Products | Syncing Travel',
    description:
      'Browse private and group tour China routes from Syncing Travel, including city breaks, culture routes, nature journeys, Silk Road loops, and custom tours.',
    image: '/images/hero-forbidden.jpg',
  },
  '/custom-trip': {
    title: 'Custom China Trip Planning | Syncing Travel',
    description:
      'Request a tailor-made China itinerary built around your dates, travelers, destinations, interests, hotel level, and pace.',
    image: '/images/ref-banner-misty-river.jpg',
  },
  '/travel-guide': {
    title: 'China Travel Guide | Syncing Travel',
    description:
      'Read practical China travel guidance for visas, payments, high-speed rail, connectivity, food, best travel seasons, safety, and first-time trip planning.',
    image: '/images/hero-bambooraft.jpg',
  },
  '/featured-services': {
    title: 'Traveler Stories | Real China Experiences | Syncing Travel',
    description:
      'See real travel videos from Syncing Travel trips: hands-on culture workshops, remote landscapes, local performances, and everyday moments we arrange for your private China tour.',
    image: '/images/route-sichuan-yading.jpg',
  },
  '/about': {
    title: 'About Syncing Travel | China-Based Inbound Travel Team',
    description:
      'Learn about Syncing Travel, the China-based inbound travel brand of Sichuan Xunting Chuhai Technology Co., Ltd., focused on private China tours.',
    image: '/images/about-hero.jpg',
  },
  '/contact': {
    title: 'Contact Syncing Travel | China Tour Inquiry',
    description:
      'Contact Syncing Travel by WhatsApp, email, phone, or inquiry form for private China tour planning and custom itinerary support.',
    image: '/images/about-hero.jpg',
  },
  '/search': {
    title: 'Search China Tours, Destinations & Guides | Syncing Travel',
    description:
      'Search Syncing Travel routes, China destinations, travel guide topics, and custom trip planning options.',
    image: '/images/ref-banner-misty-river.jpg',
  },
} satisfies Record<string, { title: string; description: string; image: string }>;

function upsertMeta(selector: string, create: () => HTMLMetaElement, content: string) {
  const existing = document.head.querySelector<HTMLMetaElement>(selector);
  const element = existing ?? create();
  element.setAttribute('content', content);
  if (!existing) document.head.appendChild(element);
}

function upsertLink(selector: string, create: () => HTMLLinkElement, href: string) {
  const existing = document.head.querySelector<HTMLLinkElement>(selector);
  const element = existing ?? create();
  element.setAttribute('href', href);
  if (!existing) document.head.appendChild(element);
}

function upsertJsonLd(id: string, data: unknown) {
  const existing = document.getElementById(id) as HTMLScriptElement | null;
  const script = existing ?? document.createElement('script');
  script.id = id;
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(data);
  if (!existing) document.head.appendChild(script);
}

export default function Seo() {
  const location = useLocation();
  const meta = routeMeta[location.pathname as keyof typeof routeMeta] ?? routeMeta['/'];

  useEffect(() => {
    const routeDestinations = destinationMeta.map((destination) => destination.name);
    const canonicalUrl =
      location.pathname === '/'
        ? `${baseUrl}/`
        : `${baseUrl}/#${location.pathname}${location.search}`;
    const imageUrl = meta.image.startsWith('http') ? meta.image : `${baseUrl}${meta.image}`;

    document.title = meta.title;
    upsertMeta('meta[name="description"]', () => {
      const element = document.createElement('meta');
      element.name = 'description';
      return element;
    }, meta.description);
    upsertMeta('meta[name="robots"]', () => {
      const element = document.createElement('meta');
      element.name = 'robots';
      return element;
    }, 'index, follow, max-image-preview:large');
    upsertLink('link[rel="canonical"]', () => {
      const element = document.createElement('link');
      element.rel = 'canonical';
      return element;
    }, canonicalUrl);

    [
      ['og:title', meta.title],
      ['og:description', meta.description],
      ['og:url', canonicalUrl],
      ['og:image', imageUrl],
      ['twitter:title', meta.title],
      ['twitter:description', meta.description],
      ['twitter:image', imageUrl],
    ].forEach(([property, content]) => {
      const isTwitter = property.startsWith('twitter:');
      upsertMeta(isTwitter ? `meta[name="${property}"]` : `meta[property="${property}"]`, () => {
        const element = document.createElement('meta');
        if (isTwitter) {
          element.name = property;
        } else {
          element.setAttribute('property', property);
        }
        return element;
      }, content);
    });

    upsertJsonLd('route-json-ld', {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'TravelAgency',
          '@id': `${baseUrl}/#organization`,
          name: brand.name,
          alternateName: brand.fullName,
          legalName: brand.legalName,
          url: `${baseUrl}/`,
          email: brand.email,
          telephone: brand.phone,
          description: brand.description,
          address: {
            '@type': 'PostalAddress',
            streetAddress:
              'Room 201, 2/F, Block C, Yibin Big Data Industrial Park Phase II, Guoxing Avenue, Lingang Economic Zone',
            addressLocality: 'Yibin',
            addressRegion: 'Sichuan',
            addressCountry: 'CN',
          },
          areaServed: routeDestinations.map((destination) => ({
            '@type': 'AdministrativeArea',
            name: destination,
          })),
          knowsAbout: [
            'Private China tours',
            'Group tours in China',
            'Custom China itinerary planning',
            'China travel guide',
            ...routeDestinations,
          ],
        },
        {
          '@type': 'WebSite',
          '@id': `${baseUrl}/#website`,
          name: brand.name,
          url: `${baseUrl}/`,
          publisher: { '@id': `${baseUrl}/#organization` },
          potentialAction: {
            '@type': 'SearchAction',
            target: `${baseUrl}/#/search?q={search_term_string}`,
            'query-input': 'required name=search_term_string',
          },
        },
        {
          '@type': 'ItemList',
          name: 'Syncing Travel China tour routes',
          itemListElement: routeTours.slice(0, 12).map((tour, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            item: {
              '@type': 'TouristTrip',
              name: tour.title,
              description: tour.desc,
              image: `${baseUrl}${tour.image}`,
              url: `${baseUrl}/#/custom-trip?tour=${encodeURIComponent(tour.title)}`,
            },
          })),
        },
        {
          '@type': 'WebPage',
          name: meta.title,
          description: meta.description,
          url: canonicalUrl,
          isPartOf: { '@id': `${baseUrl}/#website` },
        },
      ],
    });
  }, [location.pathname, location.search, meta]);

  return null;
}
