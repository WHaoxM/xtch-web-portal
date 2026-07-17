# Travel Data Pipeline

This document defines how Syncing Travel turns temporary raw route folders into reviewed English route products and reusable media resources.

## Goal

The pipeline must not treat `路线/`, `路线_新/`, or similar folders as the final data layer. Those folders are temporary raw intake areas. The final product of the pipeline is reviewed, structured, traveler-facing English data plus a media resource library that the React/Vite portal can consume safely.

## Core Flow

```txt
Raw Intake Folder
  -> File Inventory
  -> Text and Metadata Extraction
  -> Extraction Draft
  -> Cleaning and Deduplication
  -> Traveler-Friendly English Rewrite
  -> Human Review
  -> Structured Travel Data
  -> Generated Frontend Data and Media Manifest
```

The same raw file can support multiple outputs. For example, a Chinese DOCX route file may produce one English route product, one PDF download reference, several itinerary days, and several destination tags.

## Directory Strategy

Keep raw intake separate from structured data and published assets.

```txt
data/
  inventory/
    raw-files.json                 # every scanned raw file with hash, path, type, size, mtime
    grouped-route-sources.json      # probable document/webpage variants belonging to the same route

  extracted/
    documents/                      # extracted text from PDF/DOCX
    webpages/                       # extracted text from local HTML or remote route pages
    media/                          # detected image/video metadata

  drafts/
    route-products/                 # machine-created draft route product records
    media-assets/                   # machine-created draft media asset records

  normalized/
    route-products.json             # reviewed route products; trusted structured source
    destinations.json               # reviewed destination taxonomy
    media-assets.json               # reviewed media library manifest

  generated/
    travelData.ts                   # generated TypeScript data for app/src/lib
    searchIndex.ts                  # optional generated search index

  reports/
    extraction-report.json          # totals, failures, warnings
    review-queue.json               # records that need human decisions
    rejected-records.json           # rejected files or drafts with reasons
```

Recommended frontend resource locations:

```txt
app/public/images/
  destinations/
  routes/
  experiences/
  brand/

app/public/videos/
  routes/
  experiences/
  brand/
```

For dynamic catalog assets, prefer `app/public/images/...` and `app/public/videos/...` with root URLs such as `/images/routes/yunnan-lijiang-01.jpg`. This matches Vite's `public` behavior: assets in `public` are served from the root path and copied into the build output as-is. For small static assets imported by a component, normal Vite asset imports remain acceptable.

Large original media should not be copied blindly into `app/public`. Keep only publish-ready selected assets there. If the repository starts tracking large videos or high-resolution originals, use Git LFS or external object storage before the repo becomes slow to clone.

## Raw Intake Configuration

The first automation pass should be config-driven, not hard-coded to one folder name.

```json
{
  "rawIntakeFolders": [
    "路线",
    "路线_新",
    "本站/路线",
    "本站/路线子页面"
  ],
  "mediaIntakeFolders": [
    "路线",
    "路线_新",
    "本站"
  ],
  "excludedFolders": [
    "目标站",
    "app/node_modules",
    "app/dist"
  ]
}
```

`目标站/` remains a layout and interaction reference only. It must not become route product facts for Syncing Travel unless a specific asset or fact is explicitly approved.

## File Inventory

Every scan should produce `data/inventory/raw-files.json`.

Minimum fields:

```json
{
  "id": "raw_...",
  "path": "路线_新/云南/example.docx",
  "extension": ".docx",
  "kind": "document | webpage | media | url | spreadsheet | unknown",
  "sizeBytes": 123456,
  "sha256": "...",
  "modifiedAt": "2026-06-25T00:00:00+08:00",
  "intakeFolder": "路线_新",
  "regionHint": "云南",
  "languageHint": "zh | en | mixed | unknown",
  "processingStatus": "pending | extracted | failed | ignored",
  "warnings": []
}
```

Use hashes to find duplicates across `路线/` and `路线_新/`. Use paths and text fingerprints to group Chinese DOCX, English PDF, URL shortcuts, and local HTML pages that likely describe the same route.

## Extraction Rules

Route product data must come from documents or route webpages. File names can be hints, but they are not enough to create a publishable route.

Supported first-pass extraction sources:

- `.docx`: extract paragraphs, tables, headings, itinerary days, inclusions, exclusions, price tables when present.
- `.pdf`: extract text and page-level chunks; keep page references internally.
- `.html`: extract route body text from local saved pages.
- `.url`: parse the target URL, then either fetch the page or add it to the review queue if fetch fails.
- `.xlsx`: treat as pricing or schedule support data, not as a route product unless it contains itinerary fields.

Extraction output is not trusted. It becomes an `Extraction Draft`.

## Cleaning Rules

A route product draft can enter review only when it has enough traveler-facing value.

Required facts before review:

