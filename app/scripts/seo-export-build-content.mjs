/**
 * Export published destinations/routes from a target DB into seo-build-content.json.
 * Does not touch production hosts unless --env points at a production env file the
 * operator intentionally provides. Prefer local / win11-home isolation DBs.
 *
 * Usage (from app/):
 *   npx tsx scripts/seo-export-build-content.mjs --env=local
 *   npx tsx scripts/seo-export-build-content.mjs --env=win11-home
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTargetEnv, normalizeTarget } from '../../scripts/env/targetEnv.ts';
import {
  SEO_BUILD_CONTENT_PATH,
  computeContentHash,
  toLastmodDate,
} from './seo-build-content.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  let env = 'local';
  let outPath = SEO_BUILD_CONTENT_PATH;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--env=')) env = arg.slice('--env='.length);
    else if (arg === '--env') env = argv[++i];
    else if (arg.startsWith('--out=')) outPath = path.resolve(arg.slice('--out='.length));
    else if (arg === '--out') outPath = path.resolve(argv[++i]);
  }
  return { env: normalizeTarget(env), outPath };
}

async function main() {
  const { env, outPath } = parseArgs(process.argv.slice(2));
  loadTargetEnv(env, { override: true });

  const { listPublicDestinations, listPublicRoutes } = await import('../api/domains/catalog/contentQueries.ts');
  const { sql } = await import('../api/platform/db.ts');

  const destinations = await listPublicDestinations();
  const routes = await listPublicRoutes();

  if (destinations.length === 0 || routes.length === 0) {
    throw new Error(
      `[seo-export] Refusing empty publish set (destinations=${destinations.length}, routes=${routes.length}).`,
    );
  }

  const updated = await sql`
    SELECT 'destination' AS kind, slug, updated_at FROM destinations WHERE status = 'published'
    UNION ALL
    SELECT 'route' AS kind, slug, updated_at FROM routes WHERE status = 'published'
  `;

  /** @type {Record<string, string>} */
  const updatedAtByPath = {};
  for (const row of updated.rows) {
    const slug = String(row.slug ?? '');
    const lastmod = toLastmodDate(
      row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at ?? ''),
    );
    if (!slug || !lastmod) continue;
    if (row.kind === 'destination') updatedAtByPath[`/destinations/${slug}`] = lastmod;
    if (row.kind === 'route') updatedAtByPath[`/tours/${slug}`] = lastmod;
  }

  const exportedAt = new Date().toISOString();
  const snapshot = {
    version: 1,
    exportedAt,
    sourceEnv: env,
    contentHash: computeContentHash(destinations, routes),
    destinationCount: destinations.length,
    routeCount: routes.length,
    destinations,
    routes,
    updatedAtByPath,
  };

  fs.writeFileSync(outPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  console.log(
    `[seo-export] wrote ${destinations.length} destinations, ${routes.length} routes â†?${outPath}`,
  );
  console.log(`[seo-export] sourceEnv=${env} contentHash=${snapshot.contentHash}`);
  console.log(`[seo-export] lastmod paths=${Object.keys(updatedAtByPath).length}`);
}

main().catch((error) => {
  console.error('[seo-export]', error);
  process.exit(1);
});
