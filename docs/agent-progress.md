# Agent Progress

## Current Goal（socketio-server-scaffold，2026-08-21）

- 已读取 xtch Node 自托管入口、Caddy 反代和 XT_MVP 鉴权实现；确认不能共享 XT_MVP 的 JWT secret，Socket.IO 必须走注入式 token introspection。
- 已增加 `socket.io@4.8.3`、独立 `/im` namespace 工厂、Origin 白名单、连接状态恢复、鉴权中间件和 staff/tenant 服务端房间；默认不启用，等待 token-exchange/introspection endpoint 后再配置生产环境变量。
- 已增加 Socket.IO 定向测试；`tsconfig.node.json` 可独立通过。全量 `npm run typecheck` 仍被既有 `ChinaTripsMobile.tsx` 的 `draft` 未使用错误阻断。
- 未完成：因现有 `serve-selfhost.mjs` 含损坏的非 UTF-8 字节，尚未直接改动该启动文件；需要下一阶段先安全规范编码，再在 `http.createServer` 后调用工厂。
- 本阶段验证：`npx tsc -p app/tsconfig.node.json --noEmit` 通过；`npm run test:messaging-socket` 2/2 通过。

## Current Goal（im-architecture-draft，2026-08-21）

- 已结合 XT_MVP `/api/v1/auth/me`、现有 xtch PostgreSQL/migration 机制和 Socket.IO scaffold，写出从数据库、双 Token、REST、实时 outbox、断线补偿、多客服分配到审计的完整草案。
- 设计文档：`docs/superpowers/specs/2026-08-21-im-architecture.md`。
- 当前状态：Draft；待用户确认账号模型（推荐 xtch 本地客服账号 + XT_MVP super_admin exchange）后再写 migration/API 实现。
- 已补充身份与实时性设计：临时访客 cookie、门户 Supabase 登录身份、客服 xtch 身份三层区分；明确 persisted/published/connected/read 四种消息状态和匿名会话升级规则。
- 本阶段已实现：`014_im_core` migration、`/api/im/public/session`、public conversation/message REST、identity link、`/api/im/auth/exchange|refresh|logout`、客服消息 REST、动态 IM 路由、访客 cookie Socket ACL、Socket.IO production attach 和 outbox worker；尚未在真实数据库/XT_MVP 环境执行 migration。
- 后续确认项已追加实现：客服邀请/权限接口、claim/takeover/transfer assignment API、mobile 独立 IM token store/API/Socket client；mobile `pnpm typecheck` 通过。真实 migration 因本机 PostgreSQL `localhost:5432` 未启动而未执行，未触碰远程/生产数据库。

## Current Goal（im-server-completion，2026-08-21）

- 用户确认继续在 xtch-server 补齐移动客服工作台所需服务端能力。
- 本阶段范围：客服会话列表/详情、已读游标、Socket token introspection、REST CORS/OPTIONS，以及 staff REST/Socket ACL 对齐。
- 计划验证：IM 目标 TypeScript、Socket 测试、lint；真实生产迁移/部署仍由 main 的 CI/CD 执行。

## Delivery（im-server-completion，2026-08-21）
- 已改：客服会话列表/详情、已读游标、统一 staff 会话 ACL、分配目标校验、Socket token introspection、租户/客服房间 outbox 广播、IM REST CORS/OPTIONS、self-host 默认回源鉴权地址、部署环境示例。
- 已验证：IM 目标 TypeScript 编译通过；IM Socket/CORS 测试 4/4 通过；变更文件 ESLint 通过；`node --check app/scripts/serve-selfhost.mjs` 通过；`git diff --check` 无内容错误（仅 CRLF 提示）。
- 未验证：本机 PostgreSQL 未运行，未执行真实迁移/端到端消息流；生产部署由推送 main 后的 CI/CD 执行，需在部署环境填入 IM 密钥、XT_MVP 地址和明确 Origins。
- 已交付：提交 `9d4dfe0` 已推送到 `origin/main`，等待 CI/CD 构建与部署。

## Current Goal（im-access-gate，2026-08-21）
- 用户要求 mobile/门户的客服 IM 不对所有 XT_MVP 账号开放，仅 super_admin 与明确指定的内部客服可用。
- 服务端已将 IM token 签发资格收紧为：active super_admin，或 active staff 且拥有 `im:conversation:read`；exchange/login/refresh 均执行该门禁。门户访客 public session 保持客户接待用途，不视为客服权限。
- 验证：目标 IM TypeScript 编译通过；变更文件 ESLint 通过；Socket/CORS 测试 4/4 通过。
- 已交付：提交 `85103cc` 已推送到 `origin/main`，等待 CI/CD 构建与部署。

## Current Goal（restart-xtch-server，2026-08-21）

- 用户明确要求网站先恢复运行，暂不考虑支付；不伪造 Payoneer 凭据。
- 已改生产启动校验：当 `PAYMENT_PROVIDER=payoneer` 且 `PAYONEER_STORE_CODE`、`PAYONEER_TOKEN` 均为空时，不再阻止整站启动；半配置仍拒绝启动，付款接口本身仍会拒绝无凭据请求。
- 已验证：生产环境校验测试 15/15；`xtch-app` active；本机首页与 `/api/routes` 200；公网 `https://www.xuntingtravel.com/` 200。
- 已提交并推送：`676d55f fix: allow public site without payment credentials`；VPS 工作树干净，推送后健康检查通过。

## Current Goal（vps-boot-restart，2026-08-21）

- 用户澄清目标机器为 cloud-vps；当前 VPS `xtch-app` 已是 `enabled` + `active`，systemd `Restart=on-failure` / `RestartSec=5s`。
- 本次改动：云端部署脚本在每次重启前显式执行 `systemctl enable xtch-app`，并在运维文档记录该持久化保障；不改支付、数据库、DNS 或 Caddy 行为。
- 已验证：VPS 上 `bash -n deploy/cloud-vps/deploy-from-main.sh` 通过；`systemctl enable xtch-app` 返回 enabled，服务 active，`Restart=on-failure`；提交 `ddaa5b5 ops: persist cloud-vps boot restart` 已推送到 `main`。

## Status

**done（fix-prerender-spa-shell）** — Deploy cloud-vps Actions success（run Å36129700\）。prerender 干净 SPA 壳 + 等正确 canonical。

### Progress note（fix-prerender-spa-shell，2026-07-30）

- 已合 main；shell Seo 已同步 seoReady 顺序。

**done（fix-deploy-playwright）** — CD build 前 px playwright install chromium\；已合 main（PR #6）。

**done（prod-cd-configure）** — VPS `103.201.130.12`：用户 `deploy`、脏缓存迁出、xtch home→`/var/lib/xtch`；GitHub Environment `production` 已设 `VPS_HOST/USER/SSH_KEY/PORT`。Workflow 仍在本地未进 `main`，需合并后才会自动跑。

### Progress note（prod-cd-configure，2026-07-30）

- VPS：deploy 用户 + Actions 公钥；github fetch 用已有 `xtch_github_deploy`；sudoers 限 systemctl/chgrp/chmod/chown。
- GitHub：`production` secrets 已写。
- 未做：把 `.github/workflows` + `deploy-from-main.sh` 提交并合并进 `main`；未跑首次 workflow。
- 风险：当前本机 `dev` 工作树大量未提交改动；CD 文件需单独干净合并。

**done（prod-cd-gate）** — `main` push 自动部署：lint + **migrate** + build + restart；`workflow_dispatch` 默认同。须配 `production` Environment 与 `VPS_*` secrets 后才真正跑通。

### Progress note（prod-cd-gate，2026-07-30）

- 用户确认：合并进远程 main → 自动触发；自动 migrate；服务器拉取并重建重启。
- 已改：`.github/workflows/deploy-cloud-vps.yml`（`push: main` + 默认 `--with-lint --with-migrate`）；ops/gotchas/脚本头注释。
- 未验：真机 secrets / 首次 Actions 跑通。
- 下一步：用户配 `VPS_HOST`/`VPS_USER`/`VPS_SSH_KEY`，把含 workflow 的提交推进 main。

**done（me-signed-in-identity）** — 已登录 Me：删假 Contact info；身份卡（头像+邮箱）；Sign out 不再重复邮箱；未登录不动。用户否决「账户说明/认领教学」方案。

### Progress note（me-signed-in-identity，2026-07-30）

- 已改：`MeTab`；`chinaTripsMobile.css`（`.iosapp-me-signed` / `.iosapp-me-identity`）；mobile-ios Me 规则一行。
- 验证：待用户刷新已登录 Me。

**done（my-orders-no-paste）** — My Orders/Account 去掉粘贴确认信 URL；空态引导「同邮箱登录 / 点确认信链接」。`LinkOrderToAccount` 仅保留成功页 proof 自动认领。

### Progress note（my-orders-no-paste，2026-07-30）

- 判断：旅客不会在 App 里粘贴长链接；认领应是登录同邮箱自动挂单，或点确认信深链。
- 已改：`ChinaTripsMobile` MyOrders；`Account.tsx`；`LinkOrderToAccount.tsx`（删 allowPaste）；gotchas / mobile-ios。
- 验证：待 lint；浏览器待用户看空态。
- 保留：`parseOrderClaimInput` 仍在 orderClient（深链解析用）；OrderSuccess / 支付成功页 proof 认领未删。

**done（checkout-review-polish）** — 结账确认：Contact 分组、sticky Total+Pay；修 Female pill 被行内 `span max-width:42%` 挤成竖条；标签改 `Lead traveler` + `iosapp-review-label`。待用户刷新看 320/375/390。

### Progress note（checkout-review-polish，2026-07-30）

- 目标：按用户截图收紧 Book 确认卡；修性别 pill 换行。
- 已改：`ChinaTripsMobile.tsx` CheckoutReview + PlanningCheckout；`chinaTripsMobile.css`（label 选择器收窄、pill `nowrap`）；`mobile-ios-front-end-context.md` Checkout 段。
- 验证：未再跑 lint；浏览器待用户刷新确认页。
- 下一步：若还有疏密/文案问题继续点改。

**done（local-refresh-images）** — 本地刷新慢：Vite `/images`/`/s3` `Cache-Control max-age=3600` + Home/Destinations/移动列表图 `loading="lazy"`。lint 绿。需重启 `npm run dev` 后硬刷对比 Network。

### Progress note（local-refresh-images，2026-07-30）

- 目标：减轻本地刷新时图片请求风暴（非 API）。
- 已改：`vite.config.ts`；`Home.tsx`/`Destinations.tsx`；`MobileDestinationCard|ListRow|RouteListCard`；gotchas/task-board。
- 验证：`npm run lint` 绿。未在浏览器复测瀑布（需重启 Vite 加载中间件）。
- 未验/风险：同路径换图后需硬刷；未压原图；生产本就更快。
- 下一步：用户重启 dev → 首页刷新看 304 是否明显减少。

**done（api-entry-lib-cleanup）** — C：`admin/{auth,booking,catalog,inquiry,media}` + `localApiRoutes`；scripts/测试直连 domains/platform；`api/lib` 仅 shim+README。lint/build + test:s3 + test:admin-allowlist 绿。公开 `/api/admin/*` URL 未变。

### Progress note（api-entry-lib-cleanup，2026-07-30）

- 目标：理清 api 根入口 / admin / lib / platform。
- 已改：admin 分组；`localApiRoutes.ts`；scripts 与 PG e2e import；`package.json` 测试路径；lib/README；ADR 2.8；gotchas/agent-context。
- 验证：lint；build；`test:s3`（15）；`test:admin-allowlist`（8）。
- 未验：浏览器打真实 `/api/admin/*`；需重启 dev/deploy:serve 才能加载新路由表。
- 下一步：可选继续删未引用 lib shim；根 `api/*.ts` 保持平铺（URL 绑定）。

**done（function-visibility）** — Phase 2.7：功能地图 + `booking/payment`（原 providers）+ 前端 booking `payment|checkout|orders|policy` + identity `admin|traveler` + inquiry FE `clients|copy`。23 unit tests + lint + build 绿。

### Progress note（function-visibility，2026-07-30）

- 目标：不止支付 — 各功能在目录名上可辨认；不拆独立 payment 域。
- 已改：`docs/agent-context.md` 功能地图；`booking/providers`→`payment/`（含 paymentProvider）；FE booking 子目录；identity admin/traveler；inquiry admin + FE clients/copy；shim/ADR/gotchas/task-board。
- 验证：payoneer + bookingIntegrity + checkoutPayload + adminAllowlist（23）；lint；build。
- 未验：PG integration；浏览器 smoke；未清全部顶层 shim。
- 下一步：可选逐步去 shim；media 已够清晰可不动。

**done（domain-subfolder-split）** — ADR 0005 Phase 2.6：单夹 ≤8 源文件；booking → orders/inventory/checkout/integrity；catalog/http → public/admin；前端 catalog → clients/drafts/data/copy；shim 路径更新。lint/build + 相关单测绿。

### Progress note（domain-subfolder-split，2026-07-30）

- 目标：domain 子目录再分层（软上限 ≤8 源文件；测试不计）。
- 已改：`domains/booking/{orders,inventory,checkout,integrity}`；`catalog/http/{public,admin}`；`src/domains/catalog/{clients,drafts,data,copy}`；api/lib 与 src/lib shim；ADR 0005 Phase 2.6；gotchas/task-board。
- 验证：相关 unit tests；`npm run lint`；`npm run build`。
- 未验：PG integration；浏览器 smoke。
- 下一步：可选去 shim；不拆 ChinaTripsMobile/Admin 巨文件（另任务）。

**done（backend-phase2.5）** — ADR 0005 Phase 2.5：booking HTTP 补全（orders/my-orders/claim-orders/admin orders）；`platform/email` 去 booking 反向依赖（`BookingConfirmationOrder` + caller 传 `orderUrl`）；`platform/dateFormat`；`platform/actorTypes`（`auditLog` 不再 import booking）；migrations/admin/dashboard/webhook events 直 import domain/platform；`lib/` shim 保留。email + booking unit tests + lint + build 绿。

### Progress note（backend-phase2.5，2026-07-30）

- 目标：Phase 2.5 后端 — 补全 booking HTTP 迁移、解开 platform→booking 反向依赖、非 shim 直 import domains/platform。
- 已改：`domains/booking/http/{orders,myOrders,claimOrders,adminOrdersHttp}.ts`；薄入口 re-export；`platform/email.ts`（`BookingConfirmationOrder`，无 rotateAccessToken）；`platform/dateFormat.ts`；`platform/actorTypes.ts` + `auditLog`/`bookingSchema` re-export；`orders.buildOrderAccessUrl`；checkout/webhook/admin resend 传 `orderUrl`；13 migrations → `platform/db`；`admin/dashboard.ts`；webhook event providers → `platform/db`；e2e test → domains；ADR/gotchas/task-board。
- 验证：`email.test`（5）；`checkoutPayload.test`；`bookingIntegrity.test`；`npm run lint`；`npm run build`。
- 未验：PG integration；浏览器/API smoke。
- 下一步：booking 内部子目录（orders/inventory）可选；逐步去掉剩余 shim import。

**done（domain-frontend-phase3）** — ADR 0005 Phase 3 前端：`domains/*` 客户端、`shells/*`（china-trips-mobile/admin/desktop chrome）、`shared/ui|lib|seo`；旧 `@/lib/*` / `@/components/ui/*` / `@/components/ChinaTripsMobile` shim。`formErrors` tests + lint + build 绿。

### Progress note（domain-frontend-phase3，2026-07-30）

- 目标：Phase 3 前端 domain/shell/shared 布局；不改路由/URL/视觉/业务行为。
- 已改：`app/src/domains/{booking,catalog,inquiry,identity,media}/` + `index.ts`；`shared/ui|lib|seo`；`shells/china-trips-mobile`（ChinaTripsMobile + mobile 组件 + motion/css）；`shells/admin`（Admin + admin 组件）；`shells/desktop/components`（Navbar/Footer/Seo/ScrollToTop）；全量 lib/ui/组件 shim；`eslint.config.js` 忽略 shim 路径；ADR 0005 / agent-context / gotchas。
- 验证：`npx tsx --test scripts/formErrors.test.ts`（4）；`npm run lint`；`npm run build`。
- 未验：浏览器逐页 smoke（Admin/ChinaTripsMobile/桌面页）。
- 下一步：逐步让新代码 import `@/domains/*` / `@/shells/*`；Phase 4 可迁桌面 `pages/` 到 `shells/desktop/`。

**done（domain-phase2）** — ADR 0005 Phase 2：catalog/inquiry/identity/media 迁入 `app/api/domains/`；platform 迁入 `app/api/platform/`；`app/api/lib/*` 薄 shim；HTTP 薄 re-export 不变。`publicOrigin`/`adminAllowlist`/`email`/`s3Key` tests + lint + build 绿。

### Progress note（domain-phase2，2026-07-30）

- 目标：Phase 2 后端 domain cut — catalog/inquiry/identity/media + platform；booking 不再改。
- 已改：`platform/{db,email,publicOrigin,auditLog}`；`domains/catalog|inquiry|identity|media` lib + http handlers；`lib/` shims；顶层/admin 路由薄 re-export；各 domain `index.ts`；booking 内 import 改 `platform/`/`identity/`。
- 验证：`publicOrigin.test`（6）；`adminAllowlist.test`（8）；`email.test`（5）；`s3Key.test`（9）；`npm run lint`；`npm run build`。
- 未验：PG integration；真实 webhook/询盘联调；`admin/dashboard.ts` 仍直 import shim（有意保留）。
- 下一步：Phase 3 前端 shells/domains；逐步去掉 shim import。

**done（domain-booking-phase1）** — booking 模块迁入 `app/api/domains/booking/`；`app/api/lib/*` 保留薄 re-export shim；HTTP 路径不变（checkout-session / stripe-webhook / payoneer-webhook 薄入口）。`payoneer` + `checkoutPayload` unit tests + lint + build 绿。

### Progress note（domain-booking-phase1，2026-07-30）

- 目标：Phase 1 后端 domain cut — booking 逻辑集中到 `domains/booking/`，platform 留 `lib/db|email|auth`。
- 已改：移动 bookingSchema/orders/orderQueries/checkout*/payment*/availability/departureRefill/adminOrders + providers(stripe/payoneer/webhooks) + http handlers；`lib/`  shim；`domains/booking/index.ts`；ADR 0005 已存在。
- 验证：`npx tsx --test api/domains/booking/providers/payoneer.test.ts`（5）；`checkoutPayload.test.ts`（3）；`bookingIntegrity*.test.ts`（12）；`npm run lint`；`npm run build`。
- 未验：PG integration tests（需 POSTGRES_URL）；真实 webhook 联调。
- 下一步：Phase 2 catalog/inquiry domain cut；逐步让新代码 import `domains/booking` 而非 shim。

**done（Payoneer checkout cutover）** — 旅客默认 Payoneer Checkout；Stripe 代码保留可 `PAYMENT_PROVIDER=stripe` 切回。`payoneer` unit + env tests + lint + build 绿。

### Progress note（Payoneer checkout cutover，2026-07-30）

- 目标：程序化派安盈托管收款替换旅客可见 Stripe；订单/库存状态机不变。
- 已改：`paymentProvider.ts`/`payoneer.ts`/`payoneer-webhook.ts`/`checkout-session.ts`；schema 013 + ensure columns；订单 lookup/claim；旅客文案 helper；CONTEXT/ADR0002/gotchas/mobile-ios；env examples；`validateTargetEnv`。
- 验证：`npx tsx --test api/lib/payoneer.test.ts`（5）；`validateTargetEnv.test.ts`（15）；`npm run lint`；`npm run build`。
- 未验：真实派安盈沙箱密钥下的 list 创建与 webhook 签名（仓库无密钥）；浏览器端到端。
- 下一步：填入 `PAYONEER_STORE_CODE`/`PAYONEER_TOKEN`/`PAYONEER_WEBHOOK_SECRET` 后沙箱联调；`db:migrate` 跑 013。

**done（桌面定制支付壳）** — `/custom-trip`：Continue to payment → 确认页 Pay full amount（金额待定）+ Send request by email。`lint`/`tsc` 绿。

### Progress note（桌面定制支付壳，2026-07-29）

- 目标：桌面定制对齐移动端统一支付入口壳。
- 已改：`CustomTrip.tsx`；CONTEXT/gotchas。
- 未改：`PrivateQuoteModal`（仍直发询盘）。
- 验证：lint + tsc。未验：浏览器 Continue → Pay / 邮件后备。
- 下一步：金额/商品确定后接 Stripe；可选对齐桌面 PrivateQuote。

