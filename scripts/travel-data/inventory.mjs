import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');
const configPath = path.join(repoRoot, 'data/pipeline.config.json');

const config = JSON.parse(await readFile(configPath, 'utf8'));
const outputDir = path.join(repoRoot, config.structuredData.inventoryDir);
const outputPath = path.join(outputDir, 'raw-files.json');

const excludedAbsolutePaths = new Set(
  (config.excludedFolders ?? []).map((folder) => path.resolve(repoRoot, folder)),
);

const documentExtensions = new Set(['.doc', '.docx', '.pdf']);
const webpageExtensions = new Set(['.html', '.htm']);
const urlExtensions = new Set(['.url']);
const spreadsheetExtensions = new Set(['.xls', '.xlsx', '.csv']);
const imageExtensions = new Set(config.mediaExtraction?.imageExtensions ?? []);
const videoExtensions = new Set(config.mediaExtraction?.videoExtensions ?? []);

const inventory = [];

for (const entry of config.rawIntakeFolders ?? []) {
  if (!entry.enabled) continue;

  const absoluteFolder = path.resolve(repoRoot, entry.path);

  if (isExcluded(absoluteFolder)) continue;

  try {
    const folderStat = await stat(absoluteFolder);
    if (!folderStat.isDirectory()) continue;
  } catch {
    inventory.push({
      id: makeRawId(entry.path),
      path: normalizePath(entry.path),
      extension: '',
      kind: 'unknown',
      sizeBytes: 0,
      sha256: null,
      modifiedAt: null,
      intakeFolder: normalizePath(entry.path),
      regionHint: null,
      languageHint: 'unknown',
      processingStatus: 'failed',
      warnings: ['Configured raw intake folder does not exist.'],
    });
    continue;
  }

  for await (const filePath of walkFiles(absoluteFolder)) {
    const relativePath = normalizePath(path.relative(repoRoot, filePath));
    const extension = path.extname(filePath).toLowerCase();
    const fileStat = await stat(filePath);
    const sha256 = await hashFile(filePath);
    const pathWithinIntake = normalizePath(path.relative(absoluteFolder, filePath));

    inventory.push({
      id: makeRawId(relativePath),
      path: relativePath,
      extension,
      kind: classifyKind(extension),
      sizeBytes: fileStat.size,
      sha256,
      modifiedAt: fileStat.mtime.toISOString(),
      intakeFolder: normalizePath(entry.path),
      regionHint: getRegionHint(pathWithinIntake),
      languageHint: guessLanguageHint(relativePath),
      processingStatus: 'pending',
      warnings: getWarnings(extension, fileStat.size),
    });
  }
}

inventory.sort((a, b) => a.path.localeCompare(b.path, 'zh-Hans-CN'));

await mkdir(outputDir, { recursive: true });
await writeFile(
  outputPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      count: inventory.length,
      files: inventory,
    },
    null,
    2,
  ),
  'utf8',
);

console.log(`Wrote ${inventory.length} raw file records to ${normalizePath(path.relative(repoRoot, outputPath))}`);

async function* walkFiles(folder) {
  if (isExcluded(folder)) return;

  const { readdir } = await import('node:fs/promises');
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

function isExcluded(absolutePath) {
  const resolved = path.resolve(absolutePath);

  for (const excludedPath of excludedAbsolutePaths) {
    if (resolved === excludedPath || resolved.startsWith(`${excludedPath}${path.sep}`)) {
      return true;
    }
  }

  return false;
}

function classifyKind(extension) {
  if (documentExtensions.has(extension)) return 'document';
  if (webpageExtensions.has(extension)) return 'webpage';
  if (urlExtensions.has(extension)) return 'url';
  if (spreadsheetExtensions.has(extension)) return 'spreadsheet';
  if (imageExtensions.has(extension)) return 'media';
  if (videoExtensions.has(extension)) return 'media';
  return 'unknown';
}

function getWarnings(extension, sizeBytes) {
  const warnings = [];

  if (classifyKind(extension) === 'unknown') {
    warnings.push('Unsupported extension for first-pass extraction.');
  }

  if (sizeBytes === 0) {
    warnings.push('File is empty.');
  }

  return warnings;
}

function getRegionHint(pathWithinIntake) {
  const firstSegment = pathWithinIntake.split('/')[0];
  return firstSegment && firstSegment !== pathWithinIntake ? firstSegment : null;
}

function guessLanguageHint(value) {
  const hasCjk = /[\u3400-\u9fff]/u.test(value);
  const hasLatinWord = /[A-Za-z]{3,}/.test(value);

  if (hasCjk && hasLatinWord) return 'mixed';
  if (hasCjk) return 'zh';
  if (hasLatinWord) return 'en';
  return 'unknown';
}

function makeRawId(value) {
  return `raw_${createHash('sha1').update(normalizePath(value)).digest('hex').slice(0, 16)}`;
}

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);

    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

function normalizePath(value) {
  return value.split(path.sep).join('/');
}

