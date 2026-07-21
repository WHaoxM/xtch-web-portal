# Compose credentials (Postgres + MinIO)

Docker Compose **does not ship production default passwords**. Missing credentials fail at `docker compose config` / `up` with a clear `${VAR:?…}` error.

## Setup

From the **repo root**:

```powershell
Copy-Item .env.example .env
# Edit every REPLACE_ME_* — use strong unique secrets per host
docker compose config   # must succeed and must NOT print real weak defaults like "postgres"/"minioadmin" as passwords
docker compose up -d
```

Required variables (also listed in `.env.example`):

| Variable | Purpose |
|---|---|
| `POSTGRES_USER` | Postgres role (often `postgres`) |
| `POSTGRES_PASSWORD` | Postgres password — **required, no default** |
| `POSTGRES_DB` | Default DB created on first init (usually `xtch`) |
| `MINIO_ROOT_USER` | MinIO root user — **required, no default** |
| `MINIO_ROOT_PASSWORD` | MinIO root password — **required, no default** |

`minio-init` uses the **same** `MINIO_ROOT_*` variables (no duplicated literals).

Ports stay loopback-only: `127.0.0.1:5432`, `9000`, `9001`.

Sync app env after choosing secrets:

- `POSTGRES_URL=postgresql://<POSTGRES_USER>:<POSTGRES_PASSWORD>@127.0.0.1:5432/xtch_prod` (or `xtch` / `xtch_tunnel`)
- `S3_ACCESS_KEY_ID=<MINIO_ROOT_USER>`
- `S3_SECRET_ACCESS_KEY=<MINIO_ROOT_PASSWORD>`

Root `.env` is gitignored. Never commit real passwords.

## First initialization (empty volumes)

1. Write root `.env` with final secrets **before** the first `docker compose up`.
2. Start stack; Postgres initializes the data directory with that password; MinIO stores the root user.
3. `minio-init` creates buckets `xtch-public`, `xtch-tunnel`, `xtch-prod`.
4. Copy the same secrets into `env/<target>/.env`.

Changing compose later **does not** rewrite an already-initialized volume.

## Existing volume — rotate passwords

Compose/` .env` changes alone will **not** update credentials already stored in `xtch_pg_data` / `xtch_minio_data`.

### Postgres

1. Connect with the **current** password:
   ```bash
   docker exec -it xtch-postgres psql -U postgres -c "ALTER USER postgres WITH PASSWORD 'new-strong-secret';"
   ```
2. Update root `.env` `POSTGRES_PASSWORD` and every `env/<target>/.env` `POSTGRES_URL`.
3. `docker compose up -d --force-recreate postgres` (picks up env for future containers; data dir already has the new password from step 1).

### MinIO

1. Change root credentials via MinIO Console (`127.0.0.1:9001`) or `mc admin user` / `mc admin accesskey` with the **current** root user.
2. Update root `.env` `MINIO_ROOT_*` and app `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`.
3. Recreate MinIO + re-run init:
   ```bash
   docker compose up -d --force-recreate minio
   docker compose up minio-init
   ```

### Legacy installs that still use `postgres` / `minioadmin`

Treat those as compromised-on-any-public-host defaults. Rotate with the steps above **before** exposing 80/443, then remove the old values from every env file.

## Local validation (isolated / virtual secrets)

```powershell
# Fail-fast when secrets missing:
Remove-Item Env:POSTGRES_PASSWORD -ErrorAction SilentlyContinue
# …unset other required vars…
docker compose config   # expect non-zero + "POSTGRES_PASSWORD must be set"

# Succeed with virtual secrets only (do not use real production passwords):
$env:POSTGRES_USER="postgres"
$env:POSTGRES_PASSWORD="test-only-pg-secret"
$env:POSTGRES_DB="xtch"
$env:MINIO_ROOT_USER="test-only-minio-user"
$env:MINIO_ROOT_PASSWORD="test-only-minio-secret"
docker compose config   # exit 0; inspect YAML — no minioadmin/postgres password literals
```

Or use a temporary env file: `docker compose --env-file path\to\virtual.env config`.
