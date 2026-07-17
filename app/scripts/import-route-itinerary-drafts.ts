/**
 * Import reviewed Extraction Drafts from
 * `../data/route-itinerary-drafts/drafts/*.json` into existing `routes`
 * rows (matched by `legacy_numeric_id`) + replace `route_itinerary_days`.
 *
 * Only updates: experience / moments / included_support / itinerary days.
 * Does not rewrite card title, price, destinations, etc.
 *
 * Day numbers <= 0 (gift assembly nights in some Tibet / NW drafts) cannot
 * pass `parseItineraryDaysInput` (requires positive dayNumber). Those days are
 * folded into `included_support` as explicit gift-night lines and skipped from
 * `route_itinerary_days`.
 *
 * Run from `app/`:
 *   npx tsx scripts/import-route-itinerary-drafts.ts
 *   npx tsx scripts/import-route-itinerary-drafts.ts --dry-run
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { ensureContentTables } from '../api/lib/contentSchema';
import { sql } from '../api/lib/db';

type DraftDay = {
  dayNumber: number;
  title?: string;
  city?: string;
  attractions?: string[];
  meals?: string;
  accommodation?: string;
  transport?: string;
  summary?: string;
  notes?: string[];
};

type Draft = {
  status: string;
  legacyId: number;
  tourCode: string;
  experience?: string[];
  moments?: string[];
  includedSupport?: string[];
  days: DraftDay[];
};

function loadEnvLocal() {
  try {
    const content = readFileSync(resolve(import.meta.dirname, '../.env.local'), 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // optional
  }
}

loadEnvLocal();

const dryRun = process.argv.includes('--dry-run');
const draftsDir = resolve(import.meta.dirname, '../../data/route-itinerary-drafts/drafts');

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? '').trim()).filter(Boolean);
}

/** Drop extraction/review meta that must not reach traveler-facing assembleDayText. */
function isInternalNote(note: string): boolean {
  const tokens = [
    'CRITICAL',
    'MinerU',
    'source-map',
    'OCR',
    'PDF/MD',
    'routePdfDetails',
    'Chinese companion',
    'Where Yading Meets Jiuzhaigou.pdf',
    'needs human review',
    'table cell conflicting',
    'Brief table',
    '未提及',
    '留空',
    'do not publish',
    'Tour-level meals:',
    'per source-map',
    'MD Day',
    'MD overview',
    'MD warns',
    'MD exclusions',
    'MD says',
    'MD notes',
    'MD asks',
    'MD:',
    'MD ',
    'Primary extraction',
    'Alternate「',
    'Overview OCR',
    'overview hotel OCR',
  ];
  return tokens.some((token) => note.includes(token));
}

function travelerNotes(notes: unknown): string[] {
  return asStringArray(notes).filter((note) => !isInternalNote(note));
}

function cleanExperience(lines: unknown): string[] {
  return asStringArray(lines)
    .map((line) =>
      line
        .replace(/\s*built from the original route PDF\.?/gi, '')
        .replace(/\s*from the original PDF\.?/gi, '')
        .replace(/\s*extracted from the PDF,?/gi, '')
        .replace(/\bThe PDF route\b/gi, 'The route')
        .replace(/\bA .+ route from the PDF\b/gi, (match) => match.replace(/ from the PDF/i, ''))
        .replace(/\s{2,}/g, ' ')
        .trim()
        .replace(/^[,.\s]+/, ''),
    )
    .filter((line) => line.length > 12)
    .map((line) => (line.endsWith('.') ? line : `${line}.`))
    .map((line) => line.charAt(0).toUpperCase() + line.slice(1));
}

function foldGiftDay(day: DraftDay): string {
  const bits = [
    `Gift / assembly night (source Day ${day.dayNumber})`,
    day.title?.trim() || '',
    day.city ? `city: ${day.city}` : '',
    day.accommodation ? `stay: ${day.accommodation}` : '',
    day.meals ? `meals: ${day.meals}` : '',
  ].filter(Boolean);
  return bits.join(' — ');
}

