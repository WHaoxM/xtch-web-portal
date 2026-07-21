/**
 * Page/API route classification for deploy:serve HTTP status.
 * Public indexable paths come only from SEO role's manifest (no second public list).
 * SPA shells are non-indexable BrowserRouter deep links that must still return HTML 200.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Non-SEO BrowserRouter shells (see seo-public-routes.mjs: deliberately not listed). */
const SPA_SHELL_EXACT = new Set([
  '/search',
  '/account',
  '/admin',
  '/auth/callback',
  '/china-tours',
]);

const SPA_SHELL_PREFIXES = ['/orders/'] as const;

export type PageRouteKind = 'public' | 'spa' | 'unknown';

export type PublicRouteManifest = {
  version: number;
  paths: string[];
  pathCount?: number;
  contentHash?: string;
};

export function defaultPublicRouteManifestPath(): string {
  return path.join(__dirname, 'seo-public-route-manifest.json');
}

export function loadPublicRouteManifest(
  manifestPath: string = defaultPublicRouteManifestPath(),
): PublicRouteManifest {
  const raw = fs.readFileSync(manifestPath, 'utf8');
  const parsed = JSON.parse(raw) as PublicRouteManifest;
  if (!parsed || !Array.isArray(parsed.paths)) {
    throw new Error(`Invalid public route manifest at ${manifestPath}`);
  }
  return parsed;
}

export function normalizePagePathname(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  const withoutQuery = pathname.split('?')[0] || '/';
  let decoded = withoutQuery;
  try {
    decoded = decodeURIComponent(withoutQuery);
  } catch {
    decoded = withoutQuery;
  }
  if (decoded.length > 1 && decoded.endsWith('/')) {
    return decoded.slice(0, -1);
  }
  return decoded;
}

export function classifyPagePath(
  pathname: string,
  publicPaths: ReadonlySet<string>,
): PageRouteKind {
  const normalized = normalizePagePathname(pathname);
  if (publicPaths.has(normalized)) return 'public';
  if (SPA_SHELL_EXACT.has(normalized)) return 'spa';
  for (const prefix of SPA_SHELL_PREFIXES) {
    if (normalized.startsWith(prefix) && normalized.length > prefix.length) {
      return 'spa';
    }
  }
  return 'unknown';
}

/** True when the path looks like a static asset (not an HTML page route). */
export function looksLikeStaticAssetPath(pathname: string): boolean {
  const normalized = normalizePagePathname(pathname);
  if (normalized.startsWith('/assets/')) return true;
  const base = normalized.split('/').pop() || '';
  if (!base.includes('.')) return false;
  const ext = path.extname(base).toLowerCase();
  return Boolean(ext) && ext !== '.html';
}

export function createPublicPathSet(manifest: PublicRouteManifest): Set<string> {
  return new Set(manifest.paths.map((p) => normalizePagePathname(p)));
}
