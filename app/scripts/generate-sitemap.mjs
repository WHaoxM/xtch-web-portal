/**
 * Writes app/public/sitemap.xml and app/scripts/seo-public-route-manifest.json
 * from seo-public-routes.mjs + seo-build-content.json.
 * Usage: node scripts/generate-sitemap.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_ORIGIN, buildPublicRouteManifest, getSitemapEntries } from './seo-public-routes.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sitemapPath = path.resolve(__dirname, '../public/sitemap.xml');
const manifestPath = path.resolve(__dirname, 'seo-public-route-manifest.json');

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

const entries = getSitemapEntries();

const body = entries
  .map(({ path: routePath, priority, lastmod }) => {
    const lastmodLine = lastmod ? `\n    <lastmod>${escapeXml(lastmod)}</lastmod>` : '';
    return `  <url>
    <loc>${escapeXml(locForPath(routePath))}</loc>${lastmodLine}
    <priority>${priority}</priority>
  </url>`;
  })
  .join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;

fs.writeFileSync(sitemapPath, xml, 'utf8');
const manifest = buildPublicRouteManifest();
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const withLastmod = entries.filter((entry) => entry.lastmod).length;
console.log(`[sitemap] wrote ${entries.length} URLs → ${sitemapPath}`);
console.log(`[sitemap] origin ${SITE_ORIGIN}; lastmod on ${withLastmod}/${entries.length}`);
console.log(`[sitemap] public route manifest → ${manifestPath} (${manifest.pathCount} paths)`);
