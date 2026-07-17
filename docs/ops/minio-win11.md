# MinIO on Win11 (Phase 1)

## Start

From repo root `xtch-web-portal`:

    docker compose up -d

Services: Postgres `5432`, MinIO API `9000`, Console `9001`, buckets `xtch-public` + `xtch-tunnel` (public-read). Daily local media uses `xtch-public`. Public tunnel testbed uses `xtch-tunnel` — see [tunnel-testbed.md](./tunnel-testbed.md).

## API env (`app/.env.local`)

Copy from `app/.env.local.example`. Required: `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_PUBLIC_BASE_URL`, `S3_REGION`. Optional: `APP_ENV=dev` or `prod`.

Never put `S3_SECRET_ACCESS_KEY` in Vercel frontend env.

## Upload path

Admin → Media → choose file → API presign → browser PUT to MinIO → `media_assets.public_url` saved.

New keys: `{env}/{type}/{yyyy}/{mm}/{uuid}-{safeFilename}`.

## Production note

Expose MinIO (or a reverse proxy) so Vercel visitors can GET `S3_PUBLIC_BASE_URL/...`. Keep API + secrets on this Win11 host.
