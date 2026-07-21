# local（日常开发）

日常 Vite 开发环境。配置真相源：`env/local/.env`（从 `env/local/.env.example` 复制）。

## 常用

```powershell
cd app
npm run dev          # http://127.0.0.1:3000
npm run db:migrate   # --env local → env/local/.env
```

- 开发固定 `:3000`；生产 `deploy:serve` 用 `:3080`，可同机并行（见 [README.md](./README.md)）
- Dev Supabase；可开 `DEV_*` bypass（勿用于公网 target）
- Docker：先 `Copy-Item .env.example .env` 并填写口令，再 `docker compose up -d`（Postgres + MinIO，日常库 `xtch` / 桶 `xtch-public`）。无内置默认密码，见 [shared/compose-credentials.md](./shared/compose-credentials.md)
- MinIO 细节：[shared/minio.md](./shared/minio.md)

旧路径 `app/.env.local` 仍可回退一轮（加载时 warn）。见 [README.md](./README.md)。
