# MinIO Media Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish Phase 1 by changing new MinIO object keys to `{env}/{type}/{yyyy}/{mm}/{uuid}-{safeFilename}`, documenting operator env, and re-verifying Admin upload round-trip.

**Architecture:** Most of Phase 1 already exists (Compose MinIO, presign API, Admin upload, URL-string frontend). This plan only aligns `buildObjectKey` with the approved design, wires `contentType` into key generation, documents `APP_ENV` / `S3_*`, and verifies.

**Tech Stack:** Node/TypeScript API on Win11, `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`, MinIO via Docker Compose, Vite React admin UI, Postgres `media_assets`.

## Global Constraints

- Placement: large media → MinIO; metadata → DB `media_assets`; tiny stable assets → `app/public` only.
- Topology: Vercel frontend; Win11 runs API + DB + MinIO; secrets never on Vercel frontend.
- Bucket name: `xtch-public` (Compose bootstrap, public-read).
- New object key: `{env}/{type}/{yyyy}/{mm}/{uuid}-{safeFilename}` where `env` is `dev`|`prod`, `type` is `image`|`video`|`pdf`|`file`.
- Do not migrate existing objects under `media/...`.
- Do not migrate Home/About/guides/itineraries into DB in this plan.
- Do not create git commits unless the user explicitly asks.
- Spec: `docs/superpowers/specs/2026-07-17-minio-media-phase1-design.md`.

## File map

| File | Role |
|------|------|
| `app/api/lib/s3.ts` | Key helpers + presign; change `buildObjectKey` |
| `app/api/admin/media-presign.ts` | Pass `contentType` into `buildObjectKey` |
| `app/api/lib/s3Key.test.ts` | Pure unit tests for key helpers (`node:test` + `tsx`) |
| `app/.env.local.example` | Document `APP_ENV` + key format note |
| `docs/ops/minio-win11.md` | Short Win11 operator runbook |
| `docs/superpowers/specs/2026-07-17-minio-media-phase1-design.md` | Mark status Approved after verify |
| `docs/agent-progress.md` | Record key-format completion |

---

### Task 1: Object key helpers + unit tests

**Files:**
- Modify: `app/api/lib/s3.ts`
- Create: `app/api/lib/s3Key.test.ts`
- Modify: `app/package.json` (add `"test:s3": "tsx --test api/lib/s3Key.test.ts"`)

**Interfaces:**
- Consumes: existing `sanitizeObjectFilename(filename: string): string`
- Produces:
  - `resolveStorageEnv(env?: NodeJS.ProcessEnv): 'dev' | 'prod'`
  - `mediaTypeFromContentType(contentType: string): 'image' | 'video' | 'pdf' | 'file'`
  - `buildObjectKey(filename: string, contentType: string, now?: Date, env?: NodeJS.ProcessEnv): string`

- [ ] **Step 1: Write the failing tests**

