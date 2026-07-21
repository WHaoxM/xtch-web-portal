# V1 Release Readiness

- Overall status: `ready-for-prerelease`
- Candidate: GitHub Pre-release `v1.0.0-rc.1`
- Target: `cloud-vps`
- Last coordinator review: `2026-07-21`

## 角色验证状态

| Role | Delivery | Validation | Status |
|---|---|---|---|
| 01 预订与支付一致性 | [delivery](./deliveries/01-booking-payment-integrity.md) | coordinator rerun | pass |
| 02 Node 运行时与 API 安全 | [delivery](./deliveries/02-runtime-api-security.md) | coordinator rerun | pass |
| 03 前端关键流程 | [delivery](./deliveries/03-frontend-critical-flows.md) | coordinator rerun | pass-with-delivery-gap |
| 04 SEO 与预渲染 | [delivery](./deliveries/04-seo-prerender.md) | 45/45 + user acceptance | pass-with-delivery-gap |
| 05 发行工程 | [delivery](./deliveries/05-release-engineering.md) | coordinator completed RC checks | pass-for-github-prerelease |
| 06 基础设施加固 | [delivery](./deliveries/06-infrastructure-hardening.md) | coordinator rerun | pass |

## 最终门禁

- [x] 六个角色的代码结果已由协调代理复验
- [ ] 提交后工作树干净
- [ ] `v1.0.0-rc.1` tag 指向合并后的 `main`
- [x] typecheck、lint、75 项隔离测试、14 项数据库集成测试通过
- [x] `build:cloud-vps` 与 45/45 SEO 预渲染通过
- [x] `npm audit` 与 `npm audit --omit=dev` 均为 0
- [x] `npm ci` 使用官方 `registry.npmjs.org` 成功
- [x] GitHub 自动 source archive 由不可变 tag 生成；本次不附加自定义二进制 artifact
- [x] 未提交真实 env 或密钥
- [ ] 数据迁移、内容导入、支付、邮件、DNS 和部署均有用户单独批准

## 开放限制

- 本次是 Pre-release，不代表生产部署批准。
- 角色 03/04 的 delivery 模板未补写；代码和构建证据已独立复验。
- Linux `systemd-analyze`、ShellCheck、真实 Caddy 413/webhook/S3 联调未验证。
- 320/375/390 性别头像浏览器验收未完成。
- 首屏 JS 约 1.4 MB，仍有 Vite chunk-size warning。
- migration 011/012 尚未在生产目标执行。

## 最终结论

满足 GitHub `v1.0.0-rc.1` Pre-release 条件；不满足正式生产上线条件。