async function main() {
  if (!process.env.POSTGRES_URL) {
    throw new Error('POSTGRES_URL is missing. Set it in app/.env.local');
  }

  const files = readdirSync(draftsDir)
    .filter((name) => name.endsWith('.json'))
    .sort();

  await ensureContentTables();

  const report: Array<Record<string, unknown>> = [];

  for (const file of files) {
    const draft = JSON.parse(readFileSync(resolve(draftsDir, file), 'utf-8')) as Draft;
    if (draft.status !== 'approved' && draft.status !== 'approved_spotcheck') {
      report.push({ file, legacyId: draft.legacyId, status: 'skipped_not_approved', draftStatus: draft.status });
      console.log(`skip (not approved): ${file}`);
      continue;
    }

    const found = await sql`
      SELECT slug, title, legacy_numeric_id
      FROM routes
      WHERE legacy_numeric_id = ${draft.legacyId}
      LIMIT 1
    `;
    if (found.rows.length === 0) {
      report.push({ file, legacyId: draft.legacyId, status: 'missing_route' });
      console.warn(`MISSING route for legacyId=${draft.legacyId} (${draft.tourCode})`);
      continue;
    }

    const slug = String(found.rows[0].slug);
    const giftDays = draft.days.filter((day) => !Number.isFinite(day.dayNumber) || day.dayNumber <= 0);
    const positiveDays = draft.days
      .filter((day) => Number.isFinite(day.dayNumber) && day.dayNumber > 0)
      .slice()
      .sort((a, b) => a.dayNumber - b.dayNumber);

    const experience = cleanExperience(draft.experience);
    const moments = asStringArray(draft.moments);
    const includedSupport = [
      ...asStringArray(draft.includedSupport),
      ...giftDays.map(foldGiftDay),
    ];

    if (dryRun) {
      report.push({
        file,
        legacyId: draft.legacyId,
        slug,
        status: 'dry_run',
        itineraryDays: positiveDays.length,
        foldedGiftDays: giftDays.length,
      });
      console.log(
        `dry-run: ${slug} days=${positiveDays.length} giftFolded=${giftDays.length}`,
      );
      continue;
    }

    await sql.begin(async (tx) => {
      await tx`
        UPDATE routes SET
          experience = ${experience},
          moments = ${moments},
          included_support = ${includedSupport},
          updated_at = NOW()
        WHERE slug = ${slug}
      `;

      await tx`DELETE FROM route_itinerary_days WHERE route_slug = ${slug}`;

      for (const day of positiveDays) {
        await tx`
          INSERT INTO route_itinerary_days (
            route_slug, day_number, title, city, summary, attractions, meals, accommodation, transport, notes
          ) VALUES (
            ${slug},
            ${Math.floor(day.dayNumber)},
            ${String(day.title || '').trim()},
            ${String(day.city || '').trim()},
            ${String(day.summary || '').trim()},
            ${asStringArray(day.attractions)},
            ${String(day.meals || '').trim()},
            ${String(day.accommodation || '').trim()},
            ${String(day.transport || '').trim()},
            ${travelerNotes(day.notes)}
          )
        `;
      }
    });

    report.push({
      file,
      legacyId: draft.legacyId,
      slug,
      status: 'imported',
      itineraryDays: positiveDays.length,
      foldedGiftDays: giftDays.length,
    });
    console.log(`imported: ${slug} days=${positiveDays.length} giftFolded=${giftDays.length}`);
  }

  const summaryPath = resolve(import.meta.dirname, '../../data/route-itinerary-drafts/IMPORT_REPORT.json');
  const { writeFileSync } = await import('node:fs');
  writeFileSync(summaryPath, JSON.stringify({ dryRun, generatedAt: new Date().toISOString(), report }, null, 2));
  console.log(`Wrote ${summaryPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
