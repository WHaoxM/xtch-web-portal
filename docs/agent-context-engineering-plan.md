# Agent Context Engineering Plan

本文件是本项目的 Agent 上下文工程架构说明。它面向当前 Agent、新 Agent 和用户本人，用来解释上下文系统如何分层、如何协作、如何沉淀经验。

它不替代 `AGENTS.md`、`docs/agent-context.md` 或 `docs/agent-workflows.md`。这些文件已经承担具体规则、项目地图和任务流程；本文负责说明它们如何组成一个可维护的协作系统。

## 1. 目的

上下文工程不是写一个更长的提示词，也不是把所有资料塞进 `AGENTS.md`。它是一套协作协议：

- Agent 开工前知道先读什么。
- 新 Agent 接手时知道前面做到了哪里。
- 多个 Agent 并行时知道谁负责哪些文件。
- 高风险决策知道何时必须让用户确认。
- 重复错误能被沉淀成长期规则。
- 稳定验证能逐步变成自动化检查。

目标是减少重复解释，控制上下文污染，降低误改和编造风险，让项目经验能随着真实协作逐步积累。

## 2. 核心原则

- `AGENTS.md` 保持短，只放每次都必须加载的高优先级规则。
- 上下文按需读取，任务需要什么就读什么，不一次性加载全部文档。
- 仓库代码、项目文档和配置优先于聊天记忆。
- 区分规则、地图、流程、状态、验证和参考资料。
- 能用脚本、命令或检查自动执行的，不只依赖 Agent 记住。
- 外部优秀案例只作为参考和分析对象，不复制原文到本项目。

这些原则吸收了 `awesome-claude-md` 的内容质量筛选思路，以及 `awesome-claude-code` 对命令、工作流、hooks、skills 和安全边界的分类方式。

## 3. 分层架构

| 层 | 文件 | 作用 | 不放什么 |
|---|---|---|---|
| 常驻规则层 | `AGENTS.md` | 每个 Agent 开工都必须遵守的最小行为规则 | 详细业务知识、长流程、临时状态 |
| 项目地图层 | `docs/agent-context.md` | 技术栈、目录、入口、命令、关键文档索引 | 完整页面说明、长篇规范 |
| 任务流程层 | `docs/agent-workflows.md` | 常见任务的最小工作路线 | 单次任务状态、临时讨论 |
| 进度交接层 | `docs/agent-progress.md` | 当前或最近任务的交接状态 | 流水账、长期规则 |
| 多 Agent 协作层 | `docs/agent-task-board.md` | Agent 分工、文件 owner、阻塞请求 | 项目知识库、任务细节长文 |
| 人工门禁层 | `docs/agent-manual-gates.md` | 必须用户确认的决策类型 | 普通执行步骤 |
| 规则维护层 | `docs/agent-rule-maintenance.md` | 错误如何转化为长期规则 | 未验证猜测、一次性偏好 |
| 验证层 | `docs/agent-verification.md` | 不同改动对应的验证清单和未来自动化路线 | 业务事实解释 |
| 外部参考层 | `docs/agent-references.md` | 外部仓库、文章、工具的可吸收模式 | 复制来的长文或未评估资源 |
| 易忘事项层 | `docs/agent-gotchas.md` | 小但高频、容易忘、会导致返工的项目陷阱 | 普通代码结构 |
| 路径局部规则 | 子目录 `AGENTS.md` | 某个目录下反复出现的特殊规则 | 根目录通用规则 |

当前已经存在的文件：

- `AGENTS.md`
- `docs/agent-context.md`
- `docs/agent-workflows.md`
- `CONTEXT.md`
- `docs/content-resource-map.md`
- `docs/mobile-ios-front-end-context.md`

后续文件应按需要逐步创建，不要一次性制造一套空文档。

## 4. 操作协议

### 4.1 进度交接

`docs/agent-progress.md` 用来解决新 Agent 接手不知道进度的问题。它只在四个触发点更新：

1. 开始任务前。
2. 完成一个可交付阶段后。
3. 被阻塞时。
4. 结束、中断或切换任务前。

推荐字段：

```md
# Agent Progress

## Current Goal
## Last Updated
## Read Context
## Changed Files
## Verified
## Not Verified
## Open Risks
## Next Step
```

不记录“我正在读文件”这类流水账，只记录下一个 Agent 接手必须知道的信息。

### 4.2 多 Agent 协作

