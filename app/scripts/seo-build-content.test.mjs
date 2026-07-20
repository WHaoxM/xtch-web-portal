import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  apiDestinationsPayload,
  apiRoutesPayload,
  computeContentHash,
  loadSeoBuildContent,
  toLastmodDate,
  validateSeoBuildContent,
} from './seo-build-content.mjs';
import {
  getPrerenderRoutes,
  getSitemapEntries,
  buildPublicRouteManifest,
} from './seo-public-routes.mjs';

test('toLastmodDate accepts ISO and date-only; rejects junk', () => {
  assert.equal(toLastmodDate('2026-07-18T12:00:00.000Z'), '2026-07-18');
  assert.equal(toLastmodDate('2026-07-18'), '2026-07-18');
  assert.equal(toLastmodDate(''), null);
  assert.equal(toLastmodDate('not-a-date'), null);
});

test('validateSeoBuildContent rejects empty publish sets', () => {
  assert.throws(
    () =>
      validateSeoBuildContent({
        version: 1,
        destinations: [],
        routes: [{ slug: 'a', title: 'A', summary: 's' }],
      }),
    /non-empty/,
  );
});

test('committed snapshot loads and powers identical sitemap/prerender sets', () => {
  const prerender = getPrerenderRoutes().sort();
  const sitemap = getSitemapEntries().map((entry) => entry.path).sort();
  assert.deepEqual(prerender, sitemap);
  assert.ok(prerender.includes('/destinations/beijing'));
  assert.ok(prerender.some((path) => path.startsWith('/tours/')));
  assert.ok(prerender.filter((path) => path.startsWith('/tours/')).length >= 20);
});

test('sitemap omits fabricated lastmod when snapshot has none', () => {
  const entries = getSitemapEntries();
  assert.ok(entries.length > 0);
  assert.ok(entries.every((entry) => entry.lastmod === undefined));
});

test('API payloads match public endpoint shapes', () => {
  const snapshot = loadSeoBuildContent();
  const destinations = apiDestinationsPayload(snapshot);
  const routes = apiRoutesPayload(snapshot);
  assert.equal(destinations.ok, true);
  assert.ok(Array.isArray(destinations.destinations));
  assert.equal(routes.ok, true);
  assert.ok(Array.isArray(routes.routes));
  assert.equal(computeContentHash(snapshot.destinations, snapshot.routes), snapshot.contentHash);

  const filtered = apiRoutesPayload(snapshot, 'beijing');
  assert.ok(filtered.routes.every((route) => route.destinationSlugs.includes('beijing')));
});

test('public route manifest is stable and complete', () => {
  const manifest = buildPublicRouteManifest();
  assert.equal(manifest.version, 1);
  assert.equal(manifest.siteOrigin, 'https://www.xuntingtravel.com');
  assert.equal(manifest.pathCount, manifest.paths.length);
  assert.ok(manifest.paths.includes('/'));
  assert.ok(manifest.paths.includes('/destinations/beijing'));
});
