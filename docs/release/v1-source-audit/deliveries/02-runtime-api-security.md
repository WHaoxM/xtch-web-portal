# 交付报告：Node 运行时与 API 安全

- Task: [`../02-runtime-api-security.md`](../02-runtime-api-security.md)
- Status: `ready-for-validation`
- Agent: Subagent-2 (runtime-api-security)
- Started: 2026-07-21
- Finished: 2026-07-21

## 修改文件

### Owns

- `app/scripts/serve-selfhost.mjs` — 限流读 body、生产 env fail-closed、SEO manifest 驱动页面 404
- `scripts/env/targetEnv.ts` — 无逻辑变更（保持加载职责；校验独立模块）
- `scripts/env/validateTargetEnv.ts` — 新建：按 target 的生产环境 schema
- `app/scripts/requestBodyLimits.ts` — 新建：JSON/webhook 字节上限与流式读取
- `app/scripts/httpRoutePolicy.ts` — 新建：公开路径（SEO manifest）+ SPA 壳分类
- `app/scripts/requestBodyLimits.test.ts` — 新建
- `app/scripts/httpRoutePolicy.test.ts` — 新建
- `scripts/env/validateTargetEnv.test.ts` — 新建
- `docs/release/v1-source-audit/deliveries/02-runtime-api-security.md` — 本交付报告

### May Touch

- `app/vite.config.ts` — 生产 target（win11-home/cloud-vps）构建前接入 `assertTargetEnvValid`
- `scripts/db/migrate.ts` — 部署 target 迁移前接入同一校验
- `app/tsconfig.node.json` — include 新脚本模块
- `docs/agent-progress.md` / `docs/agent-task-board.md` — 登记与交接

### 未改（边界）

- 未改 `app/package.json`（测试脚本交角色 5）
- 未改 `env/*/ .env.example` / `docs/ops/**`（变量清单交角色 6）
- 未改 Caddy/Docker/systemd、真实 `env/*/.env`、订单/Stripe/前端/SEO 业务代码

## 问题与修复

### 1. API 请求体无大小上限

- **根因**：`serve-selfhost.mjs` 在鉴权/handler 前 `for await` 全量 `Buffer.concat`，无上限。
- **修复**：`readLimitedRequestBody` 流式累计；超限立即 `413` 并 `destroy`，不进入 handler。
  - JSON API：`1_048_576` bytes（1 MiB）
  - Stripe webhook：`262_144` bytes（256 KiB）
  - 非法 JSON → 稳定 `400`
  - 客户端中断 → 不升级为通用 500
  - 过大 `Content-Length` 先拒；chunked 超限边读边拒

### 2. 生产启动预检不完整

- **根因**：仅拒 DEV bypass / 空 Admin 名单，仍可用错误库/桶/占位凭据启动。
- **修复**：`validateTargetEnv` 对 `win11-home`/`cloud-vps` fail-closed：
  - `APP_ENV=prod`、`POSTGRES_URL` 库名 `xtch_prod`、`S3_BUCKET=xtch-prod`
  - 拒绝 `CHANGE_ME` / `YOUR_DOMAIN` / `you@example.com` 等占位
  - 禁止全部 DEV bypass；Admin 名单须可用
  - Stripe / Turnstile / Resend：区分未启用 vs 半配置
  - 错误只含变量名与修复提示，不打印密钥或完整 DB URL
- `local`/`tunnel` 不受生产规则误伤
- `deploy:serve`、`vite` 生产 mode、`db:migrate` 部署 target 共用同一规则

### 3. 未知页面的生产 HTTP 状态

- **根因**：未知路径一律 SPA fallback `200` + `index.html`，像首页。
- **修复**：读角色 4 的 `seo-public-route-manifest.json` 作公开白名单；SPA 壳（`/account` `/admin` `/search` `/auth/callback` `/orders/*` `/china-tours`）深链仍 `200`；可确定未知页 `404` + HTML shell；未知 `/api/*` 仍 JSON `404`；缺失静态资源不回 SPA。