**done（dev → main）** — PR [#2](https://github.com/WHaoxM/xtch-web-portal/pull/2) 已合并；`origin/main` = `d033251`（Merge pull request #2 from WHaoxM/dev）。本地仍在 `dev`；sitemap/manifest 未提交脏文件仍在工作区。

### Progress note（合并 main，2026-07-29）

- 目标：将 Stripe 恢复 + 定制/私定支付壳合入 main。
- 已做：`gh pr create` + `gh pr merge --merge`。
- 下一步：生产部署按既有流程 pull/build；定制 Pay 仍待金额/商品。

**done（定制/私定支付壳）** — 移动端 Custom + route-private：表单→确认页→Pay full amount（金额待定）；邮件询盘后备。`lint`/`tsc` 绿。

### Progress note（定制/私定支付壳，2026-07-29）

- 目标：选项 3 — 先统一支付入口壳，金额/商品稍后定。
- 已改：`ChinaTripsMobile.tsx`（`PlanningCheckoutReviewView`、`customReview`/`routePrivateReview`）；CONTEXT/mobile-ios/gotchas/7.28。
- 验证：lint + tsc。未验：浏览器点验 Continue → Pay / 邮件后备。
- 下一步：用户给定金额/商品后接 Stripe。

**done（恢复统一 Stripe 支付入口）** — Mini-App + 桌面 Social Tours → `Pay full amount` → `/api/checkout-session`。`build`/`lint` 绿。

### Progress note（恢复 Stripe 支付，2026-07-29）

- 目标：固定班期重新走统一支付入口，便于审核；私定/定制仍询盘。
- 已改：`ChinaTripsMobile.tsx`；`RouteInquiryModals.tsx`；GroupTours/RouteDetail 文案；CONTEXT/mobile-ios/gotchas/7.28。
- 验证：`npm run build`、`npm run lint`。未验：浏览器 Stripe test / `DEV_CHECKOUT_BYPASS` 全链路。
- 下一步：本地配 Stripe test key 或 bypass 后点验 Pay → Checkout → 成功回流。

**done（桌面 Social Tours 对齐移动端）** — 选班期→旅客名单→确认流（现已接 Stripe）。`build`/`lint` 曾绿。

### Progress note（桌面 Social Tours 对齐，2026-07-28）

- 目标：桌面与 Mini-App 同深度 confirm-by-email（非轻量月份询价）。
- 已改：`RouteInquiryModals.tsx`（GroupTourInquiryModal 两步）；`GroupTours.tsx`（Request this departure）；`RouteDetail.tsx` 文案；`CONTEXT.md`；task-board/gotchas。
- 验证：`npm run build`、`npm run lint` 通过。未验：浏览器真实提交（Turnstile+Resend）。
- 下一步：浏览器 `/group-tours` 与 `/tours/:slug` 点验两步流。

**in-progress（隐藏支付→确认发邮件）** — Mini-App 拼团 Confirm+询盘；绿泡泡短/长表后 WhatsApp；桌面支付话术清理。Stripe 后端保留。

### Progress note（隐藏支付→确认发邮件，2026-07-28）

- 目标：7.28 业务三条；计划见 hide_pay_email_flow。
- 已读：ChinaTripsMobile checkout/FAB、inquiryClient、RouteInquiryModals、CONTEXT/mobile-ios 支付条款。
- 计划改：`ChinaTripsMobile.tsx`（确认→group_tour_inquiry + Turnstile；WhatsApp 门闩表单）；相关支付话术；CONTEXT/mobile-ios 一行。
- 验证计划：`build`/`lint`；无旅客可见 Pay full amount。

**done（7.28 移动体验）** — Home 返回网站、主站滑动、窄屏自适应、跟团游英文→社交游（与 hide-pay-email 协调移交 ChinaTripsMobile）。

**done（Admin 快捷密码登录）** — env 单组邮箱+密码 + `aq1.` HMAC（12h）；Admin SignIn：Google→密码→OTP。本地 `env/local/.env` 已写凭据（gitignore）。`build`/`lint` 绿。浏览器点验待做。

### Progress note（Admin 快捷密码登录，2026-07-28）

- Spec：`docs/superpowers/specs/2026-07-28-admin-quick-password-login-design.md`（Approved）。
- 已改：`adminQuickLogin.ts`；`auth-password.ts`；`adminAuth.ts`；`localApiRoutes.ts`；`authClient.ts`；`Admin.tsx` SignIn；env examples 注释；`agent-gotchas` 一行。
- 本地：`ADMIN_QUICK_LOGIN_*` 已写入 gitignore 的 `env/local/.env`；邮箱已入 tech allowlist。
- 验证：`npm run build`、`npm run lint`。未验：重启 Vite 后浏览器密码登录；公网 target 需另配 env。
- 风险：本地弱口令勿用于公网生产。
- 下一步：公网 target 另配强口令后 rebuild；浏览器点验登录。

**done（cloud-vps 快捷登录部署）** — VPS `git pull` → `58e74f8`；强口令写入 `env/cloud-vps/.env`（本机同步）；ops 名单含 `hosheil@outlook.com`；Vite `build:cloud-vps` 成功（prerender 缺 Playwright）；`xtch-app` 已重启；`auth-password` `enabled=true`。

### Progress note（cloud-vps 快捷登录部署，2026-07-28）

- 未进 git：真实口令仅 env（gitignore）。
- 未完成：VPS `npx playwright install` 后补 prerender。
- 下一步：浏览器 `/admin` 邮箱+密码点验。

**done（cloud-vps 生产内容迁移）** — 本机 `xtch_prod` → VPS：12 目的地 / 20 路线 / 627 素材 / 7 班期 / 111 行程日；MinIO `prod/` 约 860MB（630 对象）。公网 `/api/routes` 非空，样例 `/s3/...` 200。

### Progress note（cloud-vps 内容迁移，2026-07-28）

- SSH：`xtch-vps` → `103.201.130.12`；仓库 `/opt/xtch-web-portal`；服务已 active。
- 导出：`data/content-backups/cloud-sync-2026-07-28`（本机保留）；VPS 上导入后已删临时包。
- 对象：SSH `-R 19000` 隧道 + `mc mirror` Win11 MinIO → VPS MinIO（非 scp 大目录）。
- Env：VPS 补 `S3_PUBLIC_BASE_URL=https://www.xuntingtravel.com/s3/xtch-prod`；重启 `xtch-app`。
- 验证：本机/公网 API 20 routes、12 destinations；media 与 hero `/s3/...` HTTP 200；departures=7。
- 未迁：订单/询盘等业务 PII 全量（本机 inquiries=1 未强制同步）；表单配置仍用 VPS 既有 seed。
- 下一步：浏览器硬刷新官网目视封面；可选加固 VPS DB 口令（导入日志曾显示弱口令形态，属既有配置）。

**done（找素材筛选关联）** — tags 搜索；关联强提醒可跳过；标题软提示；选图器与素材库同套目的地/路线/标题·标签筛。`build`/`lint` 绿。浏览器点验未人工完成。

### Progress note（找素材筛选关联，2026-07-28）

- 已改：`contentQueries.ts`；新 `MediaBrowseFilters.tsx`、`mediaBrowseHints.ts`；`ImageFieldPicker.tsx`；`Admin.tsx` MediaPanel。
- 设计稿：`docs/superpowers/specs/2026-07-28-admin-media-find-browse-design.md`（Approved）。
- 验证：tsc/lint 通过。下一步：登录 Admin 验选图器筛、库筛、无关联确认。

**done（素材视频持久封面）** — `cover_url` 列 + 浏览器抽帧上传；MediaPanel 上传视频自动封面；卡片优先 coverUrl；编辑可重生。`build`/`lint` 绿。实际上传 mp4 未人工点验。

### Progress note（素材视频持久封面，2026-07-28）

- 已改：`contentSchema.ts`、`contentQueries.ts`、`mediaClient.ts`、新 `videoPoster.ts`、`Admin.tsx`（MediaPanel/MediaCardThumb）。
- 未改：选图器、批量回填历史视频、ffmpeg、驳回备注。
- 验证：build、lint；Vite 模块含抽帧逻辑。下一步：登录 Admin 上传 mp4 目视封面。

**done（Admin 素材审库体验）** — MediaPanel 默认待审页签 + 卡片网格 + 一键通过/驳回确认弹窗 + 空状态；无 URL；视频首帧/占位。`build`/`lint` 绿。浏览器登录点验未人工完成。

### Progress note（Admin 素材审库体验，2026-07-28）

- 目标：列表主任务=审库；默认待审网格；混合审核；无 URL。
- 已改：`app/src/pages/Admin.tsx`（`MediaCardThumb`、`MEDIA_LIST_TABS`、`MediaPanel` 列表区）。
- 未改：选图器、cover_url/服务端抽帧、驳回备注入库。
- 验证：`npm run build`、`npm run lint` 通过。
- 下一步：登录 Admin「素材」目视确认待审/通过/驳回/空状态/视频占位。

**done（表单必填勾选与跳转收口）** — Admin「表单配置」列表可直接勾选必填；路线/目的地编辑保存失败跳到首个缺项；旅客询盘偏好字段沿用既有跳转。`build`/`lint` 绿。浏览器勾选与跳转未人工验。

### Progress note（表单必填勾选与跳转，2026-07-28）

- 目标：缺必填可跳转；管理端可自行勾选偏好字段必填。
- 已改：`app/api/lib/customTripForm.ts`、`app/api/admin/custom-trip-form.ts`（`set-required`）；`Admin.tsx` 列表勾选；`RouteEditor`/`DestinationEditor` 校验失败滚动聚焦。
- 未改：Contact/Checkout 姓名邮箱等硬编码必填；班期编辑器仍为单条错误文案。
- 验证：build、lint 通过；浏览器未验。
- 下一步：若要把 Contact/Checkout 联系人字段也做成 Admin 可开关，需产品确认。

**done（游记 10 条供稿落地）** — 用户 docx 10 文 + 10 图已写入 `Home.tsx` travelerStories；主图/头像 `traveler-story-01..10.jpg`；polaroid 用同目的地站内实景。`npm run build` + `npm run lint` 绿。开放：Sophie&Max 配图为两名女性，需业务确认；浏览器圆点切换未人工点验。

### Progress note（游记 10 条供稿落地，2026-07-28）

- 来源：`docs/桌面端内容/10位入境游客的中国旅行故事.docx`；图文顺序 Emma/成都 → … → Neal/九寨沟。
- 替换原 3 条无来源示意文案；英文据供稿改写，引语优先原话，无原话仅用可核对事实。
- 已改：`app/src/pages/Home.tsx`；新增 `app/public/images/traveler-story-01.jpg` … `10.jpg`。
- 验证：图片路径存在；build；lint。未验：桌面/移动圆点切换与长文折行观感。
- 临时解包/提取脚本已清理；原 docx 保留。

**review-needed（7.20 整合验证）** — 6 个领域均已完成代码或清单交付；自动补团与表单已有完整命令验证，桌面 Group Tours 有数据测试和双视口冒烟。支付邮件与性别头像因当前命令执行器无退出状态仍需统一复跑；性别头像另需 320/375/390 浏览器验收。游记供稿已到达并开始落地（见上）。

### Progress note（7.20 用户决策与实施分配，2026-07-21）

- 桌面 Hero：现有两个按钮下新增 `Group Tours`，进入新的桌面路线拼团页；Hero 使用仓库 4032×3024 九寨沟实景。
- 游记：用户提供 7 份真实游记与图片；供稿前不补写。
- 表单：覆盖所有旅客侧表单，包括移动 checkout、OTP、订单认领。
- 性别头像：每位旅客必填男/女；仅使用自报数据，两色匿名头像，禁止姓名推断。
- 支付邮件：旅客确认信 + 运营副本；旅客邮件 Reply-To 到运营邮箱。
- 自动补团：Admin 预建后续班期；确认满团后激活下一期；配置激活总数上限，不自动生成日期/价格。
- 内容终审：生成 12 目的地 + 20 路线逐条审核清单，由用户勾选。
- 并行约束：Subagent-8 完成前，Subagent-9 不改 `ChinaTripsMobile.tsx`。

### Progress note（7.20 业务终审清单完成，2026-07-21）

- 已创建 `docs/content/business-approved-catalog.md`，逐条列出 12 个目的地与 20 条路线，无遗漏或重复。
- 清单明确 `published`/`featured` 不等于业务批准，保留批准/暂缓/下架/仅询价及审核人、日期、备注栏。
- 已显式标记路线 11/12 证据缺口、路线 9/17 时长冲突、Zhangjiajie/Guilin 导航冲突、路线类型与 bootstrap/运行库漂移风险。
- 未改数据库、公开状态或生产；审批后的 Admin/SEO/sitemap/prerender 动作仅列出，未执行。

### Progress note（7.20 表单必填跳转完成，2026-07-21）

- 桌面与移动旅客表单已统一首个字段错误的滚动/聚焦；Turnstile、班期卡等非输入控件只滚动。
- Checkout 字段错误返回编辑页并聚焦；API/网络错误保留复核页；OTP 与订单认领空输入可聚焦。
- 已补相关 `aria-invalid` / `aria-describedby`；未改服务端业务校验、gender、头像或自动补团。
- 验证：`formErrors` 4/4、typecheck、build、lint、IDE diagnostics 全绿；浏览器逐表人工交互未验。
- `ChinaTripsMobile.tsx` 已移交 Subagent-9，后者不得回滚本次聚焦与 aria 改动。

### Progress note（7.20 桌面 Group Tours 页面完成，2026-07-21）

- Home Hero 已换为 4032×3024 九寨沟实景，并在原两个 CTA 下增加 `Group Tours` → `/group-tours`。
- 新页按现有公开 routes/departures API 展示真实日期、价格、库存与保证出发状态；无班期时引导浏览路线或定制，不编造数据。
- 已新增 departures client 与 3 项数据测试，App 仅注册新路由；未改 Navbar、Traveler Stories、Home 其他区或全局 CSS。
- 验证：lint、3 tests、Vite bundle、1280/390 浏览器冒烟与 IDE lints 通过；Agent 执行时全量 build 曾受并行表单测试瞬时类型状态阻塞，待所有并行改动完成后由主 Agent统一复跑。
- 数据风险：本地 API 当前出现 `$0.98` 成人价和中文出发地“ 四川”，页面忠实显示；需业务数据审核，不应在 UI 层偷偷修正。

### Progress note（7.20 支付双向邮件实现，2026-07-21）

- 已实现旅客确认信、独立运营副本与 Reply-To；运营副本只含订单号、旅客邮箱、金额和路线。
- 新增分阶段状态 `confirmation_email_traveler_sent` 与 migration `011_booking_email_delivery_stage`：旅客已发而运营失败时，Webhook 重试只补运营副本；运营副本使用稳定 Resend Idempotency-Key。
- Admin resend 在未完成时补缺失阶段，全部完成后只重发旅客信；邮件失败不反转已确认订单。
- 已更新四套 env examples、生产配置校验、运维说明与纯单元测试；未读真实 env、未发真实邮件、未跑迁移。
- IDE diagnostics 绿；主 Agent 与 shell 验证 Agent 均遇到命令执行器不返回输出/退出状态，邮件测试/typecheck/lint 结果暂不能声明通过，待执行环境恢复后整合复跑。

### Progress note（7.20 预配置自动补团完成，2026-07-21）

- 新增 migration `012_departure_refill_chains`：显式 chain、顺序成员与审计事件；既有班期默认不受影响。
- Admin 可预建完整草稿班期并配置链 key、顺序、启用和最多自动激活数；校验同路线、连续顺序与后续 draft 状态。
- 订单从 pending→confirmed 的事务内锁定 chain；仅 confirmed/cancellation_requested 人数满 capacity 时激活下一期，active hold 不触发；Webhook 重试/并发只激活一次。
- 新班期继承满团班期的 featured 标记/优先级；退款不撤销已激活班期；达上限写 `limit_reached` 审计，不自动生成日期、价格或政策。
- 验证：21/21 tests、typecheck、lint、build 通过，IDE lints 绿；未写生产 DB、未执行 migration。
- 部署门禁：先运行目标环境 migration 并确认 011 邮件状态迁移与 012 补团链迁移顺序完成，再发布 API。

### Progress note（7.20 拼团性别头像实现，2026-07-21）

- 每位成人现需自报 `male`/`female`，姓名与 gender 在前端、checkout payload、服务端校验和订单 JSONB 快照中严格对齐；支付取消/登录草稿恢复保留 gender。
- 公开 departures 只返回 confirmed/cancellation_requested 的匿名聚合 `male/female/unknown/total`，不返回姓名、邮箱、订单号或逐旅客数组；active hold 仅减少可用座位，不计入性别构成。
- 历史缺 gender 的订单计入 unknown/灰色，不推断、不回填，因此无需 migration。
- UI 增加两色头像、unknown 灰色、可见图例、文本数量和 aria-label；主 Agent 修正了 seats-left 说明，明确临时 hold 会减少可用座位，而非被计入 confirmed roster。
- 已新增 checkout payload 单测与 confirmed roster PG 集成测试；IDE lints 绿。命令执行器未返回 typecheck/build/lint/test 状态，320/375/390 浏览器尚未验。

### Progress note（7.20 桌面首页摸底，2026-07-21）

- Hero 当前只有 `Plan My Trip`、`Explore China Trips` 两个 CTA；桌面无独立拼团落点。
- 当前首图为 1080×1440，在宽屏 90vh hero 会明显放大；仓库有 4032×3024 九寨沟实景等高分辨率候选，但选材属于审美门禁。
- Traveler Story 当前在 `Home.tsx` 硬编码 3 条，无 DB/Admin 管线；增加到 10 条需 7 条经核实内容与图片来源，不能自行编造。
- `Home.tsx` 与正在进行的 desktop-audit-follow-up 共用；实施需串行合并或严格按 section 分区。

### Progress note（7.20 支付双向邮件摸底，2026-07-21）

- 现状：付款成功仅给旅客发确认信；询盘仅通知运营；退款、取消、取消申请、Stripe 过期均无邮件；Resend 调用未设置 Reply-To。
- 风险：当前确认信写有 “reply to this email”，但代码未把回复导向运营邮箱。
- 人工门禁：需用户选择“双向”含义——A 旅客+运营双投递、B Reply-To、C 全生命周期双方通知、D 完整 inbound 邮件线程。
- 本阶段未改代码、未发邮件、未读取真实 env、未操作 Stripe/生产订单。

### Progress note（7.20 拼团性别头像 / 自动补团 / 内容清单摸底，2026-07-21）

- 性别头像：当前 UI 仅以 `capacity - available_seats` 生成匿名占位头像；订单旅客快照只有姓名，没有 gender/sex，禁止按姓名推断。实现前需确认自报采集时机、枚举、是否必填、匿名聚合展示与隐私说明。
- 自动补团：热门团由 `departures.featured_on_home` 与动态库存驱动，满团后只从首页查询中消失，仓库无自动克隆班期。推荐在支付确认事务成功后幂等触发，但上限语义、满团阈值、新日期/价格、退款放座后行为均待业务确认。
- 真实投放：仓库技术候选为 12 个目的地 + 20 条路线，来自 backfill/SEO bootstrap catalog；`published`/`featured` 仅表示技术可见/展示位，不等于业务终审。需产品运营逐条批准，且有 Zhangjiajie/Guilin、路线类型和 2 条日行程证据缺口。
- 三项均保持只读；未改 schema/代码、未写数据库、未接触生产。

### Progress note（7.20 表单必填项跳转摸底，2026-07-21）

- 现有 `app/src/lib/formErrors.ts` 已提供按错误顺序滚动并聚焦首个无效字段；桌面 Contact、CustomTrip、两类路线询盘弹窗及移动主要询盘/拼团 Step 1 已接入。
- 缺口集中在 checkout 只读复核页、OTP 验证、订单认领，以及部分 `aria-describedby` / `aria-invalid` 连线；服务端错误仍应保留全局 banner。
- 不建议改用原生 `required/reportValidity` 或引入表单依赖，因为现有组合字段、动态偏好与 Turnstile 使用统一自定义校验。
- 待用户确认：仅收口桌面第 4 项，还是把移动 checkout/登录/认领一并纳入；非输入控件只滚动是否可接受。

**blocked（Subagent-5 release-engineering）** — 已按任务书做只读摸底；启动门禁未齐，**不生成 RC、不改 package.json/lockfile**。交付：`docs/release/v1-source-audit/deliveries/05-release-engineering.md`（`blocked`）。

### Progress note（角色 5 只读摸底，2026-07-21）

- 角色：`Subagent-5 (release-engineering)`；Owns/May Touch 已登任务板。
- 门禁缺口：无冻结 commit/target/registry；工作树 16 行脏；03/04 deliveries 仍 `incomplete`；06 尚在 `working`；`serve-selfhost.mjs` 未阶段性移交。
- 只读证据：无字面量 `\` 文件名；lockfile 混 `npmjs` 512 + `npmmirror` 120；`dist/win11-home` canonical 仍为 syncingtravel.com；serve 仅验 target+bypass。
- 待收口 BR：角色 2 `test:runtime-security`；角色 4 SEO scripts；角色 1 booking 测试脚本。
- 下一步：等协调代理冻结工作树与用户确认 registry 后再建 RC。

**done（Subagent-6 infra-hardening）** — Compose 无默认密码、bootstrap 路径分离、systemd loopback+hardening、Caddy 对齐角色 2 体限/超时与安全头。交付：`docs/release/v1-source-audit/deliveries/06-infrastructure-hardening.md`（`ready-for-validation`）。9 单测 + caddy validate 绿。未连真机、未读真实 env。

### Progress note（角色 6 完成，2026-07-21）

- Owns：compose、bootstrap/grant、systemd、两套 Caddyfile、ops 文档、`deploy/validate-infra.test.mjs`。
- May Touch：两套生产 `.env.example`、`/.gitignore`、gotchas 一行。
- 上游：角色 2 体限 1MiB/256KiB、超时 60s/30s；角色 1 `TRUST_PROXY=1`。
- 验证：`node --test deploy/validate-infra.test.mjs` → 9 pass（shellcheck/systemd-analyze 本机 skip）。
- 给角色 5：Blocking Request 登记 `test:infra`。
- 未验证：Linux systemd-analyze、真机 413/webhook/`/s3` 联调、严格 CSP。
- 运维注意：已有 Docker volume 需按 `docs/ops/shared/compose-credentials.md` 旋转口令；根目录需 `.env`。

**done（Subagent-2 runtime-api-security）** — 请求体上限、生产 env fail-closed、SEO manifest 页面 HTTP 404 已落地；22 单测 + typecheck/lint/build 绿。交付：`docs/release/v1-source-audit/deliveries/02-runtime-api-security.md`（`ready-for-validation`）。未部署、未读真实生产数据、未改真实密钥。

### Progress note（角色 2 完成，2026-07-21）

- Owns：`serve-selfhost.mjs`、`validateTargetEnv.ts`、`requestBodyLimits.ts`、`httpRoutePolicy.ts` + 测试。
- May Touch：`vite.config.ts` / `migrate.ts` 仅接入公共 env 校验；`tsconfig.node.json` include。
- 上限：JSON 1 MiB；webhook 256 KiB；代理建议 60s/30s。
- 给角色 6：变量清单见 delivery / `describeProdEnvRequirements()`。
- 给角色 5：Blocking Request 登记 `test:runtime-security`。
- 未验证：真实生产 env 启动冒烟、浏览器抽检 404、Vite 本地 API body 上限。

**done（Subagent-4 SEO/prerender）** — 方案 A 已落地；local 预渲染 45/45 + assert 通过。未部署、未读真实生产数据、未改真实密钥。

### Progress note（SEO/prerender 实现，2026-07-20）

- 用户确认：构建期真相源 = 仓库快照 `app/scripts/seo-build-content.json`（方案 A）。
- 已改：
  1. 快照 + `seo-export-build-content.mjs` / `seo-bootstrap-build-content.mjs`；prerender 对 `/api/destinations|routes` 返回快照 JSON，其它 `/api/*` 404 JSON（不再回 SPA）。
  2. `seo-public-routes.mjs`：sitemap 与 prerender 同一路径集（含全部 published `/tours/:slug`）；`lastmod` 仅来自快照 `updatedAtByPath`，无则省略。
  3. `App.tsx`：内容加载失败不设 ready、不挂 Seo；`*` → `NotFound`（`noindex`）；`RouteDetail` 缺内容标记 `data-seo-content="missing"`。
  4. 交付 `app/scripts/seo-public-route-manifest.json` 给角色 2；Blocking Request 给角色 5 登记 npm scripts。
- 验证：`typecheck`/`lint`/`build` 绿；`node --test scripts/seo-build-content.test.mjs` 6 pass；`prerender dist/local` 45 ok 0 fail；`seo-assert-prerender dist/local` OK。
- 未验证：完整 `build:cloud-vps` 末尾 prerender（vite 产物曾生成，prerender 因缺 playwright 中断后改在 `dist/local` 验）；有 DB 时的 `seo-export`。
- 给角色 2：读 `app/scripts/seo-public-route-manifest.json` 的 `paths` 作 HTTP 404 白名单。

**done（V1 审计角色 3：前端关键流程）** — 四项 P1 已修；typecheck/lint/build + 9 单元测试通过；**真实 E2E（含 Stripe Cancel）已通过**。未部署、未改真实密钥文件内容（仅本机 `xtch` 班期 capacity 8→20 供测）。

### Progress note（V1 审计 03 前端关键流程，2026-07-20）

- 角色：`Auto (v1-audit-03-frontend-flows)`；用户确认：方案 A（sessionStorage 含 PII）+ 授权改 `Search.tsx`。
- 已改：
  1. Hash 内链 → `Link`：`DestinationDetail`、`Navbar` 搜索、`Search.tsx`；全仓无 `#${internalPath}`。
  2. Stripe cancel：`sessionStorage` 草稿 TTL 30min；`checkout=cancelled` 恢复确认步+提示并清 query；success/失败开单/返回表单时清理。
  3. `Account` 订单卡改为真实 `Link`。
  4. Navbar 关菜单 `inert` + 焦点回触发钮。
- 测试：`scripts/hashLegacyRedirect.test.ts` + `scripts/checkoutCancelDraft.test.ts`（9 pass）。
- 验证：`npm run typecheck` / `lint` / `build` 全绿。
- **E2E（2026-07-20 晚）** `node scripts/e2e-frontend-critical-flows.mjs` 全绿：
  - Destination/Search/Navbar 无 `#` 内链
  - 移动菜单 inert + Escape 焦点回按钮
  - Account 订单卡为 `<a href="/orders/...">`
  - 真实 Stripe Checkout（`cs_test_…`）打开 → Cancel 回流 → 草稿恢复 + 提示 + query 清理；刷新不再弹提示
- 本机辅助：`departures.capacity` 8→20（座位已满无法下单）；脚本见 `app/scripts/e2e-frontend-critical-flows.mjs`
- 剩余风险：`env/local/.env` 的 `STRIPE_CHECKOUT_*_URL` 仍含旧 `#/china-trips?...`（靠开机 `migrateLegacyHashRoute` 兼容）；建议改为无 `#` path。
- May Touch：`checkoutClient.ts`、`hashLegacyRedirect.ts`、`chinaTripsMobile.css`、`Search.tsx`（经批准）。
- 未部署、未改生产库/DNS。

**done（V1 预订/支付一致性 · Subagent-1）** — 交付报告已填：`docs/release/v1-source-audit/deliveries/01-booking-payment-integrity.md`（`ready-for-validation`）。PG 6/6 + 本地 webhook 4/4 + 网络 E2E 2/2 + 单元 12/12；typecheck/lint/build 全绿。

### Progress note（交付报告更新，2026-07-20）

- 按 README 统一交付格式写入 `deliveries/01-booking-payment-integrity.md`。
- 含用户确认 A/B/C、四项修复、May Touch、全部命令退出码、网络 E2E（rk_test 进程态）与剩余风险。
- 状态：`ready-for-validation`（待主协调代理独立复跑）。

### Progress note（Stripe 网络 E2E，2026-07-20）

- 用户提供 `rk_test_` 受限密钥（仅本次进程环境，**未写入**仓库跟踪文件）。
- 权限探测：balance/charges/PI/checkout/refunds 均可。
- `api/stripe-webhook.network.e2e.integration.test.ts`：**2/2 pass**（paid completed PI retrieve；refund.updated + charges.retrieve）。
- 确认邮件：Resend key 无效仅打日志，不影响订单状态。
- 安全：密钥曾出现在对话中，建议用户轮换。

### Progress note（预订与支付一致性 · PG/Webhook 验证，2026-07-20）

- PG 集成（`localhost/xtch`）：并发 hold、fail 释放、A1 过期、邮箱限流、取消门禁、全额退款释放 consumed。
- 本地签名 webhook：expired、unpaid completed、charge.refunded 部分→全额+幂等、amount 陷阱。
- 修复：`canAutoReleaseSeats` → `(start_date - CURRENT_DATE)::int`。
- 声明：未部署、未访问生产库、未启用 Stripe live。

### Progress note（预订与支付一致性收口，2026-07-20）

- 确认：A=推荐限流+A1+同主体拒绝+建议频率+TRUST_PROXY 仅 Caddy；B=B1 仅卡；C=仅 confirmed+paid，幂等，部分退款不可申请。
- Owns 与 May Touch 见交付报告。
- 交接角色 6：`TRUST_PROXY=1`；角色 5：测试脚本登记。

**done（About 数据统计区编辑感动效）** — Playfair 数字、Manrope 标签、稳定单行数值、响应式分隔线与遮罩错峰揭示已完成。

### Progress note（About 数据统计区，2026-07-20）

- 依据：用户选中统计 section；当前大号粗黑 sans + mono 标签偏仪表盘感，`60K +` / `100 %` / `15 Years` 在桌面列内发生不美观换行。
- 已改：`60K+ / 50+ / 100% / 15 Years` 单行；Playfair Display 500 数值 + Manrope 500 标签；两列移动/四列桌面；移动行列分隔线与桌面列分隔线。
- 动效：30% 入视口触发、90ms 错峰；分隔线中心绘制、数值遮罩上揭、标签随后淡入；`viewport.once` 确认不重播。
- 范围：仅 `About.tsx` 数据统计区；不改四项业务事实、不改全局字体/动画、不新增依赖。
- 已验证：`npm run build`、`npm run lint`、IDE lints 全绿；390/1024/1280 数值均单行且无横向溢出；正常动效初始隐藏→完成态，离开再进入不重播；reduced-motion 在区块未入视口时已直接显示完成态。

**done（About Mission & Vision 精致化）** — 缩小区块与字体，平衡标题换行，并局部明确 Playfair Display / Archivo / Manrope 字体角色。

### Progress note（About Mission & Vision 比例，2026-07-20）

- 依据：用户截图和浏览器选中节点；原 1024px 档使用 128px 上下留白、24px 标签、58px 标题、30px 正文，且标题自然换行不均衡、正文行长偏宽。
- 已改：390px 为 56px 留白 / 30px 标题 / 16px 正文；1024px 为 72px / 42px / 17px；1280px+ 为 88px / 46px。桌面标题受控为两行，正文宽度收至 780px。
- 字体：标题 Playfair Display 400、标签 Archivo 600、正文 Manrope 400；均复用已有字体变量，无新依赖、无全局字体改动。
- 范围：仅 `About.tsx` 的 Mission & Vision section；不改其他 About 板块、图片、产品文案、全局字体或依赖。
- 已验证：`npm run build`、`npm run lint`、IDE lints 全绿；浏览器实测 390/1024/1280，无水平溢出，字体与断点值符合设计。

**blocked（公网内容同步）** — sitemap MIME + 导入脚本已修；本机 `xtch_prod` 已有 20 路线/12 目的地/627 素材；公网 `api/routes` 仍 `[]`（DNS→cloud-vps）。等 VPS SSH。

### Progress note（SEO MIME + 内容导入，2026-07-20）

- 已改：`serve-selfhost.mjs` 补 `.xml`→`application/xml`；`import-content-backup.ts` 修未定义 `envFile`；本机建 `xtch_prod`+桶 `xtch-prod`；包 `data/content-backups/prod-ready-2026-07-20` 已导入本机库。
- 公网：`www.xuntingtravel.com` → `103.201.130.12`，`/api/routes` 仍空——本机导入不影响公网。
- Admin：素材仅「归档」软删；「筛选分类」管 Places/Routes，素材用 tags+关联 slug。
- 阻塞/下一步：用户提供 cloud-vps SSH 与 `env/cloud-vps/.env` 后，在 VPS 跑 import + `build:cloud-vps` 重启。

**done（透明导航 logo 脱色）** — `logo-on-dark.png` 已重生：S 标蓝渐变完整保留，仅右侧 Syncing 字变白。

### Progress note（logo-on-dark 脱色，2026-07-20）

- 依据：用户截图透明导航下 S 标中间发白/脱色；像素统计确认旧图左侧 half 有 ~9k 近白像素（S 标暗部折叠被全局「深色→白」误伤）。
- 根因：生成 on-dark 时把整图深蓝像素洗白，未区分左侧 S 与右侧字标。
- 已改：从 `logo.png` 重生成 `logo-on-dark.png`——`x < 250` 原样保留，`x >= 250` 仅把字标 RGB 置白并保留 alpha。
- 已验证：icon 区与 `logo.png` 像素差 0；icon 近白像素 0；Playwright 首页透明导航截图 S 为青→宝蓝渐变 + 白字。
- 未改：Navbar 切换逻辑、`logo.png` / `logo-mark.png`。
- 注意：硬刷新后再看（浏览器可能缓存旧 PNG）。

**done（桌面 RouteDetail 询盘弹窗）** — `Get a Private Quote` / `Group tour inquiry` 已各自是独立弹窗表单（非跳转独立页），字段/文案与用户提供的参考站截图一致；build/lint 绿，浏览器核对两个弹窗均正确打开。

### Progress note（桌面询盘弹窗，2026-07-20）

- 背景：`RouteInquiryModals.tsx`、`RouteDetail.tsx`、`inquiries.ts` 等询盘弹窗代码此前已由任务板 `desktop-route-inquiry-modals` 写好，但未验证是否可编译、未收口。用户本轮用参考站截图确认方向：两个 CTA 点开各自的弹窗表单（不是独立页面），与已实现的 `PrivateQuoteModal` / `GroupTourInquiryModal` 完全一致。
- 发现并修复真实 bug：`app/src/lib/inquriesAdminClient.ts` 的 `InquiryType` 类型缺 `'group_tour_inquiry'`，导致 `npm run build` 因 `inquiryOpsCopy.ts` 类型不匹配报错（`tsc` 两处 TS2353）。已补上该枚举值，前后端类型现已一致（`app/api/lib/adminInquiries.ts` 的 `INQUIRY_TYPES` 早已包含该值）。
- 已验证：`npm run build`、`npm run lint` 全绿；本地 dev（`:3000`）打开 `/tours/2-3-days-and-2-nights-in-shanghai`，分别点「Get a Private Quote」「Group tour inquiry」，两个弹窗标题/字段/文案与用户截图一致。
- 与参考站的已知差异（此前用户已确认，非本轮改动）：Group tour inquiry 弹窗用「Preferred Month/Year + 是否灵活」代替参考站的「选择具体班期」下拉——因为本产品定位是轻量询价、客服邮件回复真实班期，不锁库存/不展示假班期。
- 未验证：真实提交（Turnstile + Resend 邮件）全链路；Admin 侧 `group_tour_inquiry` 类型列表筛选/详情展示的浏览器点击（代码已支持，未逐一点击）。
- 下一步：如需验证提交全链路，需要本地 Postgres + Turnstile/Resend 配置（见 `docs/agent-gotchas.md` 对应条目）。

### Progress note（推送 dev + 合并 main，2026-07-20）

- 用户确认：把当前工作区内所有已完成但未提交的改动（询盘弹窗修复 + 品牌图标/logo + About 办公室图 + Tibet 封面图 + Home/Navbar 审计修复）一并提交推送。
- 已做：`git add -A` → 单个 commit `42cc4c1`（提交信息列出各部分）→ `git push origin dev` → `git checkout main` + `git pull --ff-only` → `git merge dev --no-ff` → `git push origin main`（`d60b81f..3c9618b`）→ 切回 `dev`。
- 合并无冲突；提交前已用 `npm run build` / `npm run lint` 验证过整棵树可编译。
- **重要：仅代码仓库更新，生产站点未自动更新**——`win11-home` 部署需要运维手动 `npm run build:win11-home` 后重启 `npm run deploy:serve` 才会把这些改动带到公网站点；未做此步。

**done（RouteDetail sticky 段导航重叠）** — 下滚时段导航不再切过卡片；主 Navbar 在 `/tours/` 保持可见。

### Progress note（RouteDetail sticky 段导航，2026-07-20）

- 根因：主 Navbar 下滚隐藏后，段导航仍 `sticky top-*`，顶距空隙让正文穿过。
- 已改：`Navbar.tsx`（`/tours/` 不 slide-hide）；`RouteDetail.tsx`（`top-24` / 侧栏 `top-48` / 锚点 `scroll-mt-48`）。
- 已验证：Playwright 1440×900 滚动后 siteNav.top=0、subNav.top=96 齐平；`npm run build` + `npm run lint` 绿。
- 未提交 git。

**in-progress（桌面首页审计跟进）** — 按用户确认，仅处理 1024–1279px 导航可发现性、Real Moments 两组无效箭头、Traveler Story 的错误跳转。

### Progress note（桌面首页审计跟进，2026-07-20）

- 依据：用户确认保留其余审计项，仅修第 2、5、6 项。
- 拟改：`Navbar.tsx` 将桌面导航从 `xl` 提前至常见笔记本断点；`Home.tsx` 移除无效箭头，并将无对应详情页的故事链接调整为非跳转状态。
- 验证：修改后运行 `npm run build`、`npm run lint`；再检查桌面断点。
- 注意：`Navbar.tsx` 正与 route-sticky-nav-fix 共用；勿覆盖 `/tours/` 不隐藏逻辑。

**done（Tibet 目的地封面）** — Tibet 封面已从中文拼图 `route-tibet-ali.jpg` 换成羊湖实景 `route-tibet-yamdrok-01.jpg`。

### Progress note（Tibet 目的地封面，2026-07-19）

- 依据：用户截图内容即 `route-tibet-ali.jpg`（亮点拼图：精品小团等）；目标 `route-tibet-yamdrok-01.jpg`。
- 已改：`backfill-content.ts`、`CustomTrip.tsx`；本地库 `xtch.destinations` tibet → 已有 MinIO yamdrok URL（与路线 `18-tibet-ali-southern-line` 同源）。
- 已验证：`GET /api/destinations` 返回 yamdrok MinIO URL。
- 未改：生产库（本机无 `xtch_prod`）；硬刷新 Mini-App Places/Tibet 可见。

**done（About 办公室两图）** — 已从 syncingtravel.com `/page-1` 取回 logo wall + 办公区照片并接入 About。

### Progress note（About 办公室两图，2026-07-19）

- 官方 About URL：`https://www.syncingtravel.com/page-1`（非 `/about`）。
- 来源媒体：`2c1368_f8d7048b279e491a99c293c25905b94a~mv2.png`（公司 logo 墙）、`2c1368_b543bb49aa8c4e729739c9db565d8ef5~mv2.png`（办公区）。
- 已落盘：`app/public/images/about-logo-wall.jpg`、`about-office-workspace.jpg`（原 PNG 转 JPEG q88，约 3000×1550）。
- 已改：`About.tsx` 的 `companyLogoWall` / `officeWorkspace` 指向上述本地图。
- 已验证：`npm run build` 绿。
- 未改：`about-hero.jpg`（Contact/SEO 仍用）；未提交 git。

**done（favicon 改用大 S）** — 站点图标与页脚同源裁剪 S，铺满黑底方图，标签页不再因整图含字而显小。

### Progress note（favicon 放大，2026-07-19）

- 原因：`favicon-source` 含 Syncing 全文，缩成 16/32px 后 S 占比很小。
- 已改：用 `logo-mark.png` 生成 `favicon-32/192.png`、`apple-touch-icon.png`、`favicon.png`；`index.html` 去掉优先挂 source。
- 验证：硬刷新标签页。

**done（站点图标用最大 favicon-source）** — tab/apple 图标均由 `favicon-source.png` 居中裁方生成；`index.html` 优先挂原图。

### Progress note（favicon-source 站点图标，2026-07-19）

- 已从 `favicon-source.png` 重生成 `favicon-32/192.png`、`apple-touch-icon.png`、`favicon.png`。
- `index.html` 增加 `/favicon-source.png`（sizes=any）；`brand.iconSrc` 指向同源。
- 验证：硬刷新后看浏览器标签页图标。

**done（导航横版 + 页脚仅 S）** — 导航恢复横版 wordmark；页脚裁剪为蓝色 S（无 Syncing 字）。

### Progress note（logo 回退与页脚裁剪，2026-07-19）

- 导航：恢复 `logo.png` / `logo-on-dark.png`（810×449 横版）。
- 页脚：新增裁剪 `logo-mark.png`（仅 S），`Footer` 用 `brand.logoMarkSrc`。
- 已验证：裁剪图无 Syncing 字样。

**done（最大竖版标展示）** — 导航/页脚改用 `favicon-source` 全量 lockup（1280×1225）；尺寸已放大。

### Progress note（最大图标展示，2026-07-19）

- 已从 `favicon-source.png` 重生成 `images/logo.png` / `logo-on-dark.png`。
- Navbar ~56–72px 高；Footer ~80–96px。
- 已验证：DOM natural 1280×1225；Home 透明导航叠浅色天空时白字版仍可能偏淡（既有透明导航取舍）。

**done（Featured Services 导航可读）** — 根因是 `bg-white/92` 未被 Tailwind 生成（背景实际透明）+ 深色 hero 页未进白字模式；已修。

### Progress note（导航对比度，2026-07-19）

- 问题：`/featured-services` 深色 hero 上导航深色字/深色 logo 看不清。
- 根因：`bg-white/92` 无对应 CSS（computed 为透明）；且该页不在 `usesTransparentHero`。
- 已改：`Navbar.tsx` — `bg-white/90`；透明导航覆盖 featured-services / destinations / contact / travel-guide 等深色 hero 路由。
- 已验证：本地 `/featured-services` 顶部为白字 + logo-on-dark。

**done（Syncing 官方图标替换）** — 已从 syncingtravel.com 取回 favicon + 横版 logo 并接入；build 绿；本地导航/页脚已见官方标。

### Progress note（Syncing 官方图标，2026-07-19）

- 目标：用 https://www.syncingtravel.com/ 的站点图标替换本站 favicon 与 Navbar/Footer logo。
- 来源：Wix `…4bc28899…~mv2.png`（favicon 32/192/180）与 `…73632240…~mv2.png`（头图横版 logo）。
- 已改：`app/public/favicon-*.png`、`apple-touch-icon.png`、`images/logo.png`、`images/logo-on-dark.png`；`index.html`；`siteData.ts`；`Navbar.tsx`（透明导航用浅色字版）；`Footer.tsx`；`jsonLd.ts`。
- 已验证：`npm run build`；本地 `3000` 下 favicon link + navbar/footer 加载官方 PNG。
- 未验证：生产 rebuild 后公网 tab 图标（需硬刷新清缓存）。
- 残留：旧 `images/logo.svg` 仍在 public，已无引用。

**done（sitemap 完整化）** — 已推 `origin/dev`（`49851de`），PR #1 已合并 `main`（merge `d60b81f`）。

### Progress note（sitemap 完整化，2026-07-19）

- 目标：完整 sitemap 可被生产抓取，并走 git → dev → main。
- 已改：`seo-public-routes.mjs`、`generate-sitemap.mjs`、`prerender.mjs`、`package.json`、`public/sitemap.xml`（45 URL）、`public/robots.txt`、gotchas/progress/task-board。
- 域名：`https://www.xuntingtravel.com`；路径型 URL（BrowserRouter，无 `#`）。
- Git：commit `49851de` → push `dev`；PR https://github.com/WHaoxM/xtch-web-portal/pull/1 → merge `d60b81f` on `main`。
- 已验证：`npm run build`（dist 含 45 URL sitemap）；公网 curl / 生产 rebuild 未验。
- 风险：tour slug 来自 backfill 列表；生产库若另有 published routes 需扩 `TOUR_ENTRIES` 再跑 `seo:sitemap`。

**done（仅技术 SEO）** — 用户要求撤掉内容 GEO 展示；页面 FAQ/Home 新块等已回滚；技术层（Router/meta/prerender）保留。

### Progress note（撤回内容 GEO 展示，2026-07-19）

- 已撤：Home 实体段+按钮、Guide/About/Destination/Custom/Contact 新增 FAQ、指南 lead、站外 playbook。
- 保留：BrowserRouter、canonical/meta/JSON-LD、robots/sitemap/llms、prerender、TourCost/RouteDetail 原有 FAQ（本来就有）。
- 下一步：生产 rebuild + Supabase/Stripe path 回调。

### Progress note（SEO/GEO Phase B，2026-07-19）

- 已改：`BrowserRouter`、`hashLegacyRedirect`、`authClient` path 模型、`/auth/callback`、Stripe/email/order 解析、`vite base: '/'`、sitemap/llms path、`prerender.mjs`+playwright、`serve-selfhost` 目录 index、ops/gotchas/context。
- 已验证：`npm run build`、`npm run prerender -- dist/local`（25 ok）、`npm run lint`；抽查 `/destinations/beijing` prerender canonical。
- 未验证：生产 Supabase Redirect / 真实 Stripe env 是否仍写旧 hash；真机 Auth/OTP；公网 curl prerender。
- 运维必做：Supabase 加 `https://www.xuntingtravel.com/auth/callback`；生产 `.env` Stripe URL 去 `#`；`build:win11-home` 后重启 serve。
- 下一步：Phase C 内容包（Guide/About/Destination FAQ + answer-first）。

### Progress note（SEO/GEO Phase A，2026-07-19）

- 门禁 G1–G4 已确认；域名/seo 模块/机器文件/动态 meta+FAQ schema 已完成。

### Progress note（SEO/GEO 精细设计，2026-07-19）

- 设计稿：`docs/superpowers/specs/2026-07-19-seo-geo-design.md`。

**done（Me 页 Google/Apple 无反馈）** — OAuth 先进入 Sign In 再发起；失败可见错误；build/lint 绿。

### Progress note（Me 页 Google/Apple，2026-07-19）

- 根因：Me 点 Google/Apple 不跳 Sign In，错误写在 `authError` 但 Me 不渲染 → 像「点不进去」；邮箱会 `beginSignIn`。
- 已改：`handleProviderSignIn` 对 OAuth 先 `setActiveView('signIn')`；`handleAccountSignIn` 统一走该路径；gotchas。
- 已验证：`npm run build`、`npm run lint`。
- 未验证：真机点 Google（应跳 Google）；Apple 未启用时应见红字提示。
- 下一步：硬刷新 Me → Continue with Google。

**done（Admin 无权限独立页）** — 非名单账号只见 Access denied 卡，不见侧栏/工作台；build/lint 绿。

### Progress note（Admin 无权限独立页，2026-07-19）

- 目标：已登录但不在 Admin 名单 → 独立提示页，不渲染 Admin 壳。
- 已改：`Admin.tsx` 增加 `roleStatus` + `AccessDeniedView`；`/api/admin/me` 失败（非过期会话）不再进侧栏；gotchas 补充。
- 已验证：`npm run build`、`npm run lint`。
- 未验证：浏览器用非名单 Google 账号再进 `#/admin`。
- 下一步：硬刷新 `#/admin`；要进后台需把邮箱写入 `ADMIN_*_EMAIL_ALLOWLIST`。

**done（订单凭证认领）** — 表单邮箱≠登录邮箱时，可用 order+token / session_id 绑到当前账号；build/lint 绿。

### Progress note（订单凭证认领，2026-07-19）

- 目标：方案 2 — 确认信/成功页凭证绑定，不依赖 lead_email === auth email。
- 已改：`claimOrderByProof` + `/api/claim-orders` 扩展；`orderClient` 解析链接；`LinkOrderToAccount`；OrderSuccess / Account / Mini-App 成功页与 My Orders。
- 规则：有 token 或 Stripe `session_id` 即可认领；已绑他人账号 → 409；邮箱自动认领仍保留。
- 已验证：`npm run build`、`npm run lint`。
- 未验证：真支付回流 / 确认信粘贴端到端。
- 下一步：用户用 DEV bypass 或真单测「不同邮箱登录 + 成功页/粘贴链接」。

**done（旅客邮件勿跳 Admin）** — 已推 `dev`+`main`（`bb833dc`）；生产需 `build:win11-home` + 重启 `deploy:serve` 后验。

### Progress note（旅客邮件勿跳 Admin，2026-07-19）

- 目标：移动端旅客注册/登录点邮件链接不再进 `#/admin`。
- 根因：(1) 旅客 OTP 未带 `emailRedirectTo`；(2) 无 `auth_next` 时用 allowlist 推断 `#/admin`。
- 已改并推送：`authClient.ts`、`auth-otp.ts`、gotchas；commit `bb833dc` → `origin/dev` + `origin/main`。
- 未验证：生产 rebuild 后真机点旅客确认邮件。
- Dashboard：Site URL 用 `https://www.xuntingtravel.com`（不要 `/#/admin`）。

**in-progress（正式域名 xuntingtravel.com）** — env PUBLIC_DOMAIN + Caddyfile 已写；等 DNS/证书/Supabase OTP 模板。

### Progress note（正式域名 A+B，2026-07-18）

- 目标：A 正式域名入口 + B Auth/发信体验收口。
- 域名：`xuntingtravel.com`（www 一并进 Caddy）。
- 已改：`env/win11-home/.env`（`PUBLIC_DOMAIN=xuntingtravel.com`，恢复 `INQUIRY_TO`）；`deploy/win11-home/Caddyfile`。
- 家宽公网 IP（用户确认，非 VPN）：`125.69.160.65` → 已写入 `env/win11-home/.env` 的 `PUBLIC_IP`。DNS A `@`/`www` 应对准此 IP。
- 进行中：Caddy HTTPS（DNS+端口通后）；用户侧 Supabase Redirect+Token 模板 / Turnstile Hostnames。
- 发信 FROM 仍 `support@neutronm.store`（Resend 已配该域）；站点域与发信域可分离。

**done（S3 相对 URL）** — xtch_prod 封面/媒体改为 `/s3/...`；新上传也写相对路径；ngrok 图 200。

### Progress note（S3 相对 URL，2026-07-18）

- 目标：ngrok/LAN 不裂图（方案 1：入库相对路径）。
- 已改：`s3.ts`（`publicUrlForKey` 相对 + `toSameOriginS3Path`）、`contentQueries` 校验/规范化、migration `010_relative_s3_public_urls`、gotchas。
- 已验：`test:s3` 15 pass；`db:migrate:win11-home` 应用 010；routes/destinations/media 绝对 http=0；`GET /api/routes` 返回 `/s3/...`；本机与 ngrok HEAD 图 200；`npm run build` 绿；已重启 `deploy:serve`。
- 未做：cloud-vps 库若另有数据需同迁移；浏览器硬刷新目视。
- 下一步：用户硬刷新 ngrok Custom 卡看图。

**done（生产表单 Turnstile 配置）** — env 已写、build:win11-home、deploy:serve :3080 已重启；dist 含 site key、无 secret/bypass。

### Progress note（生产表单 Turnstile，2026-07-18）

- 目标：消黄条 + 真 Turnstile；形态 A（本机全栈 + 后续 ngrok）。
- 已写：`env/win11-home/.env` — Turnstile site/secret + `RESEND_API_KEY`（自 local）；FROM 仍 `onboarding@resend.dev`。
- 已验证：`build:win11-home`；dist 有 site key、无 secret、无 bypass；`deploy:serve` Listening `:3080`；`GET /` 200。
- 未验证：浏览器硬刷新看控件；真提交询盘；ngrok Hostnames。
- 风险：试用发件域只能发到 Resend 账号本人；`INQUIRY_TO=qq` 可能 502，需 override 或换已验证域。
- 下一步：用户硬刷新 `http://127.0.0.1:3080` 或 LAN hint；ngrok 时把隧道 host 加进 Turnstile Hostnames。

**in-progress（生产业务数据补全）** — 班期×7 + 分类 + 首页 6 目的地推荐已补；等下一项。

### Progress note（生产业务数据补全，2026-07-18）

- 目标：两套生产业务数据一致；先本机 `xtch_prod`，再同步 cloud-vps。
- 已写：
  - `departures` ×7（featured 路线各 1 期 sellable；运维默认价）
  - `categories`：route×6 + destination×4；themes / travel_styles 已挂
  - 首页 Popular places：beijing/shanghai/chengdu/yunnan/xinjiang/qinghai（priority 1–6）
- 仍缺：cloud-vps 未同步、班期价未业务终审。
- 下一步：用户选 E 同步云 / F 改价 / G 改分类打标。

**done（开发/生产端口拆分）** — Vite `:3000`；`deploy:serve` 默认 `:3080`。

### Progress note（开发/生产端口拆分，2026-07-18）

- 目标：开发与生产各用固定端口，同机可并行、避免 `free-dev-port` 误杀生产。
- 决定：开发 `3000`（不变）；生产 `3080`（新默认）。
- 已改：`serve-selfhost.mjs`、`publicOrigin.ts`、两份 Caddyfile、`env/*/`.env.example、ops/gotchas/context/workflows、`.cursor/rules/dev-server-port.mdc`、`bootstrap.sh`。
- 已验证：默认值与 Caddy 反代指向 `3080`（代码审阅）；未重启本机已在跑的 `deploy:serve`（若仍在 3000 需重启）。
- 下一步：用户若有运行中的 serve/Caddy，重启并核对 `http://127.0.0.1:3080`；Supabase Redirect 补 `:3080` LAN 入口。

**in-progress（deploy:serve 拒启）** — dist 含 `dev-bypass-token`；用 `build:win11-home` 重建后重启 serve。

### Progress note（deploy:serve 拒启，2026-07-18）

- 现象：`npm run deploy:serve` 拒绝启动，因 `app/dist` 含 `dev-bypass-token`（本地 `npm run build` 打进了 `VITE_DEV_AUTH_BYPASS_EMAIL`）。
- 处理：`npm run build:win11-home` → 确认 dist 无 bypass → `npm run deploy:serve`。
- 备注：已在 `app/` 时不要再 `cd app`（没有 `app/app`）。

**done（dist 按 target 隔离）** — `build`→`dist/local/`；`build:win11-home`→`dist/win11-home/`；serve 只读对应目录 + marker。

### Progress note（dist target 隔离，2026-07-18）

- 目标：杜绝本地 `npm run build` 污染 `deploy:serve` 静态包。
- 已改：`vite.config.ts`（`outDir=dist/<target>` + `.xtch-build-target`）；`serve-selfhost.mjs`（按 target 读 dist、校验 marker/bypass）；`package.json` build/preview；gotchas/ops 路径。
- 已验证：`build:win11-home` → `dist/win11-home/` 无 bypass；随后 `build` → `dist/local/`，`dist/win11-home` 仍在。
- 下一步：用户 `npm run deploy:serve`（读 `dist/win11-home`）。

**done（路线展示标签强制对齐筛选分类）** — 读/写均由 themes[0]→label；Admin 手填关闭；无 themes 无角标。

### Progress note（展示标签强制对齐，2026-07-18）

- 目标：首页角标不再出现与「筛选分类」无关的漂移文案。
- 已改：`contentQueries`（list + upsert 强制 `alignRouteCategory`）；`routeDraft` 去掉 `categoryManual`；`RouteEditor` 展示标签只读；旅客端无 category 则不渲染 pill；gotchas。
- 已验证：`npm run build` / `lint` 绿。
- 下一步：硬刷新后看 Browse routes；未勾选筛选分类的路线应无角标；勾选后角标=该分类英文名。

**done（分类筛选默认 All + 文案拆开）** — Places/Routes 默认 All；Admin「分类文案」→「展示标签」、侧栏「筛选分类」。浏览器已验通。

### Progress note（分类后列表空白 + 文案止痛，2026-07-18）

- 目标：修建筛选分类后列表变空；文案拆开展示标签 vs 筛选分类。
- 已改：`ChinaTripsMobile.tsx`（`ALL_FILTER_KEY`、Destinations/Routes 默认 All）；`RouteEditor` / `DestinationEditor` / `Admin` 用词。
- 已验证：`build`/`lint`；本地写入测试筛选分类后浏览器：Places 默认 All=12 → Culture=0 → All=12；Routes API 有 Classic。
- 未提交：与 Auth WIP 同文件混杂。
- 下一步：用户本机硬刷新验收；需要时拆开 commit。

**done（Auth Session + Email OTP P0，代码）** — `@supabase/supabase-js` 续期 + Admin/旅客 6 位 OTP；build/lint 绿；浏览器与 Dashboard 模板待用户验。

### Progress note（Auth Session OTP P0，2026-07-18）

- 目标：同设备 refresh 静默续期；邮箱 OTP 同页校验；Admin 名单预检后发码；去掉 magic link 主 CTA。
- 已读：计划、`authClient` / Admin SignIn / ChinaTrips SignIn / gotchas / win11-home。
- 已改：spec/plan；`@supabase/supabase-js`；`supabaseClient.ts`；`authClient.ts`（SDK 会话、迁移旧 key、OTP、`ensureFreshSession`）；`api/admin/auth-otp.ts` + magic-link 别名；`localApiRoutes`；Admin/ChinaTrips OTP 两步 UI；`orderClient`/`adminSessionClient` 401 续期一次；Account `subscribeAuthSession`；gotchas/win11-home。
- 已验证：`npm run build` / `lint`；`build:win11-home`（dist `dev-bypass-token=0`）；`deploy:serve` 已重启（25 routes，含 `auth-otp`）；Admin UI 显示「Send sign-in code」；非名单 403；名单发码触达 Supabase 但当前被 **email rate limit** 拦下。
- 未验证：收信 + 同页输码 + 刷新续期 + 60s 倒计时 UI（需限流过后再点）；Dashboard 模板 `{{ .Token }}`。
- 下一步：等 Supabase 发信限流解除 → 硬刷新 `http://127.0.0.1:3000/#/admin` 或 LAN hint → 发码验收；确认 Magic Link 模板含 `{{ .Token }}`。

**in-progress（Admin Auth token consume）** — 修卡在首页 `#access_token=…`：强制消费 token + admin/me 回退。

### Progress note（Admin Auth 卡在 #access_token，2026-07-18）

- 现象：魔法链接落到 `#access_token=…&type=recovery`，停在首页，未进 Admin。
- 根因：(1) 已有 session 时跳过消费；(2) Site URL 丢掉 `auth_next`。
- 已改：`App.tsx`、`authClient.ts`（admin/me → `#/admin`）、gotchas；已 `build:win11-home` + 重启 serve。
- 未验证：浏览器再点**新**魔法链接（勿用旧 recovery 链接）。
- 下一步：用户硬刷新后从 `#/admin` 重发链接验收。

**in-progress（旅客登录↔订单）** — grill 确认 C：默认回 `#/china-trips`+Me；token 门禁；401 清会话；Account/Me 跨标签同步。

### Progress note（旅客登录↔订单，2026-07-18）

- 目标：修「像已登录、点订单仍要登录」；验收：双入口 + 刷新后仍可拉 `/api/my-orders`（可空列表）。
- 已读：grill 共识、`authClient`/`AuthCallback`/`Account`/`ChinaTripsMobile`/`my-orders`。
- 已改：`authClient.ts`（旅客默认回 china-trips + Me focus）、`AuthCallback.tsx`、`Account.tsx`、`orderClient.ts`（401 标记）、`ChinaTripsMobile.tsx`（重读会话/401/storage）。
- 已验证：`npm run build` / `npm run lint`。
- 未验证：浏览器邮箱 magic link round-trip（Me 订单 + `#/account`）。
- 下一步：用户本机验收标准 B。

**in-progress（Admin Auth return path）** — 修魔法链接误跳 `#/account`：回跳改 `localStorage` + `?auth_next=`。

### Progress note（Admin Auth 误跳 account，2026-07-18）

- 现象：Admin 登录后到 `http://192.168.99.248:3000/#/account`（旅客空订单页）。
- 根因：回跳只写在 `sessionStorage`；邮件魔法链接常开**新标签**，读不到 `#/admin`，intent 回退 `#/account`。
- 已改：`authClient.ts`（localStorage+TTL、`?auth_next=`、Admin/OAuth/旅客 magic link 带 next）；`Admin.tsx` Google `returnPath`；gotchas / win11-home Redirect 通配说明。
- 已验证：`npm run build` / `npm run lint` 绿。
- 未验证：浏览器 Admin 魔法链接 / Google 回跳仍进 `#/admin`（需 `build:win11-home` + 重启 serve；Supabase Redirect 加 `http://192.168.x.x:3000/**`）。
- 下一步：重建部署后硬刷新 `#/admin` 再登录验收。

### Progress note（Admin Auth deploy mismatch，2026-07-18）

- 现象：壳显示 freezingm… 但 API `Invalid or expired admin session`；发魔法链接 `Not found.`。
- 根因：`dist` 用 `npm run build`（local）打进 `VITE_DEV_AUTH_BYPASS_EMAIL`；`deploy:serve` 拒 bypass。运行中进程仅 23 routes（缺 `auth-magic-link`）。
- 已改：`build:win11-home` 重建（dist 无 bypass）；`serve-selfhost` 拒绝含 `dev-bypass-token` 的 dist；Admin `/me` 401 清会话；魔法链接 404 文案；gotchas。
- 已验证：`build:win11-home`；dist `dev-bypass=0` / `auth-magic-link=1`；正在重启 `deploy:serve`。
- 未验证：用户硬刷新后魔法链接收信 round-trip。
- 下一步：硬刷新 `#/admin` → 发魔法链接 → 应回 Admin 且工作台有数。

### Progress note（Admin Auth callback，2026-07-18）

- 目标：修魔法链接落在 `#access_token` / 误跳 `#/account`；回登录发起页；Admin 仅名单可发链接。
- 已改：`authClient.ts`、`AuthCallback.tsx`、`App.tsx`、`Admin.tsx` SignIn、`api/admin/auth-magic-link.ts`、`localApiRoutes`、gotchas、`win11-home.md`。
- 已验证：`build`/`lint`；后续见「deploy mismatch」note。

**done（Prod multi-origin）** — `deploy:serve` 默认 `0.0.0.0`；`publicOrigin`（域名 > PUBLIC_IP > LAN）；S3/Auth 跟请求 Host；`VITE_AUTH_REDIRECT_URL` 宜留空。

### Progress note（Prod multi-origin，2026-07-18）

- 目标：执行生产多入口计划。
- 已改：`serve-selfhost.mjs`、`publicOrigin.ts`(+test)、`s3.ts`/`media-presign`、env examples + 本机 win11-home/cloud-vps `.env`、`win11-home.md`、gotchas、`test:s3`。
- 已验证：`npm run test:s3`（13 pass）、`build`、`lint`。
- 未验证：局域网 IP 浏览器冒烟（需用户本机防火墙）。
- 下一步：`npm run build:win11-home` 后 `deploy:serve`；Supabase/Google 白名单加局域网 origin。

**done（Env folder layering）** — 配置迁入 `env/<target>/.env`；共享 `scripts/env/targetEnv.ts`；docs/ops 按 target+shared 分层；旧 `app/.env.*.local` 仅回退一轮。

### Progress note（Env folder layering，2026-07-18）

- 目标：执行 `.cursor/plans/env_folder_layering_abe46b57.plan.md`。
- 已读：计划、既有 loaders（vite/serve/migrate/tunnel/import/小脚本）、四套 example、ops 文档。
- 已改：`scripts/env/targetEnv.ts`；`env/{local,tunnel,win11-home,cloud-vps}/.env.example` + README；本机复制真实 `.env`（未提交）；根 `.gitignore`；接线 vite/serve/migrate/tunnel/import/小脚本；`docs/ops/README.md` + target/shared + 旧路径跳转；`app/ENV.md`；删 `app/.env*.example`；gotchas/context；bootstrap 注释。
- 已验证：`git check-ignore` 忽略 `env/*/.env`、跟踪 example；`db:migrate --env local` → `env\local\.env`；`cloud-vps` 缺文件报新文案；`build:win11-home` / `build` / `lint` 绿；`deploy:serve` 读到 `env/win11-home/.env`（G1 空名单拒启，路径正确）。
- 未验证：浏览器 `npm run dev` 全链路；用户手删旧 `app/.env.*.local`。
- 下一步：确认新路径 OK 后可手删旧 `app/.env.*.local`；公网前填 `env/win11-home/.env` 真实 Admin 名单。

**done（Env layer cleanup）** — 四层环境总览收口；gitignore 忽略 `*.secrets*`；example 注释对齐；未搬目录、未删 selfhost 回退。

### Progress note（Env layer cleanup，2026-07-18）

- 目标：执行 `.cursor/plans/env_layer_cleanup_486d8e8c.plan.md`（方案 C）。
- 已读：计划、`docs/ops/deploy/README.md`、gotchas/context、四套 env example、`app/.gitignore`。
- 已改：`docs/ops/deploy/README.md`（四层总览 + selfhost 别名）、`docs/agent-context.md`、`docs/agent-gotchas.md`、`app/.gitignore`、`app/.env.{local,tunnel,win11-home,cloud-vps,selfhost}.local.example` 头注释。
- 已验证：`git check-ignore -v app/.env.selfhost.secrets.local.txt` → `app/.gitignore:*.secrets.local.txt`。
- 未验证 / 不做：真实 `.env.*.local` 改名；硬删 selfhost 回退；env 搬目录。
- 下一步：可选本机复制 `.env.selfhost.local` → `.env.win11-home.local`；需要时再开 D 方案搬目录。

**done（Prod Admin S1）** — 双名单 ops/tech + `GET /api/admin/me` + Admin 角色展示/`minRole` 钩子 + 生产 G1 拒启 + S1 运维文档。未建 Prod Supabase、未写真实邮箱进 git。

### Progress note（Prod Admin S1，2026-07-18）

- 目标：执行 `.cursor/plans/prod_admin_s1_5ffd86d2.plan.md`。
- 已改：`adminAllowlist.ts`(+test)、`adminAuth.ts`、`admin/me.ts`、`adminSessionClient.ts`、`Admin.tsx`、`localApiRoutes.ts`、`serve-selfhost.mjs`、env examples、deploy/tunnel/gotchas、`package.json` `test:admin-allowlist`。
- 已验证：`npm run test:admin-allowlist`（8 pass）；`npm run build` / `lint`；G1 空名单与 `you@example.com` 拒启；填 `smoke-admin@example.test` 后 `deploy:serve --target cloud-vps` 可起（临时 env 已删）。
- 未验证：浏览器登录后 `/api/admin/me` 与侧栏「运营/技术」；本机旧单名单进 Admin；用户 Prod Supabase 建项与真邮箱配置。
- 下一步：用户按 `docs/ops/deploy/win11-home.md` S1 清单配 Prod keys + 双名单；若 `.env.win11-home.local` 仍只有 `you@example.com` 需改真实邮箱否则拒启。

**done（MinIO/DB 多库隔离 + 备份导入）** — 生产隔离 `xtch_prod` + `xtch-prod`；备份包已导入并重写 `dev/`→`prod/`；627 对象在生产桶可读。

### Progress note（MinIO/DB 多库隔离，2026-07-18）

- 目标：把 `D:\XTCH_PROJECT\db\xtch-content-minio-backup-2026-07-17\2026-07-17T22-30-35` 迁入生产隔离，不污染日常 `xtch` / `xtch-public`。
- 已读：备份 `manifest`/`IMPORT.md`/`media-map`、compose、`migrate.ts`、`docs/ops/deploy/win11-home.md`、content schema。
- 已改：`docker/postgres/init-extra-db.sql`（`xtch_prod`）、`docker-compose.yml`（桶 `xtch-prod`）、`app/scripts/import-content-backup.ts`、`docs/ops/content-backup.md`、env examples / `.env.selfhost.local`、gotchas/minio 文档、备份包 `IMPORT.md`/`OBJECTS.md`。
- 已验证：`CREATE DATABASE xtch_prod`；`minio-init` 建桶；`db:migrate:selfhost`→`xtch_prod` 9 条；import 12/20/627/111；`mc mirror` 后 `xtch-prod/prod/` **627** 对象；样例 JPG HTTP 200；URL 为 `…/s3/xtch-prod/prod/…`；日常 `xtch` 仍独立有 20 路线。
- 未验证：`deploy:serve` 读生产库后的全站浏览器冒烟；公网域名下的 `/s3`；建议复制 `.env.selfhost.local`→`.env.win11-home.local`。
- 下一步：本机 `npm run selfhost` / `deploy:serve` 验收图片与 `/api/routes`；公网前改密。

**done（Deploy target layering）** — `win11-home` / `cloud-vps` 分层 + cloud-vps 部署包（脚本/env/systemd/文档）。本机 build/serve 冒烟通过；无 SSH、无数据迁移。

### Progress note（Deploy target layering，2026-07-18）

- 目标：执行 `.cursor/plans/deploy_target_layering_66193799.plan.md`。
- 已改：`serve-selfhost.mjs`（`--target`/`DEPLOY_TARGET`）、`migrate.ts`（win11-home/cloud-vps + selfhost 别名）、`package.json` scripts、env examples、`deploy/win11-home`+`cloud-vps`、`docs/ops/deploy/*`、ops/旧文档重定向、gotchas/context/minio、vite win11-home→selfhost env 回退。
- 已验证：`npm run build:win11-home`；`npm run deploy:serve` 冒烟（target=win11-home，env 回退 `.env.selfhost.local`；`/` `/api/routes` `/s3/minio/health/live` 皆 200）；`db:migrate:cloud-vps` 缺 env 明确报错。
- 未验证：真机 SSH/证书/切 DNS；Win11→云数据迁移（本期不做）。
- 下一步：云主机开通后按 `docs/ops/deploy/cloud-vps.md` 上机；建议本机复制 `.env.selfhost.local` → `.env.win11-home.local`。

**done（Win11 selfhost）** — serve-selfhost + `S3_BROWSER_ENDPOINT` + compose 绑 `127.0.0.1` + Caddy/运维文档。本机冒烟通过；外网 HTTPS/端口映射待用户环境。

### Progress note（Win11 selfhost，2026-07-18）

- 目标：执行 `.cursor/plans/win11_selfhost_server_2b93f7f0.plan.md`。
- 已改：`serve-selfhost.mjs`、`localApiRoutes.ts`、`s3.ts`（浏览器 URL 改写）、`.env.selfhost.local.example`、`docker-compose.yml`、`ops/Caddyfile`、`docs/ops/win11-selfhost.md`、gotchas/migrate `--env selfhost`、`build:selfhost`/`selfhost` scripts。
- 已验证：`npm run test:s3`；`npm run build`；`npm run selfhost` 冒烟（`/` HTML、`/api/routes` 200、`/s3/minio/health/live` 200、SPA fallback）。
- 未验证：公网 DNS/路由 80·443、Caddy 证书、Admin 真登录、媒体 PUT 全链路、开机自启、外网端口扫描。
- 下一步：用户按 `docs/ops/win11-selfhost.md` 填域名/改密/起 Caddy 做外网验收。

**done（Admin 表单配置通俗化）** — 预览优先：完整定制/路线私人手机框 + 自动 fieldKey（snake）+ 草稿合并「未保存」角标 + 列表整表预览 + CJK 门闩。已验证 build/lint。

### Progress note（Admin 表单配置通俗化，2026-07-18）

- 目标：执行 `.cursor/plans/admin表单配置通俗化_16d97113.plan.md`。
- 已读：计划、`CustomTripFormPanel`、`CustomTripPreferenceFields`、分类/路线预览壳、API `fieldKey` 校验（`^[a-z][a-z0-9_]{1,63}$`）。
- 已改：`formFieldDraft.ts`、`FormConfigMobilePreview.tsx`、`Admin.tsx` CustomTripFormPanel、gotchas/task-board。
- 已验证：`npm run build` / `npm run lint` 全绿。
- 未验证：浏览器改 label→预览即时变；勾选路线私人→短表单 Tab；列表整表预览；CJK 拦截（需 Postgres）。
- 下一步：起库后在 Admin「定制行程表单」验收。

**done（Admin 工作台通俗化）** — 四卡紧急序（取消→询盘→草稿路线→待审素材）+ `dashboardOpsCopy` 文案 + 有数醒目/零淡化；未改 dashboard API。已验证 build/lint。

### Progress note（Admin 工作台通俗化，2026-07-18）

- 目标：执行 `.cursor/plans/admin工作台通俗化_0aa74511.plan.md`。
- 已改：`dashboardOpsCopy.ts`（新建）；`Admin.tsx` DashboardPanel（重排、文案、有数/零样式）；`agent-gotchas`。
- 已验证：`npm run build` / `npm run lint` 全绿。
- 未验证：浏览器有取消/询盘数据时前两卡醒目与跳转筛选；全 0 四卡可点（需 Postgres）。
- 下一步：起库后在 Admin「工作台」验收。

**done（Admin 路线详情预览对齐）** — `MobileRouteDetailFacade` 扩至 Overview 全文、全部逐日、moments、included；无 Booking CTA；无天数截断。已验证 build/lint。

### Progress note（Admin 路线详情预览对齐，2026-07-18）

- 目标：路线预览与目的地同一口径——内容块全预览，交易 CTA 不预览。
- 已改：`MobileRouteDetailFacade.tsx`；`routeDraft.draftToRouteTour`（无逐日时仍透出 experience/moments/included 供预览）；gotchas。
- 已验证：`npm run build` / `npm run lint` 全绿。
- 未验证：浏览器路线编辑「详情门面」Tab。
- 下一步：无。

**done（Admin 分类通俗化）** — 运营只填英文显示名/排序/启用；key 自动生成并隐藏；CJK 保存拦截；两套筛选与停用说明。已验证 build/lint。

### Progress note（Admin 分类通俗化，2026-07-18）

- 目标：执行 `.cursor/plans/admin分类通俗化_92aba6f1.plan.md`。
- 已改：`Admin.tsx` CategoriesPanel（新建自动 key + 末尾排序、编辑高级只读 key、页顶 Places/Routes 说明、列表 key 弱化、CJK 门闩、停用文案）；`agent-gotchas`。
- 已验证：`npm run build` / `npm run lint` 全绿。
- 未验证：浏览器新建→自动 key→路线/目的地勾选可见；中文拦截；停用后筛选栏隐藏（需 Postgres）。
- 下一步：起库后在 Admin「分类」验收。

**done（Admin 素材通俗化）** — 选图器搜索/说明/关联筛；库页新建默认 review + 名称多选关联 + 通过/驳回；工作台待审文案对齐。已验证 build/lint。

### Progress note（Admin 素材通俗化，2026-07-18）

- 目标：执行 `.cursor/plans/admin素材通俗化_9a62b58b.plan.md`；选图上传仍 published；库新建 review。
- 已读：计划、`ImageFieldPicker`、`MediaPanel`/`emptyMediaDraft`、Dashboard `reviewMedia`、`mediaClient`/`parseMediaInput`。
- 已改：`ImageFieldPicker.tsx`；`Admin.tsx` MediaPanel + Dashboard 卡；`RouteEditor`/`DestinationEditor` 传 context slug；`agent-gotchas`。
- 已验证：`npm run build` / `npm run lint` 全绿。
- 未验证：浏览器选图上传→封面变、库新建待审→通过/驳回、关联勾选往返（需 Postgres）。
- 下一步：起库后在 Admin「素材」与路线/目的地选图验收。

**done（Admin 目的地真移动预览）** — 390 壳三 Tab + 详情照实反查已发布关联路线（最多 4 条）；空态提示去路线勾选。已验证 build/lint。

### Progress note（Admin 目的地真移动预览，2026-07-18）

- 目标：对齐 `RouteMobilePreview`；详情含「Routes from」只读反查。
- 已改：`MobileDestinationDetailFacade`（相关路线 + 空态）、`DestinationMobilePreview`（`fetchAdminRoutes` 筛 `destinationSlugs` + published）、`DestinationEditor` 传 token；桌面 `.iosapp-page` 空白已修。
- 已验证：`npm run build` / `npm run lint`。
- 未验证：浏览器详情 Tab 有/无关联路线两种空态。
- 下一步：无（本任务收口）。

**done（Admin 目的地通俗化）** — 快速壳 + 自动 slug + 存草稿/上架 + 首页推荐折叠；新建默认 draft；CJK 上架拦截。预览已升级为真移动组件（见上条）。

### Progress note（Admin 目的地通俗化，2026-07-18）

- 目标：对齐路线快速壳；理清 displayOrder vs featuredPriority；不新开字段。
- 已读：计划、`DestinationsPanel`、`RouteEditor`/`routeDraft`/`slugify`、`destinationsClient`。
- 已改：`destinationDraft.ts`、`DestinationEditor.tsx`、`slugify.ts`（`prefix`）、`Admin.tsx` DestinationsPanel、gotchas/task-board。
- 已验证：`npm run build` / `npm run lint` 全绿（通俗化阶段）。
- 未验证：浏览器新建→自动 slug→存草稿/上架（需 Postgres）。

**done（Admin 班期通俗化）** — 快速开班 + 任务化状态 + 列表短标签/可买/路线与可售筛/重新上架；不改后端状态枚举。已验证 build/lint。

### Progress note（Admin 班期通俗化，2026-07-18）

- 目标：旅客能否购买一眼可见；锁/关/取消人话确认；目的地显示名称；快速开班 + 更多设置。
- 已读：计划、`DeparturesPanel`、`orderOpsCopy`/`inquiryOpsCopy`、`destinationsClient`、`admin/departures.ts`。
- 已改：`departureOpsCopy.ts`、`departureDraft.ts`、`DepartureEditor.tsx`、`Admin.tsx` DeparturesPanel、gotchas/task-board。
- 已验证：`npm run build` / `npm run lint` 全绿。
- 未验证：浏览器开班→上架→锁团→重新上架→关闭/取消（需 Postgres）。
- 下一步：起库后在 Admin「班期」验收。

**done（Admin 订单通俗化）** — 详情改为跟进工单三块（下一步/客人行程金额/支付技术折叠）；双状态人话；取消申请强警示；打开详情 GET 回显备注；列表补支付列与可读时间；工作台取消卡文案对齐。已验证 build/lint。

### Progress note（Admin 订单通俗化，2026-07-18）

- 目标：订单详情从字段 dump → 下一步指引；修点列表 `setNotes('')`；列表支付列；不新增取消批准/退款。
- 已读：计划、`OrdersPanel`、`InquiryDetail`/`inquiryOpsCopy`、`admin/orders.ts`。
- 已改：`orderOpsCopy.ts`、`OrderDetail.tsx`、`Admin.tsx` OrdersPanel + Dashboard 取消卡、`admin/orders.ts` `sanitizeOrderForDetail`、gotchas/task-board。
- 已验证：`npm run build` / `npm run lint` 全绿。
- 未验证：浏览器 `confirmed+paid` / `cancellation_requested` / `pending_payment` 手测（需 Postgres）。
- 下一步：起库后在 Admin「订单」验收；班期通俗化另开任务。

**done（本地 Admin 免登录）** — 已建 `app/.env.local`（bypass + allowlist = `dev-admin@syncingtravel.test`）；`/#/admin` 可直接进。Postgres `:5432` 未起 → 工作台 `Admin request failed`（与登录无关）。

### Progress note（本地 Admin 免登录，2026-07-18）

- 已改：`app/.env.local`；`app/.env.local.example` 补 `ADMIN_EMAIL_ALLOWLIST`。
- 已验证：浏览器 Signed in as `dev-admin@syncingtravel.test`。
- 下一步：用户起本地 Postgres 后刷新；换邮箱则改 `.env.local` 三处并重启 `npm run dev`。

**done（Admin 询盘通俗化）** — 详情改为跟进工单三块（下一步/意向/技术折叠）；一键改状态；偏好用人话 label；列表时间 `M月D日 HH:mm`。已验证 build/lint。

### Progress note（Admin 询盘通俗化，2026-07-18）

- 目标：详情从字段 dump → 下一步/客人意向/技术折叠；列表时间可读；不改状态枚举、不发信。
- 已读：计划、`InquiriesPanel`、`inquiriesAdminClient`、`customTripFormClient`。
- 已改：`inquiryOpsCopy.ts`、`inquiryPreferencesDisplay.ts`、`InquiryDetail.tsx`、`Admin.tsx` InquiriesPanel、gotchas/task-board。
- 已验证：`npm run build` / `npm run lint` 全绿。
- 未验证：浏览器三态/三类型手测（需 Postgres）；表单偏好 label 往返。
- 下一步：起库后在 Admin「询盘」验收；班期通俗化另开任务。

**done（Admin 路线通俗化）** — 快速模式 + 完整编辑 + 内嵌移动真组件预览已落地；新建默认 draft；存草稿/上架；CJK 上架拦截。已验证 build/lint（2026-07-18 再验）。

### Progress note（Admin 路线通俗化，2026-07-18 再验）

- 用户要求执行 `.cursor/plans/admin路线通俗化_ebdfaa4e.plan.md`：对照代码后五项 todo 均已落地，无需重写。
- 再验：`npm run build` / `npm run lint` 全绿。
- 浏览器：已配 bypass，Admin UI 可进；数据 API 仍等 Postgres。
- 下一步：起库后在 Admin「路线」走新建→预览→存草稿/上架；班期/询盘通俗化另开任务。

### Progress note（Admin 路线通俗化，2026-07-18）

- 目标：运营友好的路线编辑（默认快速模式、存草稿/上架、390px 列表卡|详情门面预览）。
- 已读：计划、`Admin.tsx` RoutesPanel、`ChinaTripsMobile` 列表行/详情英雄、`routesClient`/`destinationsClient`、backfill slugify。
- 已改：`MobileRouteListCard`/`MobileRouteDetailFacade`；`slugify.ts`/`routeDraft.ts`；`RouteEditor`/`RouteMobilePreview`；`Admin.tsx` RoutesPanel 挂载；`ChinaTripsMobile` 列表行改用抽取件；gotchas/task-board。
- 已验证：`npm run build` / `npm run lint` 全绿。
- 未验证：浏览器 Admin 新建→预览→存草稿/上架；中文标题上架拦截；375px China Trips 列表卡视觉。
- 下一步：用户在 Admin「路线」走一遍验收；班期/询盘通俗化另开任务。

**done（Mini-App 去站点顶栏）** — ≤900px `/china-trips` 不再渲染站点 Navbar/Footer；375 无 logo/汉堡，可见 AppHeader「Syncing Travel」+ 底栏 Tab。已验证 build/lint + 浏览器。

### Progress note（Mini-App 去站点顶栏，2026-07-18）

- 目标：去掉网站式顶栏（logo + 汉堡）；Mini-App 用底栏 + AppHeader。
- 已改：`App.tsx`（`useSyncExternalStore` ≤900px 不渲染 Navbar/Footer）；`index.css` / `chinaTripsMobile.css`（`:has` / `!important` 加固）；设计文档与 gotchas。
- 已验证：`npm run build` / `npm run lint`；375 `navCount=0`、`Open menu` 不存在；截图无站点顶栏。
- 未验证：隧道真机需硬刷新或重启 `testbed:tunnel`。
- 下一步：无（本任务收口）。

**done（traveler story 轮播 UX）** — 已按 grill 规格落地：Embla 可控轮播、交互暂停 + 8s 恢复、圆点可点+滑动、移动端满宽无 peek、reduced-motion 关自动、循环；图片 marquee 未动。已验证 `npm run build` / `npm run lint`。

**done（Real Moments「亭」顶裁切）** — 窄屏负 margin 大于上内边距，父级 `overflow:hidden` 裁掉「亭」顶部；已加大 padding 并改为只裁水平。已验证 build/lint + 375。

### Progress note（traveler story 轮播，2026-07-18）

- 目标：去掉 CSS 强制自动切带来的移动端难受；按 grill 规格落地可控轮播。
- 已读：grill 决议、`Home.tsx` Real Moments story、`index.css` `real-story-*`、`ui/carousel.tsx`（复用已有 Embla，未加新依赖）。
- 已改：`app/src/pages/Home.tsx`（`TravelerStoryCarousel`）；`app/src/index.css`（去掉 `real-story-slide` 动画、viewport/满宽/圆点 button）；任务板/进度/gotchas。
- 已验证：`npm run build` / `npm run lint` 全绿。
- 未验证：浏览器桌面 hover/圆点、移动端滑与 8s 恢复、`prefers-reduced-motion`。
- 下一步：无（本任务收口）；用户刷新首页 Real Moments 故事区验收。

### Progress note（Real Moments「亭」顶裁切，2026-07-18）

- 目标：修用户第二张截图「亭」顶部被裁。
- 根因：移动端 `margin:-72px` + `padding-top:64px` → 内容起点在父级裁切线上方约 8px。
- 已改：`index.css`（`overflow-x:hidden`、padding-top 88px、emblem `line-height:1.2`）；`Home.tsx`（外包 `overflow-x-hidden`）。
- 已验证：`npm run build` / `npm run lint`；375 `clippedByParent=false`；截图「亭」完整。
- 下一步：无；用户硬刷新后再看。

**done（Real Moments 标题溢出）** — 窄屏 Iconic Places 标题与山形图标重叠已修；`.real-moment-row-title` 改为固定图标列 grid。已验证 `npm run build` / `npm run lint` + 浏览器 320/375。

### Progress note（Real Moments 标题溢出，2026-07-18）

- 目标：修用户截图中 Iconic Places 标题文字压到山形图标上。
- 已读：截图、`Home.tsx` Real Moments、`index.css` `.real-moment-row-title` / `.curated-trust-item`。
- 已改：`app/src/index.css`（标题区改 grid `44px/36px + minmax(0,1fr)`，SVG 固定宽高，文字 `min-width:0` + `overflow-wrap`）。
- 已验证：`npm run build` / `npm run lint` 全绿；浏览器 375/320 测距 `gap=12`、`overlap=false`。
- 未验证：真机 Safari/微信内置浏览器。
- 下一步：无（本任务收口）；用户刷新首页窄屏看 Iconic Places 标题即可。

**done（桌面 Real Moments lightbox）** — 跑马灯点开放大；关闭后从暂停处继续滑动。已验证 `npm run build` / `npm run lint` + 浏览器 open/close 动画态。

### Progress note（桌面 Real Moments lightbox，2026-07-18）

- 目标：Home Real Moments 自动滑动图可点开放大，叉掉后继续滑动。
- 已读：用户截图、`Home.tsx` Real Moments、`index.css` marquee、Mini-App Moments lightbox 对照。
- 已改：`Home.tsx`（`RealMomentsSection` + lightbox；打开时 `is-lightbox-open`）；`index.css`（暂停轨道动画 + lightbox 样式）。
- 已验证：`npm run build` / `npm run lint` 全绿；浏览器点卡 → lightbox；关闭后 `animationPlayState` 从 `paused` 回到 `running`。
- 未验证：无阻塞项。
- 下一步：无（本任务收口）。

**done（首页 Curated 转化 + Mini-App 回门户）** — 三卡深链 + 首选 slug/featured 兜底；Mini-App `?route=`；顶栏品牌 + Me 回 `/`。已验证 `npm run build` / `npm run lint`。

### Progress note（首页 Curated 转化，2026-07-18）

- 目标：Curated Journeys 可转化；Mini-App 可回门户。
- 已读：grill 决议、`Home.tsx`、`ChinaTripsMobile`、`contentStore`、`useIsMobile`。
- 已改：`Home.tsx`（首选 slug + featured 补位 + 静态兜底；桌面 `/tours/:slug`、手机 `?route=`）；`ChinaTripsMobile.tsx`（`?route=` 打开详情后清 query；AppHeader 品牌 + Me Back to website）；`chinaTripsMobile.css`；`mobile-ios-front-end-context.md`；`agent-gotchas.md`。
- 已验证：`npm run build` / `npm run lint` 全绿（本机曾缺 `node_modules`，已 `npm install`）。
- 未验证：浏览器桌面/手机点 View Itinerary；Mini-App 品牌与 Me 回门户；空库兜底三卡。
- 踩坑沉淀（已写入 gotchas）：GitHub 经 SOCKS 慢/需 `-c http.proxy`；`git add` 路径相对仓库根（勿在 `app/` cwd 下写 `app/src/...`）；PowerShell 不用 bash heredoc；缺 `node_modules` 先 `npm install`。
- 下一步：grill 用户清单第 2 项。

**in-progress（隧道测试台联调）** — 本机前置与 `testbed:tunnel` 已拉起；外网四项验收待用户走一遍。

### Progress note（隧道联调启动，2026-07-17）

- 目标：按 `docs/ops/tunnel-testbed.md` 完成本机联调前置并启动公网隧道。
- 已读：`docs/ops/tunnel-testbed.md`、`.env.tunnel.local.example`、agent progress/task board。
- 已做：`cloudflared` 装到 `D:\XTCH_PROJECT\bin` 并写入 User PATH；`CREATE DATABASE xtch_tunnel`；`docker compose up minio-init`（`xtch-tunnel` 桶）；从 `.env.local` 合并密钥生成 `app/.env.tunnel.local`；`npm run db:migrate:tunnel`（Target=`xtch_tunnel`，9 条）；`npm run testbed:tunnel` 已在跑。
- 已验证：cloudflared 2026.7.2 在 PATH；DB/桶就绪；迁移 Target 正确；隧道 URL 已打印。
- 未验证：验收清单 1–4（外网浏览、bypass 下单、Admin/媒体、Resend 收信）。空库首页可能无内容，需 seed/backfill。
- 下一步：用户用隧道 URL 按验收清单测；用完 Ctrl+C 停 `testbed:tunnel`。

### Progress note（隧道测试台，2026-07-17）

- 目标：本机公网可达测试台（非真生产）；不买域名、不建 prod 分支。
- 已读：计划、`docker-compose.yml`、`vite.config.ts`、`scripts/db/migrate.ts`、`.env.local.example`、minio/gotchas、`s3.ts`。
- 已改：`docker-compose.yml`、`docker/postgres/init-extra-db.sql`、`app/vite.config.ts`（`/s3` 反代）、`app/package.json`（`dev:tunnel` / `db:migrate:tunnel` / `testbed:tunnel`）、`scripts/db/migrate.ts`（`--env tunnel`）、`app/.env.tunnel.local.example`、`app/scripts/start-tunnel-testbed.mjs`、`docs/ops/tunnel-testbed.md`、`docs/ops/minio-win11.md`、`docs/agent-gotchas.md`。
- 已验证：`npm run build` / `npm run lint` 全绿；联调前置与进程已起（见上一条）。
- 下一步：用户验收四项。

**done（日期选择与快照修复）** — 见 `.cursor/plans/日期选择与快照修复_bfe542bb.plan.md`：快照 YYYY-MM-DD、展示兜底、迁移 009、Admin 结束日建议、私人短表单日历。已验证 `npm run build` / `npm run lint` / `db:migrate`。

### Progress note（日期选择与快照，2026-07-17）

- 目标：修 ISO 脏快照 + Admin 结束日联动 + 私人短表单日历选出发日。
- 已读：计划、`orders.ts`（事务内 SELECT * 未 formatDate）、`availability.formatDate`、`orderClient.formatOrderDateRange`、DeparturesPanel、routePrivate 短表单。
- 已改：`availability.ts`、`orders.ts`、`009_normalize_order_route_snapshot_dates.ts`、`dateOnly.ts`、`orderClient.ts`、`admin/orders.ts`、`email.ts`、`Admin.tsx`、`ChinaTripsMobile.tsx`（routePrivate）、`routesClient.ts`、`docs/agent-gotchas.md`。
- 已验证：`npm run build` / `npm run lint` 全绿；`npm run db:migrate` 已应用 009。
- 未验证：浏览器新建订单成功页；Admin 选开始日自动填结束日；私人短表单日历/Flexible。
- 下一步：无（本任务收口）；建议本机走一遍 Pay + Admin 班期 + 私人询盘。

**done（My Orders 留在 Mini-App）** — Me → My Orders 改为站内 `myOrders`，不再跳桌面 `/account`。已验证 `npm run build` / `npm run lint`。

### Progress note（My Orders Mini-App，2026-07-17）

- 目标：点击 Me → My Orders 不离开 China Trips Mini-App。
- 已读：截图、`MeTab` `navigate('/account')`、`Account.tsx`、`mobile-ios-front-end-context.md`（搜索/支付回流均站内）。
- 已改：`orderClient.ts`（`fetchMyOrders`）、`ChinaTripsMobile.tsx`（`myOrders` 视图 + 详情 `mode: 'detail'`）、`chinaTripsMobile.css`、`mobile-ios-front-end-context.md`、`agent-gotchas.md`。
- 已验证：`npm run build` / `npm run lint` 全绿。
- 未验证：浏览器 Me → My Orders（空态/有单）与点单进详情返回。
- 下一步：无（本任务收口）；用户刷新后在 Mini-App Me 再点一次。

**done（Booking confirmed CTA 文案）** — 去掉无效的 Add traveler details 禁用按钮，改为说明“旅客信息稍后开放；邮件目前用于查看订单”。已验证 `npm run build` / `npm run lint`。

**done（确认邮件格式）** — Dates 可读日期；Cancellation policy 人话，不再吐 ISO / 字段名。

### Progress note（确认邮件格式，2026-07-17）

- 目标：确认信 Dates / Cancellation policy 可读。
- 已读：用户截图、`email.ts`、`departurePolicy.ts`、`formatOrderDateRange`。
- 已改：`app/api/lib/email.ts`（`formatTripDate` + `formatPolicySnapshot` 认 `*_days_before` 等已知键）。
- 已验证：`npm run build` / `npm run lint` 全绿。
- 未验证：再下一单真收信看邮件正文。
- 下一步：无（本任务收口）；需重启/热更新 API 后再测发信。

**done（Resend 确认信 override）** — 试用 `onboarding@resend.dev` 只能发到账号本人；本地 `BOOKING_EMAIL_OVERRIDE_TO=freezingm2020@outlook.com`。

### Progress note（Resend override，2026-07-17）

- 目标：本地 bypass 确认后 Resend 不再因非白名单收件人失败。
- 已读：终端报错、`email.ts`、`.env.local`、gotchas。
- 已改：`app/api/lib/email.ts`（`BOOKING_EMAIL_OVERRIDE_TO`）、`app/.env.local`、`.env.local.example`、`docs/agent-gotchas.md`。
- 已验证：`npm run build` / `npm run lint` 全绿。
- 未验证：重启 dev 后走一遍 Pay；查 `freezingm2020@outlook.com` 收件箱。
- 下一步：无（本任务收口）；用户需完整重启 `npm run dev` 以加载新 env。

**done（Admin 订单路线空）** — 列表 `sanitizeOrderForList` 未透出 `route_snapshot`，路线列恒为 `-`；已从 snapshot 映射 `route_title` 等。

### Progress note（Admin 订单路线，2026-07-17）

- 目标：修复订单列表路线为空；核对「直接已确认」。
- 已读：截图、`admin/orders.ts` sanitize、`Admin.tsx` OrdersPanel、本地订单行（`ST-260717-XBQP` / `NRB4`）。
- 依据：DB 中 `route_snapshot.route_title` 有值（如 Shanghai），`status=confirmed`；列表 API 剥掉 snapshot，前端读 `route_title` 为空。已确认来自 `DEV_CHECKOUT_BYPASS` 即时确认，非标签映射错误。
- 已改：`app/api/admin/orders.ts`（sanitize 透出 route_title/departure_city/start_date/end_date/route_slug）、`Admin.tsx`（类型 + 详情补充出发地/行程日期）。
- 已验证：本地 SQL 抽查；`npm run build` / `npm run lint` 全绿。
- 未验证：浏览器刷新订单列表看路线列。
- 下一步：无（本任务收口）。

**done（支付成功回流 Mini-App）** — Stripe/bypass 成功落 Mini-App Booking confirmed；bypass 也发确认邮件；见 `.cursor/plans/支付成功回流_mini-app_2b309d9d.plan.md`。

### Progress note（支付成功回流，2026-07-17）

- 目标：支付后 Mini-App 内确认页；dev bypass 触发确认邮件；邮件链仍 `/#/orders/...` 轻修。
- 已读：计划、`checkout-session.ts`、webhook/email、`ChinaTripsMobile` BookingConfirmed、`OrderSuccess`、`orderClient`/`orderQueries`。
- 本次新增：`checkout-session` bypass 后 `sendBookingConfirmationEmail` + status；`SafeOrderSummary.confirmation_email_status`；`formatConfirmationEmailNote`；env/gotchas/mobile 合同注明 console vs Resend。
- 前序已有：success_url、BookingConfirmed 视图+轮询、formatOrderDateRange、Coming soon CTA、CSS。
- 已验证：`npm run build` / `npm run lint` 全绿。
- 未验证：浏览器 bypass → 成功页；终端 `--- Booking confirmation email ---`；resend 真收信。
- 下一步：无（本任务收口）；建议本机重启 dev 后走一遍 Pay。

**done（拼团已报名匿名头像）** — GroupRequest 用 `capacity - available_seats` 显示匿名占位头像；仅拼团/固定班期路线显示，与私人路线短表单分开。

### Progress note（拼团已报名头像，2026-07-17）

- 目标：人数区展示「已在该团」的匿名头像，不露真实姓名。
- 已改：`ChinaTripsMobile.tsx`（`DepartureJoinedRoster` + `routeSupportsGroupTourBooking` guard）、`routesClient.ts`（前端 RouteTour 保留 `primaryType/availableTypes`）、`chinaTripsMobile.css`、`docs/mobile-ios-front-end-context.md`。
- 已验证：`npm run build` / `npm run lint` 全绿；ReadLints 无新增诊断。
- 未验证：浏览器选有/无已订座位班期的视觉。
- 下一步：无（本任务收口）。

**done（表单配置 / 路线私人勾选）** — Admin「定制行程表单」改名为「表单配置」；字段可勾选用于路线私人短表单；补「新建」；迁移 `008`。

### Progress note（表单配置，2026-07-17）

- 目标：避免误认为只能配定制表；短表单字段可勾选；列表能新建字段。
- 已改：`008_custom_form_use_on_route_private.ts`、`customTripForm.ts`、`custom-trip-form.ts` admin API、`customTripFormClient.ts`、`inquiries.ts`、`ChinaTripsMobile.tsx`、`Admin.tsx`、`CONTEXT.md`、`docs/mobile-ios-front-end-context.md`。
- 已验证：`npm run db:migrate`（008）、`npm run build`、`npm run lint` 全绿。
- 未验证：Admin 浏览器点新建/勾选保存；短表单是否只显示勾选字段。
- 下一步：无（本任务收口）。

**done（dev checkout bypass）** — 本地无 Stripe key 时用 `DEV_CHECKOUT_BYPASS=1` 建单并确认，绕过 “Checkout is not configured.”

### Progress note（dev checkout bypass，2026-07-17）

- 目标：开发阶段可走完整预订 UI，无需配置 `STRIPE_SECRET_KEY`。
- 已读：截图错误、`checkout-session.ts`、`stripe.ts`、auth bypass 模式、`.env.local`。
- 已改：`app/api/lib/stripe.ts`（`isDevCheckoutBypassEnabled`）、`app/api/checkout-session.ts`（bypass 建单+确认+跳订单页）、`app/.env.local` + `.env.local.example`、`docs/agent-gotchas.md`。
- 已验证：`npm run build` / `npm run lint` 全绿。
- 未验证：浏览器点 Pay（改 `.env.local` 后需重启 `npm run dev` 再测）。
- 下一步：无（本任务收口）；本机重启 dev 后走一遍拼团确认 → Pay。

**done（checkout confirm 视觉）** — Mini-App `ConfirmBookingScreen`：单张 iOS grouped 确认表；路线+日期作锚点；Total 强调；Refund 作注脚；Stripe 收成信任条。

### Progress note（checkout confirm，2026-07-17）

- 目标：游客确认页从「多卡 key-value 堆」改为可读的付款确认。
- 已读：截图、`ConfirmBookingScreen`、`chinaTripsMobile.css`、`docs/mobile-ios-front-end-context.md`、Web Interface Guidelines。
- 已改：`ChinaTripsMobile.tsx`（`ConfirmBookingScreen`）、`chinaTripsMobile.css`（`iosapp-checkout-review` / review rows / total / note / stripe-trust）、`docs/mobile-ios-front-end-context.md` Checkout Rules（full payment CTA）。
- 已验证：`npm run build` / `npm run lint` 全绿。
- 未验证：浏览器 320/375/390 视觉（本会话 Shell sandbox 不可用；建议本机开 `#/china-trips` 走完拼团到确认页）。
- 下一步：无（本任务收口）。

**done（路线私人短表单）** — 移动端路线详情：Plan private → 基于此路线短表单（`route_private`）；Join 按路线筛班期，无班期引导短表单；见 `.cursor/plans/路线私人短表单_ff16df75.plan.md`。

### Progress note（路线私人短表单，2026-07-17）

- 目标：路线详情私人 CTA 走短表单；拼团只显示该路线班期；Admin 识别 `route_private`。
- 已读：计划、`inquiryClient`/`inquiries`/`adminInquiries`、`ChinaTripsMobile` RouteDetail/GroupRequest、Admin 询盘标签。
- 已改：`inquiryClient.ts`、`inquiriesAdminClient.ts`、`adminInquiries.ts`、`inquiries.ts`（`route_private` 校验/邮件）、`ChinaTripsMobile.tsx`（`routePrivateRequest` 短表单、按 `routeSlug` 筛班期、无班期引导、去掉 `$100 deposit`）、`Admin.tsx`（类型标签/下拉）、`CONTEXT.md`、`docs/mobile-ios-front-end-context.md`。
- 已验证：`npm run build` / `npm run lint` 全绿。
- 未验证：浏览器 320/375/390 路径（有班期 Join / 无班期 Join / Plan private 提交 / Custom tab 完整表）。
- 下一步：无（本任务收口）；建议本机开 `http://127.0.0.1:3000/#/china-trips` 点路线详情两 CTA 冒烟。

**done（区号选择器 sheet 化)** — Mini-App `PhoneCountryField` 原生 `<select>` 换为「旗标+区号」触发器 + 底部 sheet；见 `docs/superpowers/specs/2026-07-17-mobile-phone-country-picker-design.md`。

