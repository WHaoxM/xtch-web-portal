# 交付报告：发行工程

- Task: [`../05-release-engineering.md`](../05-release-engineering.md)
- Status: `ready-for-prerelease`
- Agent: Subagent-5 (release-engineering)
- Started: 2026-07-21
- Finished: 2026-07-21（由协调代理完成收口）
- Candidate: `v1.0.0-rc.1`
- Target: `cloud-vps`

## 协调代理收口（2026-07-21）

- 用户确认 GitHub Pre-release `v1.0.0-rc.1`，目标 `cloud-vps`。
- 用户确认 lockfile 统一使用官方 `https://registry.npmjs.org`；`npm ci` 成功。
- `npm audit` 与 `npm audit --omit=dev` 均为 0。
- typecheck、lint、75 项隔离测试、14 项本地数据库集成测试通过。
- 基础设施校验 9 pass、2 个 Linux-only 检查跳过。
- `build:cloud-vps` 成功，SEO 预渲染 45/45。
- GitHub 自动 source archive 由 tag 生成；本次不附加自定义二进制 artifact。
- 本报告后续“blocked”内容保留为收口前的历史摸底，不再代表当前状态。

## 启动门禁证据

- 其他角色验证报告：
  - 01：`ready-for-validation`（有交付正文）
  - 02：`ready-for-validation`（有交付正文；代码仍在脏工作树未提交）
  - 03：`incomplete`（交付模板未填；progress 称已完成）
  - 04：`incomplete`（交付模板未填；progress 称已完成）
  - 06：任务板 `working`；delivery 仍 `incomplete`（进行中）
  - `release-readiness.md`：overall `not-ready`；05 标为 `blocked-by-01-04-06`
- 干净工作树：否。`git status --porcelain` 共 16 行（2026-07-21 扫描），包括：
  - 已修改：`app/public/sitemap.xml`、`app/scripts/seo-public-route-manifest.json`、`app/scripts/serve-selfhost.mjs`、`app/tsconfig.node.json`、`app/vite.config.ts`、`docs/agent-progress.md`、`docs/agent-task-board.md`、`docs/release/v1-source-audit/deliveries/02-runtime-api-security.md`、`scripts/db/migrate.ts`
  - 未跟踪：`app/scripts/httpRoutePolicy.{ts,test.ts}`、`app/scripts/requestBodyLimits.{ts,test.ts}`、`scripts/env/validateTargetEnv.{ts,test.ts}`、`docs/problem/`
- 用户确认的 npm registry：未提供。当前 lockfile 混用 `registry.npmjs.org`（512）与 `registry.npmmirror.com`（120）。
- `serve-selfhost.mjs` 阶段性移交：任务板**未**记录向角色 5 移交；本角色未修改该文件。

**门禁结论：缺项齐全前只做只读分析，不生成 release candidate，不改 package.json / lockfile。**

## 修改文件

- 无代码/脚本修改。
- 协作文档：`docs/agent-task-board.md`、`docs/agent-progress.md`、本交付文件。
- 临时只读扫描脚本（未提交）：`tmp/role5-readonly-scan.mjs`

## 问题与修复

### 异常反斜杠路径

- `git ls-files`：523 个跟踪文件中，**字面量 `\` 文件名 = 0**。
- 工具/PowerShell 显示的 `docs\...` 是 Windows 路径分隔符，不是仓库内重复实体。
- 需用户确认是否纳入发行边界（非反斜杠问题，但是异常/非应用路径）：
  - `docs/政策/拼团预订须知及安全提示.docx`
  - `logo/原图.png`
- **未自行删除或合并任何文件。**

### 陈旧 dist 与 manifest

- `app/dist/{local,win11-home,cloud-vps}` 均有合法 `.xtch-build-target`。
- 抽查 `app/dist/win11-home/index.html`：canonical / og:url 仍为 `https://www.syncingtravel.com/`（旧域名），符合任务书「陈旧包仍能通过仅 target+bypass 校验」。
- 当前 `assertDistSafeForPublicDeploy`：只校验 marker 与 `dev-bypass-token`；**不**校验 commit SHA、canonical origin、文件 checksum。
- 修复计划（门禁通过后）：清空目标 dist → 从冻结 SHA 重建 → 写入发行 manifest → serve 拒绝不一致包。

