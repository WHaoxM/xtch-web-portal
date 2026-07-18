/**
 * Import a content+MinIO backup pack into an isolated target env.
 *
 * Typical production isolation import:
 *   npx tsx scripts/import-content-backup.ts \
 *     --env=win11-home \
 *     --dir=D:/XTCH_PROJECT/db/xtch-content-minio-backup-2026-07-17/2026-07-17T22-30-35 \
 *     --rewrite-key-env=prod \
 *     --upload-objects
 *
 * See docs/ops/shared/content-backup.md
 */
import { createReadStream, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ensureContentTables } from '../api/lib/contentSchema';
import { sql } from '../api/lib/db';
import { getS3Config, publicUrlForKey } from '../api/lib/s3';
import {
  loadTargetEnv,
  normalizeTarget,
  repoRoot,
  targetEnvExampleHint,
} from '../../scripts/env/targetEnv';

type Manifest = {
  version: number;
  generatedAt: string;
  appEnv?: string;
  keyPrefix?: string;
  publicBaseUrl?: string;
  bucket?: string;
  counts?: Record<string, number>;
};

type CliOptions = {
  envName: string;
  dir: string;
  publicBaseUrl?: string;
  rewriteKeyEnv: string;
  uploadObjects: boolean;
  dryRun: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  let envName = 'selfhost';
  let dir = '';
  let publicBaseUrl: string | undefined;
  let rewriteKeyEnv = 'prod';
  let uploadObjects = false;
  let dryRun = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--env' && next) {
      envName = next;
      i += 1;
      continue;
    }
    if (arg.startsWith('--env=')) {
      envName = arg.slice('--env='.length);
      continue;
    }
    if (arg === '--dir' && next) {
      dir = next;
      i += 1;
      continue;
    }
    if (arg.startsWith('--dir=')) {
      dir = arg.slice('--dir='.length);
      continue;
    }
    if (arg === '--public-base-url' && next) {
      publicBaseUrl = next;
      i += 1;
      continue;
    }
    if (arg.startsWith('--public-base-url=')) {
      publicBaseUrl = arg.slice('--public-base-url='.length);
      continue;
    }
    if (arg === '--rewrite-key-env' && next) {
      rewriteKeyEnv = next;
      i += 1;
      continue;
    }
    if (arg.startsWith('--rewrite-key-env=')) {
      rewriteKeyEnv = arg.slice('--rewrite-key-env='.length);
      continue;
    }
    if (arg === '--upload-objects') {
      uploadObjects = true;
      continue;
    }
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
  }

  if (!dir) {
    throw new Error('Missing --dir=<backup-pack-path>');
  }

  return { envName, dir, publicBaseUrl, rewriteKeyEnv, uploadObjects, dryRun };
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf-8')) as T;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}

function rewriteObjectKey(key: string, fromEnv: string, toEnv: string): string {
  const prefix = `${fromEnv}/`;
  if (key.startsWith(prefix)) return `${toEnv}/${key.slice(prefix.length)}`;
  if (key.startsWith(`${toEnv}/`)) return key;
  return key;
}

function extractObjectKeyFromUrl(url: string, fromBucket?: string): string | null {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.replace(/^\/+/, '').split('/').map((p) => decodeURIComponent(p));
    if (parts.length < 2) return null;

    if (parts[0] === 's3' && parts.length >= 3) {
      return parts.slice(2).join('/');
    }
    if (fromBucket && parts[0] === fromBucket) {
      return parts.slice(1).join('/');
    }
    // path-style /bucket/key… — treat first segment as bucket when it looks like xtch-*
    if (parts[0]?.startsWith('xtch-')) {
      return parts.slice(1).join('/');
    }
    return parts.join('/');
  } catch {
    return null;
  }
}

function rewritePublicUrl(
  url: string,
  opts: {
    toPublicBaseUrl: string;
    fromKeyEnv: string;
    toKeyEnv: string;
    fromBucket?: string;
  },
): string {
  if (!url || !/^https?:\/\//i.test(url)) return url;
  const key = extractObjectKeyFromUrl(url, opts.fromBucket);
  if (!key) return url;
  const nextKey = rewriteObjectKey(key, opts.fromKeyEnv, opts.toKeyEnv);
  return publicUrlForKey(nextKey, {
    endpoint: '',
    accessKeyId: '',
    secretAccessKey: '',
    bucket: '',
    region: 'us-east-1',
    publicBaseUrl: opts.toPublicBaseUrl.replace(/\/$/, ''),
  });
}

function guessContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.svg':
      return 'image/svg+xml';
    case '.mp4':
      return 'video/mp4';
    case '.webm':
      return 'video/webm';
    case '.pdf':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
}

function walkFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkFiles(full, out);
    else out.push(full);
  }
  return out;
}

async function importDestinations(
  rows: Record<string, unknown>[],
  rewrite: (url: string) => string,
  dryRun: boolean,
) {
  for (const row of rows) {
    const image = rewrite(String(row.image || ''));
    if (dryRun) continue;
    await sql`
      INSERT INTO destinations (
        slug, name, description, image, display_order, status,
        travel_styles, featured_on_home, featured_priority
      ) VALUES (
        ${String(row.slug)}, ${String(row.name)}, ${row.description ? String(row.description) : null},
        ${image || null}, ${Number(row.display_order ?? 0)}, ${String(row.status || 'published')},
        ${asStringArray(row.travel_styles)}, ${Boolean(row.featured_on_home)},
        ${Number(row.featured_priority ?? 0)}
      )
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        image = EXCLUDED.image,
        display_order = EXCLUDED.display_order,
        status = EXCLUDED.status,
        travel_styles = EXCLUDED.travel_styles,
        featured_on_home = EXCLUDED.featured_on_home,
        featured_priority = EXCLUDED.featured_priority,
        updated_at = NOW()
    `;
  }
}

async function importRoutes(
  rows: Record<string, unknown>[],
  rewrite: (url: string) => string,
  dryRun: boolean,
) {
  for (const row of rows) {
    const heroImage = rewrite(String(row.hero_image || ''));
    const pdfUrl = row.pdf_url ? rewrite(String(row.pdf_url)) : null;
    if (dryRun) continue;
    await sql`
      INSERT INTO routes (
        slug, legacy_numeric_id, title, subtitle, summary, duration_days,
        group_size_display, category, themes, status, featured, hero_image,
        pdf_url, price_mode, price_display, primary_type, available_types,
        experience, moments, included_support
      ) VALUES (
        ${String(row.slug)},
        ${row.legacy_numeric_id == null ? null : Number(row.legacy_numeric_id)},
        ${String(row.title)},
        ${row.subtitle ? String(row.subtitle) : null},
        ${String(row.summary || '')},
        ${Number(row.duration_days ?? 0)},
        ${row.group_size_display ? String(row.group_size_display) : null},
        ${row.category ? String(row.category) : null},
        ${asStringArray(row.themes)},
        ${String(row.status || 'published')},
        ${Boolean(row.featured)},
        ${heroImage || null},
        ${pdfUrl},
        ${String(row.price_mode || 'on-request')},
        ${String(row.price_display || 'On request')},
        ${String(row.primary_type || 'customizable')},
        ${asStringArray(row.available_types)},
        ${asStringArray(row.experience)},
        ${asStringArray(row.moments)},
        ${asStringArray(row.included_support)}
      )
      ON CONFLICT (slug) DO UPDATE SET
        legacy_numeric_id = EXCLUDED.legacy_numeric_id,
        title = EXCLUDED.title,
        subtitle = EXCLUDED.subtitle,
        summary = EXCLUDED.summary,
        duration_days = EXCLUDED.duration_days,
        group_size_display = EXCLUDED.group_size_display,
        category = EXCLUDED.category,
        themes = EXCLUDED.themes,
        status = EXCLUDED.status,
        featured = EXCLUDED.featured,
        hero_image = EXCLUDED.hero_image,
        pdf_url = EXCLUDED.pdf_url,
        price_mode = EXCLUDED.price_mode,
        price_display = EXCLUDED.price_display,
        primary_type = EXCLUDED.primary_type,
        available_types = EXCLUDED.available_types,
        experience = EXCLUDED.experience,
        moments = EXCLUDED.moments,
        included_support = EXCLUDED.included_support,
        updated_at = NOW()
    `;
  }
}

async function importRouteDestinations(rows: Record<string, unknown>[], dryRun: boolean) {
  if (dryRun) return;
  await sql`DELETE FROM route_destinations`;
  for (const row of rows) {
    await sql`
      INSERT INTO route_destinations (route_slug, destination_slug)
      VALUES (${String(row.route_slug)}, ${String(row.destination_slug)})
      ON CONFLICT DO NOTHING
    `;
  }
}

