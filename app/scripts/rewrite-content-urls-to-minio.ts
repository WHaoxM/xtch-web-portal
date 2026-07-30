/**
 * Rewrite destinations.image / routes.hero_image from `/images/...` (or `/videos/...`)
 * to MinIO public URLs using a media-map.json produced by migrate-local-media-to-minio.
 *
 * From app/:
 *   npx tsx scripts/rewrite-content-urls-to-minio.ts --map=../data/content-backups/<ts>/media-map.json
 *   npx tsx scripts/rewrite-content-urls-to-minio.ts --map=... --dry-run
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ensureContentTables } from '../api/domains/catalog/contentSchema';
import { sql } from '../api/platform/db';
import { argValue, hasFlag, loadEnvLocal } from './lib/envLocal';
import type { MediaMapFile } from './lib/mediaMapTypes';

loadEnvLocal();

const dryRun = hasFlag('--dry-run');
const mapArg = argValue('--map');
if (!mapArg) {
  console.error('Required: --map=../data/content-backups/<ts>/media-map.json');
  process.exit(1);
}

const mapPath = resolve(import.meta.dirname, '..', mapArg);
const map = JSON.parse(readFileSync(mapPath, 'utf-8')) as MediaMapFile;

const byLocalUrl = new Map<string, string>();
for (const entry of map.entries) {
  if (entry.localPublicUrl && entry.publicUrl) {
    byLocalUrl.set(entry.localPublicUrl, entry.publicUrl);
  }
}

console.log(`Loaded ${byLocalUrl.size} localâ†’MinIO URL mappings from ${mapPath}`);

async function main() {
  await ensureContentTables();

  const dests = await sql`SELECT slug, image FROM destinations`;
  let destUpdated = 0;
  for (const row of dests.rows) {
    const image = String(row.image || '').trim();
    if (!image.startsWith('/')) continue;
    const next = byLocalUrl.get(image);
    if (!next || next === image) continue;
    console.log(`destination ${row.slug}: ${image} â†?${next}`);
    if (!dryRun) {
      await sql`
        UPDATE destinations SET image = ${next}, updated_at = NOW()
        WHERE slug = ${row.slug as string}
      `;
    }
    destUpdated++;
  }

  const routes = await sql`SELECT slug, hero_image FROM routes`;
  let routeUpdated = 0;
  for (const row of routes.rows) {
    const image = String(row.hero_image || '').trim();
    if (!image.startsWith('/')) continue;
    const next = byLocalUrl.get(image);
    if (!next || next === image) continue;
    console.log(`route ${row.slug}: ${image} â†?${next}`);
    if (!dryRun) {
      await sql`
        UPDATE routes SET hero_image = ${next}, updated_at = NOW()
        WHERE slug = ${row.slug as string}
      `;
    }
    routeUpdated++;
  }

  console.log(`Done: destinations=${destUpdated} routes=${routeUpdated} dryRun=${dryRun}`);
  await sql.end();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await sql.end();
  } catch {
    // ignore
  }
  process.exit(1);
});
