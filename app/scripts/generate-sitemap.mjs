/**
 * Writes app/public/sitemap.xml from seo-public-routes.mjs.
 * Usage: node scripts/generate-sitemap.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_ORIGIN, getSitemapEntries } from './seo-public-routes.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.resolve(__dirname, '../public/sitemap.xml');

function locForPath(routePath) {
  if (!routePath || routePath === '/') return `${SITE_ORIGIN}/`;
  return `${SITE_ORIGIN}${routePath.startsWith('/') ? routePath : `/${routePath}`}`;
}

function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const lastmod = new Date().toISOString().slice(0, 10);
const entries = getSitemapEntries();

const body = entries
  .map(
    ({ path: routePath, priority }) => `  <url>
    <loc>${escapeXml(locForPath(routePath))}</loc>
    <lastmod>${lastmod}</lastmod>
    <priority>${priority}</priority>
  </url>`,
  )
  .join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;

fs.writeFileSync(outPath, xml, 'utf8');
console.log(`[sitemap] wrote ${entries.length} URLs → ${outPath}`);
console.log(`[sitemap] origin ${SITE_ORIGIN}`);