### Progress note（区号选择器，2026-07-17）

- 目标：默认态不再显示长国名字符串；展开不再是系统原生下拉。
- 已改：`ChinaTripsMobile.tsx`（`PhoneCountryField` 触发器 + `iosapp-sheet-*` 选择列表、Escape/backdrop 关闭、选后聚焦号码输入）；`chinaTripsMobile.css`（`iosapp-phone-country` 改按钮、新增 `iosapp-country-list/option`、删 390px 堆叠媒体查询）。
- 未改：`PHONE_COUNTRIES` 数据、校验/E.164 拼接、默认国 US、桌面表单。
- 已验证：`npm run build` / `npm run lint` 全绿；`<select>` 已从 PhoneCountryField 移除。
- 未验证：浏览器 320/375/390 视觉（本会话无浏览器工具）；建议本机开 `http://127.0.0.1:3000/#/china-trips` → Custom 或小团联系表单查看。
- 下一步：无（本任务收口）。

**done（拼团命名统一）** — small group / 小团 → group tour / 拼团；见 `.cursor/plans/拼团命名统一_363e2c67.plan.md`。

### Progress note（拼团命名统一，2026-07-17）

- 目标：全站可购买产品统一为 Group tour / 拼团；枚举 `small-group` → `group-tour`；旧 Group Tour Inquiry 术语改为 Custom trip inquiry。
- 已改：`contentSchema.ts`、`routesClient.ts`、`contentQueries.ts`、`007_route_group_tour_rename.ts`（迁移）、`Admin.tsx`、`ChinaTripsMobile.tsx`、`chinaTripsMobile.css`、`RouteDetail.tsx`、`Seo.tsx`、`siteData.ts`、`Home.tsx`、`About.tsx`、`TourCost.tsx`、`searchIndex.ts`、`routePdfDetails.ts`、`CONTEXT.md`、`docs/mobile-ios-front-end-context.md`、`docs/travel-data-pipeline.md`。
- 已验证：`npm run build` / `npm run lint` 全绿；`npm run db:migrate` 已应用 007；`app/src` + `app/api` grep 残留仅预期项（001 历史迁移、007 UPDATE 语句、searchIndex 搜索别名 `small group tour`、routePdfDetails 中文 PDF 源文件名）。
- 未验证：浏览器 320/375/390 移动拼团卡与预订流文案；桌面 RouteDetail 视觉核对。
- 下一步：无（本任务收口）。

