# Deploy target: win11-home（家宽 Win11）

## 目标 / 非目标

**是什么**：这台 Win11 对外提供完整站点——`dist` 静态资源 + `/api` + 同域 `/s3`（MinIO），边缘用 Caddy 做 80/443 与自动 HTTPS。生产隔离库 `xtch_prod`、桶 `xtch-prod`（与日常 `xtch` / `xtch-public`、隧道 `xtch_tunnel` / `xtch-tunnel` 分开）。

**不是什么**：

- 不是 Vercel 部署，不是 Cloudflare Named Tunnel
- 不是隧道测试台（[tunnel.md](./tunnel.md)）；不要开 auth/checkout bypass
- 不是 `cloud-vps`（见 [cloud-vps.md](./cloud-vps.md)）；同一时刻只应有一个 target 接公网 DNS
- 不默认开通 Stripe 真收款（需你另配 live/test key + webhook）

## 架构

```text
Visitor → Router :80/:443 → Caddy (HTTPS) → Node deploy:serve :3080 (127.0.0.1)
                                              ├─ static app/dist/win11-home (BrowserRouter + prerender; per-target outDir)
                                              ├─ /api/* → app/api handlers
                                              └─ /s3/* → MinIO 127.0.0.1:9000
API → Postgres 127.0.0.1:5432 (xtch_prod)
Presign 签本机 MinIO（桶 xtch-prod）；浏览器 PUT/GET 走 https://YOUR_DOMAIN/s3（S3_BROWSER_ENDPOINT）
```

## 前提（缺一则 HTTPS 起不来）

1. 域名 DNS **A 记录**指向当前公网 IP（家宽 IP 变了要改或上动态 DNS）
2. 路由器把 **TCP 80、443** 转到这台 Win11
3. 运营商未封锁入站 80/443
4. Win11 防火墙：域名 HTTPS 放行 80/443；局域网调试可放行 **3080**（`deploy:serve`）；**不要**对公网放行 5432/9000/9001（3080 仅在你明确要直连调试时对局域网开放）。日常 Vite 开发仍用 **3000**，与生产端口分开。

## 安全（必读）

- **禁止** `DEV_CHECKOUT_BYPASS` / `DEV_AUTH_BYPASS_EMAIL` / `VITE_DEV_AUTH_BYPASS_EMAIL`。`npm run deploy:serve`（或 `selfhost`）检测到会直接退出。
- Docker 端口已绑 `127.0.0.1`（见仓库根 `docker-compose.yml`）。**无内置默认密码**——必须先配置仓库根 `.env`（见 [compose-credentials.md](./shared/compose-credentials.md)）。
- Caddy 为公网入口时：`SELFHOST_HOST=127.0.0.1`、`TRUST_PROXY=1`；**不要**对公网开放 `3080`。
- Admin 只走真实 **Prod Supabase** 登录 + 双名单：`ADMIN_OPS_EMAIL_ALLOWLIST` / `ADMIN_TECH_EMAIL_ALLOWLIST`（旧 `ADMIN_EMAIL_ALLOWLIST` 仍兼容，全部视为 tech）。空名单或仅 `you@example.com` 时 `deploy:serve` 拒启。

## 首次准备

### 1. Docker

仓库根：

```powershell
Copy-Item .env.example .env
# 编辑全部 REPLACE_ME_*（强随机）；与 env/win11-home/.env 保持一致
docker compose up -d
```

确认本机可连 `127.0.0.1:5432` 与 `127.0.0.1:9000`（外网应不通）。

- **新 volume**：第一次 `up` 前就把最终口令写进根 `.env`。
- **已有 volume**：改 `.env` / compose **不会**自动改旧密码；按 [compose-credentials.md](./shared/compose-credentials.md) 在容器内 `ALTER USER` / MinIO 控制台改密后再同步 env。

### 2. Env

```powershell
# 仓库根
Copy-Item env\win11-home\.env.example env\win11-home\.env
```

若仍有旧文件 `app/.env.win11-home.local` 或 `app/.env.selfhost.local`：serve/migrate/`build:win11-home` 会回退读取并 warn；建议迁到 `env/win11-home/.env`。

填数据库/MinIO 口令（与根 `.env` 一致）、Supabase、Resend（可选）、Stripe（可选）。公网询盘表单还需 **Cloudflare Turnstile**（见下）。多入口公开地址：

