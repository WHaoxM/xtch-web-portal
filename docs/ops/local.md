# local（日常开发）

日常 Vite 开发环境。配置真相源：`env/local/.env`（从 `env/local/.env.example` 复制）。

## 常用

```powershell
cd app
npm run dev          # http://127.0.0.1:3000
npm run db:migrate   # --env local → env/local/.env
```

- Dev Supabase；可开 `DEV_*` bypass（勿用于公网 target）
- Docker：`docker compose up -d`（Postgres + MinIO，日常库 `xtch` / 桶 `xtch-public`）
- MinIO 细节：[shared/minio.md](./shared/minio.md)

旧路径 `app/.env.local` 仍可回退一轮（加载时 warn）。见 [README.md](./README.md)。
