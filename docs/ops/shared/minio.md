# MinIO on Win11 (Phase 1)

## Start

From repo root `xtch-web-portal`:

    docker compose up -d

Services: Postgres `127.0.0.1:5432`, MinIO API `127.0.0.1:9000`, Console `127.0.0.1:9001`, buckets `xtch-public` + `xtch-tunnel` + `xtch-prod` (public-read). Ports are loopback-only. Daily local media uses `xtch-public`. Public tunnel testbed uses `xtch-tunnel` — see [tunnel.md](../tunnel.md). Public deploy targets (`win11-home` / `cloud-vps`) use isolated `xtch-prod` — see [README.md](../README.md) and [win11-home.md](../win11-home.md). Content backup import / multi-DB isolation — see [content-backup.md](./content-backup.md).

## API env (`env/local/.env`)

Copy from `env/local/.env.example`. Required: `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_PUBLIC_BASE_URL`, `S3_REGION`. Optional: `APP_ENV=dev` or `prod`.

Never put `S3_SECRET_ACCESS_KEY` in Vercel frontend env.

## Upload path

Admin → Media → choose file → API presign → browser PUT to MinIO → `media_assets.public_url` saved.

New keys: `{env}/{type}/{yyyy}/{mm}/{uuid}-{safeFilename}`.

## Production note

Do **not** publish MinIO `9000`/`9001` to the internet. For public deploy targets, browsers use same-origin `https://YOUR_DOMAIN/s3/...` via Node/Caddy (`S3_BROWSER_ENDPOINT` / `S3_PUBLIC_BASE_URL`). Keep API + secrets on this host. See [win11-home.md](../win11-home.md) / [cloud-vps.md](../cloud-vps.md).