| 变量 | 值 |
|---|---|
| `POSTGRES_URL` | `.../xtch_prod`（生产隔离库；不是日常 `xtch`，不是 `xtch_tunnel`） |
| `S3_ENDPOINT` | `http://127.0.0.1:9000`（签名用本机） |
| `S3_BUCKET` | `xtch-prod` |
| `APP_ENV` | `prod` |
| `PUBLIC_DOMAIN` | 有域名时填（最高优先，默认 https） |
| `PUBLIC_IP` | 可选公网 IP（次优先，http） |
| `SELFHOST_HOST` | 有 Caddy 时用 `127.0.0.1`；仅当需要局域网直连 `:3080` 时用 `0.0.0.0` |
| `SELFHOST_PORT` | 默认 `3080`（与 Vite 开发 `:3000` 分开；可用 env 覆盖） |
| `TRUST_PROXY` | Caddy 后设 `1`；直连 Node 时设 `0` |

`S3_BROWSER_ENDPOINT` / `S3_PUBLIC_BASE_URL` 可留空：浏览器 `/s3` **跟当前访问 Host**；无请求时按 `PUBLIC_DOMAIN` > `PUBLIC_IP` > 局域网侦测。

`VITE_AUTH_REDIRECT_URL` 建议**留空**（前端默认 `{origin}/auth/callback`；Admin 登录会变成 `{origin}/auth/callback?auth_next=admin`）。在 Supabase **Redirect URLs** 登记每个入口，建议用通配以免 query 被拒：

- `http://127.0.0.1:3080/**`
- `http://192.168.x.x:3080/**`（本机局域网 IP；`deploy:serve` 默认端口）
- `https://你的域名/**`（有域名时）

也可同时保留精确的 `/auth/callback`（以及过渡期旧 `/#/auth/callback`）。Site URL 用站点根（不要写成 `/#/admin`）。**Confirm email** 保持开启（仅首次注册确认）。

Stripe Checkout success/cancel 用 path：`/china-trips?checkout=…`（不要 `#/`）。`build:win11-home` 会跑 Playwright prerender；首次需本机 `npx playwright install chromium`。

> 开发 Vite 仍是 `:3000`；生产直连/局域网用 `:3080`。Supabase Redirect 两边入口都要登记。

**邮箱 OTP（P0）：** Admin / 旅客主路径是 6 位码，不是 magic link。在 **Dev 与 Prod** Supabase → Authentication → Email Templates → **Magic Link** 正文加入 `{{ .Token }}`（建议主文案写 “Your code is …”）。Admin 发码走 `POST /api/admin/auth-otp`（仅双名单邮箱；旧 `auth-magic-link` 路径仍转发）。OAuth（Google）仍需要 Redirect URLs。`VITE_*` 在 **构建时** 打进前端，改完需 `build:win11-home`。

验收清单（本机）：同设备登录后刷新仍在；Admin/旅客 OTP 同页校验；连续点发送有约 60s 倒计时；游客下单不被登录拦住。

**询盘 Turnstile（公网必配）：** 未设 `VITE_TURNSTILE_SITE_KEY` 时表单黄条 *Inquiry protection is not configured*，且无法提交。

1. Cloudflare Dashboard → Turnstile → 新建 widget；Hostnames 填浏览器地址栏实际域名（含 Caddy/Tunnel 对外域名）。
2. 写入 `env/win11-home/.env`：`VITE_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`（**勿**用 always-pass 测试 key；**勿**提交 git）。
3. **必须** `npm run build:win11-home` 后再重启 `deploy:serve`——site key 是 Vite 编译期注入，只改 `.env` 不重建黄条仍在。
4. 发信另需齐：`RESEND_API_KEY`、`INQUIRY_FROM_EMAIL`、`INQUIRY_TO_EMAIL`（缺则 Turnstile 通过后仍 502）。

内容从备份迁入生产隔离库：见 [shared/content-backup.md](./shared/content-backup.md)。

### 3. 迁移

```powershell
cd app
npm run db:migrate:win11-home
```

确认日志 Target 指向生产隔离库 `xtch_prod`。旧命令 `db:migrate:selfhost` 仍可用（别名）。

### 4. 构建 + 启动 Node

```powershell
cd app
npm run build:win11-home
npm run deploy:serve
# 或旧别名：
# npm run selfhost
```

