import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');

const args = parseArgs(process.argv.slice(2));
const intakePath = args.intake ?? '路线_新';
const inputRoot = path.resolve(repoRoot, intakePath);
const outputPath = path.join(repoRoot, 'data/drafts/media-assets/media-assets.from-route-new.json');

const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.svg', '.jpg!nc_n_webp_mw_1']);
const videoExtensions = new Set(['.mp4', '.mov', '.webm']);

if (!existsSync(inputRoot)) {
  throw new Error(`Raw intake folder does not exist: ${normalizePath(path.relative(repoRoot, inputRoot))}`);
}

const assets = [];

for await (const filePath of walkFiles(inputRoot)) {
  const extension = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath).toLowerCase();
  const kind = imageExtensions.has(extension) || fileName.endsWith('.jpg!nc_n_webp_mw_1') ? 'image' : videoExtensions.has(extension) ? 'video' : null;

  if (!kind) continue;

  const relativePath = normalizePath(path.relative(repoRoot, filePath));
  const pathWithinIntake = normalizePath(path.relative(inputRoot, filePath));
  const segments = pathWithinIntake.split('/');
  const destinationName = segments[0] ?? null;
  const collectionPath = segments.slice(0, -1).join('/');
  const stats = await stat(filePath);
  const id = `media_${createHash('sha1').update(relativePath).digest('hex').slice(0, 16)}`;

  assets.push({
    id,
    status: 'review',
    type: kind,
    title: path.basename(filePath, path.extname(filePath)),
    destinationName,
    destinationSlug: slugifyDestination(destinationName),
    collectionPath,
    originalPath: relativePath,
    sizeBytes: stats.size,
    modifiedAt: stats.mtime.toISOString(),
    suggestedPublicPath: makeSuggestedPublicPath(kind, destinationName, filePath),
    routeProductIds: [],
    usageCandidates: inferUsageCandidates(pathWithinIntake, kind),
    rightsStatus: 'unknown',
    internalSourceTrace: relativePath,
    warnings: ['Draft media record only. Human review must confirm rights, intended usage, and whether the asset should be copied to app/public.'],
  });
}

assets.sort((a, b) => a.originalPath.localeCompare(b.originalPath, 'zh-Hans-CN'));

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      intakePath: normalizePath(path.relative(repoRoot, inputRoot)),
      count: assets.length,
      assets,
    },
    null,
    2,
  ),
  'utf8',
);

console.log(`Wrote ${assets.length} draft media records to ${normalizePath(path.relative(repoRoot, outputPath))}`);

async function* walkFiles(folder) {
  const entries = await readdir(folder, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(folder, entry.name);

    if (entry.isDirectory()) {
      yield* walkFiles(entryPath);
      continue;
    }

    if (entry.isFile()) {
      yield entryPath;
    }
  }
}

function inferUsageCandidates(pathWithinIntake, kind) {
  const normalized = pathWithinIntake.toLowerCase();
  const usage = new Set();

  if (normalized.includes('特色') || normalized.includes('体验')) usage.add('experience');
  if (normalized.includes('客拍') || normalized.includes('旅拍')) usage.add('route-gallery');
  if (normalized.includes('图片') || normalized.includes('照片')) usage.add('destination-hero');
  if (kind === 'video') usage.add('experience');
  if (usage.size === 0) usage.add('route-gallery');

  return Array.from(usage);
}

function makeSuggestedPublicPath(kind, destinationName, filePath) {
  const root = kind === 'image' ? '/images/routes' : '/videos/routes';
  const destinationSlug = slugifyDestination(destinationName) ?? 'unknown';
  const ext = path.extname(filePath).toLowerCase().replace('!nc_n_webp_mw_1', '') || (kind === 'image' ? '.jpg' : '.mp4');
  const base = slugifyText(path.basename(filePath, path.extname(filePath))) || 'asset';

  return `${root}/${destinationSlug}/${destinationSlug}-${base}${ext}`;
}

function slugifyDestination(value) {
  const map = {
    上海: 'shanghai',
    云南: 'yunnan',
    北京: 'beijing',
    广西: 'guangxi',
    '成都-川西': 'chengdu-western-sichuan',
    新疆: 'xinjiang',
    西安: 'xian',
    '西藏-川藏': 'tibet-sichuan-tibet',
    询价路线: 'inquiry-routes',
    重庆: 'chongqing',
    青甘: 'qinghai-gansu',
  };

  return map[value] ?? slugifyText(value);
}

function slugifyText(value) {
  if (!value) return null;

  const ascii = value
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, ' ')
    .trim()
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();

  return ascii || createHash('sha1').update(value).digest('hex').slice(0, 8);
}

function parseArgs(values) {
  const parsed = {};

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith('--')) continue;

    const key = value.slice(2);
    const next = values[index + 1];

    if (!next || next.startsWith('--')) {
      parsed[key] = true;
      continue;
    }

    parsed[key] = next;
    index += 1;
  }

  return parsed;
}

function normalizePath(value) {
  return value.split(path.sep).join('/');
}
