# 子代理角色：发行工程

> 发放要求：必须同时提供本目录 `README.md`。本任务不授权部署、访问真实生产数据、修改真实 env、推送代码或删除来源不明的文件。跨出 `Owns` 前必须提交 Blocking Request。

## 任务目标

建立可追溯、可重复、最小化的 V1 发行流程。该角色最后收口，不负责替其他角色修业务代码，也不执行真实部署。

## 文件边界

**Owns**

- `package.json`
- `app/package.json`
- `app/package-lock.json`
- `.gitignore`
- 新增的发行脚本、manifest 生成和校验测试
- 发行流程文档

**May Touch**

- `app/scripts/serve-selfhost.mjs`：仅在角色 2 完成且协调代理在任务板明确阶段性移交后，接入发行 manifest 校验
- `app/scripts/generate-sitemap.mjs`：仅可重复构建接口；需 SEO 代理批准
- `deploy/**`：只读核对，修改交给基础设施代理

**Must Not Touch**

- 订单、支付、前端交互、内容事实
- 真实 env、数据库、对象存储、DNS 和公网服务
- 直接删除不确定来源的用户文件

## 启动门禁

本角色不得与业务修复并行收口。开始前必须由协调代理提供：

- 其他五个角色的完成与验证报告。
- 已冻结且干净的候选 commit SHA。
- 发行 target。
- 用户确认的可信 npm registry。

缺任一项时只做只读分析，不生成 release candidate。

## 必修问题

### 1. 工作树不可追溯且存在异常路径

当前同时出现正常斜杠和反斜杠形式的文档路径，并有未提交改动。跨 Windows/Linux 打包可能产生重复或错误目录，发行物也无法对应唯一 commit。

完成要求：

- 先列出所有异常反斜杠路径及其内容差异，交用户确认后再删除或合并；不得自行覆盖。
- 构建 release candidate 前强制检查 `git status --porcelain` 为空。
- 发行只允许从唯一 commit/tag 构建。
- 脚本在 Windows 和 Linux 上使用 Node path API，不拼接平台相关反斜杠文件名。

### 2. 陈旧静态包仍能通过启动校验

现存 `app/dist/win11-home` 带合法 target marker，但仍包含旧域名和旧 hash 路由。当前启动校验只验证 target 名称和 bypass token。

完成要求：

- 禁止复用仓库中已有 dist；发行候选必须清空目标目录后重新构建。
- manifest 至少包含 commit SHA、target、UTC 构建时间、Node/npm 版本、canonical origin、关键 env 非敏感指纹和文件校验和。
- `deploy:serve` 拒绝 commit/target/canonical 与当前发行声明不一致的包。
- manifest 不得写入密钥或完整连接串。

### 3. 依赖安装和供应链不可重复

部署文档使用 `npm install`；lockfile 混用多个 registry；本轮 `npm audit` 因命令环境异常尚无结果。

完成要求：

- CI/发行使用 `npm ci`。
- 明确并统一可信 registry，重新生成并审查 lockfile；不得手工改 integrity。
- 固定并记录 Node/npm 主版本。
- 保存 `npm audit` 和 `npm audit --omit=dev` 结果。
- high/critical 生产漏洞必须修复或由用户书面接受风险。

### 4. 发行包边界过宽

当前生产运行依赖完整仓库、TypeScript 源码和 devDependency `tsx`。

完成要求：

- 定义最小发行 artifact：目标静态目录、编译后的服务端代码、生产依赖、迁移、必要配置示例和 manifest。
- 排除 docs、原始素材、本地数据、测试输出、agent 文件和真实 env。
- artifact 应可在干净目录验证校验和并启动，不依赖开发机全仓路径。
- 若本轮无法完成服务端编译拆包，必须给出明确的 V1 临时边界和后续迁移计划，不能假装已最小化。

## 验收

- 干净 clone 上 `npm ci` 后可完成所有验证和目标构建。
- 脏工作树、错误 target、错误 canonical、旧 commit manifest 均被拒绝。
- 同一 commit 和同一输入生成内容稳定的 artifact；时间戳差异必须局限在 manifest 明确字段。
- artifact 解包后无 `.git`、真实 `.env`、原始数据、agent 文档或旧 dist。
- 校验和验证失败时拒绝启动。
- 记录 `npm audit` 结果及处置。

执行并记录：

```text
npm ci
npm run typecheck
npm run lint
npm run build
npm run build:cloud-vps
npm audit
npm audit --omit=dev
发行 manifest 与 artifact 校验测试
```

## 完成定义

- V1 候选包可映射到唯一 commit/tag。
- 不再接受旧域名、旧路由或错误 target 的陈旧 dist。
- 发行流程在干净环境可重复，并有完整命令记录。
- 未执行真实部署。

