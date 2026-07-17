import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;

try {
  ({ chromium } = require('playwright'));
} catch (error) {
  throw new Error(
    [
      'Playwright is not resolvable from this Node process.',
      'Install it locally or set NODE_PATH to a node_modules directory that contains playwright.',
      `Original error: ${error instanceof Error ? error.message : String(error)}`,
    ].join(' '),
  );
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');
const configPath = path.join(repoRoot, 'data/pipeline.config.json');

const args = parseArgs(process.argv.slice(2));
const intakePath = args.intake ?? '路线_新';
const limit = args.limit ? Number(args.limit) : null;
const timeoutMs = args.timeout ? Number(args.timeout) : 45000;

const config = JSON.parse(await readFile(configPath, 'utf8'));
const outputRoot = path.join(repoRoot, config.structuredData.extractedDir, 'webpages');
const reportPath = path.join(repoRoot, config.structuredData.reportsDir, 'playwright-url-extraction-report.json');
const inputRoot = path.resolve(repoRoot, intakePath);

if (!existsSync(inputRoot)) {
  throw new Error(`Raw intake folder does not exist: ${normalizePath(path.relative(repoRoot, inputRoot))}`);
}

const urlFiles = [];

for await (const filePath of walkFiles(inputRoot)) {
  if (path.extname(filePath).toLowerCase() === '.url') {
    urlFiles.push(filePath);
  }
}

urlFiles.sort((a, b) => normalizePath(a).localeCompare(normalizePath(b), 'zh-Hans-CN'));

const selectedFiles = limit ? urlFiles.slice(0, limit) : urlFiles;
const results = [];

await mkdir(outputRoot, { recursive: true });
await mkdir(path.dirname(reportPath), { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
});

for (const filePath of selectedFiles) {
  const relativePath = normalizePath(path.relative(repoRoot, filePath));
  const rawFileId = makeRawId(relativePath);
  const sourceUrl = await readInternetShortcutUrl(filePath);
  const perUrlOutputDir = path.join(outputRoot, rawFileId);
  const result = {
    rawFileId,
    sourcePath: relativePath,
    sourceUrl,
    finalUrl: null,
    title: null,
    status: 'pending',
    outputDir: normalizePath(path.relative(repoRoot, perUrlOutputDir)),
    downloadedPath: null,
    extractedAt: null,
    textLength: 0,
    linkCount: 0,
    warnings: [],
  };

  await mkdir(perUrlOutputDir, { recursive: true });

  if (!sourceUrl) {
    result.status = 'failed';
    result.warnings.push('No URL= entry found in .url file.');
    result.extractedAt = new Date().toISOString();
    results.push(result);
    continue;
  }

  const page = await context.newPage();

  try {
    const downloadPromise = page.waitForEvent('download', { timeout: timeoutMs }).catch(() => null);

    try {
      await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
      await page.waitForLoadState('networkidle', { timeout: timeoutMs }).catch(() => {});
    } catch (error) {
      const download = await downloadPromise;
      if (!download) throw error;

      const suggestedName = download.suggestedFilename() || `${rawFileId}.html`;
      const downloadedPath = path.join(perUrlOutputDir, sanitizeFileName(suggestedName));
      await download.saveAs(downloadedPath);
      result.downloadedPath = normalizePath(path.relative(repoRoot, downloadedPath));

      const downloadedContent = await readFile(downloadedPath, 'utf8').catch(() => '');
      if (!downloadedContent.trim()) throw error;

      await page.setContent(downloadedContent, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    }

    const pageData = await extractVisiblePageData(page, sourceUrl);

    result.finalUrl = pageData.url;
    result.title = pageData.title;
    result.status = pageData.text ? 'extracted' : 'failed';
    result.textLength = pageData.text.length;
    result.linkCount = pageData.links.length;
    result.extractedAt = new Date().toISOString();

    if (!pageData.text) {
      result.warnings.push('Page loaded but no visible text was extracted.');
    }

    await writeFile(
      path.join(perUrlOutputDir, 'page.json'),
      JSON.stringify(
        {
          rawFileId,
          sourcePath: relativePath,
          sourceUrl,
          finalUrl: pageData.url,
          title: pageData.title,
          downloadedPath: result.downloadedPath,
          extractedAt: result.extractedAt,
          text: pageData.text,
          links: pageData.links,
        },
        null,
        2,
      ),
      'utf8',
    );

    await writeFile(
      path.join(perUrlOutputDir, 'page.md'),
      [`# ${pageData.title || sourceUrl}`, '', `Source URL: ${sourceUrl}`, `Final URL: ${pageData.url}`, '', pageData.text].join('\n'),
      'utf8',
    );
  } catch (error) {
    result.status = 'failed';
    result.extractedAt = new Date().toISOString();
    result.warnings.push(error instanceof Error ? error.message : String(error));
  } finally {
    await page.close().catch(() => {});
  }

  await writeFile(
    path.join(perUrlOutputDir, 'source-trace.json'),
    JSON.stringify(
      {
        rawFileId,
        sourcePath: relativePath,
        sourceUrl,
        finalUrl: result.finalUrl,
        downloadedPath: result.downloadedPath,
        extractedAt: result.extractedAt,
        extractor: 'Playwright',
        status: result.status,
        warnings: result.warnings,
      },
      null,
      2,
    ),
    'utf8',
  );

  results.push(result);
  console.log(`${result.status}: ${relativePath}`);
}

await browser.close();

await writeFile(
  reportPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      intakePath: normalizePath(path.relative(repoRoot, inputRoot)),
      extractor: 'Playwright',
      totalUrlFiles: urlFiles.length,
      attemptedFiles: selectedFiles.length,
      extractedCount: results.filter((item) => item.status === 'extracted').length,
      failedCount: results.filter((item) => item.status === 'failed').length,
      results,
    },
    null,
    2,
  ),
  'utf8',
);

console.log(`Wrote Playwright URL report to ${normalizePath(path.relative(repoRoot, reportPath))}`);

async function readInternetShortcutUrl(filePath) {
  const content = await readFile(filePath, 'utf8').catch(async () => readFile(filePath, 'latin1'));
  const line = content
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find((item) => item.toLowerCase().startsWith('url='));

  return line ? line.slice(4).trim() : null;
}

async function extractVisiblePageData(page, fallbackUrl) {
  return page.evaluate((providedFallbackUrl) => {
    const blockedTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'CANVAS']);
    const walker = document.createTreeWalker(document.body ?? document.documentElement, NodeFilter.SHOW_TEXT);
    const chunks = [];

    while (walker.nextNode()) {
      const node = walker.currentNode;
      const parent = node.parentElement;
      if (!parent || blockedTags.has(parent.tagName)) continue;

      const text = node.textContent?.replace(/\s+/g, ' ').trim();
      if (text) chunks.push(text);
    }

    const links = Array.from(document.querySelectorAll('a[href]')).map((anchor) => ({
      text: anchor.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      href: anchor.href,
    }));

    return {
      title: document.title,
      url: location.href === 'about:blank' ? providedFallbackUrl : location.href,
      text: chunks.join('\n'),
      links,
    };
  }, fallbackUrl);
}

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

function makeRawId(value) {
  return `raw_${createHash('sha1').update(normalizePath(value)).digest('hex').slice(0, 16)}`;
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

function sanitizeFileName(value) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 160);
}

function normalizePath(value) {
  return value.split(path.sep).join('/');
}
