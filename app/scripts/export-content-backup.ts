/**
 * Export content + business tables (+ optional media-map) into data/content-backups/<ts>/.
 *
 * From app/:
 *   npx tsx scripts/export-content-backup.ts
 *   npx tsx scripts/export-content-backup.ts --scope=all
 *   npx tsx scripts/export-content-backup.ts --scope=business
 *   npx tsx scripts/export-content-backup.ts --media-map=../data/content-backups/<prior>/media-map.json
 *   npx tsx scripts/export-content-backup.ts --out-dir=../data/content-backups/manual
 *
 * Note: business dumps may include PII (order emails/phones, inquiries). Treat packs as sensitive.
 */
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { ensureContentTables } from '../api/domains/catalog/contentSchema';
import { sql } from '../api/platform/db';
import { getS3Config } from '../api/domains/media/s3';
import { argValue, loadEnvLocal } from './lib/envLocal';
import { tablesForScope, type BackupScope } from './lib/backupTables';

loadEnvLocal();

const repoRoot = resolve(import.meta.dirname, '../..');
const appDir = resolve(import.meta.dirname, '..');
const mediaMapArg = argValue('--media-map');
const outDirArg = argValue('--out-dir');
const scopeRaw = (argValue('--scope') || 'all').toLowerCase();
const scope: BackupScope =
  scopeRaw === 'content' || scopeRaw === 'business' || scopeRaw === 'all' ? scopeRaw : 'all';

async function main() {
  await ensureContentTables();
  const config = getS3Config();
  const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });
  const tables = tablesForScope(scope);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outDir = outDirArg
    ? resolve(appDir, outDirArg)
    : resolve(repoRoot, 'data/content-backups', stamp);
  const tablesDir = resolve(outDir, 'tables');
  const minioDir = resolve(outDir, 'minio');
  mkdirSync(tablesDir, { recursive: true });
  mkdirSync(minioDir, { recursive: true });

  const counts: Record<string, number> = {};
  const skipped: string[] = [];
  try {
    for (const table of tables) {
      const exists = await pool.query(
        `SELECT to_regclass($1) AS reg`,
        [`public.${table}`],
      );
      if (!exists.rows[0]?.reg) {
        skipped.push(table);
        console.warn(`Skip missing table: ${table}`);
        continue;
      }
      const q = await pool.query(`SELECT * FROM ${table}`);
      counts[table] = q.rows.length;
      writeFileSync(resolve(tablesDir, `${table}.json`), `${JSON.stringify(q.rows, null, 2)}\n`, 'utf-8');
      console.log(`Exported ${table}: ${q.rows.length}`);
    }
  } finally {
    await pool.end();
  }

  let mediaMapCopied = false;
  if (mediaMapArg) {
    const src = resolve(appDir, mediaMapArg);
    if (!existsSync(src)) throw new Error(`media-map not found: ${src}`);
    copyFileSync(src, resolve(outDir, 'media-map.json'));
    mediaMapCopied = true;
  } else if (existsSync(resolve(outDir, 'media-map.json'))) {
    mediaMapCopied = true;
  }

  const keyPrefix = process.env.APP_ENV?.toLowerCase() === 'prod' ? 'prod/' : 'dev/';
  const manifest = {
    version: 2,
    generatedAt: new Date().toISOString(),
    scope,
    appEnv: process.env.APP_ENV || 'dev',
    keyPrefix,
    publicBaseUrl: config?.publicBaseUrl || '',
    bucket: config?.bucket || '',
    counts,
    skippedMissingTables: skipped,
    mediaMapIncluded: mediaMapCopied,
    containsPii: scope === 'all' || scope === 'business',
  };
  writeFileSync(resolve(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');

  writeFileSync(
    resolve(minioDir, 'OBJECTS.md'),
    `# MinIO object mirror

Do **not** put access keys in this backup pack.

## Recommended: mc mirror

\`\`\`bash
mc mirror local/${manifest.bucket}/${keyPrefix} prod/${manifest.bucket}/${keyPrefix}
\`\`\`

Or use \`minio/objects/\` if this pack already includes mirrored files.
`,
    'utf-8',
  );

  writeFileSync(
    resolve(outDir, 'IMPORT.md'),
    `# Import this backup

Scope: \`${scope}\` (content + business when \`all\`).

See [docs/ops/content-backup.md](../../../docs/ops/content-backup.md).

\`\`\`bash
cd app
npm run db:migrate
npx tsx scripts/import-content-backup.ts --dir=../data/content-backups/${outDirArg ? '<dir>' : stamp} --public-base-url=<PROD_S3_PUBLIC_BASE_URL>
# then restore MinIO objects if needed
\`\`\`

Business tables may include traveler PII â€?handle accordingly.
`,
    'utf-8',
  );

  console.log(`Backup written to ${outDir} (scope=${scope})`);
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