**done（移动首页搜索与瞬间）** — Mini-App 站内搜索结果页 + Real Moments lightbox；见 `.cursor/plans/移动首页搜索与瞬间_d1b443c8.plan.md`。

### Progress note（移动首页搜索与瞬间，2026-07-17）

- 目标：`submitSearch` 不再跳桌面 `/search`；Real Moments 可开全屏大图（禁止产品导航）；更新移动设计合同。
- 已改：`ChinaTripsMobile.tsx`（`searchResults` 视图、`searchMobileContent`、`placeDetailReturnView`、`RealMomentsSection` lightbox）、`chinaTripsMobile.css`（search/lightbox）、`docs/mobile-ios-front-end-context.md`。
- 已验证：`npm run build` / `npm run lint` 全绿；浏览器 375：搜 Beijing → 站内结果（Destinations+Routes）、进 place 后返回结果页、URL 仍 `#/china-trips`；Real Moments 开 Great Wall lightbox（关闭/前后切），无产品跳转。
- 未验证：真机触摸横滑手感；320/390 仅改过 viewport metrics，未逐宽截图归档。
- 下一步：无（本任务收口）。

**done（Home Real Moments）** — Travel support 已替换为 Real Moments 横滑卡；见 `.cursor/plans/home_真实瞬间替换_89def049.plan.md`。

