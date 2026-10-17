# IM 客服来源范围

## 目的与默认值

迁移 `023_im_staff_source_scope` 为客服账号增加可选 `source_scope_enforced`，并为 IM 权限增加 `scope_type='source'` / `scope_source`。新列默认关闭，因此未显式启用范围约束的现有客服账号继续使用原来的全局、租户及会话成员权限。

启用后，账号对会话的每项操作都必须有该会话 `source` 对应的未撤销授权；全局权限、租户权限、超级管理员身份或既有会话成员关系都不能跨过来源边界。来源受限账号也不能调用客服账号/权限管理接口，即使账号仍有 `super_admin` 身份或旧的全局 `im:staff:manage` 权限；如需调整其授权或关闭 enforcement，必须由另一位未启用来源限制且有管理权限的管理员操作。允许使用的会话来源来自服务端白名单：`portal_web`、`portal_mobile`、`xt_mvp_mobile`、`wenshuzhilv`。不同操作分别检查其权限码：

- 查看会话/消息/附件：`im:conversation:read`
- 认领、接手、转交：对应 `im:assignment:claim`、`im:assignment:takeover`、`im:assignment:transfer`
- 发送文字或附件：`im:message:send`
- 关闭、重开或更新状态：`im:conversation:close`

来源授权保存在数据库中，并在每次客服 API 请求中读取；修改授权或禁用账号对后续请求即时生效。来源范围账号的权限判断忽略超级管理员身份及旧 JWT 中的全局/租户权限；认证会剥离既有 token 里的这类 claims，新签发 token 也不包含全局权限或租户范围，只凭当前数据库加载的来源权限代码进入 ACL，再按会话精确来源复核。启用来源范围的账号只可通过 HTTP 工作台轮询，队列约每 4 秒刷新、会话消息约每 2.5 秒刷新，不加入 Socket.IO 房间。旧账号未启用来源限制时保留原有实时行为。

客服 access token 当前有效期为 10 分钟，refresh token 最长 30 天。来源权限和 enforcement 标记在每次请求查当前数据库状态，因此来源撤销/缩小无需等 access token 过期；refresh token 只负责续发会话，不会把来源权限提升为全局权限。未启用来源限制的旧账号全局/租户 JWT claims 仍沿用原有生命周期；来源受限账号即使持有启用前签发的旧 access token，也会在服务端认证时剥离这些 claims。账号 `disabled`/`suspended` 会在请求级数据库检查中立即拒绝，即使客户端仍持有未过期的 access token。

## Admin quick-login SSO（显式 opt-in）

`POST /api/im/auth/exchange` 接受现有管理端 `aq1.` 快捷登录 bearer token，并复用 `/api/admin/*` 的签名、到期、当前配置邮箱和 admin allowlist 验证。随后只查找精确预配置的 IM 映射：`external_provider='admin_quick'`、`external_subject` 等于规范化后的 quick-login 邮箱、`status='active'`、`account_type='staff'`、`source_scope_enforced=true`。签发前还会再次读取并验证这些 live 字段；如账号停用、映射变更或来源限制关闭，exchange 拒绝。无匹配时返回拒绝，不创建账号、不自动写权限，也不按 admin tech/ops 角色映射 IM 权限。来源权限必须由获准的客服管理员单独预配置，例如只授予 `wenshuzhilv` 的来源读取/发送/认领权限。

该 SSO 只返回 10 分钟 IM access token，不返回 refresh token，也不插入 `im_staff_sessions` 行；工作台遇到 access token 401 后使用原管理端 `aq1.` token 重新 exchange。`aq1.` 本身仍按现有 admin quick-login 机制有效（默认最长 12 小时），并受当前 allowlist/配置邮箱校验；它不是 IM refresh token。损坏/过期的 `aq1.` 会留在 admin exchange 分支并 fail closed，不会被当成 XT_MVP token 尝试。此路径的审计记录只写 reason、账号 ID（若已匹配）、IP/UA hash，不写 bearer/access/refresh token 或邮箱。现有 XT_MVP exchange 和本地客服账号密码登录保持各自原有路径。

