# 环境分层与运维入口

仓库里有 **四层运行环境**、**两套生产部署**。`selfhost` **不是**第三套环境，只是 `win11-home` 的旧别名（软兼容回退）。

同一套应用代码；换的是「机器 + 域名 + 该 target 的 env / Caddy / 进程管理」。**同一时刻只应有一个生产 target 对外接 DNS。**

## 四层一览

| 层级 | Target | 用途 | Env 文件 | Supabase | 边缘 / 进程 | 文档 |
|---|---|---|---|---|---|---|
| 开发 | `local` | 日常 Vite | `env/local/.env` | **Dev** | Vite `:3000` | [local.md](./local.md) |
| 测试台 | `tunnel` | 临时公网 | `env/tunnel/.env` | **Dev** | cloudflared → Vite `:3000` | [tunnel.md](./tunnel.md) |
| 生产 A | `win11-home` | 家宽 Win11 对外站 | `env/win11-home/.env` | **Prod** | Caddy → Node `:3080` | [win11-home.md](./win11-home.md) |
| 生产 B | `cloud-vps` | Linux 云主机对外站 | `env/cloud-vps/.env` | **Prod** | Caddy → Node `:3080` | [cloud-vps.md](./cloud-vps.md) |

**别名**：`selfhost` → `win11-home`。npm `build:selfhost` / `selfhost` / `db:migrate:selfhost` 仍可用。

共享（不按 target 分叉）：`app/scripts/serve-selfhost.mjs`、`docker-compose.yml`、`app/api/**`。

### 路径约定

| 目录 | 内容 |
|---|---|
| `env/<target>/` | 配置真相源（`.env` 不进 git；`.env.example` 进 git） |
| `deploy/<target>/` | 仅边缘/进程资产（Caddyfile、bootstrap、systemd） |
| `docs/ops/` | 本运维文档（按 target + `shared/`） |

加载器：`scripts/env/targetEnv.ts`。优先 `env/<target>/.env`；一轮内可回退旧 `app/.env.*.local`（会 `console.warn`）。

说明见 [env/README.md](../../env/README.md)、[app/ENV.md](../../app/ENV.md)。

### 共享专题

- [shared/compose-credentials.md](./shared/compose-credentials.md) — Compose 无默认密码；首启 / 旧 volume 改密
- [shared/caddy-csp-matrix.md](./shared/caddy-csp-matrix.md) — CSP 上线前测试矩阵（V1 未启用严格 CSP）
- [shared/minio.md](./shared/minio.md)
- [shared/content-backup.md](./shared/content-backup.md)
- [shared/booking-email.md](./shared/booking-email.md) — 支付成功旅客确认信、运营副本与重试语义

## S1 身份与双名单

- `local` + `tunnel` → **Dev Supabase**
- `win11-home` + `cloud-vps` → **Prod Supabase** + `ADMIN_OPS_EMAIL_ALLOWLIST` / `ADMIN_TECH_EMAIL_ALLOWLIST`
- 公网 target：`deploy:serve` 拒启空名单或仅 `you@example.com`（G1）；禁止 `DEV_*` bypass

详见各 target 文档的 S1 验收清单。

## 常用命令（在 `app/`）

```powershell
# 构建（Vite --mode 读对应 env/<target>/.env）
npm run build:win11-home
npm run build:cloud-vps

# 运行（读 DEPLOY_TARGET 或 --target；默认 win11-home）
$env:DEPLOY_TARGET="win11-home"; npm run deploy:serve
npm run deploy:serve -- --target cloud-vps

# 迁移
npm run db:migrate:win11-home
npm run db:migrate:cloud-vps
```

## 切换清单（例如 Win11 → 云）

1. 在云上按 [cloud-vps.md](./cloud-vps.md) 空库起步并验收 HTTPS / Admin / `/api` / `/s3`
2. 把公网 DNS A 指到云主机
3. Win11 停公网 80/443（备胎可留本机进程，但不接域名）
4. 确认只有一个 target 接 DNS；勿两边同时接同一域名

数据从 Win11 迁到云（Postgres/MinIO）**不在**本目录默认流程内，另开任务。

## 旧路径跳转

| 旧路径 | 新路径 |
|---|---|
| `docs/ops/deploy/README.md` | [README.md](./README.md) |
| `docs/ops/deploy/win11-home.md` | [win11-home.md](./win11-home.md) |
| `docs/ops/deploy/cloud-vps.md` | [cloud-vps.md](./cloud-vps.md) |
| `docs/ops/tunnel-testbed.md` | [tunnel.md](./tunnel.md) |
| `docs/ops/win11-selfhost.md` | [win11-home.md](./win11-home.md) |
| `docs/ops/minio-win11.md` | [shared/minio.md](./shared/minio.md) |
| `docs/ops/content-backup.md` | [shared/content-backup.md](./shared/content-backup.md) |
| `app/.env.*.local` | `env/<target>/.env` |
