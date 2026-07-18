/**
 * Scan local image/video trees → sha256 dedupe → PutObject → upsert media_assets
 * → write media-map.json under data/content-backups/<ts>/.
 *
 * From app/:
 *   npx tsx scripts/migrate-local-media-to-minio.ts
 *   npx tsx scripts/migrate-local-media-to-minio.ts --dry-run
 *   npx tsx scripts/migrate-local-media-to-minio.ts --key-env=prod --concurrency=4
 *   npx tsx scripts/migrate-local-media-to-minio.ts --resume-map=../data/content-backups/<ts>/media-map.json
 *   npx tsx scripts/migrate-local-media-to-minio.ts --limit=20
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ensureContentTables } from '../api/lib/contentSchema';
import { sql } from '../api/lib/db';
import {
  buildObjectKey,
  getS3Config,
  putObject,
  publicUrlForKey,
} from '../api/lib/s3';
import { argValue, hasFlag, loadEnvLocal } from './lib/envLocal';
import {
  defaultScanRoots,
  mapPool,
  scanMediaFiles,
  sha256File,
  titleFromFilename,
  type ScannedFile,
} from './lib/mediaScan';
import type { MediaMapEntry, MediaMapFile } from './lib/mediaMapTypes';
import { fileURLToPath } from 'node:url';

loadEnvLocal();

export type { MediaMapEntry, MediaMapFile };

const dryRun = hasFlag('--dry-run');
const keyEnv = (argValue('--key-env') || process.env.APP_ENV || 'dev').toLowerCase() === 'prod' ? 'prod' : 'dev';
const concurrency = Math.max(1, Number(argValue('--concurrency') || '4') || 4);
const limit = Number(argValue('--limit') || '0') || 0;
const resumeMapPath = argValue('--resume-map');
const outDirArg = argValue('--out-dir');

const repoRoot = resolve(import.meta.dirname, '../..');
const appDir = resolve(import.meta.dirname, '..');

function mediaIdForHash(sha256: string): string {
  return `media-${sha256.slice(0, 16)}`;
}

function loadResumeMap(path: string | undefined): Map<string, MediaMapEntry> {
  const byHash = new Map<string, MediaMapEntry>();
  if (!path) return byHash;
  const abs = resolve(appDir, path);
  const raw = JSON.parse(readFileSync(abs, 'utf-8')) as MediaMapFile;
  for (const entry of raw.entries || []) {
    if (entry.sha256) byHash.set(entry.sha256, entry);
  }
  console.log(`Resume map: ${byHash.size} hashes from ${abs}`);
  return byHash;
}

async function loadDbHashIndex(): Promise<Map<string, { id: string; publicUrl: string; objectKeyHint: string }>> {
  const byHash = new Map<string, { id: string; publicUrl: string; objectKeyHint: string }>();
  const result = await sql`
    SELECT id, public_url, tags, original_path
    FROM media_assets
    WHERE status <> 'archived'
  `;
  for (const row of result.rows) {
    const tags = (row.tags as string[] | null) || [];
    const shaTag = tags.find((t) => t.startsWith('sha256:'));
    if (!shaTag) continue;
    const sha256 = shaTag.slice('sha256:'.length);
    const publicUrl = String(row.public_url || '');
    let objectKeyHint = '';
    try {
      const cfg = getS3Config();
      if (cfg && publicUrl.startsWith(`${cfg.publicBaseUrl}/`)) {
        objectKeyHint = decodeURIComponent(publicUrl.slice(cfg.publicBaseUrl.length + 1));
      }
    } catch {
      // ignore
    }
    byHash.set(sha256, { id: String(row.id), publicUrl, objectKeyHint });
  }
  console.log(`DB hash index: ${byHash.size} media rows with sha256 tags`);
  return byHash;
}

async function upsertMediaRow(entry: MediaMapEntry) {
  const title = titleFromFilename(entry.sourcePath.split('/').pop() || entry.mediaId);
  const tags = [entry.sourceTag, `sha256:${entry.sha256}`, 'bulk-minio-migrate'];
  const rights = entry.sourceTag === 'source:benzhan' ? 'owned' : 'unknown';

  await sql`
    INSERT INTO media_assets (
      id, status, type, public_url, original_path, title, alt_text,
      destination_slugs, route_slugs, tags, rights_status, internal_source_trace
    ) VALUES (
      ${entry.mediaId}, 'published', ${entry.mediaType}, ${entry.publicUrl}, ${entry.sourcePath},
      ${title}, ${title}, ${[] as string[]}, ${[] as string[]}, ${tags}, ${rights}, ${entry.sourcePath}
    )
    ON CONFLICT (id) DO UPDATE SET
      status = EXCLUDED.status,
      type = EXCLUDED.type,
      public_url = EXCLUDED.public_url,
      original_path = EXCLUDED.original_path,
      title = EXCLUDED.title,
      alt_text = EXCLUDED.alt_text,
      tags = EXCLUDED.tags,
      rights_status = EXCLUDED.rights_status,
      internal_source_trace = EXCLUDED.internal_source_trace,
      updated_at = NOW()
  `;
}

function localPublicUrl(sourcePath: string): string | null {
  const markers = ['app/public/images/', 'app/public/videos/'];
  for (const marker of markers) {
    if (sourcePath.startsWith(marker) || sourcePath.includes(`/${marker}`)) {
      const idx = sourcePath.indexOf('app/public/');
      if (idx === -1) continue;
      return `/${sourcePath.slice(idx + 'app/public/'.length)}`;
    }
  }
  if (sourcePath.startsWith('app/public/')) {
    return `/${sourcePath.slice('app/public/'.length)}`;
  }
  return null;
}

async function main() {
  const config = getS3Config();
  if (!config && !dryRun) {
    throw new Error('S3_* env vars missing. Configure app/.env.local (see docs/ops/minio-win11.md).');
  }
  if (config) {
    console.log(`S3 bucket=${config.bucket} publicBaseUrl=${config.publicBaseUrl} keyEnv=${keyEnv}`);
  } else {
    console.log('Dry-run without S3 config');
  }

  await ensureContentTables();

  const resumeByHash = loadResumeMap(resumeMapPath);
  const dbByHash = dryRun ? new Map() : await loadDbHashIndex();

  let files = scanMediaFiles(defaultScanRoots(repoRoot));
  if (limit > 0) files = files.slice(0, limit);
  console.log(`Scanned ${files.length} media files (concurrency=${concurrency}, dryRun=${dryRun})`);

  // First pass: hash all files (I/O bound; still pooled)
  type Hashed = ScannedFile & { sha256: string };
  const hashed = await mapPool(files, concurrency, async (file) => {
    const sha256 = await sha256File(file.absPath);
    return { ...file, sha256 };
  });

  // Dedupe by hash: keep first sourcePath, note aliases
  const firstByHash = new Map<string, Hashed>();
  const aliases = new Map<string, string[]>();
  for (const file of hashed) {
    const existing = firstByHash.get(file.sha256);
    if (!existing) {
      firstByHash.set(file.sha256, file);
      aliases.set(file.sha256, []);
    } else {
      aliases.get(file.sha256)!.push(file.sourcePath);
    }
  }
  console.log(`Unique hashes: ${firstByHash.size} (dupes: ${hashed.length - firstByHash.size})`);

  const uniqueList = [...firstByHash.values()];
  const sourceTagByPath = new Map(hashed.map((f) => [f.sourcePath, f.sourceTag]));

  const batchResults = await mapPool(uniqueList, concurrency, async (file, index) => {
    const mediaId = mediaIdForHash(file.sha256);
    const resumed = resumeByHash.get(file.sha256);
    const fromDb = dbByHash.get(file.sha256);

    let objectKey = resumed?.objectKey || fromDb?.objectKeyHint || '';
    let publicUrl = resumed?.publicUrl || fromDb?.publicUrl || '';
    let skipped = false;
    let didUpload = false;

    if (objectKey && publicUrl) {
      skipped = true;
    } else {
      const keyEnvProcess = { ...process.env, APP_ENV: keyEnv };
      objectKey = buildObjectKey(file.filename, file.contentType, new Date(), keyEnvProcess);
      if (dryRun) {
        publicUrl = config
          ? publicUrlForKey(objectKey, config)
          : `https://example.invalid/${objectKey}`;
        skipped = true;
      } else {
        const body = readFileSync(file.absPath);
        const put = await putObject({
          objectKey,
          body,
          contentType: file.contentType,
        });
        publicUrl = put.publicUrl;
        didUpload = true;
      }
    }

    const primary: MediaMapEntry = {
      sourcePath: file.sourcePath,
      sourceTag: file.sourceTag,
      sha256: file.sha256,
      objectKey,
      publicUrl,
      mediaId: resumed?.mediaId || fromDb?.id || mediaId,
      contentType: file.contentType,
      mediaType: file.mediaType,
      bytes: file.bytes,
      skippedUpload: skipped,
      localPublicUrl: localPublicUrl(file.sourcePath),
    };

    const allSources = [file.sourcePath, ...(aliases.get(file.sha256) || [])];
    const mapEntries: MediaMapEntry[] = allSources.map((sourcePath) => ({
      ...primary,
      sourcePath,
      localPublicUrl: localPublicUrl(sourcePath),
      sourceTag: sourceTagByPath.get(sourcePath) || primary.sourceTag,
    }));

    if (!dryRun) {
      await upsertMediaRow(primary);
    }

    if ((index + 1) % 25 === 0 || index + 1 === uniqueList.length) {
      console.log(`Progress ${index + 1}/${uniqueList.length}`);
    }

    return { mapEntries, didUpload, skipped, upserted: dryRun ? 0 : 1 };
  });

  const entries = batchResults.flatMap((r) => r.mapEntries);
  const uploaded = batchResults.filter((r) => r.didUpload).length;
  const skippedUpload = batchResults.filter((r) => r.skipped).length;
  const upserted = batchResults.reduce((n, r) => n + r.upserted, 0);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outDir = outDirArg
    ? resolve(appDir, outDirArg)
    : resolve(repoRoot, 'data/content-backups', stamp);
  mkdirSync(outDir, { recursive: true });

  const mapFile: MediaMapFile = {
    version: 1,
    generatedAt: new Date().toISOString(),
    keyEnv,
    publicBaseUrl: config?.publicBaseUrl || '',
    bucket: config?.bucket || '',
    counts: {
      scanned: files.length,
      uniqueHashes: firstByHash.size,
      uploaded,
      skippedUpload,
      upserted,
    },
    entries,
  };

  const mapPath = resolve(outDir, 'media-map.json');
  writeFileSync(mapPath, `${JSON.stringify(mapFile, null, 2)}\n`, 'utf-8');
  console.log(`Wrote ${mapPath}`);
  console.log(
    `Done: scanned=${files.length} unique=${firstByHash.size} uploaded=${uploaded} skippedUpload=${skippedUpload} upserted=${upserted} dryRun=${dryRun}`,
  );

  await sql.end();
}

const isMain =
  Boolean(process.argv[1]) &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMain) {
  main().catch(async (err) => {
    console.error(err);
    try {
      await sql.end();
    } catch {
      // ignore
    }
    process.exit(1);
  });
}
