import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { faqsForPathname } from '@/lib/seo/faqPacks';
import {
  buildBreadcrumbNode,
  buildFaqPageNode,
  buildJsonLdGraph,
  buildOrganizationNode,
  buildTouristTripNode,
  buildTourListNode,
  buildWebPageNode,
  buildWebSiteNode,
} from '@/lib/seo/jsonLd';
import { resolvePageMeta } from '@/lib/seo/routeMeta';
import { toAbsoluteAssetUrl, toCanonicalUrl } from '@/lib/seo/siteOrigin';
import { getDestinationBySlug, getRouteTourBySlug } from '@/lib/contentStore';
import { getGuideArticleBySlug } from '@/lib/siteData';

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

function buildBreadcrumbs(pathname: string) {
  const crumbs: Array<{ name: string; path: string }> = [{ name: 'Home', path: '/' }];

  const destinationMatch = pathname.match(/^\/destinations\/([^/]+)$/);
  if (destinationMatch) {
    crumbs.push({ name: 'Destinations', path: '/destinations' });
    const destination = getDestinationBySlug(destinationMatch[1]);
    crumbs.push({
      name: destination?.name ?? destinationMatch[1],
      path: pathname,
    });
    return crumbs;
  }

  const tourMatch = pathname.match(/^\/tours\/([^/]+)$/);
  if (tourMatch) {
    crumbs.push({ name: 'China Trips', path: '/china-trips' });
    const tour = getRouteTourBySlug(tourMatch[1]);
    crumbs.push({
      name: tour?.title ?? tourMatch[1],
      path: pathname,
    });
    return crumbs;
  }

  const guideMatch = pathname.match(/^\/travel-guide\/([^/]+)$/);
  if (guideMatch) {
    crumbs.push({ name: 'Travel Guide', path: '/travel-guide' });
    const article = getGuideArticleBySlug(guideMatch[1]);
    crumbs.push({
      name: article?.title ?? guideMatch[1],
      path: pathname,
    });
    return crumbs;
  }

  return null;
}

export default function Seo() {
  const location = useLocation();

  useEffect(() => {
    const meta = resolvePageMeta(location.pathname);
    const canonicalUrl = toCanonicalUrl(location.pathname, location.search);
    const imageUrl = toAbsoluteAssetUrl(meta.image);
    const faqs = faqsForPathname(location.pathname);
    const breadcrumbs = buildBreadcrumbs(location.pathname);

    document.title = meta.title;
    // Only mark SEO ready after meta is applied. Content-load failures never mount Seo
    // (see App content gate). Missing detail pages still set ready with noindex meta.
    document.documentElement.dataset.seoReady = '1';

    upsertMeta('meta[name="description"]', () => {
      const element = document.createElement('meta');
      element.name = 'description';
      return element;
    }, meta.description);
    upsertMeta('meta[name="robots"]', () => {
      const element = document.createElement('meta');
      element.name = 'robots';
      return element;
    }, meta.robots);
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

    const graph: unknown[] = [
      buildOrganizationNode(),
      buildWebSiteNode(),
      buildWebPageNode({
        title: meta.title,
        description: meta.description,
        canonicalUrl,
      }),
    ];

    if (
      location.pathname === '/' ||
      location.pathname === '/china-trips' ||
      location.pathname === '/china-tours'
    ) {
      graph.push(buildTourListNode());
    }

    const tourMatch = location.pathname.match(/^\/tours\/([^/]+)$/);
    if (tourMatch) {
      const tour = getRouteTourBySlug(tourMatch[1]);
      if (tour) {
        graph.push(
          buildTouristTripNode({
            title: tour.title,
            desc: tour.desc,
            image: tour.image,
            slug: tour.slug,
          }),
        );
      }
    }

    if (faqs?.length) {
      graph.push(buildFaqPageNode(faqs));
    }

    if (breadcrumbs) {
      graph.push(buildBreadcrumbNode(breadcrumbs));
    }

    upsertJsonLd('route-json-ld', buildJsonLdGraph(graph));
  }, [location.pathname, location.search]);

  return null;
}