### `npm ci`、lockfile 和 audit

- 部署文档仍用 `npm install`：`docs/ops/cloud-vps.md`、`deploy/cloud-vps/bootstrap.sh`（文档/ bootstrap 属角色 6 Owns；角色 5 负责 scripts 与 lockfile 统一）。
- lockfile 双 registry（见上）；无 `.npmrc`；无 `engines` / `packageManager`。
- 本机：Node `v24.18.0`，npm `11.16.0`。
- **`npm ci` / `npm audit` / `npm audit --omit=dev` 本轮未执行**（避免在脏树/未确认 registry 下制造不可追溯结果）。

### 最小发行 artifact

- 尚未定义/打包。V1 临时边界草案（待协调代理确认后再实现）：
  - 包含：`app/dist/<target>/`（本 commit 新构建）、生产依赖安装结果、迁移脚本、env example、发行 manifest。
  - 排除：`.git`、真实 `.env`、`docs/` agent 材料、原始素材、旧 dist、测试输出。
  - 若本轮无法完成服务端编译拆包：在交付中明确「仍依赖仓库内 TypeScript + tsx 运行 serve」为 V1 临时边界，并写后续迁移计划——**不假装已最小化**。

## Artifact

- 路径：未生成
- Manifest：未生成
- SHA/checksum：未生成
- 包含内容：n/a
- 明确排除内容：n/a

## 验证命令

| Working directory | Command | Exit code | Result |
|---|---|---:|---|
| repo root | `git status --porcelain` | 0 | 16 dirty lines；非空 |
| repo root | `git rev-parse HEAD` | 0 | `4deaf48b199bbc9fc0903f67497d591a769a3761`（**非**冻结候选） |
| repo root | `node tmp/role5-readonly-scan.mjs` | 0 | lockfile 双 registry；无字面量 `\` 路径；三份 dist marker 存在 |
| app/ | `npm ci` | — | 未执行（门禁） |
| app/ | `npm run typecheck` / `lint` / `build` / `build:cloud-vps` | — | 未执行（门禁） |
| app/ | `npm audit` / `npm audit --omit=dev` | — | 未执行（门禁） |

## 未验证项与剩余风险

- 角色 3/4 交付正文缺失 → 协调代理无法独立复核 → 角色 5 收口无上游冻结点。
- 角色 6 未交付 → `npm install`→`npm ci` 运维文档与 bootstrap 未对齐。
- 未确认 registry 前重写 lockfile 会引入供应链不可重复风险。
- 未移交 `serve-selfhost.mjs` 前无法接入 manifest 校验（否则越界）。
- 脏树含角色 2 安全修复；若在未提交状态下构建，发行物无法映射唯一 commit。

## 边界声明

- [x] 未部署或推送
- [x] 未访问真实生产数据
- [x] 未修改真实 env/密钥
- [x] 未删除未经用户确认的异常文件
- [x] 未越过文件边界；或已记录获批的阶段性移交（未移交，未改 `serve-selfhost.mjs`）

## 解除 blocked 所需（请协调代理 / 用户提供）

1. 角色 03/04 补齐 `deliveries/`；角色 06 完成或协调代理书面说明可与 05 并行收口的例外。
2. 冻结干净工作树 + 候选 commit SHA（或 tag）+ 发行 target（如 `cloud-vps` / `win11-home`）。
3. 用户书面确认唯一可信 npm registry（建议：仅 `https://registry.npmjs.org`）。
4. 任务板记录：`serve-selfhost.mjs` 阶段性移交角色 5（仅 manifest 校验）。
5. 用户确认：`docs/政策/...docx` 与 `logo/原图.png` 保留、移出发行边界或删除。