## 给其他角色的正式交付

### 给角色 6（基础设施）

- JSON API 上限：**1048576** bytes（1 MiB）
- Stripe webhook 上限：**262144** bytes（256 KiB）
- 建议反向代理超时：读超时 **60s**；请求体超时 **30s**（常量见 `requestBodyLimits.ts`）
- 生产必填 / 条件必填 / 禁止变量：见 `describeProdEnvRequirements()` 与下表

| 类别 | 变量 |
|---|---|
| 必填 | `APP_ENV=prod`；`POSTGRES_URL`→`xtch_prod`；`S3_BUCKET=xtch-prod`；`S3_ENDPOINT`；`S3_ACCESS_KEY_ID`；`S3_SECRET_ACCESS_KEY`；`VITE_SUPABASE_URL`；`VITE_SUPABASE_ANON_KEY`；可用 Admin allowlist |
| 条件 | Stripe 两密钥同有同无；Turnstile site+secret 同有同无；`INQUIRY_EMAIL_MODE`/`BOOKING_EMAIL_MODE=resend` 时要 `RESEND_API_KEY` |
| 禁止 | `DEV_CHECKOUT_BYPASS`；`DEV_AUTH_BYPASS_EMAIL`；`VITE_DEV_AUTH_BYPASS_EMAIL`；含 `CHANGE_ME`/`YOUR_DOMAIN`/`you@example.com` 的值；非 `xtch_prod` 库名；非 `xtch-prod` 桶 |

### 给角色 5（发行工程）

建议登记（本角色未改 package.json）：

```text
test:runtime-security → tsx --test scripts/requestBodyLimits.test.ts scripts/httpRoutePolicy.test.ts ../scripts/env/validateTargetEnv.test.ts
```

### SEO manifest

- 路径：`app/scripts/seo-public-route-manifest.json`
- 构建时 `generate-sitemap.mjs` 刷新；当前 `version: 1`，`pathCount: 45`

## 新增或更新测试

| 文件 | 覆盖 | 结果 |
|---|---|---|
| `requestBodyLimits.test.ts` | 合法 JSON/webhook、CL 超限、chunked 超限、非法 JSON、客户端中断 | 7/7 pass |
| `httpRoutePolicy.test.ts` | manifest 公开路径、SPA 深链、未知 404、静态启发式 | 4/4 pass |
| `validateTargetEnv.test.ts` | local 不误伤、两生产 target、错库/错桶/占位/bypass/半配置 Stripe·Turnstile·Resend、日志不泄密 | 11/11 pass |

## 验证命令

| Working directory | Command | Exit code | Result |
|---|---|---:|---|
| `app/` | `npx tsx --test scripts/requestBodyLimits.test.ts scripts/httpRoutePolicy.test.ts ../scripts/env/validateTargetEnv.test.ts` | 0 | 22 pass |
| `app/` | `npm run typecheck` | 0 | 通过 |
| `app/` | `npm run lint` | 0 | 通过 |
| `app/` | `npm run build` | 0 | 通过（local；未跑 build:win11-home，避免触碰不完整真实生产 env） |

## 未验证项与剩余风险

- 未对真实 `env/win11-home/.env` / `env/cloud-vps/.env` 做启动冒烟（禁止改真实密钥；本机生产 env 可能仍含半配置而被拒启——属预期）。
- 未跑完整 `deploy:serve` 对真实 dist 的 HTTP 404 浏览器抽检；路由分类有单测覆盖。
- Vite 本地 API 中间件仍无 body 上限（审计项针对 `deploy:serve`；本地 DoS 面另议）。
- 角色 5 尚未登记 npm test 脚本；角色 6 尚未把 body 上限写入 Caddy。

## 边界声明

- [x] 未部署或推送
- [x] 未访问真实生产数据
- [x] 未修改真实 env/密钥
- [x] 未越过文件边界；May Touch 仅用于公共 env 校验接入与 tsconfig/进度文档
