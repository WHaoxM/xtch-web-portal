# Agent Gotchas

本文件记录小但高频、容易忘、会导致返工的项目陷阱。它不是完整规则库，只放“忘了就容易出错”的事项。

## 当前高频事项

| Gotcha | 正确处理 |
|---|---|
| 根目录也可 `npm run …` | 仓库根 `package.json` 会 `--prefix app` 转发；仍须写 `npm run deploy:serve`（不是裸 `deploy:serve`）。带参数：`npm run deploy:serve -- --target win11-home` |
| Agent 反复 `npm run dev` 导致端口变成 3001/3002 | 本地 Vite 固定 `3000`（`strictPort: true`）。需要新开时直接 `npm run dev`（会先跑 `scripts/free-dev-port.mjs` 释放占用）；不要手动换端口。已有健康的 3000 服务时优先复用，勿重复启动 |
| 开发与生产端口分开 | Vite/`npm run dev` → `:3000`；`deploy:serve` → `:3080`（`SELFHOST_PORT` 可覆盖）。Caddy 反代 `127.0.0.1:3080`。勿把两边都写 3000，否则同机并行会抢端口，且 `free-dev-port` 会误杀生产进程 |
| 当前路由使用 `BrowserRouter` | 路径形如 `/china-trips`；旧 `#/…` 书签由 `hashLegacyRedirect` 开机迁移。Supabase token 仍可能出现在 `#access_token=`，勿清掉 hash 解析 |
| Vite `base` 必须是 `/` | BrowserRouter 深链依赖绝对 asset 路径；勿改回 `./` |
| 正式站 canonical 域 | 公网 SEO/GEO 主机为 `https://www.xuntingtravel.com`（Caddy）；品牌名仍 Syncing Travel；勿再把 sitemap/llms/og 写回 `syncingtravel.com` |
| 公网当前在 cloud-vps | `www.xuntingtravel.com` DNS → 云主机（非本机 Win11）。本机 `xtch_prod` 导入**不会**自动出现在公网；需 SSH 到 VPS 跑 migrate/import + `build:cloud-vps` 重启服务 |
| sitemap Content-Type | `serve-selfhost.mjs` MIME 须含 `.xml` → `application/xml`；缺了会变成 `application/octet-stream`，不利于引擎认 sitemap |
| 内容导入 JSON 勿带 BOM | PowerShell `Set-Content` 默认 UTF-8 BOM 会让 `import-content-backup.ts` 解析失败；用无 BOM UTF-8，或从已有干净备份包复制 `tables/*.json` |
| sitemap 维护 | 改公开路由或 published 内容后：优先 `npx tsx scripts/seo-export-build-content.mjs --env=<target>` 更新 `seo-build-content.json`（无 DB 时用 `node scripts/seo-bootstrap-build-content.mjs`）；再跑 `npm run seo:sitemap`。sitemap 与 prerender 共用该快照；勿手改 `public/sitemap.xml`。无可靠 `updated_at` 时不要写假 `lastmod` |
| 产品枢纽路径 | 公开路由是 `/china-trips`；`/china-tours` 仅别名跳转；sitemap/Seo 勿再写死 `china-tours` |
| Auth / Stripe 回调 URL | Supabase Redirect：`/auth/callback`；Stripe success/cancel：`/china-trips?checkout=…`（无 `#`）。生产 env 若仍写旧 hash 需改 |
| 生产 build 含 prerender | `build:win11-home` / `build:cloud-vps` 会跑 Playwright prerender；需本机已 `npx playwright install chromium` |
| 页面路由集中在 `app/src/App.tsx` | 新页面或路由改动先查这里 |
| `@/*` 指向 `app/src/*` | 应优先使用项目已有别名 |
| 内容事实不能从目标站猜 | 先查 `docs/content-resource-map.md` |
| TOCN 只能作为参考 | 只能参考结构、节奏、交互和信息层级，不能当作 Syncing 事实 |
| `ChinaTripsMobile` 不是普通长网页 | 先读 `docs/mobile-ios-front-end-context.md`，并检查 320px、375px、390px |
| Mini-App 顶上出现网站 logo+汉堡 | ≤900px `/china-trips` 不得渲染站点 `Navbar`/`Footer`（见 `App.tsx`）；勿只靠组件内 CSS。断点是 900，不是 `useIsMobile` 的 768 |
| 订单 Account 看不到、但确认信有 | 登录认领只按 `lead_email`；邮箱不一致时用确认信/成功页链接绑定：`POST /api/claim-orders` + `orderNumber`+`token` 或 `sessionId`（OrderSuccess / My Orders 粘贴） |
| 首页 Curated「View Itinerary」仍进 `/china-trips` 总览 | 桌面链 `/tours/:slug`；手机链 `/china-trips?route={slug}`（打开详情后清 query） |
| RouteDetail 段导航（Itinerary/Included/FAQ/Price）切过中间内容 | 子导航 `sticky top-24` 假定主 Navbar 仍占顶；`/tours/` 上勿对主 Navbar 做下滚隐藏（`-translate-y-full`），否则会空出顶距让正文从缝里穿过 |
| Home traveler story 又改回 CSS `real-story-slide` 自动切 | 已改为 Embla JS 轮播（交互暂停 + 8s 恢复、圆点可点）；不要恢复无限 CSS 动画；图片 marquee 是另一套，勿混改 |
| Mini-App 无回门户入口 | 顶栏右上：返回箭头 `navigate(-1)` + Home 图标链到 `/`；品牌 Syncing Travel / Me「Back to website」仍可用；勿把预订主路径改成外跳 |
| 主站手机竖滑发涩 | 全页裁切用 `overflow-x: clip`（勿用会建 scrollport 的 `hidden`）；横滑轨加 `touch-action: pan-x pan-y` + `overscroll-behavior-x: contain`；≤900px 关闭 `html { scroll-behavior: smooth }` |
| Tailwind `py-18` / `md:py-18` | Tailwind **v3** 无 spacing `18`，类会被丢掉；用 `16`/`20`/`24`。Home Real Moments 曾用无效 `py-18` + `margin-top:-72px` 盖住 Curated trust bar |
| 跟团游英文产品名 | 旅客可见英文用 **Social Tours / social tour**；URL `/group-tours`、API `group-tour` / `group_tour_inquiry` 与 CSS class 名保持不变 |
| `AGENTS.md` 不是知识库 | 详细内容放入对应 `docs/` 文件 |
| 本机 `docker` CLI（`docker ps` 等）在这个 shell 环境里可能一直挂起不返回，即使 Docker Desktop 里真的有容器在跑（可能是 shell 会话拿不到桌面会话的 named pipe） | 不要死等 `docker ps`；改用直连 `pg`/`fetch` 测 `POSTGRES_URL` 指向的端口（如 `localhost:5432`）是否能连通，能连通就说明数据库可用，不用管 `docker` CLI 卡不卡 |
| PowerShell（本项目终端默认）不支持 `&&` 链接命令（会报 `token '&&' is not a valid statement separator`） | 用 `;` 分隔，或用 Shell 工具的 `working_directory` 参数代替 `cd xxx &&` |
| 验证需要本地数据库时，本机没有常驻 Postgres 服务/进程，但可能有用户手动起的 docker 容器（如 `xtch-postgres`，映射到 `localhost:5432`） | 验证前先问用户是否已有可用的本地库，别自己瞎折腾 Docker Desktop 启动 |
| `ensureContentTables` 等自愈 DDL 在首屏会并发触发 | 必须用 in-flight Promise 串行化；`CREATE INDEX IF NOT EXISTS` 在并发下仍可能报 `pg_class_relname_nsp_index`（23505），需忽略该碰撞 |
| 本地 Postgres 空库时 `/api/destinations` `/api/routes` 会 200 但返回空数组；`App` 仍会渲染 | 页面组件不得假设 `routeTours[0]` / `destinationMeta[0]` 一定存在；需要内容时跑 `npx tsx scripts/backfill-content.ts`（在 `app/` 下） |
| `CREATE TABLE IF NOT EXISTS` 不会修复旧表缺列 | 查询/更新新增列时，同步在对应 ensure schema 里加 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`，不能只改建表 SQL |
| 本地未配 `STRIPE_SECRET_KEY` 时点 Pay 会报 `Checkout is not configured.` | 在 `env/local/.env` 设 `DEV_CHECKOUT_BYPASS=1`（示例已有）；会本地建单并确认，跳 Mini-App `Booking confirmed`，并走确认邮件（`console` 只打终端预览）。生产/部署环境该开关强制无效；真测 Stripe 时填 test key 并去掉 bypass；真收信设 `BOOKING_EMAIL_MODE=resend` + `RESEND_API_KEY` |
| Resend `onboarding@resend.dev` 报只能发到本人邮箱 | 试用发件域只能发到 Resend 账号邮箱。本地设 `BOOKING_EMAIL_OVERRIDE_TO=<账号邮箱>`（见 `email.ts`）；表单可填任意 lead email，实际投递走 override。验证自有域名后可去掉 override |
| 改 env 后仍报 `RESEND_API_KEY is not configured.` | Vite 热重启会保留进程里旧的空 env；`vite.config.ts` 经 `loadTargetEnv` 强制覆盖。若仍异常，停掉终端里的 dev 再 `npm run dev`（完整重启进程） |
| 订单 `route_snapshot` 日期出现 ISO（如 `…T16:00:00.000Z`） | `pg` DATE 在事务里是 `Date`；写入 snapshot 前必须 `formatDate` 成 `YYYY-MM-DD`，禁止直接 `JSON.stringify(Date)`。展示侧用 `normalizeDateOnly` / `formatOrderDateRange`。历史脏数据跑迁移 `009_normalize_order_route_snapshot_dates` |
| 隧道测试台 env | `vite --mode tunnel` 加载 `env/tunnel/.env`。迁移必须用 `npm run db:migrate:tunnel`，勿对日常 `xtch` 库跑隧道迁移。见 `docs/ops/tunnel.md` |
| 隧道 Host 被 Vite 拦 | `Blocked request... not allowed` → `vite --mode tunnel` 需 `server.allowedHosts: ['.trycloudflare.com']`（仅 tunnel mode） |
| 隧道下 MinIO 直连 `127.0.0.1:9000` 会签名失败 | Presign Host 须等于浏览器访问的隧道域名。用 Vite `/s3` 反代 + `S3_ENDPOINT=https://<tunnel>/s3`（`testbed:tunnel` 会回写 `env/tunnel/.env`） |
| 隧道上的 Admin / auth bypass 不是生产 | `DEV_CHECKOUT_BYPASS` + bypass 邮箱在公网裸奔；用完 Ctrl+C 关隧道，勿当正式站 |
| 环境分层：两套生产，不是 selfhost vs cloud | 四层 = `local` / `tunnel` / `win11-home` / `cloud-vps`。配置在 `env/<target>/.env`；生产只有 **win11-home + cloud-vps**；`selfhost` 只是旧别名。总览：`docs/ops/README.md` |
| Env 路径 | 真相源 `env/<target>/.env`；旧 `app/.env.*.local` 仅一轮回退（`targetEnv` 会 warn）。勿再新增 `app/.env*.example` |
| Deploy target：同一时刻一个公网 DNS | `win11-home` 与 `cloud-vps` 换的是机器/域名/env/Caddy；勿两边同时接同一域名。索引见 `docs/ops/README.md` |
| 公网部署勿把 5432/9000 暴露 | `docker-compose.yml` 端口须绑 `127.0.0.1`；只放行 80/443；Compose **无默认密码**（根 `.env` 必填）。见 `docs/ops/shared/compose-credentials.md` |
| 公网 deploy 禁止 auth/checkout bypass | `env/win11-home/.env` / `env/cloud-vps/.env` 不得设 `DEV_CHECKOUT_BYPASS` / `DEV_AUTH_BYPASS_*`；`npm run deploy:serve` 会拒绝启动 |
| Admin 双名单 + 角色 | 服务端 `resolveAdminRole`：`ADMIN_TECH_EMAIL_ALLOWLIST` / `ADMIN_OPS_EMAIL_ALLOWLIST`；两边都有 → tech；旧 `ADMIN_EMAIL_ALLOWLIST` 仅在新名单皆空时兼容为全部 tech。bypass 邮箱也必须落在名单内。**非名单账号**：`/api/admin/me` 403 后前端只渲染独立 Access denied 页，不展示侧栏/工作台壳 |
| Admin 快捷密码登录 | `ADMIN_QUICK_LOGIN_EMAIL` + `ADMIN_QUICK_LOGIN_PASSWORD`（gitignore 的 `env/<target>/.env`）；邮箱须在名单内。签发 `aq1.` HMAC token（12h）。改密码后旧会话失效。**勿把真实口令写进 `.env.example` 或提交 git**；弱口令勿用于公网 |
| 公网 deploy 拒启空/占位 Admin 名单（G1） | `win11-home` / `cloud-vps`：名单全空或仅 `you@example.com` 时 `deploy:serve` `process.exit(1)`；不影响 Vite `local` |
| 自建 MinIO 签名用本机、浏览器走同域 `/s3` | `S3_ENDPOINT=http://127.0.0.1:9000`；上传签名 URL 跟请求 Host 改写；**入库的 `public_url`/`hero_image`/`image` 用相对 `/s3/<bucket>/…`**（勿存 `http://127.0.0.1:3000/s3/...`，否则 ngrok/LAN 裂图）。历史绝对路径跑迁移 `010_relative_s3_public_urls` |
| 生产多入口（域名/公网IP/局域网） | `deploy:serve` 默认 `SELFHOST_HOST=0.0.0.0`；`VITE_AUTH_REDIRECT_URL` 宜留空；Supabase/Google 须白名单每个会用的 origin |
| Auth 回调必须消费 `#access_token` | URL 含 token 时 `authReady` 必须为 false 并跑 `completeAuthRedirectNavigation`；**勿**因已有 localStorage session 而跳过（曾卡在首页 `#access_token=…`）。回跳：`auth_next` / localStorage → 否则旅客默认 `#/china-trips`（**不要**仅因 allowlist 推断 `#/admin`）。旅客 OTP 须带 `emailRedirectTo`（含 `auth_next`）；Admin OTP 链接回跳须带 `auth_next=admin`。Site URL 用站点根（如 `https://www.xuntingtravel.com`），**不要**写成 `/#/admin`。Redirect URLs：`https://www.xuntingtravel.com/**` 等。`type=recovery` 同样走消费逻辑 |
| 旅客登录成功勿默认 `#/account` | 无 return path 时回 `#/china-trips`（`TRAVELER_DEFAULT_RETURN_PATH`）并 `markPostAuthMeFocus`；会话真相源是 `@supabase/supabase-js`（勿再双写旧 key `syncing_travel_auth_session`）；401 先 `ensureFreshSession` 再试一次，仍失败再清会话；跨标签用 `subscribeAuthSession` + `focus` |
| Me 页 Google/Apple「点不进去」 | Me 无 loading/error UI；OAuth 须先 `setActiveView('signIn')` 再 `signInWithOAuth`。邮箱走 `beginSignIn` 故看似正常。Apple 未在 Supabase 启用时会在 Sign In 页报错，不是按钮坏了 |
| 「看着已登录」却订单要登录 | 先查：① Redirect URL 是否含当前 origin；② 前端 bypass 会话 vs 服务端无 `DEV_AUTH_BYPASS_EMAIL`；③ React `authUser` 与 `readStoredAuthSession()` 是否脱节（点订单前应重读）；④ Supabase 邮件模板是否仍只有链接、未放 `{{ .Token }}` |
| Admin / 旅客邮箱用 6 位 OTP | Admin：`POST /api/admin/auth-otp`（名单预检；可带 `emailRedirectTo` 含 `auth_next=admin` 作链接回退）；旅客：客户端 `signInWithOtp` + `emailRedirectTo`→`#/china-trips`；两端 `verifyOtp({ type: 'email' })`。旧 `/api/admin/auth-magic-link` 一期仍转发到 OTP。Confirm email 保持开启＝仅首次注册确认 |
| Supabase 邮件模板必须含 Token | Dashboard → Auth → Email Templates → **Magic Link**：正文写 `{{ .Token }}`（Dev+Prod）。不改模板则用户收不到可用 6 位码。代码不改模板 |
| 本地测真 OTP | 临时去掉 `VITE_DEV_AUTH_BYPASS_EMAIL`，用名单邮箱收 6 位码；测完可再开 bypass |
| 生产勿共用日常库/桶 | Deploy target 用 `xtch_prod` + `xtch-prod` + `APP_ENV=prod`；日常仍是 `xtch` + `xtch-public`；隧道是 `xtch_tunnel` + `xtch-tunnel`。导入备份见 `docs/ops/shared/content-backup.md`，勿对 `xtch` 跑生产导入 |
| 公网前端 `VITE_*` 要打进构建 | 用 `npm run build:win11-home` 或 `build:cloud-vps`（输出到 `app/dist/<target>/`），再 `npm run deploy:serve`；只改 runtime env 不会更新已构建的 Supabase/redirect |
| 询盘黄条 / Complete the anti-spam | 生产缺 `VITE_TURNSTILE_SITE_KEY`（编译期）或未 rebuild。填 `env/win11-home/.env` 的 site+secret 后必须 `build:win11-home` 再重启 `deploy:serve`；只改 `.env` 不重建则黄条仍在。公网勿用 Cloudflare always-pass 测试 key；Turnstile 通过后还要齐 `RESEND_API_KEY` / `INQUIRY_FROM_EMAIL` / `INQUIRY_TO_EMAIL` 否则 502 |
| 勿用本地 `npm run build` 喂 deploy:serve | **已隔离：** `build` → `app/dist/local/`；`build:win11-home` → `app/dist/win11-home/`；`deploy:serve` 只读 `dist/<target>/` 且校验 `.xtch-build-target`。本地 build 再也盖不掉生产包 |
| Vite `Failed to run dependency scan` / `@emotion/is-prop-valid` 指向 `dist/win11-home/assets/…` | `npm run dev` 的 `outDir` 是 `dist/local`；Vite 默认会扫根下所有 HTML，只忽略当前 outDir，仍会扫到其他 target 的 dist。已用 `optimizeDeps.entries: ['index.html']` 限定入口。勿为此乱装 `@emotion/is-prop-valid`（motion 的 optional peer，缺了只影响 styled(motion) 场景） |
| 新增 API 后须重启 deploy:serve | `localApiRoutes` 在进程启动时加载；未重启会 JSON `Not found.`（如 `/api/admin/auth-otp`） |
| Agent/脚本重定向输出别落在 `app/` 根 | 写到仓库根 `tmp/`（gitignore）；勿再生成 `app/out.txt` / `app/err.txt` / `app/build-out.txt` |
| 直连 GitHub `443` 失败 | 本机 v2rayN/xray 常见 SOCKS `127.0.0.1:10808`；临时用 `git -c http.proxy=socks5://127.0.0.1:10808 -c https.proxy=socks5://127.0.0.1:10808 …`，勿默写进 global config；经代理会明显变慢 |
| Shell 若已在 `app/`，`git add app/src/...` 会 pathspec 失败 | `git` 路径相对**仓库根**；在 `app/` 内应 `git add src/...`，或设 `working_directory` 为仓库根再用 `app/src/...` |
| PowerShell 不能用 bash `$(cat <<'EOF')` 写 commit message | 用 `git commit -m "…"` 或 PowerShell here-string `@'…'@` |
| `npm run build`/`lint` 报 `tsc`/`eslint` 不是内部命令 | 多半缺 `app/node_modules`；在 `app/` 下 `npm install` 后再 `npm run build`，不要裸 `npx tsc`（会装错包） |
| Admin 路线编辑又堆回巨型表单 / 英文 CSV | 用 `RouteEditor`（默认快速模式）+ `routeDraft`/`slugify`；目的地勾选名称，勿恢复逗号分隔 slug CSV 为主路径；上架拦中文客文案，存草稿可软警告 |
| Admin 移动预览与线上列表卡不一致 | 预览必须用 `MobileRouteListCard` / `MobileRouteDetailFacade`（与 China Trips 同源），勿另写一套假卡片 HTML |
| Admin 路线详情预览缺内容块 | `MobileRouteDetailFacade` 须含 Overview / 全部逐日 / moments / included；不要 Booking CTA；勿只截前 4 天 |
| Admin 班期又堆回六态裸下拉为主路径 | 用 `DepartureEditor`：快速开班 +「更多设置」；状态靠任务按钮（存草稿/上架/锁关取消确认/重新上架）；结论条看旅客能否买；目的地显示名称；「保证发团」在售卖区，勿与状态混淆 |
| Admin 目的地又堆回状态裸下拉 / 混排推荐与列表序 | 用 `DestinationEditor`：快速填写 + 存草稿/上架；slug 名称自动；`displayOrder` 在快速区、`featuredPriority` 在「首页推荐」折叠；CJK 上架拦截 |
| Admin 目的地预览又变成示意卡 | 预览必须用 `DestinationMobilePreview`（390 壳）+ `MobileDestinationCard` / `MobileDestinationListRow` / `MobileDestinationDetailFacade`（与 China Trips 同源），勿另写假卡片 HTML |
| Admin 详情预览空白（桌面） | `.iosapp-page` 公网默认 `display:none`（≤900 才显示）；预览外包 `admin-mobile-preview-shell` 强制 `display:block` |
| Admin 订单详情又变字段 dump / 点列表清空备注 | 用 `OrderDetail` 三块（下一步/客人行程金额/支付技术折叠）；打开详情走 `GET ?orderNumber=` 回显 `internal_notes`；勿 `setNotes('')`；取消申请只警示不假装可批准 |
| Admin 素材待审与选图上传混淆 / 关联又变 slug 逗号串 | 选图器上传 → `published`（立刻封面）；素材页新建 → 默认 `review`，列表「通过/驳回」；关联用目的地/路线名称勾选，≠ 自动换封面；工作台「待审」只计库内入库 |
| Admin 分类又露出手填 key / 中文显示名 | 运营只填英文显示名+排序+启用；新建 key 由 `slugify`/`slugifyOrFallback` 自动生成并隐藏；编辑 key 仅「高级」只读；CJK 保存/启用拦截；停用不删已勾选内容上的 key |
| 路线展示标签必须对齐筛选分类 | `routes.category` 只由 `themes[0]`→`categories.label` 推导（读列表与 `upsertRoute` 强制）；Admin 不可手填；无 themes 则角标不显示。勿再恢复独立「分类文案」手填 |
| Admin 表单配置又手填 fieldKey / 无旅客预览 | 用 `FormConfigMobilePreview`（完整定制｜路线私人）+ `formFieldDraft`；新建 fieldKey 由 label 转 **snake_case**（非 hyphen slug）自动生成并藏进高级；编辑草稿合并预览带「未保存」角标；列表「整表预览」仅已启用已保存；CJK 拦 label/description；列表可直接勾选必填（`set-required`），勿只依赖编辑页；勿做拖拽构建器 |
| Admin 工作台四卡顺序/文案散落 | 紧急序固定：取消申请 → 待跟进询盘 → 未上架路线 → 待确认素材；文案在 `dashboardOpsCopy`（取消说明复用 `orderOpsCopy`）；有数醒目、零淡化；勿改 `dashboard.ts` 计数或增删卡 |

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
