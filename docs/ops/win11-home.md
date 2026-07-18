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
Visitor → Router :80/:443 → Caddy (HTTPS) → Node deploy:serve :3000 (127.0.0.1)
                                              ├─ static app/dist (HashRouter)
                                              ├─ /api/* → app/api handlers
                                              └─ /s3/* → MinIO 127.0.0.1:9000
API → Postgres 127.0.0.1:5432 (xtch_prod)
Presign 签本机 MinIO（桶 xtch-prod）；浏览器 PUT/GET 走 https://YOUR_DOMAIN/s3（S3_BROWSER_ENDPOINT）
```

## 前提（缺一则 HTTPS 起不来）

1. 域名 DNS **A 记录**指向当前公网 IP（家宽 IP 变了要改或上动态 DNS）
2. 路由器把 **TCP 80、443** 转到这台 Win11
3. 运营商未封锁入站 80/443
4. Win11 防火墙：域名 HTTPS 放行 80/443；局域网调试可放行 3000；**不要**对公网放行 5432/9000/9001（3000 仅在你明确要直连调试时对局域网开放）

## 安全（必读）

- **禁止** `DEV_CHECKOUT_BYPASS` / `DEV_AUTH_BYPASS_EMAIL` / `VITE_DEV_AUTH_BYPASS_EMAIL`。`npm run deploy:serve`（或 `selfhost`）检测到会直接退出。
- Docker 端口已绑 `127.0.0.1`（见仓库根 `docker-compose.yml`）。公网前务必改掉默认 `postgres` / `minioadmin` 口令，并同步改 `env/win11-home/.env` 与 `minio-init` 里的 mc 凭据。
- Admin 只走真实 **Prod Supabase** 登录 + 双名单：`ADMIN_OPS_EMAIL_ALLOWLIST` / `ADMIN_TECH_EMAIL_ALLOWLIST`（旧 `ADMIN_EMAIL_ALLOWLIST` 仍兼容，全部视为 tech）。空名单或仅 `you@example.com` 时 `deploy:serve` 拒启。

## 首次准备

### 1. Docker

仓库根：

```powershell
docker compose up -d
```

确认本机可连 `127.0.0.1:5432` 与 `127.0.0.1:9000`（外网应不通）。

公网前改密示例（新 volume 可直接改 compose；已有 volume 需在容器内 `ALTER USER` / MinIO 控制台改密，并改 compose 环境变量后重建）：

- `POSTGRES_PASSWORD`
- `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`
- `minio-init` 里 `mc alias set ...` 的用户名密码

### 2. Env

```powershell
# 仓库根
Copy-Item env\win11-home\.env.example env\win11-home\.env
```

若仍有旧文件 `app/.env.win11-home.local` 或 `app/.env.selfhost.local`：serve/migrate/`build:win11-home` 会回退读取并 warn；建议迁到 `env/win11-home/.env`。

填数据库/MinIO 口令、Supabase、Resend（可选）、Stripe（可选）。多入口公开地址：

| 变量 | 值 |
|---|---|
| `POSTGRES_URL` | `.../xtch_prod`（生产隔离库；不是日常 `xtch`，不是 `xtch_tunnel`） |
| `S3_ENDPOINT` | `http://127.0.0.1:9000`（签名用本机） |
| `S3_BUCKET` | `xtch-prod` |
| `APP_ENV` | `prod` |
| `PUBLIC_DOMAIN` | 有域名时填（最高优先，默认 https） |
| `PUBLIC_IP` | 可选公网 IP（次优先，http） |
| `SELFHOST_HOST` | 默认 `0.0.0.0`（局域网/公网网卡可达）；本机-only 用 `127.0.0.1` |

`S3_BROWSER_ENDPOINT` / `S3_PUBLIC_BASE_URL` 可留空：浏览器 `/s3` **跟当前访问 Host**；无请求时按 `PUBLIC_DOMAIN` > `PUBLIC_IP` > 局域网侦测。

`VITE_AUTH_REDIRECT_URL` 建议**留空**（前端用 `window.location.origin`）。在 Supabase / Google 白名单登记会用到的每个 origin（域名、公网 IP、局域网 IP）。`VITE_*` 在 **构建时** 打进前端，改完需 `build:win11-home`。

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

- `http://127.0.0.1:3000/` → 首页 HTML
- `http://127.0.0.1:3000/api/routes` → JSON（库空则为 `[]`）
- `http://127.0.0.1:3000/s3/minio/health/live` → MinIO health（若代理路径可用；否则用桶对象测）

默认监听 `0.0.0.0:3000`（启动日志会打印规范 Origin 与 LAN hint）。域名 HTTPS 仍建议前面挂 Caddy；直连 IP/局域网用 HTTP。

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
| Caddy | Windows 服务，依赖 Node 已监听 3000 |

重启后按验收清单第 5 项自测。

## S1 验收清单（身份与标准配置）

完成下列再对外宣告「生产可用」：

1. 域名 DNS A 指向本机；路由器 80/443 端口映射；`https://YOUR_DOMAIN` 证书有效
2. Docker 已改掉默认 `postgres` / `minioadmin` 口令，并同步到 `env/win11-home/.env`
3. **Prod** Supabase 项目：`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` 已填；Auth 回调含 `https://YOUR_DOMAIN/#/...`
4. 双名单已填真实邮箱：`ADMIN_OPS_EMAIL_ALLOWLIST` / `ADMIN_TECH_EMAIL_ALLOWLIST`（勿留空、勿用 `you@example.com`）
5. **禁止** `DEV_CHECKOUT_BYPASS` / `DEV_AUTH_BYPASS_*`；空/占位名单时 `deploy:serve` 必须拒启
6. 库桶隔离：`POSTGRES_URL` → `xtch_prod`；`S3_BUCKET=xtch-prod`；`APP_ENV=prod`
7. `npm run build:win11-home` 后 `npm run deploy:serve`（或 `selfhost`）可起；Caddy 反代正常
8. 用 Prod Supabase 真账号登录 Admin；侧栏显示「运营」或「技术」；现有面板对运营齐全

补充（运维）：

- 媒体：presign → PUT `https://YOUR_DOMAIN/s3/...` → 前台同域显示（非 403）
- 外网只扫到 80/443；`5432` / `9000` / `9001` / `3000` 外网不通
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
