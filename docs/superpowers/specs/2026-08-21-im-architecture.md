# 即时通信与多客服协作技术设计（Draft）

- 状态：Draft，待确认后实施
- 日期：2026-08-21
- 读者：xtch-server、mobile、门户前端和运维开发者
- 目标：在不修改 XT_MVP 后端的前提下，建立可恢复、可审计、支持多客服并行接待的 IM 闭环

## 1. 设计结论

采用 **xtch-server 作为 IM 领域系统**，XT_MVP 只作为 B 端身份和角色的外部事实源。

1. XT_MVP 的 JWT secret 不进入 xtch；xtch 通过服务端调用 XT_MVP `/api/v1/auth/me` 完成一次身份交换。
2. 交换成功后，mobile 使用独立的 xtch access/refresh token 访问 IM REST 和 Socket.IO；XT_MVP API 继续使用原有 token。
3. 消息事实只写 PostgreSQL；Socket.IO 只负责通知和补偿触发，不能作为消息存储。
4. 所有写操作先在一个 PostgreSQL 事务中完成：业务事实、消息序号、outbox 事件、审计记录要么全部成功，要么全部回滚。
5. 多客服使用“主接待 + 协作成员”模型；认领、接管、转交都产生不可变审计记录。
6. 第一期单 Node 进程使用 PostgreSQL outbox worker；未来扩容时再引入 Redis adapter，不提前增加分布式依赖。

## 2. 边界与不变约束

### 2.1 系统职责

| 系统 | 负责 | 不负责 |
|---|---|---|
| XT_MVP | B 端用户、外部角色、租户、原有业务 API | 不增加 IM 表、不改现有后端、不签发 xtch token |
| xtch-server | IM 账号、权限、会话、会话/消息事实、outbox、审计、REST、Socket.IO | 不复制 XT_MVP 全量用户表，不直接读 XT_MVP 数据库 |
| 门户官网/移动端 | 创建访客会话、展示气泡、发送/接收客户消息 | 不持有客服 token，不直接连接数据库 |
| XT_MVP mobile | 原有 B 端 API 与业务 token | 不把原有 Suda 实时通道当作 IM 消息通道 |
| xtch mobile client | 客服账号、IM REST、`/im` Socket.IO | 不把 xtch token 发送给 XT_MVP API |

### 2.2 账号模型

不要求每个客服都成为 XT_MVP 后端用户。预置的 XT_MVP `super_admin`（实际角色应按 XT_MVP `/auth/me` 返回值判断，通常为 `platform_admin`）通过 exchange 进入 xtch，然后在 xtch 管理客服账号。

- `super_admin`：唯一能够管理客服账号、权限和全局会话的内部管理员。
- `staff`：xtch 本地客服账号，可用密码/一次性邀请登录；不需要修改 XT_MVP。
- `external_subject`：只有被 XT_MVP 明确交换并映射的账号才可作为外部管理员入口。
- 任何“XT_MVP 返回 platform_admin 就自动成为 xtch super_admin”的逻辑都禁止；必须存在显式映射或一次性 bootstrap 配置。

## 3. 目标拓扑

```mermaid
flowchart LR
  C[门户访客] -->|HTTPS REST| X[xtch-server]
  M[客服 mobile] -->|XT_MVP token| E[/api/im/auth/exchange]
  M -->|xtch token| R[/api/im REST]
  M -->|xtch token| S[Socket.IO /im]
  E -->|server-to-server GET /api/v1/auth/me| V[XT_MVP]
  R --> DB[(PostgreSQL)]
  X --> DB
  DB --> O[im_outbox worker]
  O --> S
  S --> M
  X --> A[im_audit_events]
```

Socket.IO 连接断开后的事实来源仍是 PostgreSQL。客户端保存每个会话的 `last_seen_seq`，重连后按序号 REST 补齐。

## 4. PostgreSQL 数据模型

迁移文件建议：`app/api/migrations/014_im_core.ts`。所有 ID 使用 UUID；时间使用 `TIMESTAMPTZ`；消息正文使用 `TEXT`，扩展字段使用 `JSONB`。第一期不做消息表分区，达到规模阈值后再按月份分区。