本机冒烟：

- `http://127.0.0.1:3080/` → 首页 HTML
- `http://127.0.0.1:3080/api/routes` → JSON（库空则为 `[]`）
- `http://127.0.0.1:3080/s3/minio/health/live` → MinIO health（若代理路径可用；否则用桶对象测）

默认监听 `0.0.0.0:3080`（启动日志会打印规范 Origin 与 LAN hint）。域名 HTTPS 仍建议前面挂 Caddy；直连 IP/局域网用 HTTP。与日常 Vite `:3000` 可同机并行。

### 5. Caddy

1. 安装 [Caddy for Windows](https://caddyserver.com/docs/install#windows)
2. 编辑仓库 [`deploy/win11-home/Caddyfile`](../../deploy/win11-home/Caddyfile)：把 `YOUR_DOMAIN` 换成真实域名
3. 管理员 PowerShell（示例）：

```powershell
caddy run --config D:\XTCH_PROJECT\xtch-web-portal\deploy\win11-home\Caddyfile
```

首次申请证书需要公网 80 已映射到本机。验证：`https://YOUR_DOMAIN` 证书有效。

注册为 Windows 服务（任选一种你熟悉的方式，例如 `caddy` 自带 service 安装，或 NSSM 指向 `caddy run --config ...`）。

旧路径 `ops/Caddyfile` 仅为重定向说明，勿再当作维护入口。

## 开机自启

| 组件 | 建议 |
|---|---|
| Docker Desktop | 设置里开启开机启动；compose 已 `restart: unless-stopped` |
| Node | 任务计划程序或 NSSM：工作目录 `app/`，程序 `npm` 参数 `run deploy:serve`（或 `run selfhost`）。依赖 Docker healthy 后再起（可延迟 30–60s） |
| Caddy | Windows 服务，依赖 Node 已监听 3080 |

重启后按验收清单第 5 项自测。

## S1 验收清单（身份与标准配置）

完成下列再对外宣告「生产可用」：

1. 域名 DNS A 指向本机；路由器 80/443 端口映射；`https://YOUR_DOMAIN` 证书有效
2. 根 `.env` 与 `env/win11-home/.env` 使用强随机口令且一致（无 compose 默认弱口令）
3. **Prod** Supabase 项目：`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` 已填；Auth 回调含 `https://YOUR_DOMAIN/#/...`
4. 双名单已填真实邮箱：`ADMIN_OPS_EMAIL_ALLOWLIST` / `ADMIN_TECH_EMAIL_ALLOWLIST`（勿留空、勿用 `you@example.com`）
5. **禁止** `DEV_CHECKOUT_BYPASS` / `DEV_AUTH_BYPASS_*`；空/占位名单时 `deploy:serve` 必须拒启
6. 库桶隔离：`POSTGRES_URL` → `xtch_prod`；`S3_BUCKET=xtch-prod`；`APP_ENV=prod`
7. `npm run build:win11-home` 后 `npm run deploy:serve`（或 `selfhost`）可起；Caddy 反代正常
8. 用 Prod Supabase 真账号登录 Admin；侧栏显示「运营」或「技术」；现有面板对运营齐全

补充（运维）：

- 媒体：presign → PUT `https://YOUR_DOMAIN/s3/...` → 前台同域显示（非 403）
- 外网只扫到 80/443；`5432` / `9000` / `9001` / `3080` 外网不通
- Caddy：JSON API >1 MiB → 413；webhook / `/s3` / BrowserRouter 深链正常；安全头可见；严格 CSP 未启用（见 [caddy-csp-matrix.md](./shared/caddy-csp-matrix.md)）
- 重启 Win11 后 Docker + Caddy + Node 自动恢复

## 日常命令

```powershell
# 更新代码后
cd app
npm run build:win11-home
# 重启 deploy:serve 进程（任务计划/NSSM/手动 Ctrl+C 再起）

# 迁移
npm run db:migrate:win11-home
```

## 风险

- 家宽 IP 变化 → 动态 DNS 或手动改 A 记录
- 家宽禁 80/443 入站 → 换云主机（[cloud-vps.md](./cloud-vps.md)）或改 Tunnel（另一套方案）
- Win11 7×24：休眠/更新/停电会中断；家宽暴露面大于云主机
- 切到云后：DNS 只指一个 target；Win11 可留备胎但不接域名
