import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');

const args = parseArgs(process.argv.slice(2));
const maxChars = args.maxChars ? Number(args.maxChars) : 24000;
const outputPath = path.join(repoRoot, 'data/drafts/model-extraction/model-extraction-queue.jsonl');
const promptPath = path.join(repoRoot, 'data/drafts/model-extraction/model-extraction-system-prompt.md');

const sourceRoots = [
  path.join(repoRoot, 'data/extracted/mineru'),
  path.join(repoRoot, 'data/extracted/webpages'),
];

const items = [];

for (const root of sourceRoots) {
  if (!existsSync(root)) continue;

  for await (const filePath of walkFiles(root)) {
    const fileName = path.basename(filePath).toLowerCase();
    if (path.extname(filePath).toLowerCase() !== '.md') continue;
    if (fileName === 'source-trace.json') continue;

    const content = await readFile(filePath, 'utf8').catch(() => '');
    const normalizedContent = extractContent(filePath, content);
    if (!normalizedContent.trim()) continue;

    const sourceTracePath = await findNearestSourceTrace(path.dirname(filePath));
    const sourceTrace = sourceTracePath ? JSON.parse(await readFile(sourceTracePath, 'utf8')) : null;
    const relativePath = normalizePath(path.relative(repoRoot, filePath));
    const id = `model_input_${createHash('sha1').update(relativePath).digest('hex').slice(0, 16)}`;

    items.push({
      id,
      sourceKind: relativePath.includes('/webpages/') ? 'webpage' : 'document',
      extractedPath: relativePath,
      rawFileId: sourceTrace?.rawFileId ?? null,
      sourcePath: sourceTrace?.sourcePath ?? null,
      sourceUrl: sourceTrace?.sourceUrl ?? null,
      finalUrl: sourceTrace?.finalUrl ?? null,
      task: 'extract_travel_route_experience_promotion_triples',
      schemaVersion: 1,
      instructions: [
        'Use the provided extracted text as evidence. Do not invent route facts, prices, reviews, awards, guarantees, or service promises.',
        'Classify content into route, promotion, feature_experience, price_support, media_context, or unclear.',
        'Extract all explicit destinations, routes, attractions, experiences, inclusions, exclusions, timing, group type, pricing conditions, and warnings.',
        'Return English customer-facing drafts only when the source supports the facts. Keep original Chinese names in sourceFacts when useful.',
        'Every extracted fact must include an evidence quote or short evidence note from the supplied text.',
      ],
      expectedOutputShape: {
        contentType: 'route | promotion | feature_experience | price_support | media_context | unclear',
        routeProductDraft: 'Route product JSON draft when evidence supports it, otherwise null',
        triples: [{ subject: 'string', predicate: 'string', object: 'string', evidence: 'string' }],
        experiences: [{ destination: 'string', name: 'string', description: 'string', evidence: 'string' }],
        promotions: [{ title: 'string', claim: 'string', evidence: 'string' }],
        unresolvedQuestions: ['string'],
        confidence: 'high | medium | low',
      },
      text: normalizedContent.slice(0, maxChars),
      truncated: normalizedContent.length > maxChars,
      originalCharCount: normalizedContent.length,
    });
  }
}

items.sort((a, b) => a.extractedPath.localeCompare(b.extractedPath, 'zh-Hans-CN'));

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, items.map((item) => JSON.stringify(item)).join('\n') + (items.length ? '\n' : ''), 'utf8');
await writeFile(promptPath, makeSystemPrompt(), 'utf8');

console.log(`Wrote ${items.length} model extraction queue items to ${normalizePath(path.relative(repoRoot, outputPath))}`);
console.log(`Wrote model prompt to ${normalizePath(path.relative(repoRoot, promptPath))}`);

function extractContent(filePath, content) {
  if (path.extname(filePath).toLowerCase() !== '.json') return content;

  try {
    const parsed = JSON.parse(content);
    if (typeof parsed.text === 'string') return parsed.text;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return content;
  }
}

async function findNearestSourceTrace(folder) {
  let current = folder;

  while (current.startsWith(repoRoot)) {
    const candidate = path.join(current, 'source-trace.json');
    if (existsSync(candidate)) return candidate;

    const next = path.dirname(current);
    if (next === current) break;
    current = next;
  }

  return null;
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

function makeSystemPrompt() {
  return [
    '# Travel Data Model Extraction Prompt',
    '',
    'You extract structured Syncing Travel route and experience data from one evidence text block at a time.',
    '',
    'Hard rules:',
    '- Do not invent facts. If the source does not say it, leave it null or add an unresolved question.',
    '- Keep source trace IDs and paths internal. Do not create traveler-facing copy that exposes raw paths or source URLs.',
    '- Prefer complete route evidence over filenames. Filenames may only help label an unresolved draft.',
    '- Extract route facts, promotions, and feature experiences separately.',
    '- Output JSON only.',
    '',
    'Return shape:',
    '```json',
    '{',
    '  "contentType": "route | promotion | feature_experience | price_support | media_context | unclear",',
    '  "routeProductDraft": null,',
    '  "triples": [{ "subject": "", "predicate": "", "object": "", "evidence": "" }],',
    '  "experiences": [{ "destination": "", "name": "", "description": "", "evidence": "" }],',
    '  "promotions": [{ "title": "", "claim": "", "evidence": "" }],',
    '  "unresolvedQuestions": [],',
    '  "confidence": "high | medium | low"',
    '}',
    '```',
    '',
  ].join('\n');
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