async function importItineraryDays(rows: Record<string, unknown>[], dryRun: boolean) {
  if (dryRun) return;
  await sql`DELETE FROM route_itinerary_days`;
  for (const row of rows) {
    await sql`
      INSERT INTO route_itinerary_days (
        id, route_slug, day_number, title, city, summary,
        attractions, meals, accommodation, transport, notes
      ) VALUES (
        ${String(row.id)},
        ${String(row.route_slug)},
        ${Number(row.day_number)},
        ${row.title ? String(row.title) : null},
        ${row.city ? String(row.city) : null},
        ${row.summary ? String(row.summary) : null},
        ${asStringArray(row.attractions)},
        ${row.meals ? String(row.meals) : null},
        ${row.accommodation ? String(row.accommodation) : null},
        ${row.transport ? String(row.transport) : null},
        ${asStringArray(row.notes)}
      )
      ON CONFLICT (id) DO UPDATE SET
        route_slug = EXCLUDED.route_slug,
        day_number = EXCLUDED.day_number,
        title = EXCLUDED.title,
        city = EXCLUDED.city,
        summary = EXCLUDED.summary,
        attractions = EXCLUDED.attractions,
        meals = EXCLUDED.meals,
        accommodation = EXCLUDED.accommodation,
        transport = EXCLUDED.transport,
        notes = EXCLUDED.notes
    `;
  }
}

async function importCategories(rows: Record<string, unknown>[], dryRun: boolean) {
  for (const row of rows) {
    if (dryRun) continue;
    await sql`
      INSERT INTO categories (id, key, label, scope, sort_order, enabled)
      VALUES (
        ${String(row.id)},
        ${String(row.key)},
        ${String(row.label)},
        ${String(row.scope)},
        ${Number(row.sort_order ?? 0)},
        ${row.enabled !== false}
      )
      ON CONFLICT (id) DO UPDATE SET
        key = EXCLUDED.key,
        label = EXCLUDED.label,
        scope = EXCLUDED.scope,
        sort_order = EXCLUDED.sort_order,
        enabled = EXCLUDED.enabled,
        updated_at = NOW()
    `;
  }
}

async function importMedia(
  rows: Record<string, unknown>[],
  rewrite: (url: string) => string,
  dryRun: boolean,
) {
  for (const row of rows) {
    const publicUrl = rewrite(String(row.public_url || ''));
    if (dryRun) continue;
    await sql`
      INSERT INTO media_assets (
        id, status, type, public_url, original_path, title, alt_text,
        destination_slugs, route_slugs, usage, orientation, tags,
        rights_status, internal_source_trace
      ) VALUES (
        ${String(row.id)},
        ${String(row.status || 'published')},
        ${String(row.type || 'image')},
        ${publicUrl},
        ${row.original_path ? String(row.original_path) : null},
        ${String(row.title || row.id)},
        ${row.alt_text ? String(row.alt_text) : null},
        ${asStringArray(row.destination_slugs)},
        ${asStringArray(row.route_slugs)},
        ${asStringArray(row.usage)},
        ${row.orientation ? String(row.orientation) : null},
        ${asStringArray(row.tags)},
        ${String(row.rights_status || 'unknown')},
        ${row.internal_source_trace ? String(row.internal_source_trace) : null}
      )
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        type = EXCLUDED.type,
        public_url = EXCLUDED.public_url,
        original_path = EXCLUDED.original_path,
        title = EXCLUDED.title,
        alt_text = EXCLUDED.alt_text,
        destination_slugs = EXCLUDED.destination_slugs,
        route_slugs = EXCLUDED.route_slugs,
        usage = EXCLUDED.usage,
        orientation = EXCLUDED.orientation,
        tags = EXCLUDED.tags,
        rights_status = EXCLUDED.rights_status,
        internal_source_trace = EXCLUDED.internal_source_trace,
        updated_at = NOW()
    `;
  }
}

