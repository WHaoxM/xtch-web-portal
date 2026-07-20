/**
 * Assert prerender + sitemap consistency for a dist target.
 * Usage: node scripts/seo-assert-prerender.mjs [distDir]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_ORIGIN, getPrerenderRoutes, getSitemapEntries } from './seo-public-routes.mjs';
import { loadSeoBuildContent } from './seo-build-content.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');

function htmlPathForRoute(distRoot, route) {
  if (route === '/') return path.join(distRoot, 'index.html');
  return path.join(distRoot, route.replace(/^\//, ''), 'index.html');
}

function assertFile(label, condition, detail = '') {
  if (!condition) {
    throw new Error(`${label}${detail ? `: ${detail}` : ''}`);
  }
}

function main() {
  const distArg = process.argv[2] || 'dist/cloud-vps';
  const distRoot = path.resolve(appRoot, distArg);
  const snapshot = loadSeoBuildContent();
  const prerenderRoutes = getPrerenderRoutes();
  const sitemapPaths = getSitemapEntries().map((entry) => entry.path).sort();
  const prerenderSorted = [...prerenderRoutes].sort();

  assertFile(
    'sitemap/prerender path sets must match',
    JSON.stringify(sitemapPaths) === JSON.stringify(prerenderSorted),
    `sitemap=${sitemapPaths.length} prerender=${prerenderSorted.length}`,
  );

  const sampleTours = snapshot.routes.slice(0, 3).map((route) => `/tours/${route.slug}`);
  const required = ['/destinations/beijing', ...sampleTours];

  for (const route of prerenderRoutes) {
    const file = htmlPathForRoute(distRoot, route);
    assertFile(`missing HTML for ${route}`, fs.existsSync(file), file);
  }

  for (const route of required) {
    const file = htmlPathForRoute(distRoot, route);
    const html = fs.readFileSync(file, 'utf8');
    assertFile(`${route} seoReady`, html.includes('data-seo-ready="1"'));
    assertFile(`${route} not empty shell`, !html.includes('Destination not found'));
    assertFile(`${route} not empty shell`, !html.includes('Route not found'));
    const canonical = route === '/' ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${route}`;
    assertFile(`${route} canonical`, html.includes(`href="${canonical}"`));
    assertFile(`${route} not homepage canonical`, !/<link[^>]+rel=["']canonical["'][^>]*href=["']https:\/\/www\.xuntingtravel\.com\/["']/i.test(html) || route === '/');
  }

  console.log(
    `[seo-assert] OK ${prerenderRoutes.length} routes; checked beijing + ${sampleTours.length} tours in ${distRoot}`,
  );
}

try {
  main();
} catch (error) {
  console.error('[seo-assert]', error instanceof Error ? error.message : error);
  process.exit(1);
}