### Progress note（Home Real Moments，2026-07-17）

- 目标：删除 Home 底部 Travel support，原位 Real Moments（6 张真实素材横滑 snap，纯展示）。
- 已改：`ChinaTripsMobile.tsx`（`RealMomentsSection` + `homeRealMomentCards`）、`chinaTripsMobile.css`（`iosapp-moments-*`，删 `support-grid`）、`docs/mobile-ios-front-end-context.md`、任务板。
- 已验证：`npm run build`、`npm run lint` 全绿；6 张 `syncing-real-*` 素材存在；DOM 无 Travel support、含 Real moments + snap CSS；Chrome 截图 320/375/390 与全页 375 显示 Browse routes 后横滑 peek。
- 未验证：真机触摸 snap 手感（仅 headless 截图 + dump-dom）。
- 下一步：无（本任务收口）。

**done（Home 小团容器卡）** — 双态模块容器卡已在代码中；见 `.cursor/plans/home_小团容器卡_1c03369e.plan.md`。

**done（dev 端口固定）** — `npm run dev` 启动前自动释放 3000；Vite `strictPort: true`；已写入 gotchas/workflows/context + Cursor rule。

### Progress note（dev 端口固定，2026-07-17）

- 目标：Agent 反复开 `npm run dev` 时不再落到 3001/3002。
- 已改：`app/scripts/free-dev-port.mjs`、`app/package.json`（`dev` / `dev:keep`）、`app/vite.config.ts`（`strictPort`）、`docs/agent-gotchas.md`、`docs/agent-workflows.md`、`docs/agent-context.md`、`.cursor/rules/dev-server-port.mdc`。
- 已验证：`node scripts/free-dev-port.mjs` 能识别空闲端口输出；未做长时间 live reload 冒烟。
- 下一步：无。