### 4.1 客服身份与权限

#### `im_staff_accounts`

| 字段 | 约束/用途 |
|---|---|
| `id` | UUID PK，xtch 内部 subject |
| `username` | 唯一、规范化、小写 |
| `email` | 可空唯一，用于邀请/找回 |
| `display_name` | 客服展示名 |
| `password_hash` | Argon2id；外部映射账号可为空 |
| `status` | `active` / `suspended` / `invited` / `disabled` |
| `account_type` | `super_admin` / `staff` |
| `external_provider` | 当前固定 `xt_mvp`，可空 |
| `external_subject` | XT_MVP `/auth/me` 的 `id`，唯一可空 |
| `external_role` | 最近一次交换得到的原始 role，仅用于审计/诊断 |
| `last_login_at`、`created_at`、`updated_at` | 时间字段 |

约束：`external_provider` 与 `external_subject` 成对出现；`status != active` 不得签发新 token。

#### `im_staff_permissions`

不要把业务权限硬编码在 role 名称中。权限表支持全局或租户范围：

| 字段 | 用途 |
|---|---|
| `id` | UUID PK |
| `staff_id` | FK `im_staff_accounts.id` |
| `permission_code` | 如 `im:conversation:read`、`im:message:send`、`im:assignment:takeover`、`im:staff:manage`、`im:audit:read` |
| `scope_type` | `global` / `tenant` |
| `scope_id` | `scope_type=tenant` 时为 XT_MVP tenant UUID |
| `granted_by` | 授权人 staff UUID，可空（bootstrap） |
| `created_at` | 授权时间 |

唯一键：`(staff_id, permission_code, scope_type, scope_id)`。撤销不删除行，使用 `im_staff_permission_events`（或后续增加 `revoked_at`）保留历史。

#### `im_staff_sessions`

不把 refresh token 明文存库：

- `id`、`staff_id`、`token_family`、`refresh_token_hash`
- `expires_at`、`last_used_at`、`revoked_at`、`replaced_by`
- `created_ip_hash`、`user_agent_hash`、`created_at`

refresh rotation 检测到旧 token 重放时，撤销整个 `token_family`。

### 4.2 访客、会话、成员和分配

#### `im_visitors`

门户没有强制登录，因此访客资料和浏览器会话必须拆开：

- `id` UUID PK
- `display_name`、`email`、`phone` 可空；敏感字段按保留策略处理
- `first_seen_at`、`last_seen_at`、`created_at`

#### `im_visitor_sessions`

浏览器临时身份的真正 bearer 是独立 session，不直接放在 `im_visitors`：

- `id` UUID PK、`visitor_id` FK
- `session_token_hash` UNIQUE（HttpOnly cookie 的 SHA-256）
- `expires_at`、`revoked_at`、`last_seen_at`
- `user_agent_hash`、`ip_hash`、`created_at`

cookie 建议使用 `__Host-im_visitor`、`Secure`、`HttpOnly`、`SameSite=Lax`；服务端只存 hash。清 cookie、过期或显式退出后，临时访客不能再读取旧会话。

#### `im_conversation_identities`

这是“谁拥有/可以恢复会话”的唯一来源，不能只看 `visitor_id`：

- `conversation_id`
- `identity_type`：`visitor_session` / `supabase_user` / `xt_mvp_subject`
- `identity_subject`：visitor session UUID 或外部用户 UUID
- `assurance`：`anonymous` / `verified`
- `is_primary`、`linked_at`、`revoked_at`、`created_at`

唯一约束：同一会话同一 `identity_type + identity_subject` 只有一个未撤销绑定。匿名会话登录后，通过同一浏览器 session + Supabase 验证显式 link；禁止仅凭相同 email 自动合并。

#### `im_conversations`

