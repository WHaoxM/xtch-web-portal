# 子代理角色：Node 运行时与 API 安全

> 发放要求：必须同时提供本目录 `README.md`。本任务不授权部署、访问真实生产数据、修改真实 env 或推送代码。跨出 `Owns` 前必须提交 Blocking Request。

## 任务目标

让自托管 Node 服务在进入业务 handler 和鉴权前具备资源保护，并对生产目标配置执行 fail-closed 校验。

## 文件边界

**Owns**

- `app/scripts/serve-selfhost.mjs`
- `scripts/env/targetEnv.ts`
- 与运行时安全直接对应的新测试

**May Touch**

- `app/scripts/localApiRoutes.ts`
- `app/vite.config.ts`：仅接入公共环境校验
- `scripts/db/migrate.ts`：仅接入公共环境校验

**Must Not Touch**

- Caddyfile、Docker Compose、systemd 和 bootstrap
- 订单、Stripe、前端及 SEO 业务代码
- `app/package.json`、lockfile、根 package scripts、生产 env examples 和 `docs/ops/**`；测试命令、变量说明或文档变更交对应 owner
- 真实 `env/*/.env`、真实密钥和真实生产服务

## 必修问题

### 1. API 请求体无大小上限

当前 `serve-selfhost.mjs` 会在鉴权和 handler 执行前收集全部 chunk 并 `Buffer.concat`。匿名攻击者可用超大或持续分块请求耗尽内存。

完成要求：

- 流式累计请求体大小，超过上限立即返回 `413 Payload Too Large`。
- JSON API 和 Stripe webhook 分别定义明确上限；上限应足够业务使用但不能无限。
- 超限后停止读取并安全终止请求，不得继续进入 handler。
- 非法 JSON 返回稳定的 400，不得变成通用 500。
- 处理客户端中断、Content-Length 欺骗和 chunked body。
- 限制值应集中定义，便于 Caddy 角色使用同一数值设置边缘层上限。

### 2. 生产启动预检不完整

当前只拒绝 DEV bypass 和无效 Admin 名单，仍可能以错误数据库、桶、占位凭据或缺失关键配置启动。

完成要求：

- 建立按 target 校验的环境 schema，并让 build/migrate/serve 能复用同一规则。
- `win11-home` 与 `cloud-vps` 至少校验：
  - `APP_ENV=prod`
  - 数据库目标为 `xtch_prod`
  - `S3_BUCKET=xtch-prod`
  - 不存在 `CHANGE_ME`、`YOUR_DOMAIN` 等占位值
  - 禁止所有 DEV bypass
  - Admin 名单可用
  - 启用某项能力时，其配套配置必须完整，例如 Stripe secret 与 webhook secret、Turnstile site 与 secret、Resend 模式与 key
- 区分“能力未启用”和“配置了一半”；未启用可以明确关闭，半配置必须拒绝启动。
- 错误消息只显示变量名和修复提示，不打印密钥值或完整数据库 URL。

### 3. 未知页面的生产 HTTP 状态

SEO 代理负责 Not Found 页面和 noindex 语义，并交付公开路由 manifest。本角色收到该 manifest 后：

- 在不破坏 BrowserRouter 合法深链的前提下，让可确定的未知页面返回 HTTP 404。
- API 404 继续返回 JSON，页面 404 返回 HTML。
- 不得自行维护第二份公开路由清单；路由真相源由 SEO 代理提供。

## 验收测试

至少覆盖：

- 小型合法 JSON 和合法 webhook body 正常通过。
- 超限 Content-Length、chunked body、提前断连均不会进入 handler。
- 非法 JSON 返回 400。
- 本地 target 不被生产规则误伤。
- 两个生产 target 对错误数据库、错误桶、占位值、DEV bypass、半配置能力均拒绝启动。
- 日志不包含密码、token、secret 或完整连接串。
- 合法 BrowserRouter 深链返回页面 HTML。
- 未知页面返回 HTTP 404 和页面 HTML，不回退成首页 canonical。
- 未知 `/api/*` 返回 HTTP 404 和 JSON。

执行并记录：

```text
npm run typecheck
npm run lint
npm run build
与本任务对应的运行时测试
```

## 给基础设施角色的交付

额外输出：

- JSON API 与 webhook 的最终字节上限。
- 建议的反向代理超时。
- 生产必填、条件必填和禁止变量清单。

## 完成定义

- 未授权请求不能在进入 handler 前无限占用内存。
- 错误生产目标或半配置环境无法启动。
- 所有新限制均有自动化测试，不依赖真实生产环境。