**done（Admin 交易组表单中文化）** — 订单 + 班期对齐路线/目的地样板；见 `.cursor/plans/admin_交易组表单中文化_f87c299a.plan.md`。

### Progress note（Admin 交易组表单中文化，2026-07-17）

- 已改：`app/src/pages/Admin.tsx` — `OrdersPanel`（列表/详情中文、状态/支付映射、订单信息+跟进）；`DeparturesPanel`（四分区 FormSection、FieldHint、状态中文入库英文、锁团/关闭/取消）；`StatusBadge` 支持 `label`。
- 未改：素材/分类/定制表单、API/schema、询盘。
- 已验证：`npm run build` 通过；`eslint src/pages/Admin.tsx` 通过。
- 备注：全仓 `npm run lint` 仍有既有 `ImageFieldPicker.tsx` set-state-in-effect 报错（与本任务无关）。
- 未验证：浏览器点订单备注/重发、班期新建编辑锁团往返。
- 下一步：无（本任务收口）；下一份计划为内容配置三模块中文化。

**done（Admin media schema）** — `media_assets` 旧表缺 `created_at` / `updated_at` 已修；Admin media GET/POST 200；`npm run build` 通过。

**done（CustomTripHero crash）** — 空库时 hero 不再读 undefined `.image`；本地已回填 destinations=12 / routes=20；`npm run build` 通过。

