# Agent Gotchas

本文件记录小但高频、容易忘、会导致返工的项目陷阱。它不是完整规则库，只放“忘了就容易出错”的事项。

## 当前高频事项

| Gotcha | 正确处理 |
|---|---|
| npm 命令不在仓库根目录执行 | 在 `app/` 目录执行 `npm run build`、`npm run lint`、`npm run dev` |
| Agent 反复 `npm run dev` 导致端口变成 3001/3002 | 本地固定 `3000`（`strictPort: true`）。需要新开时直接 `npm run dev`（会先跑 `scripts/free-dev-port.mjs` 释放占用）；不要手动换端口。已有健康的 3000 服务时优先复用，勿重复启动 |
| 当前路由使用 `HashRouter` | 内部链接和刷新行为要兼容 hash 路由 |
| 页面路由集中在 `app/src/App.tsx` | 新页面或路由改动先查这里 |
| `@/*` 指向 `app/src/*` | 应优先使用项目已有别名 |
| 内容事实不能从目标站猜 | 先查 `docs/content-resource-map.md` |
| TOCN 只能作为参考 | 只能参考结构、节奏、交互和信息层级，不能当作 Syncing 事实 |
| `ChinaTripsMobile` 不是普通长网页 | 先读 `docs/mobile-ios-front-end-context.md`，并检查 320px、375px、390px |
| Mini-App Me → My Orders 跳到桌面 Account | 必须开站内 `myOrders` 视图；禁止 `navigate('/account')`（与搜索、支付回流同一规则） |
| `AGENTS.md` 不是知识库 | 详细内容放入对应 `docs/` 文件 |
| 本机 `docker` CLI（`docker ps` 等）在这个 shell 环境里可能一直挂起不返回，即使 Docker Desktop 里真的有容器在跑（可能是 shell 会话拿不到桌面会话的 named pipe） | 不要死等 `docker ps`；改用直连 `pg`/`fetch` 测 `POSTGRES_URL` 指向的端口（如 `localhost:5432`）是否能连通，能连通就说明数据库可用，不用管 `docker` CLI 卡不卡 |
| PowerShell（本项目终端默认）不支持 `&&` 链接命令（会报 `token '&&' is not a valid statement separator`） | 用 `;` 分隔，或用 Shell 工具的 `working_directory` 参数代替 `cd xxx &&` |
| 验证需要本地数据库时，本机没有常驻 Postgres 服务/进程，但可能有用户手动起的 docker 容器（如 `xtch-postgres`，映射到 `localhost:5432`） | 验证前先问用户是否已有可用的本地库，别自己瞎折腾 Docker Desktop 启动 |
| `ensureContentTables` 等自愈 DDL 在首屏会并发触发 | 必须用 in-flight Promise 串行化；`CREATE INDEX IF NOT EXISTS` 在并发下仍可能报 `pg_class_relname_nsp_index`（23505），需忽略该碰撞 |
| 本地 Postgres 空库时 `/api/destinations` `/api/routes` 会 200 但返回空数组；`App` 仍会渲染 | 页面组件不得假设 `routeTours[0]` / `destinationMeta[0]` 一定存在；需要内容时跑 `npx tsx scripts/backfill-content.ts`（在 `app/` 下） |
| `CREATE TABLE IF NOT EXISTS` 不会修复旧表缺列 | 查询/更新新增列时，同步在对应 ensure schema 里加 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`，不能只改建表 SQL |
| 本地未配 `STRIPE_SECRET_KEY` 时点 Pay 会报 `Checkout is not configured.` | 在 `app/.env.local` 设 `DEV_CHECKOUT_BYPASS=1`（示例已有）；会本地建单并确认，跳 Mini-App `Booking confirmed`，并走确认邮件（`console` 只打终端预览）。生产/部署环境该开关强制无效；真测 Stripe 时填 test key 并去掉 bypass；真收信设 `BOOKING_EMAIL_MODE=resend` + `RESEND_API_KEY` |
| Resend `onboarding@resend.dev` 报只能发到本人邮箱 | 试用发件域只能发到 Resend 账号邮箱。本地设 `BOOKING_EMAIL_OVERRIDE_TO=<账号邮箱>`（见 `email.ts`）；表单可填任意 lead email，实际投递走 override。验证自有域名后可去掉 override |
| 改 `.env.local` 后仍报 `RESEND_API_KEY is not configured.` | Vite 热重启会保留进程里旧的空 env；`vite.config.ts` 已强制让 `.env.local` 覆盖。若仍异常，停掉终端里的 dev 再 `npm run dev`（完整重启进程） |
| 订单 `route_snapshot` 日期出现 ISO（如 `…T16:00:00.000Z`） | `pg` DATE 在事务里是 `Date`；写入 snapshot 前必须 `formatDate` 成 `YYYY-MM-DD`，禁止直接 `JSON.stringify(Date)`。展示侧用 `normalizeDateOnly` / `formatOrderDateRange`。历史脏数据跑迁移 `009_normalize_order_route_snapshot_dates` |
| 隧道测试台 env 覆盖顺序 | `vite --mode tunnel` 最后加载 `.env.tunnel.local`（覆盖 `.env.local`）。迁移必须用 `npm run db:migrate:tunnel`，勿对日常 `xtch` 库跑隧道迁移。见 `docs/ops/tunnel-testbed.md` |
| 隧道 Host 被 Vite 拦 | `Blocked request... not allowed` → `vite --mode tunnel` 需 `server.allowedHosts: ['.trycloudflare.com']`（仅 tunnel mode） |
| 隧道下 MinIO 直连 `127.0.0.1:9000` 会签名失败 | Presign Host 须等于浏览器访问的隧道域名。用 Vite `/s3` 反代 + `S3_ENDPOINT=https://<tunnel>/s3`（`testbed:tunnel` 会回写） |
| 隧道上的 Admin / auth bypass 不是生产 | `DEV_CHECKOUT_BYPASS` + bypass 邮箱在公网裸奔；用完 Ctrl+C 关隧道，勿当正式站 |

## 添加标准

新增 gotcha 前先判断：

- 是否已经导致过错误或很可能导致错误。
- 是否足够短，可以一眼读懂。
- 是否不适合放在更正式的上下文文档里。

## 不放这里

- 一次性任务状态。
- 长篇业务定义。
- 代码里一眼能看出来的事实。
- 未验证的猜测。

## Template

```md
| Gotcha | 正确处理 |
|---|---|
|  |  |
```
