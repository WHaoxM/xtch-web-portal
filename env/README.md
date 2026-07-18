# Environment files

Canonical secrets live under `env/<target>/.env` (gitignored). Examples are tracked.

| Target | Path | Purpose |
|---|---|---|
| `local` | `env/local/.env` | Daily Vite (`npm run dev`) |
| `tunnel` | `env/tunnel/.env` | Cloudflare tunnel testbed |
| `win11-home` | `env/win11-home/.env` | Home-broadband production |
| `cloud-vps` | `env/cloud-vps/.env` | Cloud VPS production |

`selfhost` is only a legacy alias of `win11-home` (loaders still accept it).

## Setup

```powershell
Copy-Item env\local\.env.example env\local\.env
# edit secrets
```

Ops overview: [docs/ops/README.md](../docs/ops/README.md).

Loaders resolve `env/<target>/.env` first; for one migration round they fall back to old `app/.env.*.local` with a console warning.