- `id` UUID PK
- `visitor_id` FK
- `tenant_id` 可空（来自 exchange 或会话创建上下文）
- `source`：`portal_web` / `portal_mobile` / `xt_mvp_mobile`
- `status`：`open` / `pending` / `closed`
- `priority`：`normal` / `high` / `urgent`
- `version` BIGINT NOT NULL DEFAULT 0（接管/关闭的乐观并发版本）
- `last_message_seq` BIGINT NOT NULL DEFAULT 0
- `last_message_at`、`closed_at`、`created_at`、`updated_at`

索引：`(status, last_message_at DESC)`、`(tenant_id, status, last_message_at DESC)`、`(visitor_id, updated_at DESC)`。

#### `im_conversation_members`

记录可见成员，不让客户端自行拼房间：

- `conversation_id`
- `principal_type`：`visitor` / `staff`
- `principal_id`
- `identity_assurance`：`anonymous` / `verified`
- `member_role`：`customer` / `primary` / `collaborator` / `observer`
- `joined_at`、`left_at`

唯一约束：同一会话、同一 principal 只能有一个未离开成员记录。

#### `im_conversation_assignments`

记录每一次认领、接管和转交，不覆盖旧数据：

- `id` UUID PK、`conversation_id`、`staff_id`
- `assignment_role`：`primary` / `collaborator` / `observer`
- `status`：`active` / `ended`
- `assigned_by`、`reason`
- `started_at`、`ended_at`

部分唯一索引：同一会话最多一个未结束的 `primary`。允许多个 `collaborator` 同时协作。

### 4.3 消息、读游标和可靠事件

#### `im_messages`

- `id` UUID PK
- `conversation_id` FK
- `seq` BIGINT NOT NULL（会话内单调递增）
- `client_message_id` TEXT NOT NULL（客户端幂等键）
- `sender_type`：`visitor` / `staff` / `system`
- `sender_id` TEXT NOT NULL
- `content_type`：`text` / `image` / `file` / `system`
- `body` TEXT NOT NULL（第一期文本；二进制只存对象 key）
- `metadata` JSONB NOT NULL DEFAULT `{}`
- `reply_to_message_id` 可空
- `created_at`、`edited_at`、`deleted_at`

唯一约束：`(conversation_id, seq)` 和 `(conversation_id, sender_type, sender_id, client_message_id)`。写消息时锁定 `im_conversations` 行，计算 `last_message_seq + 1`，再同事务插入消息和更新会话。

#### `im_read_cursors`

不为每个消息创建 receipt 行，而是保存读取水位：

- `conversation_id`
- `principal_type`、`principal_id`
- `last_read_seq`
- `updated_at`

唯一键：`(conversation_id, principal_type, principal_id)`。更新必须 `GREATEST(old, new)`，禁止游标倒退。

#### `im_outbox`

这是实时通知可靠性的事实桥：

- `id` BIGSERIAL PK
- `event_id` UUID UNIQUE
- `aggregate_type`、`aggregate_id`、`conversation_id`
- `event_type`、`event_version`
- `payload` JSONB（不放 token、密码、原始 Authorization）
- `available_at`、`published_at`
- `attempts`、`locked_at`、`locked_by`、`last_error`
- `created_at`

索引：`(published_at, available_at, id)` 的 pending partial index。worker 使用 `FOR UPDATE SKIP LOCKED`，成功后设置 `published_at`；失败采用指数退避。事件发布是 at-least-once，客户端必须按 `event_id` 去重。

### 4.4 审计

#### `im_audit_events`

追加不可变记录：

- `id` BIGSERIAL PK
- `event_id` UUID UNIQUE
- `actor_type`：`staff` / `visitor` / `system`
- `actor_id` 可空
- `action`：`auth.exchange`、`conversation.claim`、`conversation.takeover`、`conversation.transfer`、`message.send`、`message.edit`、`conversation.close`、`permission.grant` 等
- `conversation_id`、`target_type`、`target_id`
- `before_state`、`after_state` JSONB（脱敏）
- `request_id`、`ip_hash`、`user_agent_hash`
- `created_at`

禁止提供 UPDATE/DELETE API；管理员只能查询和导出。

## 5. 鉴权与双 Token

### 5.1 `/api/im/auth/exchange`

请求：

```http
POST /api/im/auth/exchange
Authorization: Bearer <XT_MVP_access_token>
Content-Type: application/json
```

