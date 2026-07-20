# 交付报告：预订与支付一致性

- Task: [`../01-booking-payment-integrity.md`](../01-booking-payment-integrity.md)
- Status: `ready-for-validation`
- Agent: Subagent-1 (booking-payment-integrity)
- Started: 2026-07-20
- Finished: 2026-07-20

## 修改文件

### Owns

- `app/api/checkout-session.ts` — 限流、失败释放 hold、`payment_method_types: ['card']`、A1 惰性清理入口
- `app/api/stripe-webhook.ts` — Charge/Refund 分流、累计退款、仅 paid 确认、修未 import 崩溃
- `app/api/orders.ts` — 取消申请状态门禁与幂等响应
- `app/api/lib/orders.ts` — 同邮箱+同班期并发 active hold 拒绝
- `app/api/lib/orderQueries.ts` — fail/expire/full-refund/取消原子更新；`canAutoReleaseSeats` 日期差 SQL 修复
- `app/api/lib/availability.ts` — 查询前调用 `expireExpiredHolds`
- `app/api/lib/bookingSchema.ts` — `checkout_rate_buckets` 表
- `app/api/lib/bookingIntegrity.ts` — 纯决策函数（新建）
- `app/api/lib/checkoutRateLimit.ts` — Postgres 限流（新建）

### 测试（Owns）

- `app/api/lib/bookingIntegrity.test.ts`
- `app/api/lib/bookingIntegrity.scenarios.test.ts`
- `app/api/lib/bookingIntegrity.pg.integration.test.ts`
- `app/api/stripe-webhook.e2e.integration.test.ts`
- `app/api/stripe-webhook.network.e2e.integration.test.ts`

### May Touch

- `app/vite.config.ts` — 本地 API 传入 `socket.remoteAddress`（IP 限流）
- `app/scripts/serve-selfhost.mjs` — 同上
- `docs/agent-progress.md` — 进度交接
- `docs/release/v1-source-audit/deliveries/01-booking-payment-integrity.md` — 本交付报告

## 问题与修复

### 1. 库存 hold 滥用

- **根因**：匿名 `POST /api/checkout-session` 在创建 Stripe Session 前建 30min active hold；无限流；同主体可多条；Session 失败不释放；过期仅查询侧忽略。
- **修复**：Postgres `checkout_rate_buckets`（IP 10 / 邮箱 5 / 班期 20 / 10min）；`TRUST_PROXY` 关时不信转发头，开时取 XFF 最左跳（Caddy）；同邮箱+班期拒绝第二笔 active hold；Stripe 创建/关联失败 → `failed` + hold `released`；A1 在 checkout/可用性路径惰性过期 hold+pending 订单。

### 2. 退款事件与库存一致性

- **根因**：`charge.refunded` 把 Charge 当 Refund；用单笔 `amount` 而非累计；全额不改订单终态；`releaseHoldByOrderId` 只放 `active`；且函数未 import（运行时炸）。
- **修复**：按事件类型解析 Charge vs Refund；用 `amount_refunded` / `charges.retrieve` 累计额；全额且可自动放座时事务内 `status=refunded` + 释放 `active|consumed`；保留临近出发人工审核语义；webhook 事件账本幂等。

### 3. 异步/即时支付策略（B1）

- **根因**：`checkout.session.completed` 未校验 `payment_status` / PI 状态。
- **修复**：用户确认 B1 — `payment_method_types: ['card']`；仅 `payment_status=paid` 或 PI `succeeded` 才确认并发信；未实现 async 事件处理器。

### 4. 取消申请状态机

- **根因**：持 token 可无条件写成 `cancellation_requested`，终态订单重新占库存。
- **修复**：仅 `confirmed` + `payment_status=paid`；已是 `cancellation_requested` 幂等 200；部分退款/终态/pending → 409；原子 `UPDATE ... WHERE`。

### 额外修复（E2E 发现）

- `canAutoReleaseSeats`：`EXTRACT(DAY FROM (date - date))` 在真实 Postgres 报 42883 → 改为 `(start_date - CURRENT_DATE)::int`。

## 用户确认记录

- **限流 / 可信代理 / 清理**：推荐方案 + A1 惰性清理 + 同主体拒绝 + 建议阈值 + `TRUST_PROXY` 仅 Caddy。
- **支付方式范围**：B1 — 仅即时卡支付。
- **允许取消申请的订单状态**：仅 `confirmed`（且 `payment_status=paid`）；`cancellation_requested` 幂等；部分退款不允许旅客申请。

## 新增或更新测试

| 文件 | 覆盖 | 结果 |
|---|---|---|
| `bookingIntegrity.test.ts` + `scenarios.test.ts` | 取消门禁、累计退款分类、B1 paid 门、IP 信任、Charge vs Refund 字段 | 12/12 pass |
| `bookingIntegrity.pg.integration.test.ts` | 并发 hold、fail 释放、A1 过期、邮箱限流、取消门禁、全额退款释放 consumed | 6/6 pass |
| `stripe-webhook.e2e.integration.test.ts` | 本地签名：expired、unpaid completed、charge.refunded 部分→全额+幂等、amount 陷阱 | 4/4 pass |
| `stripe-webhook.network.e2e.integration.test.ts` | 真网 PI retrieve 确认；`refund.updated` + charges.retrieve 全额退款 | 2/2 pass |

## 验证命令

| Working directory | Command | Exit code | Result |
|---|---|---:|---|
| `app/` | `npx tsx --test api/lib/bookingIntegrity.test.ts api/lib/bookingIntegrity.scenarios.test.ts` | 0 | 12 pass |
| `app/` | `npx tsx --test api/lib/bookingIntegrity.pg.integration.test.ts` | 0 | 6 pass（库 `localhost/xtch`） |
| `app/` | `npx tsx --test api/stripe-webhook.e2e.integration.test.ts` | 0 | 4 pass |
| `app/` | `npx tsx --test api/stripe-webhook.network.e2e.integration.test.ts`（进程环境注入 `rk_test_`，未写入仓库） | 0 | 2 pass |
| `app/` | `npm run typecheck` | 0 | 通过 |
| `app/` | `npm run lint` | 0 | 通过 |
| `app/` | `npm run build` | 0 | 通过 |

## 未验证项与剩余风险

- 真实浏览器 Checkout Cancel/Success 全链路未本角色验收（属角色 3 交叉面）。
- 确认邮件依赖 Resend；网络 E2E 时本地 Resend key 无效仅打日志，订单状态仍正确。
- Dashboard 正式 `whsec_` 端点未对接；本地/网络 E2E 使用本地签名 secret。
- 角色 6 交接：Caddy 后须设 `TRUST_PROXY=1`（本角色未改 env examples）。
- 角色 5 交接：建议登记 `test:booking-integrity` 等脚本（本角色未改 `package.json`）。
- 用户曾在对话中粘贴受限密钥：建议在 Stripe Dashboard 轮换；交付过程**未**把密钥写入 git 跟踪文件。

## 边界声明

- [x] 未部署或推送
- [x] 未访问真实生产数据（仅本机 `xtch` + Stripe **test** 模式）
- [x] 未修改真实生产 env/密钥文件；网络 E2E 密钥仅进程环境，未写入仓库
- [x] May Touch：`vite.config.ts` / `serve-selfhost.mjs` 各一行传 peer IP（限流所需）；未改 Caddy/Docker/前端视觉/SEO/`package.json`
