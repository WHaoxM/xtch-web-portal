# 子代理交付区

## 使用规则

每个角色只填写自己的文件：

- `01-booking-payment-integrity.md`
- `02-runtime-api-security.md`
- `03-frontend-critical-flows.md`
- `04-seo-prerender.md`
- `05-release-engineering.md`
- `06-infrastructure-hardening.md`

禁止修改其他角色交付、上级任务书、`validation/` 和 `release-readiness.md`。

## 证据要求

- 写实际结果，不写“应该通过”。
- 每条命令记录工作目录、命令、退出码和结果摘要。
- 修改文件必须逐项列出。
- 未执行或失败的验证必须明确标注。
- 大型日志放根 `tmp/`；本文件只链接路径并摘录关键错误。
- 不粘贴密钥、token、完整数据库 URL、个人邮箱或生产数据。
- 交付状态只能是 `ready-for-validation`、`blocked` 或 `incomplete`；只有主协调代理能标记验证通过。

