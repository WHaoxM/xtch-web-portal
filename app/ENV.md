# Env config moved

Application secrets and per-target env files live under the repo-root `env/` tree:

| Target | File |
|---|---|
| local | `../env/local/.env` |
| tunnel | `../env/tunnel/.env` |
| win11-home | `../env/win11-home/.env` |
| cloud-vps | `../env/cloud-vps/.env` |

Copy from the matching `.env.example` in that folder. See [`../env/README.md`](../env/README.md) and [`../docs/ops/README.md`](../docs/ops/README.md).

Loaders still accept legacy `app/.env.*.local` for one migration round (with a warning).

## Private IM attachments

`IM_MEDIA_S3_BUCKET` is an optional server-only setting for private chat attachments. It must name a dedicated bucket with anonymous access disabled and must not equal `S3_BUCKET` (the latter is used for existing public media). For the Wenshu cross-site visitor chat, explicitly configure `S3_BROWSER_ENDPOINT` to the MinIO reverse-proxy URL (`https://www.xuntingtravel.com/s3` in production); do not let signed URLs inherit the visitor page host. Until the private bucket, endpoint, and site-origin CORS policy are provisioned, image/file chat upload endpoints remain unavailable without falling back to the public bucket. See [`../docs/ops/shared/im-private-media.md`](../docs/ops/shared/im-private-media.md) before enabling it.