服务端流程：

1. 校验 Authorization 格式和长度，拒绝 query/body token。
2. 使用 3 秒超时调用 XT_MVP `GET /api/v1/auth/me`；不在 xtch 本地解析 XT_MVP JWT。
3. 只接受明确映射到 `im_staff_accounts.external_subject` 的账号；首次 bootstrap 必须使用一次性配置或人工命令。
4. 检查本地账号状态和权限。
5. 签发 xtch 专用短期 JWT：`iss=xtch`、`aud=im-mobile`、`sub=im_staff_accounts.id`、`jti`、权限 scope、租户范围；使用独立 `XTCH_IM_JWT_SECRET`/algorithm。
6. 签发随机 refresh token，只存 hash，并写 `im_staff_sessions` 和 `auth.exchange` 审计。

响应只返回 xtch token，不返回 XT_MVP token：

```json
{
  "access_token": "<xtch-token>",
  "refresh_token": "<opaque-refresh-token>",
  "token_type": "bearer",
  "expires_in": 600,
  "staff": {
    "id": "uuid",
    "display_name": "客服 A",
    "permissions": ["im:conversation:read", "im:message:send"],
    "tenant_ids": ["uuid"]
  }
}
```

失败语义：401（XT_MVP token 无效）、403（未映射/无 IM 权限）、429（exchange 频率超限）、503（XT_MVP introspection 不可用）。不把上游错误正文透传给客户端。

### 5.2 本地客服账号

为了支持多个客服而不修改 XT_MVP，第一期增加：

- `POST /api/im/auth/invite`：仅 `im:staff:manage`，创建 `invited` 账号和一次性邀请 token（只存 hash）。
- `POST /api/im/auth/activate`：设置密码并变为 `active`。
- `POST /api/im/auth/login`：本地账号登录，签发 xtch token。
- `POST /api/im/auth/refresh`、`POST /api/im/auth/logout`：rotation/revoke。

mobile 中保留两个独立 API client 和两个 token store：

```text
xtMvpClient -> XT_MVP_API_BASE_URL -> xt_mvp_access_token
imClient    -> XTCH_API_BASE_URL   -> xtch_access_token
imSocket    -> XTCH_SOCKET_URL     -> xtch_access_token
```

任何一个 token 过期都不能触发另一套 token 的 refresh 或全局 logout。原生端 token 应迁移到 Keychain/Keystore；`@capacitor/preferences` 只能作为浏览器或迁移期 fallback。

## 6. 用户身份层级与实时消息语义

“在线”与“已登录”是两个不同维度：在线只表示当前有 Socket 连接，已登录才表示拥有可跨设备恢复的稳定身份。服务端必须同时保存 `identity_type`、`identity_subject` 和 `connection_id`，不能用 Socket ID 或 IP 作为用户身份。

### 6.1 三类客户身份

| 类型 | 产生方式 | 能否实时接收 | 关闭网页后 | 能否跨设备恢复 |
|---|---|---|---|---|
| 临时访客 | `/api/im/public/session` 创建 HttpOnly visitor cookie | 当前浏览器连接在线时可以 | 消息仍在库中；同一 cookie 回来可补取 | 否；cookie 丢失即失去访问权 |
| 已登录门户用户 | 现有 Supabase session，服务端验证后绑定 `supabase_user` | 当前浏览器在线时可以 | 消息持久化；重新登录后可补取 | 是，任意已登录设备 |
| 客服/内部人员 | xtch access token | 当前 mobile 在线时可以 | 由 REST/Socket 补取 | 是，使用 xtch refresh token |

门户登录 token 不直接拿去连 Socket.IO。登录门户后，`/api/im/public/session` 服务端验证 Supabase token，建立/升级 `im_conversation_identities`，再通过 HttpOnly visitor session cookie 连接 IM。这样 Supabase token 不会进入 Socket handshake、日志或 outbox。

### 6.2 临时访客进入网站的行为

