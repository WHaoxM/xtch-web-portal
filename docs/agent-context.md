# Agent Context

给当前 Agent 和新 Agent 快速接手项目使用。这里是上下文索引，不替代源码和专门文档。

## 项目事实

- 项目是 React + TypeScript + Vite 单页应用。
- 实际应用目录是 `app/`，npm 命令在 `app/` 下执行。
- 路由入口是 `app/src/main.tsx`，使用 `BrowserRouter`（旧 `#/…` 开机迁移）。
- 页面路由集中在 `app/src/App.tsx`。
- 页面在 `app/src/pages/`，共享组件在 `app/src/components/`（迁移期大量 shim 指向新位置）。
- UI 基础组件 canonical 路径为 `app/src/shared/ui/`；`app/src/components/ui/` 为兼容 shim。
- 领域客户端在 `app/src/domains/<domain>/`；`app/src/lib/` 为兼容 shim。
- 展示壳：`app/src/shells/{desktop,china-trips-mobile,admin}/`。
- 共享工具：`app/src/shared/lib/`、`app/src/shared/seo/`。
- 样式主要是 Tailwind CSS + `app/src/index.css`。
- `@/*` 指向 `app/src/*`。
- 本地开发端口默认是 `3000`（Vite），见 `app/vite.config.ts`。生产 `deploy:serve` 默认 `3080`（与开发分开）。
- `npm run deploy:serve` / `selfhost`：读 `env/win11-home`（或 `--target`），默认监听 `:3080`。

## 架构分层（Accepted）

详见 `docs/adr/0005-domain-module-layout.md`。

- **一个后端进程**服务桌面站、China Trips 移动壳、未来 APP；不按微服务拆支付。
- 后端领域模块落在 `app/api/domains/<domain>/`；HTTP 入口文件保持薄、公开路径不变。
- Phase 1：`domains/booking/`（订单、库存、checkout、Stripe/Payoneer providers、webhook）。
- Phase 2：`domains/catalog|inquiry|identity|media` + `platform/`；`app/api/lib/*` shim。
- Phase 3（前端）：`app/src/domains/*`、`app/src/shells/*`、`app/src/shared/*`；`app/src/lib/*` 与 `@/components/ChinaTripsMobile` 等为 shim。
- Phase 2.6：domain 内单夹 ≤8 源文件（测试/barrel 不计）；booking 分 `orders|inventory|checkout|integrity`；catalog HTTP 分 `public|admin`；前端 catalog 分 `clients|drafts|data|copy`。
- Phase 2.7：功能可见命名 — 支付在 `booking/payment/`（非独立域）；见下方功能地图。
- 前端壳层不得实现支付确认或库存扣减。
- 支付适配器属于 **booking**，不要单独做成与订单脱节的 `payment` 服务孤岛。

## 功能地图（找代码从这里进）

| 功能 | 后端 | 前端 |
|------|------|------|
| 支付（Payoneer/Stripe、选 provider、webhook 事件） | `app/api/domains/booking/payment/` | `app/src/domains/booking/payment/` |
| 结账会话（创建 checkout、payload、限流） | `…/booking/checkout/` + `…/booking/http/checkoutSession.ts` | `…/booking/checkout/` |
| 订单（下单、查询、认领、Admin 订单） | `…/booking/orders/` + `…/booking/http/` | `…/booking/orders/` |
| 库存/班期座位 | `…/booking/inventory/` | （班期列表多走 catalog clients） |
| 支付完整性规则 | `…/booking/integrity/` | — |
| 班期政策/旅客姓名工具 | — | `…/booking/policy/` |
| 路线/目的地/班期内容 | `app/api/domains/catalog/`（`http/public`、`http/admin`） | `app/src/domains/catalog/{clients,drafts,data,copy}/` |
| 询盘/定制游线索 | `app/api/domains/inquiry/`（`admin/`、`http/`） | `app/src/domains/inquiry/{clients,copy}/` |
| 登录/Admin 鉴权 | `app/api/domains/identity/`（`admin/`、`traveler/`、`http/`） | `app/src/domains/identity/{admin,traveler}/` |
| 素材上传 | `app/api/domains/media/`（`http/` + `s3`） | `app/src/domains/media/`（若有） |
| DB/邮件/审计 | `app/api/platform/` | — |
| 页面壳 | — | `app/src/shells/{desktop,china-trips-mobile,admin}/` |
| 薄 HTTP 入口（路径稳定） | `app/api/*.ts`；`app/api/admin/{auth,booking,catalog,inquiry,media}/*.ts`（公开 URL 仍 `/api/admin/…`，见 `scripts/localApiRoutes.ts`） | — |
| 兼容 shim（勿堆新业务） | `app/api/lib/*`（仅 re-export；新代码直连 domains/platform） | `app/src/lib/*` |

