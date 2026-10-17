# Deploy target: cloud-vps（Linux 云主机）

## 目标 / 非目标

**是什么**：Ubuntu/Debian VPS 上跑与 Win11 同拓扑的生产站——Caddy `:80/:443` → Node `127.0.0.1:3080`（`dist` + `/api` + `/s3`）→ 本机 Docker Postgres/MinIO。仓库内提供脚本与 systemd 单元；**主机开通后再 SSH 落地**。

**不是什么**：

- 本期不做：真实 SSH 代操作、从 Win11 导库/导桶、Stripe live 默认开通
- 不是隧道测试台；**禁止** auth/checkout bypass
- 不是同时与 `win11-home` 接同一公网 DNS（见 [README.md](./README.md) 切换清单）

## 架构

```text
Visitor → DNS A → VPS :80/:443 → Caddy (HTTPS) → Node deploy:serve :3080 (127.0.0.1)
                                                    ├─ static app/dist/cloud-vps
                                                    ├─ /api/*
                                                    └─ /s3/* → MinIO 127.0.0.1:9000
API → Postgres 127.0.0.1:5432 (xtch_prod，空库起步)
桶 xtch-prod（空桶起步）
```

路径职责（bootstrap 后）：

| 路径 | 用途 | 属主 |
|---|---|---|
| `/var/lib/xtch` | 系统用户 `xtch` 的 home（npm cache 等可写） | `xtch:xtch` |
| `/opt/xtch-web-portal` | git clone / 构建 | 部署用户（写）；组 `xtch` 可读 |

**不要**把 `xtch` 的 home 设成仓库目录（旧 bootstrap 曾如此，会与 clone 冲突）。

## 上机顺序（主机开通后）

### 1. DNS 与安全组

1. DNS **A 记录** → 云主机公网 IP
2. 安全组放行 **80/443**；**不要**放行 `5432` / `9000` / `9001` / `3080`
3. 主机 UFW（bootstrap 会配）：仅 OpenSSH + 80/443

### 2. Bootstrap

在 VPS 上（普通用户 + sudo）：

```bash
# 若已 clone：
bash deploy/cloud-vps/bootstrap.sh
# 或按脚本内逐步命令：Docker / Node 20 / Caddy / UFW / xtch 用户
```

装完若加入了 `docker` 组，需重新登录后再跑 compose。

### 3. 仓库 + 权限 + Docker

```bash
# bootstrap 已准备空目录时：
git clone <YOUR_REPO_URL> /opt/xtch-web-portal
cd /opt/xtch-web-portal

# 给运行用户读权限（部署用户保留写）
bash deploy/cloud-vps/grant-xtch-read-access.sh

# Compose 凭据：无默认密码，缺省则 config/up 直接失败
cp .env.example .env
# 编辑全部 REPLACE_ME_*（强随机）；详见 docs/ops/shared/compose-credentials.md
docker compose up -d
```

首次空 volume：在第一次 `up` **之前**写好最终口令。已有 volume 改密见 [compose-credentials.md](./shared/compose-credentials.md)（改 compose **不会**自动改旧 volume）。

### 4. Env

```bash
cd /opt/xtch-web-portal
cp env/cloud-vps/.env.example env/cloud-vps/.env
# 编辑：域名、DB/MinIO（与根 .env 一致）、Prod Supabase、双名单、Resend 等
# 必填：SELFHOST_HOST=127.0.0.1、TRUST_PROXY=1（Caddy 后）
# 禁止任何 DEV_* bypass；名单勿留空、勿用 you@example.com
bash deploy/cloud-vps/grant-xtch-read-access.sh   # 再次收紧 .env 为 640
```

| 变量 | 值 |
|---|---|
| `POSTGRES_URL` | `.../xtch_prod`（密码与 compose `POSTGRES_PASSWORD` 一致） |
| `S3_ENDPOINT` | `http://127.0.0.1:9000` |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | 与 compose `MINIO_ROOT_*` 一致 |
| `S3_BUCKET` | `xtch-prod` |
| `APP_ENV` | `prod` |
| `SELFHOST_HOST` | `127.0.0.1`（与 systemd 一致） |
| `TRUST_PROXY` | `1`（仅 Caddy 后） |
| `VITE_SUPABASE_*` | **Prod** Supabase |
| `ADMIN_OPS_EMAIL_ALLOWLIST` / `ADMIN_TECH_EMAIL_ALLOWLIST` | 真实运营/技术邮箱 |
| `WENSHU_LEAD_TO_EMAIL` | 文数智旅官网表单线索提醒邮箱；至少配置一个可用发信通道 |
| `WENSHU_RESEND_FROM_EMAIL` | 线索专用 Resend 发件地址；优先于 `INQUIRY_FROM_EMAIL`，必须属于已验证域名 |
| `WENSHU_SMTP_USER` / `WENSHU_SMTP_APP_PASSWORD` | QQ SMTP 备用发件账号及**授权码**；仅服务器 `.env` 保存，不是 QQ 登录密码 |