- Route title or strong title candidate.
- Duration, either explicit or inferable from day-by-day itinerary.
- At least one destination or region.
- Product type evidence, or a warning that the type is unresolved.
- Itinerary body, route summary, or route webpage content.
- Internal source trace for maintenance.

Reject or hold records when:

- The file is only a poster, empty URL, duplicate shell, or unrelated operational file.
- The text cannot distinguish route facts from generic marketing copy.
- The route cannot be tied to any destination or travel product.
- The source is a target-site reference rather than Syncing or route material.

Deduplication priority:

1. Prefer an English route document when it is complete.
2. Prefer DOCX over PDF when DOCX has fuller editable itinerary text.
3. Keep PDF as downloadable asset when it is customer-ready.
4. Merge Chinese and English variants into one route product when facts match.
5. Keep conflicting variants in review instead of silently merging.

## English Rewrite Policy

Every published route product must be an English route product. Chinese-only material must be translated and lightly rewritten for overseas travelers.

Facts that must stay locked:

- Duration and nights.
- Start city, end city, major destinations, and attractions.
- Product type, group size, fixed departure status, and customizability.
- Inclusions, exclusions, accommodation level, transport, meals, guide/driver support.
- Price conditions and seasonal constraints.
- Risk notes such as altitude, long driving days, age/fitness limits, permits, and seasonal access.

Fields that may be rewritten for clarity and conversion:

- English title.
- Short summary.
- Highlights.
- Best-for traveler descriptions.
- Pace and experience framing.
- CTA copy and inquiry prompts.

The rewrite must not invent awards, reviews, team claims, fixed prices, guaranteed departures, or service promises not supported by the raw material.

## Route Product Schema

`data/normalized/route-products.json` should be the trusted route product source.

Recommended shape:

```ts
type RouteProduct = {
  id: string;
  slug: string;
  status: 'draft' | 'review' | 'published' | 'rejected';

  language: 'en';
  sourceLanguages: Array<'zh' | 'en' | 'mixed'>;

  title: string;
  subtitle?: string;
  summary: string;
  highlights: string[];
  bestFor: string[];
  themes: Array<'classic' | 'culture' | 'nature' | 'family' | 'food' | 'photography' | 'silk-road' | 'adventure' | 'city-break'>;

  durationDays: number;
  durationNights?: number;
  startCity?: string;
  endCity?: string;
  destinationSlugs: string[];
  attractionNames: string[];

  primaryType: 'private' | 'group-tour' | 'customizable' | 'fixed-departure';
  availableTypes: Array<'private' | 'group-tour' | 'customizable' | 'fixed-departure'>;
  groupSize?: {
    min?: number;
    max?: number;
    display: string;
  };

  pace: 'easy' | 'balanced' | 'full' | 'active';
  physicalLevel: 'light' | 'moderate' | 'active' | 'challenging';
  seasonality?: string;

  itinerary: Array<{
    day: number;
    title: string;
    city?: string;
    summary: string;
    attractions: string[];
    meals?: string;
    accommodation?: string;
    transport?: string;
    notes?: string[];
  }>;

  included: string[];
  excluded: string[];
  accommodation?: {
    level?: string;
    notes?: string;
  };
  transport?: string[];
  guideService?: string;

  price: {
    mode: 'on-request' | 'fixed-from' | 'seasonal-table' | 'per-person-range' | 'unavailable';
    display: string;
    currency?: 'USD' | 'CNY';
    amountFrom?: number;
    amountTo?: number;
    notes: string[];
  };

  customization: {
    isCustomizable: boolean;
    notes?: string;
  };

  media: {
    heroImageId?: string;
    galleryImageIds: string[];
    videoIds: string[];
  };

  inquiry: {
    primaryCta: 'request-quote' | 'plan-custom-trip' | 'join-small-group' | 'ask-whatsapp';
    suggestedQuestions: string[];
  };

  internal: {
    sourceTraces: Array<{
      rawFileId: string;
      pathOrUrl: string;
      extractedAt: string;
      evidenceNotes?: string;
    }>;
    extractionConfidence: 'high' | 'medium' | 'low';
    reviewNotes: string[];
    reviewedAt?: string;
  };
};
```

`internal.sourceTraces` is required for maintenance but must never render on traveler-facing pages.

## Traveler-Facing Field Priority

The product page should answer these questions in order:

1. What route is this, how many days, and where does it go?
2. Is it private, small-group, fixed departure, or customizable?
3. Who is it best for?
4. What are the top experiences?
5. What happens each day?
6. What is included and excluded?
7. What hotel, transport, guide, and meal assumptions should I expect?
8. How hard or flexible is the trip?
9. How does pricing work?
10. What should I do next?

Do not show raw file names, local paths, extraction IDs, or source URLs to travelers.

## Price Handling

First-pass route products should not require a fixed public price.

Use structured price modes:

