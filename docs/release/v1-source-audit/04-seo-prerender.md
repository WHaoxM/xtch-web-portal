# 子代理角色：SEO 与预渲染

> 发放要求：必须同时提供本目录 `README.md`。本任务不授权部署、访问真实生产数据、修改真实 env、改写内容事实或推送代码。跨出 `Owns` 前必须提交 Blocking Request。

## 任务目标

确保 sitemap 中承诺可索引的页面在生产构建中生成正确、内容完整的 HTML，并让未知路径得到正确的 404/noindex 语义。

## 文件边界

**Owns**

- `app/scripts/prerender.mjs`
- `app/scripts/seo-public-routes.mjs`
- `app/scripts/generate-sitemap.mjs`
- `app/src/components/Seo.tsx`
- `app/src/lib/seo/**`
- 新增的 `app/scripts/seo-*.mjs` / `app/scripts/seo-*.ts`
- 与 SEO 构建直接对应的新测试

**May Touch**

- `app/src/App.tsx`：仅内容加载失败门禁和 Not Found 路由
- `app/src/pages/RouteDetail.tsx`：仅 SEO ready/缺内容状态
- SEO 专题文档

**Must Not Touch**

- 生产数据库数据、内容文案事实、支付和 Admin
- Caddy、Docker、systemd
- `app/src/pages/DestinationDetail.tsx`：由前端关键流程代理负责；需要时提交 Blocking Request
- 页面视觉重做或新依赖

## 必修问题

### 1. 预渲染静态服务器无法提供 API 内容

当前 prerender server 对 `/api/*` 返回 SPA `index.html`。前端内容加载失败后仍把内容门禁设为完成，预渲染可能把空列表或 “not found” 写入正式 HTML，同时构建仍成功。

完成要求：

- 实现前提交构建期数据方案，列出 fixture、内容导出包或构建期 API adapter 的来源、更新责任、陈旧检测和失败行为；由用户确认真相源后再实现。
- 预渲染必须获得与发布内容一致的构建期数据，不得把 HTML 当 API JSON。
- 内容请求失败时不得设置 `seoReady=1`。
- 预渲染遇到空内容、错误页面、错误 canonical 或未解析关键 meta 时必须构建失败。

### 2. Sitemap 中路线详情未预渲染

20 条 `/tours/:slug` 在 sitemap 中，但不在 `getPrerenderRoutes()` 中。

完成要求：

- sitemap 与 prerender 使用同一套公开索引路由真相源。
- 所有 sitemap 路线详情生成对应 `dist/<target>/tours/<slug>/index.html`。
- 每个详情页具有自身 title、description、canonical、OG URL 和主要可见内容。
- 不得把不存在或未发布路线写入 sitemap。

### 3. 未知路径返回首页 200/canonical

当前无 `*` 路由，静态服务又回退首页 HTML，SEO meta 回退到首页。

完成要求：

- 增加明确 Not Found 页面和 `noindex, nofollow`。
- 客户端导航未知路径显示 404 页面，不显示空正文。
- 本角色负责生成唯一公开路由 manifest，并交给运行时安全代理接入生产 HTTP 404；不得直接修改 `serve-selfhost.mjs`。
- 不影响 BrowserRouter 合法深链。

### 4. Sitemap `lastmod` 每次构建写当天

完成要求：

- 优先使用内容真实更新时间。
- 无可靠更新时间时省略 `lastmod`，不得制造每日更新信号。
- 同一 commit 和同一输入应生成稳定 sitemap。

## 验收

生产目标构建后自动检查：

- sitemap 每个 indexable URL 都有预期 HTML，或有明确记录的可接受例外。
- `/destinations/beijing` 与至少三条 `/tours/:slug` 包含正确页面内容及 canonical。
- HTML 中不得出现 “Destination not found”、空路线壳或首页 canonical。
- 未知路径显示 noindex 404。
- API/内容加载失败会让 prerender 命令非零退出。
- sitemap 与 prerender 路由集合一致。

执行并记录：

```text
npm run typecheck
npm run lint
npm run build
npm run build:cloud-vps
SEO 产物断言测试
```

`build:cloud-vps` 只能使用隔离的非生产配置，不得读取或修改真实生产数据。

## 完成定义

- 构建成功意味着索引页内容真实可用，而不只是 `seoReady` 标志存在。
- sitemap、prerender、canonical 和应用公开路由不存在已知分叉。
- 未知路径不再伪装成首页。