1. 用户只是浏览网站时，不创建会话、不连接 IM Socket。
2. 用户点击气泡时，调用 `/api/im/public/session`；服务端创建 `im_visitor_sessions`，只返回访客展示信息和会话列表，不返回可长期存储的明文 token。
3. 用户首次发消息时创建 `im_conversations` 和 `visitor_session` identity。
4. 气泡打开期间建立 Socket；气泡关闭可以断开 Socket，但不撤销 visitor session。
5. 用户重新打开网站时，cookie 仍有效则通过 REST 拉取未读消息，再建立 Socket；cookie 清除或过期则展示“无法恢复历史，请输入邮箱/登录保存会话”。

临时访客不能通过姓名、邮箱、IP 或 URL 中的 conversation ID 找回会话。若要保存历史，必须通过 Supabase 登录或一次性邮箱验证显式升级身份。

### 6.3 匿名会话升级为登录身份

登录后不自动创建新会话，也不按 email 猜测旧会话。客户端携带当前 HttpOnly visitor session，调用：

```http
POST /api/im/public/conversations/:id/identity/link
Authorization: Bearer <Supabase_access_token>
```

服务端同时验证 cookie 属于该 conversation、验证 Supabase user，然后在事务中：

1. 新增 `supabase_user` / `verified` identity；
2. 将 anonymous visitor identity 标记为 `revoked_at`（避免共享设备 logout 后继续读）；
3. 写 `identity.link` 审计和 `conversation.updated` outbox；
4. 返回登录用户可恢复的会话摘要。

退出门户登录时，客户端清理 visitor cookie 并断开 Socket；历史消息仍保留，但只能重新登录后访问。

### 6.4 “实时收到”到底代表什么

必须区分四个状态：

- **persisted**：消息已在 PostgreSQL 提交，REST 201 才返回成功。
- **published**：outbox worker 已发布到 Socket.IO room。
- **connected**：目标身份当前存在合法 Socket 连接。
- **read**：客户端明确调用 `/read` 推进 `last_read_seq`。

Socket.IO 事件只提供低延迟通知，不能作为“消息已收到”的唯一证据。没有连接时，消息仍然是 persisted；用户下次打开页面/APP 时用 `after_seq` 补齐。第一期不承诺“实时推送必达”，只承诺“已提交消息不丢、重连可恢复”。

如果产品以后必须展示“已送达”，再增加 `im_delivery_cursors` 或按接收端保存 delivery receipt；不要把 Socket.IO ack 直接当作数据库事实。

### 6.5 Socket 连接归属

Socket `/im` middleware 支持两种认证路径：

- 客服：`auth.token = xtch_access_token`，按 staff permission 和 tenant ACL 授权；
- 门户客户：浏览器自动携带 `__Host-im_visitor` cookie，服务端查 `im_visitor_sessions`，再按 conversation identity 授权。

客户只能订阅自己可见的 conversation；客服只能订阅有权限的 conversation。服务端从数据库计算 room，客户端不能提交任意 room 名。多标签页使用 `client_instance_id` 和 `event_id` 去重。

## 7. 消息 REST API

客服 API 先做 xtch JWT 校验，再做 permission + tenant + conversation membership 检查；`public/*` API 使用 HttpOnly visitor session，若请求带 Supabase bearer 则额外验证门户登录身份。消息读写服务统一走同一套 conversation ACL。

| 方法 | 路径 | 用途 |
|---|---|---|
| `POST` | `/api/im/public/session` | 门户气泡建立/恢复访客 session；返回 HttpOnly session cookie |
| `POST` | `/api/im/public/conversations` | 访客新建会话 |
| `POST` | `/api/im/public/conversations/:id/identity/link` | 将当前匿名会话显式绑定到已验证门户用户 |
| `GET` | `/api/im/conversations` | 客服队列/我的会话/全部会话，cursor 分页 |
| `GET` | `/api/im/conversations/:id` | 会话详情、成员、当前分配和游标 |
| `GET` | `/api/im/conversations/:id/messages?after_seq=&before_seq=&limit=` | 历史和断线补偿；按 `seq` 游标，不用 offset |
| `POST` | `/api/im/conversations/:id/messages` | 发送消息；必须带 `Idempotency-Key` |
| `POST` | `/api/im/conversations/:id/read` | 推进 `last_read_seq` |
| `POST` | `/api/im/conversations/:id/claim` | 认领队列会话 |
| `POST` | `/api/im/conversations/:id/takeover` | 主管/有权限客服接管 |
| `POST` | `/api/im/conversations/:id/transfer` | 转交给指定客服或队列 |
| `POST` | `/api/im/conversations/:id/close` | 关闭会话 |
| `GET` | `/api/im/audit` | 仅审计权限查询，cursor 分页 |

