# 主协调验证区

本目录只由主协调代理填写。子代理不得修改。

## 验证文件

收到角色 delivery 后，为该角色建立同名验证文件：

```text
01-booking-payment-integrity.md
02-runtime-api-security.md
03-frontend-critical-flows.md
04-seo-prerender.md
05-release-engineering.md
06-infrastructure-hardening.md
```

## 验证模板

```markdown
# 验证：角色名称

- Delivery:
- Candidate commit:
- Result: pending | pass | fail | blocked

## 边界检查
- 实际 diff：
- 越界修改：
- 未提交/异常文件：

## 独立复验
| Command/check | Exit code | Result |
|---|---:|---|

## 逐项验收
- [ ] 任务要求 1
- [ ] 任务要求 2

## 发现的问题
- 严重级别、文件、复现、影响、退回要求

## 结论
- pass/fail/blocked 及依据
```

## 判定规则

- Delivery 声称通过但无退出码或证据：`blocked`。
- 代码越过角色边界且无批准记录：`fail`。
- 仅 build/lint 通过但缺针对性测试：不能关闭对应审计问题。
- 真实环境才能完成的检查必须保留为 release gate，不得推测通过。
- 验证通过后只更新本目录和最终 `release-readiness.md`，不要改写子代理 delivery。

