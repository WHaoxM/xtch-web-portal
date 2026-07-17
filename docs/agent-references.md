# Agent References

本文件记录外部上下文工程参考。外部资源只能作为机制参考，不复制原文到本项目。

## 使用原则

- 只记录对本项目有迁移价值的机制。
- 每条参考必须写清楚风险和适用边界。
- 优先官方资料、成熟开源案例、真实项目实践。
- 资源过期或不再适用时标记为 stale，而不是悄悄删除。

## References

| Name | Category | Link | Useful Pattern | Risk | Status | Last Checked |
|---|---|---|---|---|---|---|
| `awesome-claude-md` | CLAUDE.md 案例库 | <https://github.com/josix/awesome-claude-md> | 内容质量评分、案例分析、归因、精选而非堆砌 | 不能复制外部 `CLAUDE.md` 原文 | active | 2026-06-25 |
| `awesome-claude-code` | Claude Code 生态索引 | <https://github.com/hesreallyhim/awesome-claude-code> | commands/workflows/hooks/skills 分类、风险评估、源数据与生成物分离 | 很多能力是 Claude Code 专属，Codex 不能直接照搬 | active | 2026-06-25 |
| Codex AGENTS guide | 官方文档 | <https://developers.openai.com/codex/guides/agents-md> | Codex 如何读取和使用 `AGENTS.md` | 官方能力会变化，需要定期复查 | active | 2026-06-25 |
| `agents.md` | 跨工具约定 | <https://agents.md/> | 面向 coding agents 的项目说明约定 | 只定义通用约定，不替代具体工具文档 | active | 2026-06-25 |

## Analysis Template

```md
## Reference: <name>

- Category:
- Link:
- What is useful:
- What does not transfer:
- Risk:
- Decision:
- Last checked:
```

## 吸收标准

一条外部经验要进入本项目，至少满足：

- 能解决本项目真实协作问题。
- 能放入现有分层之一。
- 不依赖当前工具不支持的能力。
- 不引入长期维护负担。
- 能用自己的语言重写为规则、流程或检查项。