此实现不创建、不启用、不授权任何生产账号。若以后业务方选择此方案，应先确认发布及迁移 023，再由获授权管理员通过客服管理流程建立来源 grants 并启用来源 enforcement，最后由另一位未受来源限制的管理员通过受控账号管理流程完成 `admin_quick` ↔ 完全匹配邮箱的显式绑定。不得通过管理员角色、allowlist 或快速登录请求自动创建/授权 IM 账号。若决定撤销该身份入口，应删除显式映射或将 IM 账号设为 `disabled`；不要仅关闭 enforcement 来撤销身份，因为这会改变旧账号权限语义。已签发的 IM access token 本身最长 10 分钟，管理 `aq1.` token 则直到其到期、配置邮箱/allowlist 变化或密码轮换才无法再次 exchange。

## 启用流程（变更发布后）

本次代码变更不会创建、启用或授予任何生产账号。待业务方选择身份方案并由管理员确认具体账号后：

1. 先完成数据库备份，再运行应用迁移；检查 `im_staff_accounts.source_scope_enforced` 默认值为 `false`，权限表支持 `scope_source`。
2. 通过受控的客服权限管理接口，先给经确认的账号授予精确来源授权。来源范围必须使用小写白名单值，例如 `wenshuzhilv`；来源授权不能省略动作权限码。
3. 至少授予一个来源范围的 `im:conversation:read` 后，由另一位未启用来源限制且有 `im:staff:manage` 权限的管理员调用客服权限管理接口的 `set-source-scope` 操作启用该账号。该步骤会写审计事件；启用前若没有来源读取授权，服务端返回冲突且不修改账号。来源限制一旦启用，目标账号不能再自行关闭 enforcement。
4. 通过客服工作台验证：账号只看到授权来源；在授权来源内，按已授予权限验证查看、认领、发送、附件访问、状态变更；从另一个来源的会话 URL/API 发起同样操作应返回拒绝或不可见。
5. 撤销单项来源权限或将账号设为 `disabled`/`suspended` 后，立即重复越权请求；应失败。确认来源范围账号走轮询而非 websocket。

权限接口只接受明确的 `global`、`tenant`、`source` 范围；未知范围会返回 400，不会隐式退化为全局授权。来源字段会 trim 并转为小写后严格匹配白名单。

`source` 范围只接受上述会话读、分配、发送和关闭权限码；例如 `im:staff:manage` 不能通过来源授权获得。服务端动态权限装载也会重复过滤此 allowlist，避免直接写入异常来源权限时被提升。

## 实时与附件撤权边界

来源范围客服不加入消息 websocket；4 秒队列和 2.5 秒会话轮询是当前实时更新机制。已连接的旧客服 socket 在每条 outbox 事件发出前按数据库当前账号状态/范围/读权限重新授权；访客 socket 同样会校验会话未撤销、未过期且身份仍绑定该会话。授权查询失败时该条事件不发送并按 outbox 退避重试。

附件下载采用短时签名 URL。新签发请求会先检查当前来源读取授权，但已签发的 URL 不是在线代理：在 URL 过期前无法即时撤销，默认有效期约 5 分钟。因此撤权会即时阻止新附件链接签发，但已经拿到链接的人仍可能在其剩余有效期内访问该对象；必要时应同时暂停账号/隔离对象或等待短签名到期。私有桶匿名拒绝仍是对象级门禁。

## 回滚与恢复

- 优先做代码回滚，保留迁移 023 的向后兼容 schema。旧版本不理解来源范围，绝不能在仍有 `source_scope_enforced=true` 的活跃账号时运行，否则会丢失来源隔离。
- 回滚代码前，将所有来源限制账号设为 `disabled`/`suspended` 并保持禁用，直到支持来源授权的新代码恢复。不要只撤销 refresh session：access token 是最长 10 分钟的无状态 JWT，身份请求检查账号状态而不查询 session 撤销记录。也不要在旧代码运行期间重新启用来源客服。
- 若业务需要把某账号恢复为旧式广范围客服，只能由管理员明确接受恢复旧授权语义后，在支持来源模式的新代码中关闭 enforcement，并复核其原有 global/tenant grants；这不是回滚期间的应急方式。
- 不建议自动反向删除迁移。若确需删列/索引，必须先备份并确认没有来源授权、所有 enforcement 都为 false；清理来源授权后，再由 DBA 单独移除新增索引、约束与列。已应用的迁移记录也应由迁移流程保持一致。
- 重新启用新代码后，先确认迁移 023 已应用，逐个复核来源授权与账号 enforcement，再恢复账号状态。不要复用前一环境的手工 SQL 或未审核的生产账号映射。