生产启动还会按角色 2 规则校验库名/桶名/占位符/bypass（见 `scripts/env/validateTargetEnv.ts`）。

文数智旅线索由 `POST /api/wenshu?action=lead` 写入 `wenshu_leads`，优先通过 Resend 向 `WENSHU_LEAD_TO_EMAIL` 发提醒；Resend 明确拒绝或连接失败时，如备用 QQ SMTP 已配置，则改走 `smtp.qq.com:465` 的 TLS 通道。仅有一个邮件平台接受后表单才返回成功；两路皆失败时，线索仍保存在库中，表单得到可重试错误。管理员在 `/admin` →「文数智旅线索」查看记录与通知状态，打开详情后可手动重试；“邮件平台已接收”不等于收件箱最终投递。浏览器端重试沿用同一 `Idempotency-Key`，服务端通过数据库发送占用标记避免并发重复发信。若平台已接受但回写数据库失败，或 Resend 请求超时但实际已受理，备用通道可能造成重复邮件；应按回执编号核对。上线验收须用标记清楚的测试线索核对数据库状态，并请收件人检查收件箱/垃圾箱；不要在日志或 Git 中记录真实联系人资料和密钥。

### 5. 空库 migrate + 构建

```bash
cd /opt/xtch-web-portal/app
npm install
npm run db:migrate:cloud-vps   # 确认 Target 为 xtch_prod，勿误伤本机/隧道库
npm run build:cloud-vps
# 构建后再授权一次，确保 dist 对 xtch 可读
cd .. && bash deploy/cloud-vps/grant-xtch-read-access.sh
```

### 6. systemd + Caddy

```bash
sudo cp /opt/xtch-web-portal/deploy/cloud-vps/xtch-app.service /etc/systemd/system/xtch-app.service
sudo systemctl daemon-reload
sudo systemctl enable --now xtch-app
sudo systemctl status xtch-app
# 可选：systemd-analyze security xtch-app.service
```

单元已设置 `SELFHOST_HOST=127.0.0.1`、`TRUST_PROXY=1`，并启用 `NoNewPrivileges` / `PrivateTmp` / `ProtectSystem=strict` 等（见 unit 内注释）。

编辑 [`deploy/cloud-vps/Caddyfile`](../../deploy/cloud-vps/Caddyfile)：确认域名。将 Caddy 指向该文件（发行版默认 unit 常用 `/etc/caddy/Caddyfile`），然后：

```bash
sudo caddy validate --config /opt/xtch-web-portal/deploy/cloud-vps/Caddyfile
sudo systemctl reload caddy
```

边缘层：JSON API 1 MiB、webhook 256 KiB、读超时 60 s、body 超时 30 s；HSTS 等安全头已开；**严格 CSP 未上线**（矩阵见 [caddy-csp-matrix.md](./shared/caddy-csp-matrix.md)）。

本机冒烟（SSH 上）：

- `curl -sS http://127.0.0.1:3080/` → HTML
- `curl -sS http://127.0.0.1:3080/api/routes` → JSON
- `curl -sS http://127.0.0.1:3080/s3/minio/health/live` → MinIO health
- `ss -ltn | grep 3080` → 仅 `127.0.0.1:3080`

### 7. S1 验收

1. `https://YOUR_DOMAIN` 首页 + 有效证书
2. Admin **无 bypass**；Prod Supabase 真登录 + 双名单；侧栏显示「运营」/「技术」
3. 空/占位名单时 `deploy:serve` 拒启；填真实名单后可起
4. `GET /api/routes` 正常（空库可为 `[]`）
5. 同域 `/s3` health 或对象可读
6. 外网端口扫描：仅 80/443；`5432`/`9000`/`9001`/`3080` 不通
7. 超大 JSON（>1 MiB）→ 边缘或应用层 413；合法 webhook / 深链 / `/s3` 正常