```json
{
  "mode": "on-request",
  "display": "On request",
  "notes": [
    "Final quote depends on group size, hotel level, season, transport, and guide requirements."
  ]
}
```

Only use `fixed-from`, `seasonal-table`, or `per-person-range` when the raw material clearly supports it and the value has been reviewed for freshness. Internal pricing source details stay in `internal.sourceTraces` or a separate private pricing file, not on public pages.

## Media Resource Schema

Images and videos may enter the media library more directly than route data, but they still need metadata.

`data/normalized/media-assets.json` should use a stable manifest:

```ts
type MediaAsset = {
  id: string;
  status: 'review' | 'published' | 'rejected';
  type: 'image' | 'video';
  publicUrl: string;
  originalPath?: string;
  title: string;
  altText?: string;
  destinationSlugs: string[];
  routeProductIds: string[];
  usage: Array<'route-hero' | 'route-gallery' | 'destination-hero' | 'experience' | 'brand' | 'background'>;
  orientation?: 'landscape' | 'portrait' | 'square';
  tags: string[];
  rightsStatus: 'owned' | 'approved' | 'unknown' | 'rejected';
  internalSourceTrace: string;
};
```

Naming convention:

```txt
{scope}-{destination-or-route}-{subject}-{index}.{ext}

route-yunnan-lijiang-old-town-01.jpg
route-qinghai-chaka-salt-lake-01.jpg
experience-yunnan-tie-dye-01.mp4
brand-team-on-trip-support-01.jpg
```

Do not use unstable exported names, random hashes, Chinese-only names, or raw social-media download names for public assets.

## Automation Stages

Stage 1: Inventory

- Scan configured raw intake folders.
- Record file metadata and hashes.
- Detect duplicates and unsupported files.
- Output `data/inventory/raw-files.json`.

Stage 2: Source Grouping

- Group likely variants of the same route by folder, title similarity, language, duration, and destination hints.
- Output `data/inventory/grouped-route-sources.json`.

Stage 3: Extraction

- Extract text from documents and webpages.
- Extract media metadata.
- Output raw text chunks and extraction warnings.

Stage 4: Draft Generation

- Create draft route product JSON.
- Preserve internal trace back to source files/pages.
- Mark unresolved fields and confidence.

Stage 5: Cleaning and English Rewrite

- Normalize destinations, duration, product types, themes, pace, inclusions, exclusions, and itinerary days.
- Translate Chinese-only facts into English.
- Apply traveler-friendly rewrite for customer-facing copy.
- Keep factual warnings when the source is ambiguous.

Stage 6: Human Review

- Review route facts and publishability.
- Choose hero media and route gallery candidates.
- Approve price mode.
- Mark status as `published`, `review`, or `rejected`.

Stage 7: Generation

- Generate `app/src/lib/generated/travelData.ts` or update a controlled data import layer.
- Generate search index records.
- Run TypeScript build.

## Validation Gates

Before a route can become `published`:

- `language` is `en`.
- `title`, `summary`, `durationDays`, `destinationSlugs`, `primaryType`, `availableTypes`, `itinerary`, `included`, `excluded`, and `price.mode` are present.
- `primaryType` appears inside `availableTypes`.
- `durationDays` matches the itinerary day count unless explicitly explained.
- `destinationSlugs` exist in `destinations.json`.
- Every published media ID exists in `media-assets.json`.
- Internal source traces exist but are not exposed to the UI.
- Public copy does not claim confirmed booking, live payment, fake reviews, fake awards, or unsupported fixed prices.

## Frontend Consumption

Recommended frontend shape:

```txt
app/src/lib/siteData.ts
  imports generated data, adds helper functions, exports routeTours/destinations for existing pages

app/src/lib/generated/travelData.ts
  generated from data/normalized/*.json
  not hand-edited
```

This avoids rewriting every page at once. The current hand-maintained `siteData.ts` can become a compatibility layer while the generated data matures.

## First Implementation Slice

Start with a vertical slice, not the full archive.

1. Scan `路线/` and `路线_新/`.
2. Process PDF, DOCX, HTML, and URL files only.
3. Create inventory and grouping reports.
4. Pick 5-10 representative routes across different regions.
5. Generate route product drafts with full itinerary-level fields.
6. Review and publish those records into `data/normalized/route-products.json`.
7. Move selected images/videos into the public media folders and record them in `media-assets.json`.
8. Generate TypeScript data and wire one page to read from it.

This proves the pipeline without committing the whole site to a partially trusted extraction process.

## Open Decisions

These can be decided during implementation:

- Whether generated frontend data should live in `app/src/lib/generated/` or be imported from `data/generated/`.
- Whether media originals stay only in raw intake folders or get copied to a private `resources/original-media/` archive.
- Whether route review is done in JSON, a spreadsheet, or a small internal review UI.
- Whether translations are generated by an LLM step, an external translation service, or manual editorial review.