发送消息的服务层必须同时完成：

1. 锁定 conversation 行并检查状态/成员权限。
2. 用 `(conversation_id, sender, client_message_id)` 查幂等结果；重复请求直接返回原消息。
3. 分配下一个 `seq`，插入 `im_messages`。
4. 更新会话摘要和 `version`。
5. 插入 `message.created` outbox 和 `message.send` audit。
6. 提交后才返回 201；Socket 推送失败不能让 REST 返回失败。

## 8. Socket.IO 实时网关

服务端挂在现有 Node HTTP server，不额外开放端口；Caddy 继续反代同一 upstream。

- path：`/socket.io/`
- namespace：`/im`
- handshake：客服使用 `auth.token = xtch_access_token`；门户客户使用 HttpOnly visitor cookie
- CORS：明确的门户/mobile origin allowlist；门户 cookie 场景启用 credentials，禁止 `*`
- 连接 middleware：按连接类型验证 xtch JWT 或 visitor session，再检查 session 未撤销、role/scope、租户范围
- 客户端只能请求 `conversation:subscribe`；服务端查库后加入 `im:conversation:<id>`，禁止客户端传任意 room 名

事件：

```text
message.created       { event_id, conversation_id, seq, message }
conversation.updated  { event_id, conversation_id, version, patch }
assignment.changed    { event_id, conversation_id, assignments }
read.cursor.updated   { event_id, conversation_id, principal, last_read_seq }
sync.required         { conversation_id, after_seq }
```

Socket 发送写操作第一期不单独造协议；mobile 统一调用 REST 发送消息，Socket 只推送结果。后续如增加 `message:send`，必须调用同一 domain service，不能复制写库逻辑。

## 9. Outbox、断线补偿和并发

### 9.1 worker

第一期在 xtch 单进程中启动一个受控 outbox loop：

1. 每 250–500ms 取一小批 pending 行。
2. `FOR UPDATE SKIP LOCKED` 加锁并设置 `locked_by`/`locked_at`。
3. 向 `/im` namespace 的目标会话 room 广播。
4. 成功设置 `published_at`；失败增加 `attempts` 并按 1s/2s/4s…退避。
5. 超过最大次数进入 dead-letter 状态并告警，不能静默丢弃。

使用 Socket.IO connection state recovery 仅作为短断线优化；真正补偿始终是 `GET messages?after_seq=<last_seen_seq>`。

### 9.2 并发规则

- 消息序号：锁 conversation 行后递增，保证每个会话严格有序。
- 认领/接管/关闭：锁 conversation 行 + 检查 `version`，冲突返回 409 并让客户端刷新。
- 读游标：数据库使用 `GREATEST`，重复/乱序请求安全。
- outbox：允许重复发布；客户端用 `event_id` 和 `(conversation_id, seq)` 去重。

## 10. 多客服分配、接管与审计

### 9.1 状态流

```text
new/open(queue)
  -> claim -> open(primary + optional collaborators)
  -> transfer -> open(new primary)
  -> takeover -> open(new primary, old primary ended)
  -> close -> closed
```

- `claim` 只允许无 primary 的会话，默认“先到先得”。
- `takeover` 需要 `im:assignment:takeover`，必须填写 reason；旧 primary 变为 collaborator 或 ended，取决于请求。
- `transfer` 必须指定目标 staff 或 queue；不删除历史成员。
- 允许多个客服同时接待同一会话，但只有一个 primary；collaborator 仍可读写，observer 只读。
- 所有操作都在同一事务写 assignment、conversation version、outbox、audit。