### 8. 切流量

1. 确认云验收通过后，把 DNS A 指到云
2. Win11 停公网 80/443（备胎可留，但不接域名）
3. 同一时刻只有 `cloud-vps` 接该域名

## 日常更新

推荐用门禁脚本（与 CI 默认一致：lint + migrate + restart）：

```bash
cd /opt/xtch-web-portal
bash deploy/cloud-vps/deploy-from-main.sh --with-lint --with-migrate
# 只构建不重启：
bash deploy/cloud-vps/deploy-from-main.sh --with-lint --with-migrate --no-restart
```

手工等价步骤：

```bash
cd /opt/xtch-web-portal
git pull
cd app
npm install
npm run db:migrate:cloud-vps   # 若有新 migration
npm run build:cloud-vps
cd .. && bash deploy/cloud-vps/grant-xtch-read-access.sh
sudo systemctl enable xtch-app   # persist start at VPS boot
sudo systemctl restart xtch-app
```

`xtch-app.service` uses `Restart=on-failure`; the deploy gate also runs
`systemctl enable xtch-app` before each restart so boot activation remains enabled.

## 自动发布（main → 校验 → migrate → 重建重启）

目标：合并进远程 **`main`** 后，GitHub Actions 自动 SSH 到 cloud-vps：拉取、生产门禁、**自动 migrate**、`build:cloud-vps`、重启 `xtch-app`。

| 阶段 | 做什么 |
|------|--------|
| 触发 | `push` 到 `main`，或 Actions 里手工 `workflow_dispatch` |
| 拉代码 | `git fetch` + `ff-only` 到 `main`；脏工作树直接失败 |
| 校验 | `npm ci`；`check-target-env cloud-vps`；默认 lint |
| 适配 | **默认** `db:migrate:cloud-vps` |
| 重建 | `npx playwright install chromium`（prerender 浏览器）→ `build:cloud-vps`；先前 `dist/cloud-vps` 备份到 `$HOME/xtch-dist-backup/` || 发布 | `grant-xtch-read-access` + `systemctl restart`；健康检查失败则还原 dist 再重启 |

仓库文件：

- 服务器脚本：[`deploy/cloud-vps/deploy-from-main.sh`](../../deploy/cloud-vps/deploy-from-main.sh)
- Workflow：[`.github/workflows/deploy-cloud-vps.yml`](../../.github/workflows/deploy-cloud-vps.yml)

### 上线前必配（否则 push 会失败）

1. GitHub → Settings → Environments → 建 **`production`**（建议加 required reviewers）。
2. 在该 Environment（或 repo secrets）配置：
   - `VPS_HOST` — 云主机 IP/域名  
   - `VPS_USER` — 可写 `/opt/xtch-web-portal` 的 deploy 用户  
   - `VPS_SSH_KEY` — 该用户的私钥  
   - 可选 `VPS_SSH_PORT`（默认 22）、`DEPLOY_EXTRA_FLAGS`
3. VPS：deploy 用户对 `systemctl restart xtch-app` 与 `grant-xtch-read-access.sh` 有 sudo；仓库干净、能 `git fetch` origin。
4. 建议先 **Actions → Deploy cloud-vps → Run workflow** 跑通一次，再依赖 push。

手工等价（与 push 默认门禁一致）：

```bash
bash deploy/cloud-vps/deploy-from-main.sh --with-lint --with-migrate
```

## 旧 bootstrap 迁移（home 曾指向仓库）

若 `getent passwd xtch` 的 home 仍是 `/opt/xtch-web-portal`：

1. 停服务：`sudo systemctl stop xtch-app`
2. `sudo mkdir -p /var/lib/xtch && sudo chown xtch:xtch /var/lib/xtch`
3. `sudo usermod -d /var/lib/xtch xtch`（确认无登录会话占用）
4. 重新跑 `grant-xtch-read-access.sh`，再 `start` 服务

## 风险 / 后续

- **数据**：云上默认空库空桶；从 Win11 迁 Postgres/MinIO 另开任务
- **证书**：需公网 80 可达；DNS 未指向本机时 Caddy 无法签发
- **systemd User**：若不用 `xtch` 用户，改 unit 中的 `User`/`Group`/`WorkingDirectory`/`ReadWritePaths`
- **CSP**：严格策略待矩阵验证后再开
