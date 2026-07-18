/**
 * Orchestrate local content seed + full media → MinIO + optional URL rewrite + backup export.
 *
 * From app/:
 *   npx tsx scripts/seed-and-migrate-media.ts
 *   npx tsx scripts/seed-and-migrate-media.ts --skip-media
 *   npx tsx scripts/seed-and-migrate-media.ts --key-env=dev --concurrency=4
 *   npx tsx scripts/seed-and-migrate-media.ts --limit=20
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { argValue, hasFlag, loadEnvLocal } from './lib/envLocal';

loadEnvLocal();

const appDir = resolve(import.meta.dirname, '..');
const repoRoot = resolve(appDir, '..');

function runTsx(label: string, args: string[]) {
  console.log(`\n=== ${label} ===\n> npx tsx ${args.join(' ')}\n`);
  const result = spawnSync('npx', ['tsx', ...args], {
    cwd: appDir,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit ${result.status}`);
  }
}

function runNpm(label: string, npmArgs: string[]) {
  console.log(`\n=== ${label} ===\n> npm ${npmArgs.join(' ')}\n`);
  const result = spawnSync('npm', npmArgs, {
    cwd: appDir,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit ${result.status}`);
  }
}

function latestMediaMap(): string | null {
  const root = resolve(repoRoot, 'data/content-backups');
  if (!existsSync(root)) return null;
  const dirs = readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .reverse();
  for (const name of dirs) {
    const map = resolve(root, name, 'media-map.json');
    if (existsSync(map)) return `../data/content-backups/${name}/media-map.json`;
  }
  return null;
}

const skipMedia = hasFlag('--skip-media');
const skipRewrite = hasFlag('--skip-rewrite');
const skipExport = hasFlag('--skip-export');
const skipItinerary = hasFlag('--skip-itinerary');
const keyEnv = argValue('--key-env');
const concurrency = argValue('--concurrency');
const limit = argValue('--limit');
const dryRun = hasFlag('--dry-run');

runNpm('db:migrate', ['run', 'db:migrate']);

runTsx('backfill-content', ['scripts/backfill-content.ts']);

if (!skipItinerary) {
  const itineraryArgs = ['scripts/import-route-itinerary-drafts.ts'];
  if (dryRun) itineraryArgs.push('--dry-run');
  runTsx('import-route-itinerary-drafts', itineraryArgs);
}

let mediaMapRel: string | null = null;
if (!skipMedia) {
  const mediaArgs = ['scripts/migrate-local-media-to-minio.ts'];
  if (dryRun) mediaArgs.push('--dry-run');
  if (keyEnv) mediaArgs.push(`--key-env=${keyEnv}`);
  if (concurrency) mediaArgs.push(`--concurrency=${concurrency}`);
  if (limit) mediaArgs.push(`--limit=${limit}`);
  runTsx('migrate-local-media-to-minio', mediaArgs);
  mediaMapRel = latestMediaMap();
}

if (!skipRewrite && mediaMapRel) {
  const rewriteArgs = ['scripts/rewrite-content-urls-to-minio.ts', `--map=${mediaMapRel}`];
  if (dryRun) rewriteArgs.push('--dry-run');
  runTsx('rewrite-content-urls-to-minio', rewriteArgs);
} else if (!skipRewrite && !skipMedia) {
  console.warn('No media-map.json found; skipping URL rewrite');
}

if (!skipExport) {
  const exportArgs = ['scripts/export-content-backup.ts'];
  if (mediaMapRel) exportArgs.push(`--media-map=${mediaMapRel}`);
  runTsx('export-content-backup', exportArgs);
}

console.log('\nSeed + media migration orchestration finished.');
