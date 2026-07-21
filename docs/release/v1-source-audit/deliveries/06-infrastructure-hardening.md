# 交付报告：基础设施加固

- Task: [`../06-infrastructure-hardening.md`](../06-infrastructure-hardening.md)
- Status: `ready-for-validation`
- Agent: Subagent-6 (infra-hardening)
- Started: 2026-07-21
- Finished: 2026-07-21

## 修改文件

### Owns

- `docker-compose.yml` — `${VAR:?}` fail-fast；无默认密码；minio-init 共用 `MINIO_ROOT_*`
- `.env.example` — Compose 凭据占位（`REPLACE_ME_*`）
- `deploy/cloud-vps/bootstrap.sh` — 系统 home `/var/lib/xtch` 与仓库 `/opt/xtch-web-portal` 分离；可重复执行
- `deploy/cloud-vps/grant-xtch-read-access.sh` — 新建：组读 + env 640
- `deploy/cloud-vps/xtch-app.service` — `SELFHOST_HOST=127.0.0.1`、`TRUST_PROXY=1`、hardening
- `deploy/cloud-vps/Caddyfile` — 体限/超时/安全头；`/s3` 与 webhook 分路
- `deploy/win11-home/Caddyfile` — 同上
- `deploy/validate-infra.test.mjs` — 静态 + 可选 docker/caddy 校验
- `docs/ops/shared/compose-credentials.md` — 新建：首启 / 旧 volume 改密
- `docs/ops/shared/caddy-csp-matrix.md` — 新建：CSP 矩阵（未上线严格 CSP）
- `docs/ops/cloud-vps.md` / `win11-home.md` / `local.md` / `tunnel.md` / `README.md` / `shared/minio.md`
- `docs/release/v1-source-audit/deliveries/06-infrastructure-hardening.md` — 本报告

### May Touch

- `env/cloud-vps/.env.example` — `SELFHOST_HOST=127.0.0.1`、`TRUST_PROXY=1`、占位符对齐
- `env/win11-home/.env.example` — 同上
- `.gitignore` — 忽略仓库根 `/.env`
- `docs/agent-gotchas.md` — Compose 无默认密码一行
- `docs/agent-progress.md` / `docs/agent-task-board.md` — 登记与 Blocking Request

### 未改（边界）

- 未改 `package.json`（`test:infra` 交角色 5）
- 未启用严格 CSP
- 未连接真实主机 / 防火墙 / DNS；未读未改真实 `env/*/.env`

## 问题与修复

### Compose 凭据

- **根因**：Postgres/MinIO/`minio-init` 硬编码 `postgres` / `minioadmin`，靠人工事后改密。
- **修复**：全部改为 `${VAR:?…}`；根 `.env.example` 仅 `REPLACE_ME_*`；文档区分首启与旧 volume 改密。

### Bootstrap / clone 权限

- **根因**：`useradd --home-dir /opt/xtch-web-portal` 与 clone 同路径冲突。
- **修复**：home=`/var/lib/xtch`；repo=`/opt/xtch-web-portal`（部署用户写）；`grant-xtch-read-access.sh` 给 `xtch` 组读；脚本对已存在用户/目录幂等。

### Node 监听

- **根因**：文档写 loopback，systemd 未设 `SELFHOST_HOST`。
- **修复**：unit 强制 `127.0.0.1:3080`；文档强调安全组/UFW 不开放 3080；Caddy 唯一公网入口。

### systemd hardening

- **启用**：`NoNewPrivileges`、`PrivateTmp`、`ProtectSystem=strict`、`ProtectHome`、`ReadWritePaths=/var/lib/xtch`、`RestrictAddressFamilies`、资源上限等。
- **未启用及原因**：`PrivateNetwork`（需连本机 PG/MinIO 与外网 Stripe/Resend）；`MemoryDenyWriteExecute`（Node JIT）；严格 `SystemCallFilter`（V1 未在目标机验证）。

### Caddy 边缘防护

- 对齐角色 2：JSON **1MB**、webhook **256KB**、`read_body 30s`、上游读/写/响应头 **60s**（`/s3` **120s**）。
- 安全头：HSTS、`X-Content-Type-Options`、Referrer-Policy、Permissions-Policy。
- 严格 CSP：**未上线**；矩阵见 `docs/ops/shared/caddy-csp-matrix.md`。

## 上游依赖记录

| 项 | 值（来自 `deliveries/02-runtime-api-security.md`） |
|---|---|
| JSON API body | 1048576 bytes（1 MiB） |
| Stripe webhook body | 262144 bytes（256 KiB） |
| 代理读超时 | 60s |
| 请求体超时 | 30s |
| env 清单 | 已在生产 `.env.example` 体现 loopback + `TRUST_PROXY`；完整 fail-closed 规则仍由角色 2 `validateTargetEnv` 执行 |

角色 1 交接：`TRUST_PROXY=1` 已写入 cloud-vps systemd 与两套生产 env.example。

## 新增或更新校验

| 文件 | 覆盖 |
|---|---|
| `deploy/validate-infra.test.mjs` | compose fail-fast、无弱默认、bootstrap 路径、systemd、Caddy 体限/头、env.example；可选 docker compose config / caddy validate / shellcheck / systemd-analyze |

## 验证命令

| Isolated environment | Command | Exit code | Result |
|---|---|---:|---|
| 仓库根（Win11） | `node --test deploy/validate-infra.test.mjs` | 0 | 9 pass；shellcheck / systemd-analyze skipped（本机无） |
| 同上（含于上条） | `docker compose --env-file tmp/compose-empty.env config` | ≠0 | 缺凭据失败（虚拟空文件） |
| 同上 | `docker compose --env-file tmp/compose-virtual.env config` | 0 | 虚拟凭据成功；无 `minioadmin` |
| 同上 | `caddy validate --config deploy/cloud-vps/Caddyfile` | 0 | 通过（经测试套件） |
| 同上 | `caddy validate --config deploy/win11-home/Caddyfile` | 0 | 通过 |
| Linux VPS | `systemd-analyze security …` | — | **未验证**（本机 Windows） |
| Linux VPS | ShellCheck bootstrap | — | **未验证** |
| 真机 | API 超限 413 / webhook / `/s3` 冒烟 | — | **未验证**（禁止连真机） |

虚拟 compose env 仅写在根 `tmp/`（gitignored），未使用真实密钥。

## 未验证项与剩余风险

- 未在 Linux 上跑 `systemd-analyze security` / ShellCheck。
- 未对真实 Caddy 边缘做超限 HTTP 413 与 webhook/`/s3` 联调（需真机或本地起全栈）。
- 已有 Docker volume 仍可能是旧弱口令；改 compose **不会**自动改密——依赖运维按文档旋转。
- 严格 CSP 未启用；上线前需填矩阵并人工确认。
- 本机若已有根 `.env` 或旧默认 volume，开发者需按 `compose-credentials.md` 迁移。

## 给角色 5

建议登记（未改 package.json）：

```text
test:infra → node --test ../deploy/validate-infra.test.mjs
```
（在 `app/` 下；或根目录直接 `node --test deploy/validate-infra.test.mjs`）

Blocking Request 已写在 `docs/agent-task-board.md`。

## 边界声明

- [x] 未连接或修改真实主机/防火墙/DNS
- [x] 未部署或推送
- [x] 未访问真实生产数据
- [x] 未读取或修改真实 env/密钥
- [x] May Touch 仅 env.example、根 `.gitignore`、`docs/agent-gotchas.md`、进度/任务板；无越界业务代码