**done（destinations API 23505）** — `ensureContentTables` 并发建索引竞态已修；冷启动并发 `/api/destinations` + `/api/routes` 均 200。

**done（MinIO Phase 1）** — Compose/API/Admin/去 `本站` 导入已落地；本机验证 presign→PUT→GET→media create 全绿；About 暂用 public 替图。

**done（提交清理）** — 已把工作区内所有开发产物、工程文档、品牌资产、参考素材提交到 `main`，本地验证 `npm run build` / `npm run lint` 全绿。

**done（inquiries 缺表修复）** — `ensureCustomTripFormTables` 在缺 `inquiries` 时不再 `ALTER` 失败。本地 DB 已自愈建表并验证。

**blocked（motion 安装/验证）** — 移动端 Motion 动画代码已写入；用户已在系统终端 `npm install` 成功；build/lint/视觉核对仍待做。

## Current Goal

**done（Admin 列表搜筛对齐）** — 路线/素材服务端 search+status；三列表 UI 对齐；见 `.cursor/plans/admin_列表搜筛对齐_c6a0cdb8.plan.md`。

### Progress note（Admin 列表搜筛对齐，2026-07-17）

- 已改：`contentQueries.ts`（`listAdminRoutes`/`listAdminMedia` 支持 status+search ILIKE）；`admin/routes.ts`、`admin/media.ts` GET query；`routesClient.ts`、`mediaClient.ts`；`Admin.tsx` Routes/Media/Orders 搜筛栏对齐，去掉前端 filter，保存/归档后按当前筛重载。
- 未做：分页、复杂排序、目的地/班期搜筛、浏览器冒烟。
- 已验证：`npm run build`、`npm run lint` 全绿。
- 未验证：浏览器搜 title/slug、筛 draft/review、工作台跳转、订单不回归（需本地 DB + admin 会话）。
- 下一步：无（本任务收口）；下一候选：目的地/班期搜筛、分页、协作时间线、侧栏角标。

**done（Admin 工作台待办）** — 侧栏置顶「工作台」默认登录页 + 四卡聚合 count + 带筛跳转；见 `.cursor/plans/admin_工作台待办_ed1a5625.plan.md`。

### Progress note（Admin 工作台待办，2026-07-17）

- 已改：`app/api/admin/dashboard.ts`（四 COUNT 聚合，失败整体 500）；`app/vite.config.ts` 映射；`app/src/pages/Admin.tsx`（工作台导航默认 tab、DashboardPanel、seededListFilters 带筛跳转；路线/素材列表最小 status 下拉）。
- 未做：侧栏角标、卡下最近 5 条、班期异常卡、设计 spec 文件。
- 已验证：`npm run build`、`npm run lint` 全绿。
- 未验证：浏览器登录默认工作台、四卡数字对库、点卡跳转筛选、无 token → 401/403（需本地 DB + admin 会话）。
- 下一步：无（本任务收口）；可选本机冒烟上述流程。

**done（Admin 内容配置表单中文化）** — 素材 + 分类 + 定制行程表单；见 `.cursor/plans/admin_内容配置表单中文化_e4bc42f7.plan.md`。

### Progress note（Admin 内容配置表单中文化，2026-07-17）

- 已改：`app/src/pages/Admin.tsx` — `MediaPanel` 列表/编辑页中文化，三分区「文件与预览 / 素材说明 / 关联与发布」，状态/类型中文显示英文入库；`CategoriesPanel` 两个 scope 中文标题，表单轻分区「标识 / 展示」，key/enabled/sort 说明与软提示中文；`CustomTripFormPanel` 列表/编辑页中文化，三分区「标识 / 控件 / 展示与发布」，controlType/formGroup 中文显示英文入库。
- 未改：API/schema、素材关联 slug 勾选器、合并分类 scope、登录页英文壳。
- 已验证：IDE diagnostics 无 `Admin.tsx` 错误；shell 子任务在 `app/` 下运行 `npm run build` / `npm run lint`，两者 exit 0；目标英文残留搜索只命中必须保留的英文枚举值与计划外 Admin loading。
- 备注：当前直接 Shell tool 连续不回传退出状态，尝试写临时验证日志未生成；命令验证结果来自 shell 子任务回报。
- 未验证：浏览器逐一点击素材上传/高级 URL/保存、分类上移下移/停用、定制表单启停/排序/保存往返。
- 下一步：无；如需更高信心，可做 Admin 浏览器冒烟。

**done（Admin 询盘跟进）** — 交易组「询盘」列表/详情、三态跟进、内部备注；见 `.cursor/plans/admin_询盘跟进_2fc59894.plan.md`。

### Progress note（Admin 询盘跟进，2026-07-17）

- 已改：`inquirySchema.ts`（`internal_notes`/`updated_at`/status 归一+CHECK）、`adminInquiries.ts`、`admin/inquiries.ts`、`006_inquiries_admin_follow_up.ts`、`inquiriesAdminClient.ts`、`Admin.tsx`（导航+InquiriesPanel）、`vite.config.ts`、设计 spec。
- 已验证：`npm run build`、`npm run lint` 全绿。
- 未验证：浏览器公网提交→列表默认未关闭→改状态/备注→关闭后默认筛消失；无 token 访问 API（需本地 DB+dev server）。
- 下一步：无（本任务收口）；可选本机冒烟上述流程。

**done（Admin 表单样板中文化）** — 路线 + 目的地列表/表单中文、按前台影响面分区、FieldHint、枚举中文显示英文入库。设计：`docs/superpowers/specs/2026-07-17-admin-form-clarity-routes-destinations-design.md`。

### Progress note（Admin 表单样板中文化，2026-07-17）

- 已改：`app/src/pages/Admin.tsx` — `FieldHint` / `FormSection` / 枚举中文映射；`AdminEditShell.backLabel`；`DestinationsPanel` 四分区；`RoutesPanel` 五分区；列表 chrome 中文。
- 未改：班期/素材/分类/定制表单 Panel（仍英文）；API/schema。
- 已验证：`npm run build`、`npm run lint` 全绿。
- 未验证：浏览器逐一点击保存与枚举入库；公网 featured/themes/status 对照。
- 下一优先（未做）：询盘列表；其余模块套样板。
- 下一步：无（本任务收口）。

**done（MinIO key format Phase 1）** — `docs/superpowers/plans/2026-07-17-minio-media-phase1.md` 已完成：新对象 key 改为 `{env}/{type}/{yyyy}/{mm}/{uuid}-{safeFilename}`，`media-presign` 传入 `contentType`，已补 `APP_ENV` / `S3_*` 运维文档。不迁移既有 `media/...` 对象，不改 Home/About/guides/itineraries DB 范围；About interim public URLs unchanged unless ops uploaded replacements.

### Progress note（MinIO key format Phase 1，2026-07-17）

- 已改：`app/api/lib/s3.ts`、`app/api/lib/s3Key.test.ts`、`app/api/admin/media-presign.ts`、`app/package.json`、`app/.env.local.example`、`docs/ops/minio-win11.md`。
- 已验证：`npm run test:s3`（4/4）、`npm run typecheck`、`npm run build`、`npm run lint` 全绿；`rg "本站/.*\?url|from ['\"].*本站" app/src` 无匹配；MinIO health 200。
- 已验证：本地 presign 返回 `dev/image/2026/07/<uuid>-verify-key.png`；完整 round-trip `presign -> PUT tiny PNG -> public GET 200 image/png -> media create -> archive cleanup` 通过。
- 备注：`docs/superpowers/specs/2026-07-17-minio-media-phase1-design.md` 已是 `Status: Approved`，本轮未制造无意义改动；未创建 git commit。

**done（MinIO Phase 1 verify）** — presign → PUT → public GET → `media_assets` create 全绿；logo `/images/logo.svg` 200。About 原 `本站` 三图缺失，暂改用已有 public 图。

**done（Admin 侧栏分组中文化）** — 侧栏「交易 / 产品内容 / 配置」三组 + 中文入口；表单内部文案未动。设计：`docs/superpowers/specs/2026-07-17-admin-nav-groups-zh-design.md`。

### Progress note（Admin 侧栏分组中文化，2026-07-17）

- 已改：`app/src/pages/Admin.tsx` — `ADMIN_NAV_GROUPS`；`AdminNav` 按组渲染；页标题走同一数据源。
- 已验证：`npm run build`、`npm run lint` 全绿。
- 未验证：浏览器桌面侧栏 / 移动抽屉视觉逐一点击（实现对称，默认仍 `orders`）。
- 下一优先（未做）：「交易」组增加「询盘」入口 + 列表/详情。
- 下一步：无（本任务收口）。

**done（Admin 整页编辑壳）** — 六个模块 Edit/New 已改为 `AdminEditShell` 整页互斥渲染。设计文档：`docs/superpowers/specs/2026-07-17-admin-full-page-edit-design.md`。

### Progress note（Admin 整页编辑壳，2026-07-17）

- 已改：`app/src/pages/Admin.tsx` — 新增 `AdminEditShell`；Departures / Custom trip form / Destinations / Routes / Categories / Media 改为 `if (editing)` 整页表单。
- 已验证：`npm run build`、`npm run lint` 全绿；浏览器 Destinations Edit/New/Back、Routes Edit、Categories New（标题含 scope）、375px 下 Destinations Edit/Back。
- 未验证：Departures / Media / Custom trip form 的浏览器逐一点击（实现对称，未逐一手工点）；保存成功后 status 提示在浏览器里未专门点 Save 验证（逻辑未改）。
- 下一步：无（本任务收口）。

**brainstorming（Admin 运营体验）** — 整页编辑壳已落地；若还有「知道该干哪些」类目标，需另开澄清。

### Progress note（Admin media schema，2026-07-17）

