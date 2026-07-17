# Travel Data Automation Scripts

These scripts support the workflow in [docs/travel-data-pipeline.md](../../docs/travel-data-pipeline.md).

## Stage 1: Inventory

```powershell
node scripts/travel-data/inventory.mjs
```

The script reads `data/pipeline.config.json`, scans enabled raw intake folders, computes file hashes, classifies file kinds, and writes:

```txt
data/inventory/raw-files.json
```

Do not treat the inventory as trusted route data. It is only the first automation stage.

## Later Stages

Planned stages:

- `group-sources`: group PDF/DOCX/HTML/URL variants that likely describe the same route.
- `extract-documents`: extract text from DOCX and PDF route files.
- `extract-webpages`: extract route text from local HTML or fetched route pages.
- `draft-routes`: create machine-generated route product drafts.
- `validate-normalized`: validate reviewed route and media data before generation.
- `generate-frontend-data`: generate TypeScript for the React/Vite app.

## Route Intake Extraction

The route intake pipeline should not use local rules as the main semantic parser. Use deterministic
scripts only for source tracing, file organization, and extractor orchestration.

### MinerU document extraction

Use MinerU for PDF/DOCX/XLSX-style document extraction:

```powershell
node scripts/travel-data/extract-mineru.mjs --intake 路线_新
```

Optional flags:

```powershell
node scripts/travel-data/extract-mineru.mjs --intake 路线_新 --limit 10 --backend pipeline --method auto
```

Output:

```txt
data/extracted/mineru/
data/reports/mineru-extraction-report.json
```

The script calls MinerU and writes source traces. It does not infer route fields by regex.

### Playwright URL extraction

Use Playwright for `.url` shortcuts and dynamic webpages:

```powershell
$base="C:\Users\HoSheil\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules"
$env:NODE_PATH="$base;$base\.pnpm\node_modules"
$env:PLAYWRIGHT_BROWSERS_PATH=(Resolve-Path ".playwright-browsers").Path
node scripts/travel-data/scrape-urls-playwright.mjs --intake 路线_新
```

Output:

```txt
data/extracted/webpages/
data/reports/playwright-url-extraction-report.json
```

### Media draft organization

Generate a review manifest for images and videos without copying every large raw asset into
`app/public`:

```powershell
node scripts/travel-data/organize-media.mjs --intake 路线_新
```

Output:

```txt
data/drafts/media-assets/media-assets.from-route-new.json
```

### Model extraction queue

After MinerU and Playwright extraction, build a JSONL queue for model-based semantic parsing:

```powershell
node scripts/travel-data/build-model-extraction-queue.mjs
```

Output:

```txt
data/drafts/model-extraction/model-extraction-queue.jsonl
data/drafts/model-extraction/model-extraction-system-prompt.md
```

The model queue is the layer that should extract routes, promotions, feature experiences, and
triples. The queue requires evidence notes and unresolved questions so generated drafts remain
reviewable instead of becoming trusted structured data automatically.
