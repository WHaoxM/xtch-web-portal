-- Extra DBs isolated from daily `xtch` dev data.
-- Runs only on first Postgres volume init. Existing volumes: see docs/ops/tunnel-testbed.md
-- and docs/ops/win11-selfhost.md / docs/ops/content-backup.md.
CREATE DATABASE xtch_tunnel;
CREATE DATABASE xtch_prod;