- 根因：`contentQueries.ts` 的 Admin media 查询/更新依赖 `created_at`、`updated_at`；当前 `contentSchema.ts` 新建表已包含这两列，但旧 `001_initial_content_schema.ts` 创建的 `media_assets` 没有，已有表不会被 `CREATE TABLE IF NOT EXISTS` 自动补列。
- 已改：`contentSchema.ts` 对 `media_assets` 增加 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS created_at/updated_at`；`001_initial_content_schema.ts` 同步补齐列定义。
- 已验证：本地 `/api/admin/media` GET 200；对现有 media row 执行 update POST 200；`npm run build` exit 0。
- 备注：直接 Shell tool 本轮对简单命令也不返回状态，build 由 shell subagent 执行；Browser MCP 对运行中的 Vite API 验证通过。

### Progress note（CustomTripHero crash，2026-07-17）

- 根因双重：
  1. 本地 Postgres 内容表为空（`/api/routes` 与 `/api/destinations` 均 200 但 count=0），`routeTours[0]` 为 undefined。
  2. `CustomTripHero` 未判空即读 `.image`。
- 已改：
  - `ChinaTripsMobile.tsx` — hero 图/alt optional + 静态 fallback。
  - 本地执行 `npx tsx scripts/backfill-content.ts` → destinations=12 routes=20（featured=7）。
  - `docs/agent-gotchas.md` 增加空库 gotcha。
- 已验证：API 计数恢复；`npm run build` EXIT 0。
- 未验证：用户需硬刷新浏览器（contentStore 的 in-memory 数组在首次空加载后不会自动重拉）。
- 下一步：无。

### Progress note（ensureContentTables 竞态，2026-07-17）

- 根因：首屏多 API 并发调用 `ensureContentTables`；`tablesEnsured` 无锁 + `CREATE INDEX IF NOT EXISTS` 并发仍可能撞 `pg_class` 唯一约束。
- 已改：`app/api/lib/contentSchema.ts` — in-flight Promise 串行化；索引创建忽略 `23505`/`pg_class_relname_nsp_index`。
- 已验证：重启 Vite 后冷启动并发 5 次 destinations/routes，全部 HTTP 200；终端无 `pg_class_relname_nsp_index`。
- 备注：Browserslist 过期警告与本次无关；可选 `npx update-browserslist-db@latest`。
- 下一步：无（本 bug 已收口）

## 提交清理（2026-07-16）

- 目标：确认可提交文件并提交到 `main`，清理工作区。
- 已做：
  - 更新根目录 `.gitignore`，排除 `.agents/`、`.claude/`、`.codex/`、`.cursor/`、`.playwright-mcp/`、日志、`Codex Installer.exe`、`app/node-jiti/`、根 `package-lock.json`。
  - 启用 `git config core.longpaths true` 以处理 `data/extracted/mineru/` 下的长文件名。
  - 因首次大提交（含 `data/`、`路线_新/` 等 3.75 GiB）推送时 GitHub 返回 HTTP 500，拆分为两批提交并分别推送：
    1. `9e62db1 update: 应用核心代码、工程文档与品牌配置`（应用源码/API/配置/文档/脚本/Logo）
    2. `3642cb5 assets: 提交网站图片与视频素材`（`app/public/images/` + `app/public/videos/`）
  - 删除临时脚本 `app/scripts/tmp-assemble-sample.ts`（有 lint error 且为一次性验证文件）。
  - 验证：`npm run build` 通过，`npm run lint` 通过。
  - 已推送到 `origin/main`：`a8d075e..3642cb5`。
- 未提交仍保留在本地的文件：
  - 大参考/原始素材：`data/`（896M）、`本站/`（60M）、`目标站/`（39M）、`网站素材/`（230M）、`路线_新/`（3.4G）
  - 其他：`china-trips-smallgroup-flow-390.png`、`prototypes/`、`skills-lock.json`
- 下一步：由用户决定继续哪个开发任务（如 Motion 移动端视觉验证、老路线行程内容导入、Media 后台素材补全等），以及大参考素材是否要用 Git LFS 或外部存储管理。

## Previous Current Goal

MinIO Phase 1 基础设施已完成（见下方笔记）。下一步：在本机启动 `docker compose up -d`、配置 `app/.env.local` 的 `S3_*`，验证 Admin 上传往返；About 页三张图需上传到 MinIO 或放入 `app/public/images/` 对应路径。

### Progress note（MinIO Phase 1，2026-07-17）

- 已改：`docker-compose.yml`（MinIO + minio-init）、`app/.env.local.example`、`app/api/lib/s3.ts`、`app/api/admin/media-presign.ts`、`app/vite.config.ts`、`app/src/lib/mediaClient.ts`、`app/src/pages/Admin.tsx`、`app/src/lib/siteData.ts`、`app/src/pages/About.tsx`、`app/public/images/logo.svg`
- 依赖：`@aws-sdk/client-s3`、`@aws-sdk/s3-request-presigner`
- 已验证（本机）：MinIO health 200；presign 200；OPTIONS CORS 204；PUT 200；public GET 200；media create + list 命中；`/images/logo.svg` 200
- About：原 `本站` 三图不在仓库；`About.tsx` 暂用 `/images/about-hero.jpg` 与 `/images/route-sichuan-yading.jpg`；正式办公室/川西图需后续经 Admin 上传到 MinIO 再换 URL

## Previous Current Goal

无活跃开发任务。提交清理已完成，等待用户选择下一步（如 Motion 移动端视觉验证、老路线行程内容导入、Media 后台素材补全等）。

### Progress note（提交清理）

- 见上方「提交清理（2026-07-16）」段落。

## Previous Goal

修复 Custom trip form config：`relation "inquiries" does not exist`。

### Progress note（inquiries 缺表）

- 根因：`ensureCustomTripFormTables` 直接 `ALTER TABLE inquiries`，但本地库若未跑 migration 002 / 未打过 `/api/inquiries`，表不存在。
- 已改：新建 `app/api/lib/inquirySchema.ts`（`ensureInquiryTable`）；`customTripForm.ts` 先 ensure 再继续；`inquiries.ts` 复用同一函数；migration `004` 增加 `CREATE TABLE IF NOT EXISTS inquiries`。
- 已验证：本地 `POSTGRES_URL` → `ensureCustomTripFormTables` 成功；`inquiries` + `custom_preferences` + 7 个表单字段存在。
- 未验证：用户需重启 `npm run dev` 后浏览器再打开 Custom Trip / Admin 表单配置页。
- 下一步：用户重启 dev；可选继续 Motion 的 build/lint/视觉。

## Previous Goal（暂停，可续）

ChinaTripsMobile 接入 Motion（只用 Motion，不做 Anime.js）：首页 stagger、Tab/视图切换、列表与 tap 反馈；`MotionConfig reducedMotion="user"`。

### Progress note（移动端 Motion）

- 已读：`docs/mobile-ios-front-end-context.md`、Motion React installation docs。
- 已改：`app/package.json`（声明 `motion` ^12.42.2）、新建 `app/src/components/chinaTripsMobileMotion.ts`、`app/src/components/ChinaTripsMobile.tsx`。
- 未验证：`npm install`、`npm run build`、`npm run lint`、320/375/390 视觉（被 C 盘空间阻塞）。
- 用户下一步（系统 PowerShell，非 Cursor）：
  1. `npm config set cache "D:\npm-cache"`
  2. `cd "D:\AGeneral Workspace\xjch2026\xtch-web-portal\app"`
  3. `npm install`
  4. 装完后回到本对话让 Agent 跑 build/lint 与视觉核对。

## Previous Goal（已关闭）

**done（本地内容导入）** — `.cursor/plans/老路线行程内容整理_6930be3a.plan.md` 五个 todo 全部 completed。本地库已写入 `route_itinerary_days`（111 天 / 18 条路线）。**生产库 / 会影响生产的分支尚未导入或部署**——需用户另做上线决策。

### Progress note（老路线行程内容整理）

### Progress note（老路线行程内容整理）

- 权威证据：既有 MinerU（`data/extracted/mineru/`），不是 pdfplumber；id17 补抽 `raw_deb1588aa093e59e`。
- 草稿与审核：`data/route-itinerary-drafts/`（`drafts/` / `SOURCE_MAP.md` / `SUMMARY.md` / `REVIEW_SPOT5.md` / `IMPORT_REPORT.json`）。
- 用户审核：高风险 5 条（16/15/7/6/17）抽审通过；其余 13 条授权批量通过。
- 导入脚本：`app/scripts/import-route-itinerary-drafts.ts`（按 `legacy_numeric_id` 匹配既有 routes；只更新 experience/moments/included_support + itinerary days）。
- Day0 赠送过夜（18/19/20）因 schema 要求正整数 dayNumber，已折叠进 `included_support`，不写入 `route_itinerary_days`。
- 已验证：本地导入后 `route_itinerary_days` 共 111 行；`listPublicRoutes()` 18 条均有 `itineraryDays`。
- 未验证：浏览器公开页/Admin 视觉；生产库。
- 开放风险：id16 的 **route title/slug 仍是历史 “Kashgar and Ili…”**（行程内容已按喀纳斯–伊犁），改名属于产品命名门禁，未擅自改。

## Last Closed Goal

`.cursor/plans/admin-content-management-phase1_8a01ec5e.plan.md` 全部 todo completed（依据 `docs/adr/0003-admin-content-dynamic-scope-phase-1.md`）：

1. `app/api/lib/contentSchema.ts`（`ensureContentTables` 自愈建表：`destinations`/`routes`/`route_destinations`/`media_assets`，`routes` 加 `legacy_numeric_id`/`pdf_url` 列）+ `app/api/lib/contentQueries.ts`（CRUD 查询/校验）
2. Admin CRUD API：`app/api/admin/destinations.ts`、`app/api/admin/routes.ts`、`app/api/admin/media.ts`（复用 `adminAuth`/`auditLog` 模式）
3. 公开只读 API：`app/api/destinations.ts`、`app/api/routes.ts`
4. 前端 client 层：`app/src/lib/destinationsClient.ts`、`routesClient.ts`（含 `toRouteTour` 把数据库字段映射回旧 `RouteTour` 形状）、`mediaClient.ts`
5. `app/src/lib/contentStore.ts`：模块级可变数组 `destinationMeta`/`routeTours` + `ensureContentDataLoaded()`，`App.tsx` 用 `contentDataLoaded` 状态门控公开路由渲染（`/admin` 不受门控，避免管理端被阻塞）
6. `Admin.tsx` 新增 Destinations / Routes / Media 三个 tab（含 List + Edit 表单 + Archive），`DeparturesPanel` 改为通过 `fetchAdminRoutes` 自取路线列表，不再直接 import `routeTours`
7. 公开页面切到 `contentStore`：`Destinations.tsx`、`DestinationDetail.tsx`、`ChinaTours.tsx`、`RouteDetail.tsx`
8. 用户确认后追加的范围：`Navbar.tsx`、`Footer.tsx`、`Seo.tsx`、`ChinaTripsMobile.tsx`、`searchIndex.ts` 一并从 `siteData.ts` 切到 `contentStore.ts`（`searchIndex` 从静态导出改为 `buildSearchIndex()` 函数，按需重建）
9. 一次性回填脚本 `app/scripts/backfill-content.ts`：把原 `siteData.ts` 里的 12 个目的地、20 条路线写入数据库，路线 slug 用与旧 `getTourSlug()` 相同的 `${id}-${slugify(title)}` 公式，保留 `/tours/:slug` 旧链接和 `routePdfDetails.ts`（按 `legacy_numeric_id` 匹配）的行程 PDF 关联。已在本地 `POSTGRES_URL` 指向的数据库跑过一次，`destinations=12 routes=20`。
10. `siteData.ts` 清理：删除已迁移的 `destinationMeta`/`realTours`/`routeTours`/`routeDestinations`/`slugify`/`getTourSlug` 等及对应的 19 个 PDF `?url` 导入；只保留 `brand`、`guideArticles`、`getGuideArticleBySlug`（未迁移范围）

## Last Updated

- 时间：2026-07-16
- Agent：Auto（content-phase1）

## 新 Agent 必须知情

### 热点文件

| 区域 | 路径 |
|---|---|
| 内容 schema / CRUD | `app/api/lib/contentSchema.ts`, `app/api/lib/contentQueries.ts` |
| 内容 API | `app/api/destinations.ts`, `app/api/routes.ts`, `app/api/admin/destinations.ts`, `app/api/admin/routes.ts`, `app/api/admin/media.ts` |
| 前端 client / store | `app/src/lib/destinationsClient.ts`, `routesClient.ts`, `mediaClient.ts`, `app/src/lib/contentStore.ts` |
| Admin 后台 | `app/src/pages/Admin.tsx`（Destinations/Routes/Media 三个新 tab） |
| 加载门控 | `app/src/App.tsx`（`contentDataLoaded` / `ensureContentDataLoaded()`） |
| 回填脚本（一次性，已跑过） | `app/scripts/backfill-content.ts` |

### 约定

- `destinationMeta`/`routeTours` 现在**不再是静态常量**，是 `contentStore.ts` 里的模块级可变数组，只在 `ensureContentDataLoaded()` resolve 后才有数据；任何新组件要用这两个数组，必须确保它在 `App.tsx` 门控之后渲染（公开路由已天然满足），不要在模块顶层同步读取。
- `routeTours` 里的 `id` 字段现在是 `legacy_numeric_id ?? 0`；新建的路线如果没填 legacy 数字 ID 会是 `0`，多条 `id=0` 的新路线会冲突——React key 已统一改用 `tour.slug`（不要再用 `tour.id` 当 key）。`getRoutePdfDetail(tour.id)` 这类按数字 ID 查逐日行程的调用只对旧路线有效，是预期行为。
- `routeTours[].pdfUrl` 目前对所有回填路线都是空字符串（Vite `?url` 资源导入无法在纯 Node 回填脚本里解析），且当前没有任何 UI 读取它，暂不影响展示。
- `Seo.tsx` 的结构化数据（`routeDestinations`/`routeTours` 相关字段）改成在 `useEffect` 内部实时读取 `contentStore`，避免依赖数组警告；如果以后要展示企业级 SEO 数据，要注意管理端直达 `/admin` 时 `contentDataLoaded` 可能仍是 `false`（门控只拦公开路由，不拦 `/admin`），此时 `Seo` 组件仍会挂载但数组可能是空的。
- npm 在 `app/` 目录执行；`HashRouter`；`/admin` 无公网 Navbar/Footer。
- 本地开发用的 dev bypass 登录靠 `.env.local` 的 `DEV_AUTH_BYPASS_EMAIL`，`requireAdminAuth` 会认 `dev-bypass-token`。

### 已验证 / 未验证

- **已验证：** `npm run build`、`npm run lint` 全绿；本地 Postgres 跑过回填脚本（12 destinations / 20 routes）；浏览器抽查桌面 Destinations/ChinaTours/RouteDetail（旧 slug 链接可用）、Admin 新三个 tab 的列表读取与一条 Destination 的编辑保存写入回路、`ChinaTripsMobile` 在 375px 下的首页/热门目的地/路线卡片渲染。
- **未验证：** Media 后台创建/编辑（表已建好，当前是空表，只验证了空状态渲染）；Admin Routes/Destinations 的 Archive 操作；生产环境（Vercel）下的这些新 API（只在本地 vite dev + 本地 Postgres 验证过）；320px/390px 视觉（只测了 375px）。

### 事后修复（2026-07-16 补充）

- **Bug**：`ChinaTripsMobile.tsx` 的 `CustomTab`（Custom 表单）里 "Destinations *" 勾选项 `customDestinationOptions` 原来写在模块顶层，用 `destinationMeta.slice(0, 10)` 同步计算；`destinationMeta` 迁移后是异步填充的可变数组，模块顶层代码在数据加载完成前就已执行完毕，导致该常量永远只有 `['Other']`，10 个目的地名字全部丢失。首轮视觉抽查没有打开 Custom 表单去数选项个数，没测出来。
- **修复**：把计算移进 `CustomTab` 组件内部，用 `useMemo(() => [...destinationMeta.slice(0, 10)...], [])`，和 `Navbar.tsx` 的 `featuredDestinations` 用同一模式（组件只会在 `contentDataLoaded` 之后才挂载，此时数据已就位）。已重新 `npm run build` 确认通过。
- **启示**：任何从 `contentStore.ts` 派生的常量，只要不是在组件函数体/`useMemo`/事件回调里算的，而是写在模块顶层或 import 时立即执行的表达式里，都可能踩到同样的坑——新增代码前先确认计算发生的时机在组件渲染之后。

## Next Step（仅续做本功能时）

- 如需要在生产库上跑一次同样的回填，确认生产 `POSTGRES_URL` 后重新执行 `npx tsx scripts/backfill-content.ts`（脚本是 upsert，可重复执行）。
- 可选：给 Media 表补充几条真实素材做端到端验证；补 320px/390px 视觉抽查。

## 动态分类与首页推荐（2026-07-16 续做）

- 目标：`.cursor/plans/动态分类与首页推荐_2b7f062a.plan.md`。
- 已确认完成（读代码逐项核对，与计划描述完全一致）：
  1. `app/api/lib/contentSchema.ts` 的 `ensureContentTables()` 已有 `categories` 表 + `destinations.travel_styles/featured_on_home/featured_priority` 三列 + 对应索引。
  2. `app/api/lib/contentQueries.ts` 已有 `listPublicCategories`/`listAdminCategories`/`parseCategoryInput`/`upsertCategory`/`archiveCategory`/`reorderCategories`，`Destination`/`DestinationInput` 已带新三字段。
  3. `app/api/categories.ts`（公开只读）、`app/api/admin/categories.ts`（create/update/archive/reorder + 审计日志）已建好。
  4. `app/api/admin/destinations.ts`、`app/api/destinations.ts` 已读写新字段。
  5. `app/src/lib/categoriesClient.ts` 已建好；`app/src/lib/destinationsClient.ts` 的 `Destination` 类型已加 `travelStyles`/`featuredOnHome`/`featuredPriority`。
  6. `app/src/pages/Admin.tsx`：`CategoriesPanel`（含 `ENABLED_CATEGORY_SOFT_LIMIT = 6` 软提示、上移/下移即 reorder、Archive）、`DestinationsPanel` 的分类勾选 + 首页推荐开关、`RoutesPanel` 的 `themes` 分类勾选均已实现。
  7. `app/src/components/ChinaTripsMobile.tsx`：`placeFilters`/`routeFilters`/`routeMatchesFilter` 已删除，`PlaceFilterKey`/`RouteFilterKey` 已改为 `string`；`DestinationsTab`/`RoutesTab` 已改为挂载时 `fetchCategories('destination'|'route')` 渲染 `FilterRail`，过滤逻辑用 `travelStyles`/`themes` 数组匹配；`getPopularPlaces()` 已按 `featuredOnHome` + `featuredPriority` 排序，不足 6 个用 `displayOrder` 补齐。
- 已验证：
  - `npm run build`、`npm run lint`（在 `app/` 目录）全绿，无报错无警告。
  - 全链路 API 级验证（本机 `docker` CLI 连不上 daemon 一直挂起，改用直连 `postgresql://postgres:postgres@localhost:5432/xtch`——用户已有一个跑着的 `xtch-postgres` 容器——绕开 `docker ps`）：`npm run dev` 起本地服务后，写 node 脚本直接调本机跑起来的 API（带 `Authorization: Bearer dev-bypass-token`）：
    1. 建 3 个 destination 分类 + 2 个 route 分类，`POST /api/admin/categories` 全部 200。
    2. `GET /api/categories?scope=destination|route`（公开只读）原样返回刚建的分类，按 scope 隔离正确。
    3. `POST /api/admin/destinations` 给两个目的地（beijing/shanghai）写入 `travelStyles`/`featuredOnHome`/`featuredPriority`，`GET /api/destinations`（公开）原样读回，包括 `featuredPriority` 数值顺序（beijing=1 在 shanghai=2 之前，对应 `getPopularPlaces()` 的排序逻辑）。
    4. `POST /api/admin/routes` 给一条路线写 `themes`，`GET /api/routes` 原样读回。
    5. 连续建到 7 个 enabled destination 分类，确认后台会计算出 `enabledCount = 7`（触发 `Admin.tsx` 里 `ENABLED_CATEGORY_SOFT_LIMIT = 6` 的软提示条件，>6）。
    6. `archive` 一个分类后，`GET /api/categories` 公开列表里立刻消失（`enabled=false` 被过滤），确认软删除语义符合计划里"不物理删除"的要求。
  - 验证完之后已经把这次写入的所有测试分类和目的地/路线的字段改动用直连 SQL 清理复原（`DELETE FROM categories WHERE key = ANY(测试 key 列表)`，把 beijing/shanghai/该路线的新字段改回默认值），确认数据库回到验证前状态，没有留测试脏数据。
  - `ChinaTripsMobile.tsx` 里渲染分类筛选用的 `.iosapp-filter-rail`/`.iosapp-filter-chip` 是横向可滚动的 flex 容器（`overflow-x` + 隐藏滚动条），这段 CSS 是复用现有的、这次改动没碰，天然和视口宽度无关，不会在 320/375/390 下换行或溢出——按代码审查确认，没有单独起浏览器截图逐一核对三个宽度（曾派一个 browser-use 子任务去做这件事，但那个子任务环境没有挂载浏览器自动化工具，执行失败，见对话记录）。
- **仍未做（较低风险，非本次阻塞项）**：没有用真实浏览器截图逐一核对 Admin `CategoriesPanel`/`DestinationsPanel`/`RoutesPanel` 新增表单控件在桌面端的视觉效果（只做了 API 级验证 + 代码审查，没有跑浏览器）。如果之后要做，需要一个有浏览器自动化工具（不是 `browser-use` 子agent，那个环境目前没有该能力）的 agent 环境。

## 路线逐日行程结构化（2026-07-16）

- 目标：`.cursor/plans/路线逐日行程结构化_fe9c7e42.plan.md`。依据 grill-me 讨论，**只做工程能力**，不整理老路线内容（那是绑定上线的另一份计划）。
- 已完成（读代码逐项核对）：
  1. `app/api/lib/contentSchema.ts`：`ensureContentTables()` 新增 `route_itinerary_days` 表（`route_slug`/`day_number`/`title`/`city`/`summary`/`attractions[]`/`meals`/`accommodation`/`transport`/`notes[]`，唯一约束 `(route_slug, day_number)`）+ `routes.experience/moments/included_support` 三个 `TEXT[]` 列。新增 `ItineraryDayRow` 类型，`RouteRow` 补三个新字段。
  2. `app/api/lib/contentQueries.ts`：`RouteRecord`/`RouteInput` 加 `experience`/`moments`/`includedSupport`/`itineraryDays`；新增 `ItineraryDay` 类型、`mapItineraryDayRow()`、`listItineraryDaysByRouteSlugs()`（按 route_slug 批量查，避免在 `listPublicRoutes`/`listAdminRoutes` 的 `GROUP BY` 里塞复杂的行程聚合）；`parseRouteInput()` 新增 `parseItineraryDaysInput()`（校验 dayNumber 为正整数、同路线内不重复，按 dayNumber 排序）；`upsertRoute()` 在同一个事务里对 `route_itinerary_days` 做 delete+insert 整体替换。
  3. `app/api/admin/routes.ts`、`app/api/routes.ts`：**未改动**——两者已经是把 `parseRouteInput(body)`/`listPublicRoutes()`/`listAdminRoutes()` 的返回值原样传递，新字段随 `contentQueries.ts` 的改动自动生效。
  4. 新建 `app/src/lib/itineraryText.ts`：`assembleDayText()` 把结构化字段拼成连贯叙述（"In Beijing, visit X, continue to Y, then Z. Private car transfer, meals include A, and overnight at B. Note."），不是"城市:xx"字段罗列腔调；全空时兜底一句"Details for this day will be confirmed with your travel consultant."（不编造事实）。
  5. `app/src/lib/routesClient.ts`：`RouteRecord` 加四个新字段；新增 `StructuredItinerary` 类型；`RouteTour.structuredItinerary`：`itineraryDays.length > 0` 时才非空，内部 `days` 由 `assembleDayText()` 逐条生成，`title` 用 `day.title || \`Day ${day.dayNumber}\`` 兜底；否则为 `null`（走原有 `itinerarySummary` 模板 fallback，不受影响）。
  6. `app/src/pages/RouteDetail.tsx`、`app/src/components/ChinaTripsMobile.tsx`：`getRoutePdfDetail(tour.id) ?? buildFallbackDetail(tour)` 改成三级优先级：`tour.structuredItinerary` 存在 → `buildStructuredDetail()`/`buildMobileStructuredDetail()`（组装成现有的 `RoutePdfDetail` 形状）；否则维持原来的 `getRoutePdfDetail(tour.id) ?? buildFallbackDetail(...)`。两个页面渲染 JSX 完全未改，只改了数据来源判断那一行。
  7. `app/src/pages/Admin.tsx` 的 `RoutesPanel`：`RouteEditDraft` 加 `experienceText`/`momentsText`/`includedSupportText`（textarea 按行分割，复用 `DeparturesPanel` 的 `includedText` 模式）+ `itineraryDays: ItineraryDayDraft[]`；表单新增两个分组——"Overview"（三个多行文本域）和"Day-by-day itinerary"（可 Add day / Move up / Move down / Remove 的卡片列表，字段：title/city/attractions（多行）/meals/accommodation/transport/summary（多行，内部备注）/notes（多行））；卡片内部用 `grid gap-3 md:grid-cols-2`，与文件里其它表单一致，`md:` 断点以下（≤767px，覆盖 320/375/390）自动堆叠为单列。
- 已验证：
  - `npm run build`、`npm run lint`（`app/` 目录）全绿。
  - 后端端到端（本地 `postgresql://postgres:postgres@localhost:5432/xtch`，临时脚本跑完即删）：`ensureContentTables()` 自愈建表成功；`parseRouteInput` + `upsertRoute` 写入 2 天结构化行程（day_number 乱序输入 2、1）后，`listPublicRoutes()`/`listAdminRoutes()` 都按 `day_number` 排好序返回；重新提交一份只有 1 天的行程后确认整表被 delete+insert 替换（不是残留累加）；一条完全没填 `itineraryDays` 的路线返回 `itineraryDays: []`、`experience: []`（不报错，不是 undefined）。
  - 前端拼装（同一批临时脚本，直接 import 调用，非浏览器）：`assembleDayText()` 对多景点/餐食/住宿/交通/notes 的组合、单景点、无景点仅交通住宿、全空四种情况都验证了输出文本；`toRouteTour()` 在 `itineraryDays.length>0` 时 `structuredItinerary` 非空且 `days`/`experience`/`moments`/`includedSupport` 与输入一致，在空数组时 `structuredItinerary === null` 且原有 `itinerarySummary` fallback 不受影响。
  - 验证用的临时脚本和临时数据库行都已清理（`scripts/tmp-verify-*.ts` 删除，`routes`/`route_itinerary_days` 表里确认无 `tmp-itinerary%` 残留行）。
- **未验证（已知，非阻塞但要交接说明）**：
  - 没有做浏览器级视觉验证（桌面 `/tours/:slug` 手风琴、移动端 Overview/Day-by-day/Signature moments 渲染、Admin 表单在 320/375/390px 下的实际截图）。原因：项目当前无 Playwright/浏览器自动化依赖，引入新依赖属于 AGENTS.md 人工门禁项（新依赖需用户确认），未擅自安装。改用代码审查替代：新增的 Admin 卡片布局用的是文件里已有多处验证过的 `grid gap-3 md:grid-cols-2` + `flex flex-wrap` 模式（`md:` 断点 768px，320/375/390 都会自动单列堆叠），风险判断为低。
  - Admin 表单里 Move up/down 用的是普通按钮而不是拖拽（plan 里"可拖拽或用上下按钮调顺序"两种都算符合要求，选了按钮方案，更适配触屏/小屏）。
- **上线约束（重要，不要忘）**：这份计划的代码**不应单独部署到会影响生产环境的分支**，必须等「老路线逐日行程内容整理」计划（`.cursor/plans/老路线行程内容整理_6930be3a.plan.md`，当前 5 个 todo 全部 pending，是纯内容整理任务）审核通过后一起上线。详见 `docs/agent-task-board.md` 的 Blocking 关系。

## 不需要另开长交接文档

新任务写 `Current Goal` + 更新 task board Owns 即可。
