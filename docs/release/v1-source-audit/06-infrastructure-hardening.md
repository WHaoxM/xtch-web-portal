# 子代理角色：基础设施加固

> 发放要求：必须同时提供本目录 `README.md`。本任务只允许修改仓库配置和文档，不授权连接真实主机、执行防火墙命令、部署、访问真实生产数据、修改真实 env 或推送代码。跨出 `Owns` 前必须提交 Blocking Request。

## 任务目标

修复云主机部署脚本中的默认凭据、权限和监听边界问题，并在 Caddy/systemd 增加适合 V1 的基础防护。不得实际操作生产主机。

## 文件边界

**Owns**

- `docker-compose.yml`
- `deploy/cloud-vps/bootstrap.sh`
- `deploy/cloud-vps/xtch-app.service`
- `deploy/cloud-vps/Caddyfile`
- `deploy/win11-home/Caddyfile`
- 对应 `docs/ops/**`
- 基础设施配置校验脚本或测试

**May Touch**

- `env/cloud-vps/.env.example`
- `env/win11-home/.env.example`

**Must Not Touch**

- `app/api/**`、`app/src/**`、支付和 SEO 业务代码
- `package.json`、`app/package.json` 和 lockfile；校验命令需求交发行工程代理
- 真实 env、真实服务器、防火墙、DNS、数据库和对象存储数据
- 自行选择或启用新的托管服务

## 启动门禁

- Compose、bootstrap 和 systemd 可先独立处理。
- Caddy 请求体和超时部分必须等运行时安全代理正式交付限制值后再修改。
- 所有本地配置验证必须使用隔离测试 env 和虚拟凭据，禁止读取真实 `env/*/.env`。

## 必修问题

### 1. Compose 内置生产默认凭据

当前 Postgres 和 MinIO 使用公开默认密码，初始化容器也重复硬编码 MinIO 凭据。文档依赖人工“启动后再改”，容易遗漏且不可重复。

完成要求：

- 使用 `${VAR:?required}` 一类 fail-fast 变量，不提供生产默认密码。
- Postgres、MinIO 和初始化容器引用同一组变量。
- 示例文件只给占位说明，不给可误用的弱默认值。
- 保持 5432、9000、9001 仅绑定 `127.0.0.1`。
- 给首次初始化和已有 volume 改密分别提供明确步骤，不得假设改 compose 会自动修改旧 volume 密码。

### 2. cloud-vps bootstrap 与 clone 路径权限冲突

bootstrap 把 `xtch` 用户 home 创建为 `/opt/xtch-web-portal`，随后又要求当前普通用户 clone 到同一路径。

完成要求：

- 系统用户 home 与仓库目录职责分离，或提供不会冲突的明确创建、clone、chown 顺序。
- systemd 运行用户必须对代码、dist 和必要运行目录有读权限，对不必要位置无写权限。
- bootstrap 可重复执行，不应因用户已存在或目录已存在而进入不确定状态。
- 文档命令与脚本行为保持一致。

### 3. Node 监听范围与文档不一致

文档描述 Caddy 反代 `127.0.0.1:3080`，但服务默认监听 `0.0.0.0`，systemd 未覆盖。

完成要求：

- cloud-vps systemd 明确设置 `SELFHOST_HOST=127.0.0.1`。
- 3080 不通过安全组或主机防火墙公开。
- 上一条只要求修改配置模板、校验规则和运维文档，不授权实际操作防火墙或安全组。
- 保持 Caddy 为唯一公网入口。

### 4. systemd 缺少基础硬化

完成要求：

- 在不破坏 Node 读取 dist、env 和访问本机 Postgres/MinIO 的前提下评估并加入：
  - `NoNewPrivileges=true`
  - `PrivateTmp=true`
  - 合适的 `ProtectSystem`、`ProtectHome`
  - 明确的 `ReadWritePaths`（如确有写目录）
  - 合理的 restart、启动超时和资源限制
- 每个未启用的 hardening 项需说明兼容性原因。

### 5. Caddy 缺少边缘防护

完成要求：

- 使用运行时安全代理提供的限制值，为 API/webhook 设置请求体上限和合理超时。
- 加入低兼容风险响应头：HSTS、`X-Content-Type-Options`、Referrer Policy、Permissions Policy。
- CSP 必须先根据现有 Supabase、Stripe、Turnstile、图片和 S3 来源建立测试矩阵；未经验证不得直接上线严格 CSP。
- 不得阻断 BrowserRouter 深链、Stripe webhook 或 `/s3` 对象读取。

## 验收

- 缺少 Postgres/MinIO 凭据时 compose 配置阶段即失败。
- `docker compose config` 不显示硬编码默认密码。
- bootstrap 在干净 VPS 模型和重复执行模型下步骤一致。
- systemd 安全分析没有未解释的高风险项，Node 仅监听 loopback。
- Caddy 配置校验通过；API 超限返回预期状态；合法 webhook、静态资源和 `/s3` 不受影响。
- 外网暴露清单仍只有 80/443。

仅使用虚拟凭据和隔离测试 env 执行本地验证：

```text
docker compose config
caddy validate --config deploy/cloud-vps/Caddyfile
systemd-analyze security deploy/cloud-vps/xtch-app.service
ShellCheck 或等效 bootstrap 静态检查
```

如果本机缺少这些工具，必须记录未验证项，不得宣称通过。

## 完成定义

- 不再存在可直接误用的生产默认凭据。
- clone、文件归属和 systemd 用户流程无冲突。
- Node 生产监听边界和文档一致。
- 边缘层与应用层形成双重请求资源限制。
- 未连接或修改真实主机。

