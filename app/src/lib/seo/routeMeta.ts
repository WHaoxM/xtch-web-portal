import { getGuideArticleBySlug } from '@/lib/siteData';
import {
  getDestinationBySlug,
  getRouteTourBySlug,
} from '@/lib/contentStore';
import { destinationContent } from '@/lib/destinationGuides';

export type PageMeta = {
  title: string;
  description: string;
  image: string;
  robots: string;
};

const INDEX_FOLLOW = 'index, follow, max-image-preview:large';
const NOINDEX = 'noindex, nofollow';

export const NOT_FOUND_META: PageMeta = {
  title: 'Page Not Found | Syncing Travel',
  description: 'This page is not available on Syncing Travel. Return home to browse China destinations and routes.',
  image: '/images/hero-greatwall.jpg',
  robots: NOINDEX,
};

const staticMeta: Record<string, PageMeta> = {
  '/': {
    title: 'Syncing Travel | Private China Tours & Custom Trips',
    description:
      'Plan private China tours and group tour routes with a China-based local travel team. Custom itinerary planning, guides, vehicles, hotels, tickets, and on-trip support.',
    image: '/images/route-beijing-forbidden.jpg',
    robots: INDEX_FOLLOW,
  },
  '/destinations': {
    title: 'Top China Destinations | Syncing Travel',
    description:
      'Explore top China destinations including Beijing, Shanghai, Chengdu, Yunnan, Guangxi, Qinghai, Gansu, Xinjiang, Tibet, and Xi’an for private China tours.',
    image: '/images/hero-greatwall.jpg',
    robots: INDEX_FOLLOW,
  },
  '/china-trips': {
    title: 'China Trips & Real Route Products | Syncing Travel',
    description:
      'Browse private and group tour China routes from Syncing Travel, including city breaks, culture routes, nature journeys, Silk Road loops, and custom tours.',
    image: '/images/hero-forbidden.jpg',
    robots: INDEX_FOLLOW,
  },
  '/custom-trip': {
    title: 'Custom China Trip Planning | Syncing Travel',
    description:
      'Request a tailor-made China itinerary built around your dates, travelers, destinations, interests, hotel level, and pace.',
    image: '/images/ref-banner-misty-river.jpg',
    robots: INDEX_FOLLOW,
  },
  '/travel-guide': {
    title: 'China Travel Guide | Syncing Travel',
    description:
      'Read practical China travel guidance for visas, payments, high-speed rail, connectivity, food, best travel seasons, safety, and first-time trip planning.',
    image: '/images/hero-bambooraft.jpg',
    robots: INDEX_FOLLOW,
  },
  '/featured-services': {
    title: 'Traveler Stories | Real China Experiences | Syncing Travel',
    description:
      'See real travel videos from Syncing Travel trips: hands-on culture workshops, remote landscapes, local performances, and everyday moments we arrange for your private China tour.',
    image: '/images/route-sichuan-yading.jpg',
    robots: INDEX_FOLLOW,
  },
  '/china-private-tour-cost': {
    title: 'Private China Tour Cost | Syncing Travel',
    description:
      'Understand what drives private China tour pricing—group size, hotels, transport, guides, and tickets—and what to send for a practical quote.',
    image: '/images/route-guilin.jpg',
    robots: INDEX_FOLLOW,
  },
  '/about': {
    title: 'About Syncing Travel | China-Based Inbound Travel Team',
    description:
      'Learn about Syncing Travel, the China-based inbound travel brand of Sichuan Xunting Chuhai Technology Co., Ltd., focused on private China tours.',
    image: '/images/about-hero.jpg',
    robots: INDEX_FOLLOW,
  },
  '/contact': {
    title: 'Contact Syncing Travel | China Tour Inquiry',
    description:
      'Contact Syncing Travel by WhatsApp, email, phone, or inquiry form for private China tour planning and custom itinerary support.',
    image: '/images/about-hero.jpg',
    robots: INDEX_FOLLOW,
  },
  '/privacy-policy': {
    title: 'Privacy Policy | Syncing Travel',
    description:
      'How Syncing Travel handles inquiry, booking, and website information for travelers contacting our China-based team.',
    image: '/images/about-hero.jpg',
    robots: INDEX_FOLLOW,
  },
  '/search': {
    title: 'Search China Tours, Destinations & Guides | Syncing Travel',
    description:
      'Search Syncing Travel routes, China destinations, travel guide topics, and custom trip planning options.',
    image: '/images/ref-banner-misty-river.jpg',
    robots: 'noindex, follow',
  },
};

function clipDescription(text: string, max = 155): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 1).trimEnd()}…`;
}

function isPrivatePath(pathname: string): boolean {
  return (
    pathname === '/admin' ||
    pathname === '/account' ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/orders/')
  );
}

export function resolvePageMeta(pathname: string): PageMeta {
  if (isPrivatePath(pathname)) {
    return {
      ...staticMeta['/'],
      robots: NOINDEX,
    };
  }

  if (pathname === '/china-tours') {
    return staticMeta['/china-trips'];
  }

  const destinationMatch = pathname.match(/^\/destinations\/([^/]+)$/);
  if (destinationMatch) {
    const slug = destinationMatch[1];
    const destination = getDestinationBySlug(slug);
    if (!destination) {
      return {
        ...NOT_FOUND_META,
        title: 'Destination Not Found | Syncing Travel',
      };
    }
    const content = destinationContent[slug];
    const name = destination.name;
    const description = destination.description
      ? clipDescription(destination.description)
      : content
        ? clipDescription(content.overview)
        : `Plan a private ${name} trip with Syncing Travel’s China-based team—sightseeing pacing, transfers, and local support.`;
    return {
      title: `${name} Travel Guide & Tours | Syncing Travel`,
      description,
      image: destination.image || '/images/hero-greatwall.jpg',
      robots: INDEX_FOLLOW,
    };
  }

  const tourMatch = pathname.match(/^\/tours\/([^/]+)$/);
  if (tourMatch) {
    const slug = tourMatch[1];
    const tour = getRouteTourBySlug(slug);
    if (tour) {
      return {
        title: `${tour.title} | Syncing Travel`,
        description: clipDescription(tour.desc),
        image: tour.image || '/images/hero-forbidden.jpg',
        robots: INDEX_FOLLOW,
      };
    }
    return {
      ...NOT_FOUND_META,
      title: 'Route Not Found | Syncing Travel',
    };
  }

  const guideMatch = pathname.match(/^\/travel-guide\/([^/]+)$/);
  if (guideMatch) {
    const article = getGuideArticleBySlug(guideMatch[1]);
    if (article) {
      return {
        title: `${article.title} | Syncing Travel`,
        description: clipDescription(article.summary),
        image: article.image,
        robots: INDEX_FOLLOW,
      };
    }
    return {
      ...NOT_FOUND_META,
      title: 'Guide Not Found | Syncing Travel',
    };
  }

  return staticMeta[pathname] ?? NOT_FOUND_META;
}
