# Tunnel testbed（本机公网可达，非真生产）

## 目标 / 非目标

**是什么**：Win11 本机全栈 + Cloudflare quick tunnel，外网可打开；形态是 `vite --mode tunnel`（开发服务器，不是 `NODE_ENV=production` 构建）。

**不是什么**：

- 不买域名、无长期固定 hostname
- 不建正式 `prod` 分支 / 生产运行时
- 无 Stripe 真收款（`DEV_CHECKOUT_BYPASS`）
- 无开机自启、无 Cloudflare Access

## 安全警告（必读）

隧道 URL 对公网开放时，**Admin 与 auth bypass 等于裸奔**：

- `VITE_DEV_AUTH_BYPASS_EMAIL` / `DEV_AUTH_BYPASS_EMAIL` / `ADMIN_EMAIL_ALLOWLIST` 指向的邮箱可直接进 Admin、下单
- 任何人拿到 `*.trycloudflare.com` 链接都能操作测试库与测试桶

用完请 **Ctrl+C** 关掉 `testbed:tunnel`（同时停 Vite 与 cloudflared）。不要把链接发到公开群。

## 架构

```text
Visitor → Cloudflare quick tunnel → Vite :3000
                                      ├─ local API middleware
                                      ├─ /s3 proxy → MinIO :9000
                                      └─ POSTGRES_URL → xtch_tunnel
```

Presign 的 Host 必须等于隧道域名：脚本把 `S3_ENDPOINT` / `S3_PUBLIC_BASE_URL` 写成 `https://<tunnel>/s3` 与 `.../s3/xtch-tunnel`，浏览器同域 PUT/GET。

## 前置

1. Docker Desktop：`docker compose up -d`（Postgres + MinIO）
2. [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) 在 PATH
3. Resend API key（试用域需 `BOOKING_EMAIL_OVERRIDE_TO` = 账号本人邮箱）

## 首次准备

### 1. 测试库 `xtch_tunnel`

新 volume：`docker/postgres/init-extra-db.sql` 会在首次 init 时 `CREATE DATABASE xtch_tunnel`。

已有 `xtch_pg_data` 时一次性执行：

```bash
docker exec -it xtch-postgres psql -U postgres -c "CREATE DATABASE xtch_tunnel;"
```

若库已存在可忽略报错。

### 2. 测试桶 `xtch-tunnel`

`minio-init` 会创建 `xtch-public` 与 `xtch-tunnel`（均 public-read）。若 compose 已跑过、只加了新桶逻辑，再执行一次：

```bash
docker compose up minio-init
```

### 3. Env

```bash
# 在 app/ 下
copy .env.tunnel.local.example .env.tunnel.local
```

填：`RESEND_API_KEY`、bypass / Admin 邮箱、`BOOKING_EMAIL_OVERRIDE_TO`。`STRIPE_SECRET_KEY` 留空。

### 4. 迁移（必须打到隧道库）

```bash
cd app
npm run db:migrate:tunnel
```

确认日志里 Target 含 `xtch_tunnel`，不要误迁日常 `xtch`。

### 5. 可选：内容 seed / backfill

空库时首页会空。可对隧道库跑现有 backfill（确保进程 env 的 `POSTGRES_URL` 指向 `xtch_tunnel`，或临时改 `.env.tunnel.local` 后用与 migrate 相同方式加载）。日常开发仍用 `xtch` + `xtch-public`。

## 每次启动

```bash
cd app
npm run testbed:tunnel
```

脚本会：

1. 检查 `cloudflared` 与 `.env.tunnel.local`
2. 起 quick tunnel，解析 `https://*.trycloudflare.com`
3. 回写 `S3_ENDPOINT` / `S3_PUBLIC_BASE_URL` / 若干 redirect URL
4. 释放 3000 后启动 `vite --mode tunnel`
5. 控制台打印公网 URL

也可手动：先自己起 cloudflared，改好 env，再 `npm run dev:tunnel`。

## 验收清单（第一期）

1. 外网打开隧道 URL，首页/关键页可浏览（有内容；空库先 seed/backfill）
2. Mini-App bypass 下单成功，`xtch_tunnel` 中有订单
3. Admin 可进（bypass）；媒体：presign → PUT `/s3/...` → 前台同域 `publicUrl` 显示
4. 收件箱收到 Resend 确认信（override 到本人）

## 相关

- MinIO 日常本机：`docs/ops/minio-win11.md`
- Agent 陷阱：`docs/agent-gotchas.md`（tunnel env 覆盖、presign Host、bypass 勿当生产）