Create `app/api/lib/s3Key.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildObjectKey,
  mediaTypeFromContentType,
  resolveStorageEnv,
  sanitizeObjectFilename,
} from './s3.ts';

test('resolveStorageEnv prefers APP_ENV', () => {
  assert.equal(resolveStorageEnv({ APP_ENV: 'prod', NODE_ENV: 'development' }), 'prod');
  assert.equal(resolveStorageEnv({ APP_ENV: 'dev' }), 'dev');
  assert.equal(resolveStorageEnv({ NODE_ENV: 'production' }), 'prod');
  assert.equal(resolveStorageEnv({ NODE_ENV: 'development' }), 'dev');
});

test('mediaTypeFromContentType maps known types', () => {
  assert.equal(mediaTypeFromContentType('image/png'), 'image');
  assert.equal(mediaTypeFromContentType('video/mp4'), 'video');
  assert.equal(mediaTypeFromContentType('application/pdf'), 'pdf');
  assert.equal(mediaTypeFromContentType('application/octet-stream'), 'file');
});

test('buildObjectKey uses env/type/yyyy/mm/uuid-name', () => {
  const key = buildObjectKey(
    'Office Photo (1).PNG',
    'image/png',
    new Date('2026-07-17T12:00:00Z'),
    { APP_ENV: 'dev' },
  );
  assert.match(
    key,
    /^dev\/image\/2026\/07\/[0-9a-f-]{36}-Office-Photo-\(1\)\.PNG$/i,
  );
  assert.equal(key.includes('media/'), false);
});

test('sanitizeObjectFilename strips path segments', () => {
  assert.equal(sanitizeObjectFilename('C:\\tmp\\a b.png'), 'a-b.png');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `app/`:

```bash
npx tsx --test api/lib/s3Key.test.ts
```

Expected: FAIL because `resolveStorageEnv` / `mediaTypeFromContentType` are missing and `buildObjectKey` still returns `media/...`.

- [ ] **Step 3: Implement helpers in `app/api/lib/s3.ts`**

Replace `buildObjectKey` and add helpers (keep existing S3 client / presign unchanged):

```ts
export function resolveStorageEnv(env: NodeJS.ProcessEnv = process.env): 'dev' | 'prod' {
  const appEnv = env.APP_ENV?.trim().toLowerCase();
  if (appEnv === 'prod' || appEnv === 'production') return 'prod';
  if (appEnv === 'dev' || appEnv === 'development') return 'dev';
  return env.NODE_ENV === 'production' ? 'prod' : 'dev';
}

export function mediaTypeFromContentType(contentType: string): 'image' | 'video' | 'pdf' | 'file' {
  const ct = contentType.trim().toLowerCase();
  if (ct.startsWith('image/')) return 'image';
  if (ct.startsWith('video/')) return 'video';
  if (ct === 'application/pdf') return 'pdf';
  return 'file';
}

export function buildObjectKey(
  filename: string,
  contentType: string,
  now: Date = new Date(),
  env: NodeJS.ProcessEnv = process.env,
): string {
  const storageEnv = resolveStorageEnv(env);
  const type = mediaTypeFromContentType(contentType);
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const id = crypto.randomUUID();
  const safeName = sanitizeObjectFilename(filename);
  return `${storageEnv}/${type}/${yyyy}/${mm}/${id}-${safeName}`;
}
```

- [ ] **Step 4: Add npm script and re-run tests**

In `app/package.json` scripts:

```json
"test:s3": "tsx --test api/lib/s3Key.test.ts"
```

Run:

```bash
npm run test:s3
```

Expected: PASS (all four tests).

- [ ] **Step 5: Stop for review** (commit only if user asks)

---

### Task 2: Wire presign handler to new `buildObjectKey` signature

**Files:**
- Modify: `app/api/admin/media-presign.ts`

**Interfaces:**
- Consumes: `buildObjectKey(filename: string, contentType: string): string` from Task 1
- Produces: JSON `{ ok, objectKey, uploadUrl, publicUrl, contentType }` where `objectKey` matches new format

- [ ] **Step 1: Update the call site**

In `app/api/admin/media-presign.ts`, change:

```ts
const objectKey = buildObjectKey(filename);
```

to:

```ts
const objectKey = buildObjectKey(filename, contentType);
```

No other response-shape changes.

- [ ] **Step 2: Typecheck**

Run from `app/`:

```bash
npm run typecheck
```

Expected: no errors related to `buildObjectKey` arity.

- [ ] **Step 3: Stop for review** (commit only if user asks)

---

### Task 3: Operator docs (`APP_ENV` + Win11 MinIO)

**Files:**
- Modify: `app/.env.local.example`
- Create: `docs/ops/minio-win11.md`

**Interfaces:**
- Produces: documented `S3_*` + `APP_ENV` values operators can copy

- [ ] **Step 1: Extend `.env.local.example`**

After the existing `S3_*` block, ensure these lines exist (add if missing):

```env
# Storage key prefix env segment: dev | prod (defaults from NODE_ENV if unset)
APP_ENV=dev

