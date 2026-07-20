# 子代理角色：预订与支付一致性

> 发放要求：必须同时提供本目录 `README.md`。本任务不授权部署、访问真实生产数据、修改真实 env、推送代码或启用 Stripe live。跨出 `Owns` 前必须提交 Blocking Request。

## 任务目标

关闭会影响真实库存、收款状态和退款结果的发布阻断项。修复必须以服务端状态和 Stripe 已验证事件为真相源，不依赖前端参数。

## 文件边界

**Owns**

- `app/api/checkout-session.ts`
- `app/api/stripe-webhook.ts`
- `app/api/orders.ts`
- `app/api/lib/orders.ts`
- `app/api/lib/orderQueries.ts`
- `app/api/lib/availability.ts`
- 与上述逻辑直接对应的新测试文件

**May Touch**

- `app/api/lib/bookingSchema.ts`：仅在状态约束或索引确有必要时
- `app/api/lib/webhookEvents.ts`
- booking/payment 专题文档

**Must Not Touch**

- 前端视觉、SEO、Caddy、Docker、systemd
- 真实数据库数据和真实 Stripe 配置
- 新支付方式、退款政策或业务规则
- `app/package.json`、lockfile 和根 package scripts；测试命令需求交发行工程代理

## 必修问题

### 1. 匿名 Checkout 可反复锁死库存

当前匿名 `POST /api/checkout-session` 在创建 Stripe Session 前就建立 30 分钟 active hold，缺少速率限制、反自动化门禁和单主体并发限制；Stripe Session 创建失败也不会立即补偿释放。

完成要求：

- 实现前先提交一页决策请求，说明限流持久化、可信代理/IP 获取规则、多进程一致性和清理责任；推荐优先评估复用 Postgres、无需新依赖的方案，必须等用户确认。
- 经确认后，给公开 Checkout 增加可在自托管环境落地的限流策略，至少覆盖 IP、邮箱和班期维度；不得盲信任客户端可伪造的转发头。
- 限制同一主体对同一班期的并发 active hold。
- Stripe Session 创建或关联失败时，立即把本次订单和 hold 转入明确失败/释放状态。
- 清理过期 active hold 的职责和执行入口必须由用户确认；不得自行增加外部定时服务，也不得只依赖查询时忽略过期记录。
- 不得强制登录后才能购买。

### 2. Stripe 退款事件解析与库存释放错误

当前把 `charge.refunded` 的 Charge 对象强制当作 Refund；部分退款可能被判为全额退款。全额退款只更新 payment/refund 字段，没有把订单转为不占库存的终态，且释放函数只处理 active hold，无法释放 consumed hold。

完成要求：

- 按 Stripe 事件类型分别解析 Charge 和 Refund。
- 使用累计退款金额判断部分/全额退款，不得把原始支付总额当作退款额。
- 全额退款时，在同一事务内更新订单终态及库存占用状态。
- 重复 webhook 必须幂等，不得重复释放或回退状态。
- 保留临近出发时需要人工审核的现有业务语义，但财务状态和库存状态必须一致、可解释。

### 3. 延迟支付可能被提前确认为已付款

当前收到 `checkout.session.completed` 后直接确认订单，没有验证 `payment_status` / PaymentIntent 状态，也未处理异步支付成功和失败事件。

完成要求：

- 实现前由用户确认 V1 策略：只允许即时卡支付，或正式支持 Stripe 异步支付方式。子代理不得自行决定支付能力范围。
- 仅在 Stripe 明确已付款时确认订单。
- 按用户确认结果处理：支持 `checkout.session.async_payment_succeeded` / `checkout.session.async_payment_failed`，或在 Checkout 配置层明确只允许即时卡支付并有测试约束。
- 异步失败或 Session 过期时释放库存并更新订单状态。
- 确认邮件只能在订单真正确认后发送。

### 4. 客户可把终态订单改回取消申请

当前持有订单 token 的请求可以无条件把任意状态写为 `cancellation_requested`，导致退款/取消/过期订单重新占库存。

完成要求：

- 实现前列出建议的取消申请状态转换表，由用户确认哪些已付款状态允许旅客申请取消。
- 按确认结果建立服务端订单状态转换规则。
- 取消申请只允许从业务认可的状态进入，至少禁止 refunded、cancelled、expired、pending_payment 回退。
- 使用带当前状态条件的原子 UPDATE。
- 重复提交必须幂等，并返回稳定结果。

## 验收测试

至少覆盖：

- 同主体重复 hold 被拒绝或复用，不会持续占满库存。
- Stripe Session 创建失败后 hold 被释放。
- 部分退款、累计全额退款、重复退款 webhook。
- `charge.refunded` 与 `refund.updated` 使用正确对象类型。
- 即时支付成功、异步支付成功、异步支付失败、Session 过期。
- refunded/cancelled/expired 订单不能转回 `cancellation_requested`。
- 并发确认、退款和取消请求不会造成负库存或双重释放。

执行并记录：

```text
npm run typecheck
npm run lint
npm run build
与本任务对应的单元/集成测试
```

不得用真实 Stripe live 或生产数据库作为验收条件。

## 完成定义

- 四项问题均有自动化回归测试。
- 库存计算只统计明确占位状态。
- 订单、支付、退款和 hold 状态之间不存在已知矛盾。
- 错误路径不会遗留无主 active hold。

