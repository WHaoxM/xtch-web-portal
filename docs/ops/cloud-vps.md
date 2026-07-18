# Deploy target: cloud-vps（Linux 云主机）

## 目标 / 非目标

**是什么**：Ubuntu/Debian VPS 上跑与 Win11 同拓扑的生产站——Caddy `:80/:443` → Node `127.0.0.1:3000`（`dist` + `/api` + `/s3`）→ 本机 Docker Postgres/MinIO。仓库内提供脚本与 systemd 单元；**主机开通后再 SSH 落地**。

**不是什么**：

- 本期不做：真实 SSH 代操作、从 Win11 导库/导桶、Stripe live 默认开通
- 不是隧道测试台；**禁止** auth/checkout bypass
- 不是同时与 `win11-home` 接同一公网 DNS（见 [README.md](./README.md) 切换清单）

## 架构

```text
Visitor → DNS A → VPS :80/:443 → Caddy (HTTPS) → Node deploy:serve :3000 (127.0.0.1)
                                                    ├─ static app/dist
                                                    ├─ /api/*
                                                    └─ /s3/* → MinIO 127.0.0.1:9000
API → Postgres 127.0.0.1:5432 (xtch_prod，空库起步)
桶 xtch-prod（空桶起步）
```

## 上机顺序（主机开通后）

### 1. DNS 与安全组

1. DNS **A 记录** → 云主机公网 IP
2. 安全组放行 **80/443**；**不要**放行 `5432` / `9000` / `9001` / `3000`

### 2. Bootstrap

在 VPS 上（普通用户 + sudo）：

```bash
# 若已 clone：
bash deploy/cloud-vps/bootstrap.sh
# 或按脚本内逐步命令：Docker / Node 20 / Caddy / UFW
```

装完若加入了 `docker` 组，需重新登录后再跑 compose。

### 3. 仓库 + Docker

```bash
sudo mkdir -p /opt
sudo chown "$USER:$USER" /opt
git clone <YOUR_REPO_URL> /opt/xtch-web-portal
cd /opt/xtch-web-portal
docker compose up -d
```

**立刻改掉**默认 `postgres` / `minioadmin` 口令（compose + 已有 volume 时容器内改密），并准备写入 `env/cloud-vps/.env`。

可选：创建系统用户 `xtch`（bootstrap 已尝试），并把仓库属主交给该用户，与 `xtch-app.service` 一致。

### 4. Env

```bash
cd /opt/xtch-web-portal
cp env/cloud-vps/.env.example env/cloud-vps/.env
# 编辑：YOUR_DOMAIN、DB/MinIO、Prod Supabase、双名单、Resend 等
# 禁止设置任何 DEV_* bypass；名单勿留空、勿用 you@example.com
```

| 变量 | 值 |
|---|---|
| `POSTGRES_URL` | `.../xtch_prod` |
| `S3_ENDPOINT` | `http://127.0.0.1:9000` |
| `S3_BROWSER_ENDPOINT` | `https://YOUR_DOMAIN/s3` |
| `S3_PUBLIC_BASE_URL` | `https://YOUR_DOMAIN/s3/xtch-prod` |
| `S3_BUCKET` | `xtch-prod` |
| `APP_ENV` | `prod` |
| `VITE_SUPABASE_*` | **Prod** Supabase（可与 win11-home 共用同一 Prod 项目） |
| `ADMIN_OPS_EMAIL_ALLOWLIST` / `ADMIN_TECH_EMAIL_ALLOWLIST` | 真实运营/技术邮箱（必填；空或占位拒启） |

### 5. 空库 migrate + 构建

```bash
cd /opt/xtch-web-portal/app
npm install
npm run db:migrate:cloud-vps   # 确认 Target 为 xtch_prod，勿误伤本机/隧道库
npm run build:cloud-vps
```

### 6. systemd + Caddy

```bash
# 按实际路径改 WorkingDirectory / User
sudo cp /opt/xtch-web-portal/deploy/cloud-vps/xtch-app.service /etc/systemd/system/xtch-app.service
sudo systemctl daemon-reload
sudo systemctl enable --now xtch-app
sudo systemctl status xtch-app
```

编辑 [`deploy/cloud-vps/Caddyfile`](../../deploy/cloud-vps/Caddyfile)：替换 `YOUR_DOMAIN`。将 Caddy 指向该文件（发行版默认 unit 常用 `/etc/caddy/Caddyfile`——可复制或改 unit 的配置路径），然后：

```bash
sudo systemctl reload caddy   # 或 restart
```

本机冒烟（SSH 上）：

- `curl -sS http://127.0.0.1:3000/` → HTML
- `curl -sS http://127.0.0.1:3000/api/routes` → JSON
- `curl -sS http://127.0.0.1:3000/s3/minio/health/live` → MinIO health

### 7. S1 验收

1. `https://YOUR_DOMAIN` 首页 + 有效证书
2. Admin **无 bypass**；Prod Supabase 真登录 + 双名单；侧栏显示「运营」/「技术」
3. 空/占位名单时 `deploy:serve` 拒启；填真实名单后可起
4. `GET /api/routes` 正常（空库可为 `[]`）
5. 同域 `/s3` health 或对象可读
6. 外网端口扫描：仅 80/443；`5432`/`9000`/`9001`/`3000` 不通

### 8. 切流量

1. 确认云验收通过后，把 DNS A 指到云
2. Win11 停公网 80/443（备胎可留，但不接域名）
3. 同一时刻只有 `cloud-vps` 接该域名

## 日常更新

```bash
cd /opt/xtch-web-portal
git pull
cd app
npm install
npm run db:migrate:cloud-vps   # 若有新 migration
npm run build:cloud-vps
sudo systemctl restart xtch-app
```

## 风险 / 后续

- **数据**：云上默认空库空桶；从 Win11 迁 Postgres/MinIO 另开任务
- **证书**：需公网 80 可达；DNS 未指向本机时 Caddy 无法签发
- **systemd User**：若不用 `xtch` 用户，改 unit 中的 `User`/`Group`/`WorkingDirectory`
