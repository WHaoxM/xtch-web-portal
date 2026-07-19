import { brand } from '@/lib/siteData';

/** Canonical public origin (no trailing slash). */
export function getSiteOrigin(): string {
  return brand.website.replace(/\/$/, '');
}

/** Path-based canonical URLs (BrowserRouter). */
export function toCanonicalUrl(pathname: string, search = ''): string {
  const origin = getSiteOrigin();
  const normalized =
    !pathname || pathname === '/'
      ? '/'
      : pathname.startsWith('/')
        ? pathname
        : `/${pathname}`;

  if (normalized === '/') {
    return search ? `${origin}/${search}` : `${origin}/`;
  }

  return `${origin}${normalized}${search}`;
}

export function toAbsoluteAssetUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  const origin = getSiteOrigin();
  return `${origin}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
}
