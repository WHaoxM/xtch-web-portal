# Agent Context

给当前 Agent 和新 Agent 快速接手项目使用。这里是上下文索引，不替代源码和专门文档。

## 项目事实

- 项目是 React + TypeScript + Vite 单页应用。
- 实际应用目录是 `app/`，npm 命令在 `app/` 下执行。
- 路由入口是 `app/src/main.tsx`，使用 `HashRouter`。
- 页面路由集中在 `app/src/App.tsx`。
- 页面在 `app/src/pages/`，共享组件在 `app/src/components/`。
- UI 基础组件在 `app/src/components/ui/`。
- 样式主要是 Tailwind CSS + `app/src/index.css`。
- `@/*` 指向 `app/src/*`。
- 本地开发端口默认是 `3000`，见 `app/vite.config.ts`。

## 必读入口

- Agent 行为规则：`AGENTS.md`
- 业务语言和产品边界：`CONTEXT.md`
- Agent 上下文工程总架构：`docs/agent-context-engineering-plan.md`
- 内容、图片、路线、TOCN/Syncing 资源边界：`docs/content-resource-map.md`
- 移动端 China Trips 设计边界：`docs/mobile-ios-front-end-context.md`
- 旅行数据处理说明：`docs/travel-data-pipeline.md`
- 架构或关键决策记录：`docs/adr/`

## Agent 协作入口

- 当前任务交接：`docs/agent-progress.md`
- 多 Agent 分工和阻塞：`docs/agent-task-board.md`
- 必须用户确认的门禁：`docs/agent-manual-gates.md`
- 重复错误和规则沉淀：`docs/agent-rule-maintenance.md`
- 验证矩阵和自动化候选：`docs/agent-verification.md`
- 外部参考和吸收标准：`docs/agent-references.md`
- 高频易忘事项：`docs/agent-gotchas.md`

## 内容来源优先级

改页面内容、图片、视频、路线数据或页面结构前，先看 `docs/content-resource-map.md`。

快速判断：

- 路线事实优先来自 `路线/`、`路线_新/` 和已整理的结构化数据。
- Syncing 自有品牌、图片、联系信息优先来自 `本站/` 和官方 Syncing 站点。
- `目标站/` 只作为结构、节奏、交互和信息层级参考。
- 没有依据时，不创建假数据、假评论、假团队成员或假客户声称。

## 常用命令

仓库根或 `app/` 均可（根 `package.json` 转发到 `app/`）：

```bash
npm run dev
npm run build
npm run lint
npm run preview
npm run deploy:serve -- --target win11-home
```

- `npm run dev`：先释放占用 `3000` 的旧进程，再启动 Vite；本地 URL 固定为 `http://127.0.0.1:3000`。
- `npm run dev:keep`：不杀旧进程，直接启动（仅在你明确要保留现有监听时用）。
- 已有健康的 `3000` 服务时优先复用，不要再开第二个。
- 依赖安装仍在 `app/`：`cd app && npm install`。

## 环境与部署入口

- **环境分层总览**（四层：`local` / `tunnel` / `win11-home` / `cloud-vps`；两套生产；`selfhost` 仅为 win11-home 旧别名）：`docs/ops/README.md`
- 配置真相源：`env/<target>/.env`（说明见 `env/README.md`、`app/ENV.md`）
- 切公网 DNS / 各 target 运维清单：`docs/ops/win11-home.md`、`docs/ops/cloud-vps.md`
- 边缘资产：`deploy/win11-home/`、`deploy/cloud-vps/`

## 验证原则

- 文案或小样式：检查受影响页面显示。
- TS/TSX 逻辑改动：运行 `npm run build`。
- 组件、hooks、路由、共享工具改动：运行 `npm run build` 和 `npm run lint`。
- 视觉改动：检查桌面和移动端布局。
- `ChinaTripsMobile` 改动：验证 320px、375px、390px 宽度。
