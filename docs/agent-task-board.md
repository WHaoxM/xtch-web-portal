# Agent Task Board

本文件用于多 Agent 协作时声明分工、共享文件和阻塞请求。它解决“多个 Agent 同时工作互相踩文件”的问题。

## 使用规则

- 开工前声明 `Owns`、`May Touch`、`Must Not Touch`。
- 未声明负责的文件不得修改。
- 共享文件必须有 owner。
- 需要修改未负责文件时，先写 `Blocking Request`。
- 默认当前主 Agent 是 Coordinator。

## Coordinator

| Role | Owner | Responsibility |
|---|---|---|
| Coordinator | 当前主 Agent | 分配文件 owner、审批跨范围修改、合并进度、决定最终验证清单 |

## Active Agents

| Agent | Goal | Owns | May Touch | Must Not Touch | Status | Last Update |
|---|---|---|---|---|---|---|
| Auto (tunnel-testbed) | 本机 Cloudflare 隧道测试台；见 `.cursor/plans/tunnel_testbed_deploy_9b59e201.plan.md` | `docker-compose.yml`, `docker/postgres/init-extra-db.sql`, `app/vite.config.ts`, `app/package.json`, `scripts/db/migrate.ts`, `app/.env.tunnel.local.example`, `app/scripts/start-tunnel-testbed.mjs`, `docs/ops/tunnel-testbed.md` | `docs/ops/minio-win11.md`, `docs/agent-gotchas.md`, `docs/agent-progress.md`, `docs/agent-task-board.md`, `.cursor/plans/tunnel_testbed_deploy_9b59e201.plan.md` | 生产拓扑切换、Stripe 真生产、Cloudflare Access、新 Admin 账密 | in-progress（testbed 已起；验收清单待用户） | 2026-07-17 |
| Auto (my-orders-miniapp) | Me「My Orders」留在 Mini-App，勿跳桌面 `/account` | `app/src/components/ChinaTripsMobile.tsx`, `app/src/lib/orderClient.ts`, `app/src/components/chinaTripsMobile.css`, `docs/mobile-ios-front-end-context.md` | `docs/agent-progress.md`, `docs/agent-task-board.md`, `docs/agent-gotchas.md` | 桌面 Account 大改、旅客详情表单、支付 API | done（build/lint；浏览器未验） | 2026-07-17 |
| Auto (date-snapshot-fix) | 日期选择与快照修复：见 `.cursor/plans/日期选择与快照修复_bfe542bb.plan.md` | `app/api/lib/availability.ts`, `app/api/lib/orders.ts`, `app/api/migrations/009_normalize_order_route_snapshot_dates.ts`, `app/src/lib/orderClient.ts`, `app/src/lib/dateOnly.ts`, `app/src/pages/Admin.tsx`, `app/src/components/ChinaTripsMobile.tsx`, `app/src/lib/routesClient.ts` | `docs/agent-progress.md`, `docs/agent-task-board.md`, `docs/agent-gotchas.md`, `app/api/lib/email.ts`, `app/api/admin/orders.ts` | 生产库批量改 departures、Custom tab 大改 | done（build/lint + migrate 009；浏览器未验） | 2026-07-17 |
| Auto (email-format-fix) | 确认邮件：日期可读 + 退改政策人话，不吐 ISO/字段名 | `app/api/lib/email.ts` | `docs/agent-progress.md`, `docs/agent-task-board.md` | 班期数据内容、产品文案方向 | done（build/lint；真收信未验） | 2026-07-17 |
| Auto (resend-override-to) | Resend 试用域只能发本人邮箱：加 BOOKING_EMAIL_OVERRIDE_TO | `app/api/lib/email.ts`, `app/.env.local`, `app/.env.local.example` | `docs/agent-progress.md`, `docs/agent-task-board.md`, `docs/agent-gotchas.md` | 生产发信域、Stripe | done（build/lint；需重启 dev） | 2026-07-17 |
| Auto (admin-order-route) | Admin 订单列表路线为空：sanitize 补 route_title 等 | `app/api/admin/orders.ts`, `app/src/pages/Admin.tsx` | `docs/agent-progress.md`, `docs/agent-task-board.md` | 生产库、checkout/支付逻辑 | done（build/lint） | 2026-07-17 |
| Auto (payment-return-miniapp) | 支付成功回流 Mini-App + bypass 发确认邮件；见 `.cursor/plans/支付成功回流_mini-app_2b309d9d.plan.md` | `app/api/checkout-session.ts`, `app/api/lib/orderQueries.ts`, `app/src/lib/orderClient.ts`, `app/src/components/ChinaTripsMobile.tsx`, `app/src/pages/OrderSuccess.tsx`, `app/.env.local.example` | `app/src/components/chinaTripsMobile.css`, `docs/mobile-ios-front-end-context.md`, `CONTEXT.md`, `docs/agent-progress.md`, `docs/agent-task-board.md`, `docs/agent-gotchas.md` | 旅客详情表单、Account 大改、生产 Stripe 密钥 | done（build/lint；浏览器未验） | 2026-07-17 |
| Auto (dev-checkout-bypass) | 本地无 Stripe 时 DEV_CHECKOUT_BYPASS 建单确认 | `app/api/checkout-session.ts`, `app/api/lib/stripe.ts`, `app/.env.local.example` | `app/.env.local`, `docs/agent-progress.md`, `docs/agent-task-board.md`, `docs/agent-gotchas.md` | 生产 Stripe/webhook、前端确认页视觉 | done（build/lint；需重启 dev 再点 Pay） | 2026-07-17 |
| Auto (checkout-confirm-ui) | ConfirmBookingScreen：单卡 grouped 确认 + Total/注脚/Stripe 信任条 | `app/src/components/ChinaTripsMobile.tsx`, `app/src/components/chinaTripsMobile.css`, `docs/mobile-ios-front-end-context.md` | `docs/agent-progress.md`, `docs/agent-task-board.md` | 桌面营销页、Stripe API、Auth 流 | done（build/lint；浏览器未验） | 2026-07-17 |
| Auto (route-private-short-form) | 路线详情私人短表单 + 按路线筛班期；见 `.cursor/plans/路线私人短表单_ff16df75.plan.md` | `app/src/lib/inquiryClient.ts`, `app/src/lib/inquiriesAdminClient.ts`, `app/api/inquiries.ts`, `app/api/lib/adminInquiries.ts`, `app/src/components/ChinaTripsMobile.tsx`, `app/src/pages/Admin.tsx`, `CONTEXT.md`, `docs/mobile-ios-front-end-context.md` | `docs/agent-progress.md`, `docs/agent-task-board.md`, `app/src/components/chinaTripsMobile.css` | 目的地详情/桌面 RouteDetail、多表单模板构建器、短表单 more 偏好组 | done（build/lint） | 2026-07-17 |
| Auto (phone-country-picker) | Mini-App 区号选择器：触发器 + 底部 sheet；见 `docs/superpowers/specs/2026-07-17-mobile-phone-country-picker-design.md` | `app/src/components/ChinaTripsMobile.tsx`, `app/src/components/chinaTripsMobile.css` | `docs/agent-progress.md`, `docs/agent-task-board.md`, `docs/superpowers/specs/` | `phoneCountries.ts` 数据/校验、桌面表单、搜索功能 | done（build/lint；浏览器未验） | 2026-07-17 |
| Auto (group-tour-rename) | 拼团命名统一 small group→group tour；见 `.cursor/plans/拼团命名统一_363e2c67.plan.md` | `contentSchema.ts`, `routesClient.ts`, `contentQueries.ts`, `007_route_group_tour_rename.ts`, `Admin.tsx`, `ChinaTripsMobile.tsx`, `chinaTripsMobile.css`, `RouteDetail.tsx`, `Seo.tsx`, `siteData.ts`, `searchIndex.ts`, `CONTEXT.md`, `docs/mobile-ios-front-end-context.md`, `docs/travel-data-pipeline.md` | `docs/agent-progress.md`, `docs/agent-task-board.md`, `Home.tsx`, `About.tsx`, `TourCost.tsx`, `routePdfDetails.ts` | 生产库（除非用户明确要求） | done（build/lint + db:migrate） | 2026-07-17 |
| Auto (mobile-search-moments) | 移动首页站内搜索 + Real Moments lightbox；见 `.cursor/plans/移动首页搜索与瞬间_d1b443c8.plan.md` | `app/src/components/ChinaTripsMobile.tsx`, `app/src/components/chinaTripsMobile.css`, `docs/mobile-ios-front-end-context.md` | `docs/agent-progress.md`, `docs/agent-task-board.md` | 桌面 `/search`、Admin/API、Real Moments 运营可配 | done（build/lint + 浏览器） | 2026-07-17 |
| Auto (home-real-moments) | Home Travel support → Real Moments 横滑卡；见 `.cursor/plans/home_真实瞬间替换_89def049.plan.md` | `app/src/components/ChinaTripsMobile.tsx`, `app/src/components/chinaTripsMobile.css`, `docs/mobile-ios-front-end-context.md` | `docs/agent-progress.md`, `docs/agent-task-board.md` | 桌面 Home.tsx、Admin/API、假交互跳转 | done（build/lint + DOM/截图） | 2026-07-17 |
| Auto (home-smallgroup-card) | Home 小团模块容器卡：合并入口+Popular 为双态卡，最多 2 行；见 `.cursor/plans/home_小团容器卡_1c03369e.plan.md` | `app/src/components/ChinaTripsMobile.tsx`, `app/src/components/chinaTripsMobile.css`, `docs/mobile-ios-front-end-context.md` | `docs/agent-progress.md`, `docs/agent-task-board.md` | Admin schema/API、预订/支付/Auth、新建全部小团列表页 | done（代码已在文件中） | 2026-07-17 |
| Auto (admin-list-filter) | Admin 列表搜筛对齐：路线+素材服务端 search/status + 三列表 UI，见 `.cursor/plans/admin_列表搜筛对齐_c6a0cdb8.plan.md` | `app/api/lib/contentQueries.ts`, `app/api/admin/routes.ts`, `app/api/admin/media.ts`, `app/src/lib/routesClient.ts`, `app/src/lib/mediaClient.ts`, `app/src/pages/Admin.tsx` | `docs/agent-progress.md`, `docs/agent-task-board.md` | 生产库、分页、复杂排序、目的地/班期搜筛 | done（build/lint） | 2026-07-17 |
| Auto (admin-dashboard) | Admin 工作台：侧栏置顶默认页 + dashboard API 四卡 + 带筛跳转，见 `.cursor/plans/admin_工作台待办_ed1a5625.plan.md` | `app/api/admin/dashboard.ts`, `app/src/pages/Admin.tsx`, `app/vite.config.ts` | `docs/agent-progress.md`, `docs/agent-task-board.md`, `docs/superpowers/specs/` | 生产库、侧栏角标、最近列表、公网 | done（build/lint） | 2026-07-17 |
| Auto (admin-content-config-zh) | Admin 内容配置表单中文化：素材 + 分类 + 定制行程表单，见 `.cursor/plans/admin_内容配置表单中文化_e4bc42f7.plan.md` | `app/src/pages/Admin.tsx` | `docs/agent-progress.md`, `docs/agent-task-board.md` | 生产库、API/schema、素材关联勾选器、登录页英文壳 | done（build/lint） | 2026-07-17 |
| Auto (admin-trade-zh) | Admin 交易组表单中文化：订单+班期，见 `.cursor/plans/admin_交易组表单中文化_f87c299a.plan.md` | `app/src/pages/Admin.tsx` | `docs/agent-progress.md`, `docs/agent-task-board.md` | 生产库、素材/分类/定制表单 Panel、API/schema、询盘逻辑 | done（build + Admin lint） | 2026-07-17 |
| Auto (admin-inquiries) | Admin 询盘跟进：列表/详情/三态/备注，见 `.cursor/plans/admin_询盘跟进_2fc59894.plan.md` | `app/api/lib/inquirySchema.ts`, `app/api/lib/adminInquiries.ts`, `app/api/admin/inquiries.ts`, `app/api/migrations/006_inquiries_admin_follow_up.ts`, `app/src/lib/inquiriesAdminClient.ts`, `app/src/pages/Admin.tsx`, `app/vite.config.ts` | `docs/agent-progress.md`, `docs/agent-task-board.md`, `docs/superpowers/specs/` | 生产库、登录默认页、通知铃铛 | done（build/lint） | 2026-07-17 |
| Auto (admin-form-zh) | Admin 表单样板中文化：路线+目的地分区/中文/FieldHint，见 `.cursor/plans/admin_表单样板中文化_c321bee9.plan.md` | `app/src/pages/Admin.tsx` | `docs/agent-progress.md`, `docs/agent-task-board.md`, `docs/superpowers/specs/` | 生产库、班期/素材/分类/定制表单 Panel、API/schema | done（build/lint） | 2026-07-17 |
| Auto (minio-key-format-phase1) | 执行 `docs/superpowers/plans/2026-07-17-minio-media-phase1.md`：MinIO 新对象 key 格式、文档和验证 | `app/api/lib/s3.ts`, `app/api/lib/s3Key.test.ts`, `app/api/admin/media-presign.ts`, `app/package.json`, `app/.env.local.example`, `docs/ops/minio-win11.md`, `docs/superpowers/specs/2026-07-17-minio-media-phase1-design.md` | `docs/agent-progress.md`, `docs/agent-task-board.md` | 生产库、既有 `media/...` 对象迁移、Home/About/guides/itineraries DB 迁移 | done（test/typecheck/build/lint + round-trip） | 2026-07-17 |
| Auto (admin-nav-zh) | Admin 侧栏分组中文化：交易/产品内容/配置三组，见 `.cursor/plans/admin_侧栏分组中文化_62ef59a7.plan.md` | `app/src/pages/Admin.tsx` | `docs/agent-progress.md`, `docs/agent-task-board.md`, `docs/superpowers/specs/` | 生产库、Panel 表单文案、其他页面 | done（build/lint） | 2026-07-17 |
| Auto (admin-edit-shell) | Admin 整页编辑壳：Edit/New 互斥整页表单，见 `.cursor/plans/admin_整页编辑壳_ba67ce98.plan.md` | `app/src/pages/Admin.tsx` | `docs/agent-progress.md`, `docs/agent-task-board.md`, `docs/superpowers/specs/` | 生产库、其他页面 | done（build/lint + 浏览器验证） | 2026-07-17 |
| Auto (admin-media-schema) | 修复 `media_assets` 旧表缺 `created_at` / `updated_at` 导致 Admin media API 失败 | `app/api/lib/contentSchema.ts`, `app/api/migrations/001_initial_content_schema.ts` | `docs/agent-progress.md`, `docs/agent-task-board.md`, `docs/agent-gotchas.md` | 生产库 | done（GET/POST + build verified） | 2026-07-17 |
| Auto (custom-hero-crash) | 修复 CustomTripHero 在 `routeTours` 为空时读 `.image` 崩溃 | `app/src/components/ChinaTripsMobile.tsx` | `docs/agent-progress.md`, `docs/agent-task-board.md`, `docs/agent-gotchas.md` | 生产库、审美大改 | done（hero fallback + 本地 backfill） | 2026-07-17 |
| Auto (inquiries-fix) | 修复 custom trip form 缺 `inquiries` 表 | `app/api/lib/inquirySchema.ts`, `app/api/lib/customTripForm.ts`, `app/api/inquiries.ts`, `app/api/migrations/004_custom_trip_form_config.ts` | `docs/agent-progress.md`, `docs/agent-task-board.md` | 生产库 | done（本地已验证） | 2026-07-16 |
| Auto (mobile-motion) | ChinaTripsMobile 接入 Motion 动画美化 | `app/src/components/chinaTripsMobileMotion.ts`, `app/src/components/ChinaTripsMobile.tsx`, `app/package.json` | `docs/agent-progress.md`, `docs/agent-task-board.md`, `app/package-lock.json` | 桌面营销页大改、Anime.js | blocked（等 build/lint/视觉） | 2026-07-16 |
| Auto (legacy-itinerary) | 老路线逐日行程内容整理，见 `.cursor/plans/老路线行程内容整理_6930be3a.plan.md`。本地已审核导入；生产未导入 | `data/route-itinerary-drafts/`, `app/scripts/import-route-itinerary-drafts.ts` | `docs/agent-progress.md`, `docs/agent-task-board.md`, `.cursor/plans/老路线行程内容整理_6930be3a.plan.md` | 生产库（除非用户明确要求） | done（本地） | 2026-07-16 |
| Auto (categories) | 动态分类体系 + Destinations 首页推荐开关，见 `.cursor/plans/动态分类与首页推荐_2b7f062a.plan.md` | `app/api/lib/contentSchema.ts`, `app/api/lib/contentQueries.ts`, `app/api/categories.ts`, `app/api/admin/categories.ts`, `app/api/admin/destinations.ts`, `app/api/destinations.ts`, `app/src/lib/categoriesClient.ts`, `app/src/lib/destinationsClient.ts`, `app/src/lib/routesClient.ts`, `app/src/pages/Admin.tsx`, `app/src/components/ChinaTripsMobile.tsx` | — | — | done | 2026-07-16 |
| Auto (itinerary-2b) | 路线逐日行程结构化（工程能力），见 `.cursor/plans/路线逐日行程结构化_fe9c7e42.plan.md`。**上线约束**：与"老路线逐日行程内容整理"计划（`.cursor/plans/老路线行程内容整理_6930be3a.plan.md`，全部 pending）绑定一起上线，本计划代码本身不单独部署到会影响生产环境的分支 | `app/api/lib/contentSchema.ts`, `app/api/lib/contentQueries.ts`, `app/api/admin/routes.ts`, `app/api/routes.ts`, `app/src/lib/routesClient.ts`, `app/src/lib/itineraryText.ts`(新建) | `app/src/pages/RouteDetail.tsx`, `app/src/components/ChinaTripsMobile.tsx`, `app/src/pages/Admin.tsx` | `app/src/lib/routePdfDetails.ts`（只读不改，20 条老路线内容整理属于另一份计划） | done（代码，未上线） | 2026-07-16 |
| Auto (content-phase1) | Admin/DB 动态内容 Phase 1：Destinations + Routes 卡片字段 + Media 元数据（URL-only）后台 CRUD，见 `docs/adr/0003-admin-content-dynamic-scope-phase-1.md` 和 `docs/agent-progress.md` 的 Current Goal。范围经用户确认扩大到 Navbar/Footer/Seo/ChinaTripsMobile/searchIndex（这些文件直接消费即将迁移的 `destinationMeta`/`routeTours`，不只是 `brand`） | `app/api/lib/contentSchema.ts`, `app/api/lib/contentQueries.ts`, `app/api/admin/destinations.ts`, `app/api/admin/routes.ts`, `app/api/admin/media.ts`, `app/api/destinations.ts`, `app/api/routes.ts`, `app/src/lib/destinationsClient.ts`, `app/src/lib/routesClient.ts`, `app/src/lib/mediaClient.ts`, `app/src/lib/contentStore.ts`, `app/scripts/backfill-content.ts` | `app/src/pages/Admin.tsx`, `app/src/lib/siteData.ts`, `app/src/pages/Destinations.tsx`, `app/src/pages/DestinationDetail.tsx`, `app/src/pages/ChinaTours.tsx`, `app/src/pages/RouteDetail.tsx`, `app/src/lib/searchIndex.ts`, `app/src/components/Navbar.tsx`, `app/src/components/Footer.tsx`, `app/src/components/Seo.tsx`, `app/src/components/ChinaTripsMobile.tsx`, `app/src/App.tsx`, `app/vite.config.ts` | `app/src/lib/routePdfDetails.ts`, `RouteDetail.tsx` 通用文案块 (`includedItems`/`notIncludedItems`/`wayCards`/`routeFaqs`), `guide_articles` 相关内容, `siteData.ts` 里的 `brand` | done | 2026-07-16 |
| Auto | 移动首页热门小团（featured departures + Admin CRUD + ChinaTripsMobile） | — | — | — | done | 2026-07-15 |
| Auto (prev) | Admin sidebar layout（无公网壳；桌面侧栏 + 移动抽屉） | — | — | — | done | 2026-07-15 |
| Auto (prev2) | 表单/拼团/定制游动态表单（已收口） | — | — | — | done | 2026-07-15 |
| Codex | 搭建上下文工程骨架 | `docs/agent-*.md` | `AGENTS.md`, `docs/*.md` | `app/src/**` | verified | 2026-06-25 |
| Claude | 用户账户与订单绑定闭环；email 自动认领历史订单 | `app/api/lib/bookingSchema.ts`, `app/api/lib/userAuth.ts`, `app/api/lib/orderQueries.ts`, `app/api/checkout-session.ts`, `app/api/orders.ts`, `app/api/my-orders.ts`, `app/api/claim-orders.ts`, `app/src/lib/authClient.ts`, `app/src/lib/checkoutClient.ts`, `app/src/lib/orderClient.ts`, `app/src/components/ChinaTripsMobile.tsx`, `app/src/pages/Account.tsx`, `app/vite.config.ts` | `app/api/**`, `app/src/pages/**`, `app/src/components/ChinaTripsMobile.tsx`, `app/src/lib/**` | `docs/content-resource-map.md`, `CONTEXT.md`, `app/src/lib/siteData.ts`, `app/src/components/Navbar.tsx`, `app/src/components/Footer.tsx`, `app/src/index.css` | done | 2026-06-27 |