`docs/agent-task-board.md` 用来解决多个 Agent 同时工作时互相踩文件的问题。

基本规则：

- 开工前登记 `Owns`、`May Touch`、`Must Not Touch`。
- 未声明负责的文件不得修改。
- 共享文件必须有 owner。
- 需要改未负责文件时，先写 `Blocking Request`。
- 默认当前主 Agent 是 Coordinator。

推荐结构：

```md
# Agent Task Board

## Active Agents
| Agent | Goal | Owns | May Touch | Must Not Touch | Status | Last Update |

## Shared Files
| File | Owner | Rule |

## Blocking Requests
| From | Needs | Reason | Proposed Change | Status |
```

建议优先纳入共享文件的对象：

- `app/src/index.css`
- `app/src/App.tsx`
- `app/src/components/Navbar.tsx`
- `app/src/components/Footer.tsx`
- `app/src/lib/siteData.ts`
- `CONTEXT.md`
- `docs/content-resource-map.md`

### 4.3 Coordinator

Coordinator 默认是当前主 Agent。它负责整体一致性，不一定负责最多代码。

Coordinator 负责：

- 维护任务板分工。
- 分配文件 owner。
- 审批跨范围修改。
- 合并各 Agent 的进度。
- 决定最终验证清单。
- 给用户最终汇报。

子 Agent 可以更新自己的状态、备注和阻塞请求，但不应擅自改分工规则、共享文件 owner 或审批状态。

### 4.4 人工确认门禁

以下情况必须用户确认：

1. 产品方向变化。
2. 审美方向变化。
3. 新依赖、新框架或新服务。
4. 架构或长期维护成本变化。
5. 内容事实来源不明确。
6. 影响真实用户或真实业务的操作。
7. 跨 Agent 负责范围的修改审批。

Agent 可以自行处理低风险执行细节，例如读取相关文件、做最小实现、清理本次改动引入的 unused 代码、运行验证命令、更新进度记录。

## 5. 上下文准入和规则维护

不是所有经验都应该进入长期上下文。长期上下文只记录会重复影响未来判断的内容。

可以沉淀：

- Agent 反复犯的错误。
- 项目特殊规则。
- 用户长期稳定偏好。
- 内容事实和证据边界。
- 常见任务流程。
- 协作机制。

不沉淀：

- 某次任务的临时目标。
- 某次页面的中间方案。
- 已经过期的调试过程。
- 一次性审美意见。
- Agent 自己的猜测。
- 代码里一眼能看出来的事实。

### 5.1 轻量评分

规则进入长期上下文前，按以下维度快速判断：

| 维度 | 问题 | 建议 |
|---|---|---|
| 重复影响 | 这件事是否会在未来任务里反复影响判断？ | 不会重复就不沉淀 |
| 具体性 | 规则是否能指导明确行动？ | 抽象口号要改写 |
| 证据 | 是否来自仓库、文档、用户确认或权威资料？ | 猜测不能入库 |
| 可验证 | Agent 能否检查自己是否遵守？ | 不可验证就弱化为提醒 |
| 维护成本 | 未来变化时是否容易失效？ | 高波动信息只放引用 |

### 5.2 规则路由

| 规则类型 | 放到哪里 |
|---|---|
| 每次任务都必须遵守 | `AGENTS.md` |
| 项目入口、命令、目录、文档地图 | `docs/agent-context.md` |
| 某类任务怎么做 | `docs/agent-workflows.md` |
| 当前任务交接状态 | `docs/agent-progress.md` |
| 多 Agent 分工和阻塞 | `docs/agent-task-board.md` |
| 必须用户确认的决策 | `docs/agent-manual-gates.md` |
| 规则沉淀流程 | `docs/agent-rule-maintenance.md` |
| 验证方式和检查矩阵 | `docs/agent-verification.md` |
| 内容、图片、路线来源 | `docs/content-resource-map.md` |
| 移动端 China Trips 规则 | `docs/mobile-ios-front-end-context.md` |
| 业务语言和产品边界 | `CONTEXT.md` |

每次用户纠正 Agent 后，不只修当前错误，还要判断是否需要把纠正沉淀到对应文档。

## 6. 外部参考策略

外部仓库用于学习机制，不用于复制内容。

初始参考源：

