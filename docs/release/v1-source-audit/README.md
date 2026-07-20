# V1 源码审计修复任务总览

## 目标

在打包第一版网站前，修复本轮源码审计确认的发布阻断项，并形成可追溯、可重复验证的发行基线。

本目录是任务分发材料，不代表授权部署。所有子代理均不得访问真实生产数据库、修改真实 `env/*/.env`、启用 Stripe live、切换 DNS、推送代码或部署公网，除非用户另行明确批准。

## 角色与任务书

| 顺序 | 子代理角色 | 任务书 | 主要责任 |
|---|---|---|---|
| 1 | 预订与支付一致性代理 | [01-booking-payment-integrity.md](./01-booking-payment-integrity.md) | 库存占用滥用、Stripe 异步支付、退款和订单状态机 |
| 2 | Node 运行时安全代理 | [02-runtime-api-security.md](./02-runtime-api-security.md) | 请求体上限、生产环境启动校验 |
| 3 | 前端关键流程代理 | [03-frontend-critical-flows.md](./03-frontend-critical-flows.md) | BrowserRouter 内链、支付取消回流、关键可访问性 |
| 4 | SEO 与预渲染代理 | [04-seo-prerender.md](./04-seo-prerender.md) | 构建期内容、路线预渲染、404/noindex、sitemap |
| 5 | 发行工程代理 | [05-release-engineering.md](./05-release-engineering.md) | 干净工作树、异常路径、构建清单、依赖和最小发行物 |
| 6 | 基础设施加固代理 | [06-infrastructure-hardening.md](./06-infrastructure-hardening.md) | Compose 凭据、VPS bootstrap、systemd、Caddy |

分发时必须把本 README 与对应角色任务书一起发送。角色任务书不是脱离本 README 的独立授权。

## 依赖顺序

1. 角色 1、3、4 可以并行；角色 2 的请求体和环境校验可并行进行，但页面 HTTP 404 部分必须等角色 4 交付公开路由 manifest。
2. 角色 6 收到角色 2 的 API 请求体限制值、超时建议和生产环境变量清单后再开始 Caddy 对应部分。
3. 角色 5 最后收口；只有其他角色完成、协调代理给出候选 commit SHA/target，且工作树已冻结后才能开始。
4. 任一角色需要修改别人 `Owns` 的文件时，停止修改并提交 Blocking Request，由主协调代理重新分配。
5. `app/package.json`、lockfile 和根 package scripts 由角色 5 统一负责；其他角色只提交测试命令需求，不直接修改。
6. `env/win11-home/.env.example`、`env/cloud-vps/.env.example` 和 `docs/ops/**` 由角色 6 统一负责；角色 2 只交付变量校验需求。
7. 角色 2 完成运行时修复后，协调代理可把 `app/scripts/serve-selfhost.mjs` 阶段性移交给角色 5，仅允许接入发行 manifest 校验；移交必须在任务板明确记录。

## 必须由用户确认的实现门禁

以下事项不得由子代理自行选型：

- Checkout 限流的持久化方案、可信代理/IP 规则和 hold 清理机制。
- V1 是否只允许即时卡支付，或支持 Stripe 异步支付方式。
- 哪些已付款订单状态允许旅客提交取消申请。
- 支付取消草稿是否允许在 `sessionStorage` 暂存旅客个人信息。
- SEO 构建期内容的真相源与更新责任。
- 统一使用的 npm registry。
- 任何新依赖、新服务、定时任务或长期维护架构。

## 全局发布门禁

以下条件全部满足前，不得标记为 V1 release-ready：

- P1 项全部关闭，并有针对性回归测试。
- `npm run build`、`npm run lint`、`npm run typecheck`、现有单元测试全部通过。
- `npm run build:cloud-vps` 在隔离的非生产配置下成功，预渲染结果抽检通过。
- `npm audit` 与 `npm audit --omit=dev` 有可保存的结果；生产依赖不得存在未接受的 high/critical 漏洞。
- `git status --porcelain` 为空；发行物对应唯一 commit 和 tag。
- 仓库中不存在反斜杠命名的重复文件。
- 发行包由当前 commit 重新构建，不复用已有 `app/dist/win11-home`。
- 发行 manifest 至少包含 commit SHA、目标环境、构建时间、Node/npm 版本和文件校验和。
- 真实部署、数据库迁移、内容导入、DNS 和支付配置仍需用户单独确认。

## 每个子代理的统一交付格式

子代理完成后必须填写自己在 [`deliveries/`](./deliveries/README.md) 下的唯一交付报告，并返回该文件路径。不要修改其他角色报告、`validation/` 或最终发行门禁。

交付报告必须包含：

1. 修改文件清单。
2. 每个审计问题的根因和修复摘要。
3. 新增或更新的测试。
4. 实际执行的命令及退出结果。
5. 未验证项、环境限制和剩余风险。
6. 是否触碰了 `May Touch` 文件；如有，说明原因。
7. 明确声明未部署、未访问真实生产数据、未修改真实密钥。

## 验证产物分层

```text
角色任务书（本目录 01-06）
  → deliveries/（各子代理填写自己的交付证据）
  → validation/（主协调代理复核代码、测试和边界）
  → release-readiness.md（全部角色通过后的最终发行结论）
```

- 子代理只能修改自己 `Owns/May Touch` 的代码和唯一 delivery 文件。
- 主协调代理读取 delivery 后独立复跑验证，不直接采信“已通过”描述。
- 验证失败时，主协调代理在 `validation/<role>.md` 记录证据并退回原角色修复。
- 大型原始日志不得提交进 docs；放在根 `tmp/`，delivery 只写命令、退出码、关键摘要和临时日志路径。

