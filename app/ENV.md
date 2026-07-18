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