| 名称 | 类型 | 链接 | 可吸收内容 |
|---|---|---|---|
| `awesome-claude-md` | CLAUDE.md 案例库 | <https://github.com/josix/awesome-claude-md> | 内容质量评分、案例分析、归因、精选而非堆砌 |
| `awesome-claude-code` | Claude Code 生态索引 | <https://github.com/hesreallyhim/awesome-claude-code> | 资源分类、commands/workflows/hooks/skills、风险评估、源数据与生成物分离 |
| Codex AGENTS guide | 官方说明 | <https://developers.openai.com/codex/guides/agents-md> | Codex 对 `AGENTS.md` 的加载和使用方式 |
| `agents.md` | 跨工具约定 | <https://agents.md/> | 面向 coding agents 的项目说明约定 |

未来 `docs/agent-references.md` 可以使用这个表结构：

| Name | Category | Link | Useful Pattern | Risk | Status | Last Checked |
|---|---|---|---|---|---|---|

吸收外部案例时，只写：

- 来源。
- 适用场景。
- 可吸收机制。
- 不适合照搬的部分。
- 是否已经采纳。

不要把外部 `CLAUDE.md`、命令、hooks 或工作流原文复制到本项目。

## 7. 验证和自动化路线

先文档化验证，再把稳定检查脚本化。

第一阶段保留为清单：

- 文案改动：检查受影响页面显示和内容来源。
- TS/TSX 逻辑改动：运行 `npm run build`。
- 组件、hooks、路由、共享工具改动：运行 `npm run build` 和 `npm run lint`。
- 视觉改动：检查桌面和移动端布局。
- `ChinaTripsMobile`：验证 320px、375px、390px。
- 路由或导航改动：检查 hash 路由、刷新、跳转和返回顶部。
- 内容、图片、路线改动：检查 `docs/content-resource-map.md` 的来源边界。

第二阶段再考虑自动化：

- 构建检查。
- lint 检查。
- 横向溢出检查。
- 移动端宽度检查。
- 关键页面截图检查。
- 路由链接检查。

Claude Code 的 hooks、`/memory`、`.claude/rules`、slash commands 可以作为设计参考；只有当前工具明确支持时，才把它们变成执行机制。对 Codex，优先使用 `AGENTS.md`、子目录 `AGENTS.md`、docs 路由和可运行验证命令。

## 8. 采纳路线

### Phase 1: 基础闭环

创建或完善：

- `docs/agent-progress.md`
- `docs/agent-task-board.md`
- `docs/agent-manual-gates.md`
- `docs/agent-rule-maintenance.md`

目标：解决接手、并行、确认和规则沉淀。

### Phase 2: 治理补全

创建或完善：

- `docs/agent-verification.md`
- `docs/agent-references.md`
- `docs/agent-gotchas.md`

目标：让验证、外部学习和易忘事项有稳定位置。

### Phase 3: 路径局部规则

只在反复出现路径级错误时新增子目录 `AGENTS.md`。

优先候选：

- `app/AGENTS.md`
- `app/api/AGENTS.md`
- `app/src/components/AGENTS.md`

不要因为“看起来完整”就创建空规则文件。

### Phase 4: 自动化

把重复、稳定、低歧义的验证动作脚本化。优先自动化那些失败后成本高、但检查方式明确的事项。

## 9. 文章笔记

可作为后续文章主线：

> 上下文工程不是喂资料，而是设计协作协议。

可复用观点：

- `AGENTS.md` 是启动规则，不是知识库。
- 上下文地图告诉 Agent 去哪里找证据。
- 进度文件让新 Agent 接手不断片。
- 任务板让多 Agent 协作不互相踩。
- 规则维护把重复错误变成系统记忆。

一个更完整的表达：

> AGENTS.md 解决“每次开工先遵守什么”，docs 解决“需要时去哪查”，progress 解决“新 Agent 怎么接手”，task board 解决“多 Agent 怎么不互相踩”，rule maintenance 解决“同类错误怎么不再犯”。

## 10. 当前边界

本文是架构计划。当前项目已经创建基础骨架：

- `docs/agent-progress.md`
- `docs/agent-task-board.md`
- `docs/agent-manual-gates.md`
- `docs/agent-rule-maintenance.md`
- `docs/agent-verification.md`
- `docs/agent-references.md`
- `docs/agent-gotchas.md`

这些文件目前是可维护骨架，不代表流程已经完全成熟。后续应通过真实任务检验字段是否必要、规则是否过重、是否有新的重复错误需要沉淀。
