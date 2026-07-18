# Agent Progress

## Status

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