顶层 `app/api/checkout-session.ts`、`payoneer-webhook.ts` 等只是 re-export，真实逻辑在 `domains/booking/`。

## 必读入口

- Agent 行为规则：`AGENTS.md`
- 业务语言和产品边界：`CONTEXT.md`
- Agent 上下文工程总架构：`docs/agent-context-engineering-plan.md`
- 内容、图片、路线、TOCN/Syncing 资源边界：`docs/content-resource-map.md`
- 移动端 China Trips 设计边界：`docs/mobile-ios-front-end-context.md`
- 旅行数据处理说明：`docs/travel-data-pipeline.md`
- 架构或关键决策记录：`docs/adr/`

## Agent 协作入口

- 当前任务交接：`docs/agent-progress.md`
- 多 Agent 分工和阻塞：`docs/agent-task-board.md`
- 必须用户确认的门禁：`docs/agent-manual-gates.md`
- 重复错误和规则沉淀：`docs/agent-rule-maintenance.md`
- 验证矩阵和自动化候选：`docs/agent-verification.md`
- 外部参考和吸收标准：`docs/agent-references.md`
- 高频易忘事项：`docs/agent-gotchas.md`

## 内容来源优先级

改页面内容、图片、视频、路线数据或页面结构前，先看 `docs/content-resource-map.md`。

快速判断：

- 路线事实优先来自 `路线/`、`路线_新/` 和已整理的结构化数据。
- Syncing 自有品牌、图片、联系信息优先来自 `本站/` 和官方 Syncing 站点。
- `目标站/` 只作为结构、节奏、交互和信息层级参考。
- 没有依据时，不创建假数据、假评论、假团队成员或假客户声称。

## 常用命令

仓库根或 `app/` 均可（根 `package.json` 转发到 `app/`）：

```bash
npm run dev
npm run build
npm run lint
npm run preview
npm run deploy:serve -- --target win11-home
```

- `npm run dev`：先释放占用 `3000` 的旧进程，再启动 Vite；本地 URL 固定为 `http://127.0.0.1:3000`。
- `npm run deploy:serve`：生产静态+API，默认 `http://127.0.0.1:3080`（与 Vite 可同机并行）。
- `npm run dev:keep`：不杀旧进程，直接启动（仅在你明确要保留现有监听时用）。
- 已有健康的 `3000` 服务时优先复用，不要再开第二个。
- 依赖安装仍在 `app/`：`cd app && npm install`。

## 环境与部署入口

- **环境分层总览**（四层：`local` / `tunnel` / `win11-home` / `cloud-vps`；两套生产；`selfhost` 仅为 win11-home 旧别名）：`docs/ops/README.md`
- 配置真相源：`env/<target>/.env`（说明见 `env/README.md`、`app/ENV.md`）
- 切公网 DNS / 各 target 运维清单：`docs/ops/win11-home.md`、`docs/ops/cloud-vps.md`
- 边缘资产：`deploy/win11-home/`、`deploy/cloud-vps/`

## 验证原则

- 文案或小样式：检查受影响页面显示。
- TS/TSX 逻辑改动：运行 `npm run build`。
- 组件、hooks、路由、共享工具改动：运行 `npm run build` 和 `npm run lint`。
- 视觉改动：检查桌面和移动端布局。
- `ChinaTripsMobile` 改动：验证 320px、375px、390px 宽度。
