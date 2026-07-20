/**
 * Shared loader/validator for the committed SEO build-time content snapshot.
 * Truth source for sitemap paths, prerender API mocks, and lastmod (when present).
 *
 * Update via: `npx tsx scripts/seo-export-build-content.mjs --env=<target>`
 * Fallback (no DB): `node scripts/seo-bootstrap-build-content.mjs`
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SEO_BUILD_CONTENT_PATH = path.resolve(__dirname, 'seo-build-content.json');

export function computeContentHash(destinations, routes) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({ destinations, routes }))
    .digest('hex');
}

export function loadSeoBuildContent(filePath = SEO_BUILD_CONTENT_PATH) {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `[seo-build-content] Missing snapshot at ${filePath}. Run seo-export-build-content or seo-bootstrap-build-content.`,
    );
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    throw new Error(`[seo-build-content] Invalid JSON: ${error instanceof Error ? error.message : error}`);
  }
  return validateSeoBuildContent(data);
}

export function validateSeoBuildContent(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('[seo-build-content] Snapshot root must be an object.');
  }
  if (data.version !== 1) {
    throw new Error(`[seo-build-content] Unsupported version: ${data.version}`);
  }
  const destinations = data.destinations;
  const routes = data.routes;
  if (!Array.isArray(destinations) || destinations.length === 0) {
    throw new Error('[seo-build-content] destinations must be a non-empty array.');
  }
  if (!Array.isArray(routes) || routes.length === 0) {
    throw new Error('[seo-build-content] routes must be a non-empty array.');
  }

  for (const destination of destinations) {
    if (!destination?.slug || !destination?.name) {
      throw new Error('[seo-build-content] Each destination needs slug and name.');
    }
  }
  for (const route of routes) {
    if (!route?.slug || !route?.title || !route?.summary) {
      throw new Error('[seo-build-content] Each route needs slug, title, and summary.');
    }
  }

  const expectedHash = computeContentHash(destinations, routes);
  if (data.contentHash && data.contentHash !== expectedHash) {
    throw new Error(
      `[seo-build-content] contentHash mismatch (file=${data.contentHash}, computed=${expectedHash}).`,
    );
  }

  const updatedAtByPath = data.updatedAtByPath && typeof data.updatedAtByPath === 'object'
    ? data.updatedAtByPath
    : {};

  return {
    version: 1,
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : null,
    sourceEnv: typeof data.sourceEnv === 'string' ? data.sourceEnv : null,
    contentHash: expectedHash,
    destinationCount: destinations.length,
    routeCount: routes.length,
    destinations,
    routes,
    updatedAtByPath,
  };
}

export function apiDestinationsPayload(snapshot) {
  return { ok: true, destinations: snapshot.destinations };
}

export function apiRoutesPayload(snapshot, destinationSlug) {
  let routes = snapshot.routes;
  if (destinationSlug) {
    routes = routes.filter(
      (route) =>
        Array.isArray(route.destinationSlugs) && route.destinationSlugs.includes(destinationSlug),
    );
  }
  return { ok: true, routes };
}

/** YYYY-MM-DD from ISO or date-only string; null if unusable. */
export function toLastmodDate(value) {
  if (!value || typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}