### 9.2 审计最低要求

必须记录：exchange/login/logout、权限变更、认领、接管、转交、关闭/重开、消息发送/编辑/删除、访客身份修改、导出操作。审计记录不应包含完整 token、密码、银行卡或未脱敏 Authorization。

## 11. 安全、性能和运维

- XT_MVP introspection 使用服务端 HTTPS、固定 host allowlist、3 秒 timeout；禁止把 token 放 URL、日志或 outbox。
- exchange/login/发送消息/新建访客 session 做 IP + account + visitor 多维限流。
- 文本消息限制 8KB；Socket buffer 64KB；附件走 S3 presign，不经过消息正文。
- 所有客服查询强制 tenant scope；global 权限只授予显式 super_admin。
- JWT access TTL 建议 10 分钟；refresh rotation；账号 suspend 后立即 revoke session，access 最多在 TTL 内失效。
- Caddy 只需反代现有 3080；生产环境必须显式配置 `MESSAGING_SOCKET_ALLOWED_ORIGINS`，不配置时保持关闭。
- 监控：outbox pending age、dead-letter count、message write latency、Socket connected/auth reject、补偿请求比例、每会话活跃客服数。
- PostgreSQL 备份必须覆盖 messages/outbox/audit；恢复后先跑 migration，再启动 worker。

## 12. 分阶段实施与验收

当前代码状态：已落地 `014_im_core` migration、public visitor session、匿名会话创建/文本消息、Supabase identity link、XT_MVP auth exchange、客服 token refresh/logout、客服邀请/权限、claim/takeover/transfer、客服消息 REST、客户 cookie Socket ACL、Socket.IO attach 和 PostgreSQL outbox worker；真实数据库 migration 尚未执行。

### Phase 0：设计确认

- 确认客服账号是否采用 xtch 本地账号（推荐）。
- 确认 portal customer 是否允许匿名会话（推荐允许）。
- 确认第一期是否需要租户级隔离和附件。

### Phase 1：数据库与领域服务

- 增加 `014_im_core.ts`：身份/权限、visitor、conversation、member、assignment、message、cursor、outbox、audit。
- 写事务服务和唯一约束测试：重复消息、并发 claim、并发 seq、旧 read cursor。

### Phase 2：鉴权与 REST

- 实现 exchange、local staff login/invite、refresh/revoke。
- 实现 public session、conversation/message、assignment、audit API。
- mobile 增加双 client/token store，不触碰原 XT_MVP client。

### Phase 3：实时与补偿

- 将 Socket.IO 工厂挂到现有 HTTP server。
- 启动 outbox worker；实现订阅 ACL、事件去重和 reconnect replay。
- 用两个客服账号做 claim/takeover/transfer 并发验收。

### Phase 4：上线门禁

- 先只对内部 origin 开启 `MESSAGING_SOCKET_ENABLED=true`。
- 验证数据库备份、outbox dead-letter 告警、Socket 断线补偿、JWT revoke。
- 再向 portal 客户端开放 public session 和消息入口。

回滚：关闭 Socket 环境开关不影响 REST 和已存消息；如发现写入问题，停止 worker/写 API，保留数据库事实和 audit，修复后从未发布 outbox 继续发布。

## 13. 待确认问题

1. `super_admin` 是否只允许一个 XT_MVP external mapping，还是允许多个 global staff？（建议只有一个 global super_admin。）
2. 客服账号是“xtch 本地账号 + 邀请”还是必须全部绑定 XT_MVP 账号？（推荐本地账号。）
3. 临时访客是否接受“cookie 丢失即无法恢复”？（推荐接受，并在气泡中提示登录保存。）
4. portal 登录是否继续使用现有 Supabase 用户身份？（推荐是，xtch 只服务端验证并绑定，不接管 Supabase token。）
5. 第一阶段是否需要图片/文件？如果需要，直接沿用现有 S3/MinIO presign，不把二进制放 PostgreSQL。
6. 预计同时在线客服数和每日消息量是多少？超过单进程 outbox 能力后再评估 Redis adapter/worker 拆分。