async function uploadBackupObjects(opts: {
  objectsDir: string;
  fromKeyEnv: string;
  toKeyEnv: string;
  dryRun: boolean;
}) {
  const s3 = getS3Config();
  if (!s3) {
    throw new Error('S3 is not configured in the target env (need S3_*).');
  }

  const client = new S3Client({
    endpoint: s3.endpoint,
    region: s3.region,
    credentials: {
      accessKeyId: s3.accessKeyId,
      secretAccessKey: s3.secretAccessKey,
    },
    forcePathStyle: true,
  });

  const files = walkFiles(opts.objectsDir);
  let uploaded = 0;
  let skipped = 0;

  for (const filePath of files) {
    const rel = path.relative(opts.objectsDir, filePath).split(path.sep).join('/');
    const objectKey = rewriteObjectKey(rel, opts.fromKeyEnv, opts.toKeyEnv);
    if (opts.dryRun) {
      skipped += 1;
      continue;
    }
    await client.send(
      new PutObjectCommand({
        Bucket: s3.bucket,
        Key: objectKey,
        Body: createReadStream(filePath),
        ContentType: guessContentType(filePath),
      }),
    );
    uploaded += 1;
    if (uploaded % 50 === 0) {
      console.log(`  uploaded ${uploaded}/${files.length}…`);
    }
  }

  return { total: files.length, uploaded, skipped };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const target = normalizeTarget(options.envName);
  const loaded = loadTargetEnv(target, { override: true });
  if (!loaded) {
    throw new Error(`Missing env for ${target}. ${targetEnvExampleHint(target)}`);
  }

  const backupDir = path.resolve(options.dir);
  const manifestPath = path.join(backupDir, 'manifest.json');
  if (!existsSync(manifestPath)) {
    throw new Error(`manifest.json not found in ${backupDir}`);
  }

  const manifest = readJsonFile<Manifest>(manifestPath);
  const fromKeyEnv = (manifest.appEnv || manifest.keyPrefix?.replace(/\/$/, '') || 'dev').replace(
    /\/$/,
    '',
  );
  const toKeyEnv = options.rewriteKeyEnv.replace(/\/$/, '');
  const toPublicBaseUrl = (
    options.publicBaseUrl ||
    process.env.S3_PUBLIC_BASE_URL ||
    ''
  ).replace(/\/$/, '');

  if (!toPublicBaseUrl) {
    throw new Error('Missing target public base URL (--public-base-url or S3_PUBLIC_BASE_URL).');
  }
  if (!process.env.POSTGRES_URL) {
    throw new Error(`POSTGRES_URL missing after loading ${envFile}`);
  }

  const rewrite = (url: string) =>
    rewritePublicUrl(url, {
      toPublicBaseUrl,
      fromKeyEnv,
      toKeyEnv,
      fromBucket: manifest.bucket,
    });

  console.log('Import content backup');
  console.log(`  backup: ${backupDir}`);
  console.log(`  env file: ${envFile}`);
  console.log(`  POSTGRES_URL target: ${process.env.POSTGRES_URL}`);
  console.log(`  S3_BUCKET: ${process.env.S3_BUCKET || '(unset)'}`);
  console.log(`  public base: ${toPublicBaseUrl}`);
  console.log(`  key rewrite: ${fromKeyEnv}/ → ${toKeyEnv}/`);
  console.log(`  upload objects: ${options.uploadObjects}`);
  console.log(`  dry run: ${options.dryRun}`);

  if (!options.dryRun) {
    await ensureContentTables();
  }

  const tablesDir = path.join(backupDir, 'tables');
  const destinations = readJsonFile<Record<string, unknown>[]>(path.join(tablesDir, 'destinations.json'));
  const routes = readJsonFile<Record<string, unknown>[]>(path.join(tablesDir, 'routes.json'));
  const routeDestinations = readJsonFile<Record<string, unknown>[]>(
    path.join(tablesDir, 'route_destinations.json'),
  );
  const itineraryDays = readJsonFile<Record<string, unknown>[]>(
    path.join(tablesDir, 'route_itinerary_days.json'),
  );
  const categories = readJsonFile<Record<string, unknown>[]>(path.join(tablesDir, 'categories.json'));
  const media = readJsonFile<Record<string, unknown>[]>(path.join(tablesDir, 'media_assets.json'));

  console.log('Importing destinations…');
  await importDestinations(destinations, rewrite, options.dryRun);
  console.log(`  ${destinations.length} destinations`);

  console.log('Importing routes…');
  await importRoutes(routes, rewrite, options.dryRun);
  console.log(`  ${routes.length} routes`);

  console.log('Importing route_destinations…');
  await importRouteDestinations(routeDestinations, options.dryRun);
  console.log(`  ${routeDestinations.length} links`);

  console.log('Importing route_itinerary_days…');
  await importItineraryDays(itineraryDays, options.dryRun);
  console.log(`  ${itineraryDays.length} days`);

  console.log('Importing categories…');
  await importCategories(categories, options.dryRun);
  console.log(`  ${categories.length} categories`);

  console.log('Importing media_assets…');
  await importMedia(media, rewrite, options.dryRun);
  console.log(`  ${media.length} media`);

  if (options.uploadObjects) {
    const objectsDir = path.join(backupDir, 'minio', 'objects');
    console.log(`Uploading objects from ${objectsDir}…`);
    const result = await uploadBackupObjects({
      objectsDir,
      fromKeyEnv,
      toKeyEnv,
      dryRun: options.dryRun,
    });
    console.log(
      `  objects total=${result.total} uploaded=${result.uploaded} drySkipped=${result.skipped}`,
    );
  }

  console.log('Done.');
  console.log(`Repo root (for reference): ${repoRoot}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