## Shared Files

| File | Owner | Rule |
|---|---|---|
| `app/src/index.css` | Coordinator | 视觉或全局样式修改前确认影响范围 |
| `app/src/App.tsx` | Coordinator | 路由修改集中处理 |
| `app/src/components/Navbar.tsx` | Coordinator | 导航结构影响产品方向，修改前确认 |
| `app/src/components/Footer.tsx` | Coordinator | 全站链接和联系入口修改前确认 |
| `app/src/lib/siteData.ts` | Coordinator | 内容和路线数据修改前确认来源 |
| `CONTEXT.md` | Coordinator | 业务语言变化必须用户确认 |
| `docs/content-resource-map.md` | Coordinator | 内容来源规则变化必须用户确认 |
| `docs/agent-progress.md` | Coordinator | 进度文档由当前主 Agent 在关键节点更新 |

## Blocking Requests

| From | Needs | Reason | Proposed Change | Status |
|---|---|---|---|---|
| Claude | Coordinator / 用户确认 | 新增 `/account` 路由需在 `app/src/App.tsx` 注册；该文件为 Coordinator 共享文件 | 在 HashRouter 中增加 `<Route path="/account" element={<Account />} />` | approved-and-merged（已由计划覆盖并实施） |

## Status Values

| Status | Meaning |
|---|---|
| planned | 已登记，尚未开始 |
| working | 正在进行 |
| blocked | 被依赖、权限或用户确认阻塞 |
| review-needed | 已完成局部工作，需要 Coordinator 或用户检查 |
| verified | 已按约定验证 |
| done | 已完成并可交接 |