# MinIO / S3-compatible object storage (local Docker: see ../docker-compose.yml)
# API-only secrets — never expose S3_SECRET_ACCESS_KEY to the browser or Vercel frontend env.
S3_ENDPOINT=http://127.0.0.1:9000
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET=xtch-public
S3_REGION=us-east-1
# Public base URL for objects (no trailing slash). Must be reachable by Vercel visitors in production.
# Object keys look like: {APP_ENV}/{image|video|pdf|file}/{yyyy}/{mm}/{uuid}-{filename}
S3_PUBLIC_BASE_URL=http://127.0.0.1:9000/xtch-public
```

- [ ] **Step 2: Write `docs/ops/minio-win11.md`**

Contents of the new file (exact):

````markdown
# MinIO on Win11 (Phase 1)

## Start

From repo root `xtch-web-portal`:

    docker compose up -d

Services: Postgres `5432`, MinIO API `9000`, Console `9001`, bucket `xtch-public` (public-read).

## API env (`app/.env.local`)

Copy from `app/.env.local.example`. Required: `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_PUBLIC_BASE_URL`, `S3_REGION`. Optional: `APP_ENV=dev` or `prod`.

Never put `S3_SECRET_ACCESS_KEY` in Vercel frontend env.

## Upload path

Admin → Media → choose file → API presign → browser PUT to MinIO → `media_assets.public_url` saved.

New keys: `{env}/{type}/{yyyy}/{mm}/{uuid}-{safeFilename}`.

## Production note

Expose MinIO (or a reverse proxy) so Vercel visitors can GET `S3_PUBLIC_BASE_URL/...`. Keep API + secrets on this Win11 host.
````

- [ ] **Step 3: Stop for review** (commit only if user asks)

---

### Task 4: End-to-end verification

**Files:**
- None required (manual / shell checks)
- Optional touch: `docs/agent-progress.md`, spec status line

**Interfaces:**
- Consumes: running Compose + API with Task 1–2 code
- Produces: evidence that new keys and upload path work

- [ ] **Step 1: Ensure MinIO is up**

```bash
docker compose ps
curl -s -o NUL -w "%{http_code}" http://127.0.0.1:9000/minio/health/live
```

Expected: MinIO running; health `200`.

- [ ] **Step 2: Confirm no Vite `本站` imports**

From repo:

```bash
rg "本站/.*\?url|from ['\"].*本站" app/src
```

Expected: no Vite import matches (comment-only mentions OK).

- [ ] **Step 3: Presign and inspect objectKey shape**

With Admin auth token available, call (PowerShell example):

```powershell
$body = @{ filename = "verify-key.png"; contentType = "image/png" } | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri "http://127.0.0.1:3000/api/admin/media-presign" -Headers @{ Authorization = "Bearer $token"; "content-type" = "application/json" } -Body $body
```

Expected: `objectKey` matches `dev/image/YYYY/MM/<uuid>-verify-key.png` (or `prod/...` if `APP_ENV=prod`).

- [ ] **Step 4: Full Admin UI round-trip**

In browser Admin → Media: upload a small PNG, confirm list shows the new `publicUrl`, open URL in a new tab (HTTP 200 image).

- [ ] **Step 5: Update progress + spec status**

- Set spec header `Status: Approved` in `docs/superpowers/specs/2026-07-17-minio-media-phase1-design.md`.
- Append a short note under Current Goal in `docs/agent-progress.md`: key format landed; e2e verified; About interim public URLs unchanged unless ops uploaded replacements.

- [ ] **Step 6: Stop for review** (commit only if user asks)

---

## Spec coverage check

| Spec requirement | Task |
|------------------|------|
| Key format `{env}/{type}/{yyyy}/{mm}/{uuid}-...` | Task 1–2 |
| Bucket `xtch-public` / Compose | Already done; Task 3 docs + Task 4 verify |
| Presign → PUT → `media_assets` | Already done; Task 4 verify |
| No `本站` Vite imports | Already done; Task 4 rg check |
| Secrets only on Win11 API | Task 3 docs |
| No migration of old `media/...` keys | Global constraint; no task migrates |
| About interim `/images` OK | Out of code path; optional ops follow-up, not blocking |

## Placeholder scan

No TBD / "add validation later" steps. Commit steps are gated on explicit user request.
