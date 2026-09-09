# 门户公开 IM 可靠性修复记录（2026-09-09）

## 范围

- `app/src/components/PublicImBubble.tsx`
- 目标：访客在 Socket.IO 重连或代理阻断实时通道时仍可继续发消息，并避免重复文本消息在回执对账时误删。

## 修复

1. 将 REST 对账轮询从 5 秒缩短为 2 秒；Socket.IO 仍是主通道，轮询仅作为断线兜底。
2. 服务端回执优先使用 `client_message_id` 与本地待发送消息对账；只有缺少幂等键时才回退到正文匹配。
3. Socket.IO 处于 reconnecting 时不再锁死输入框和发送按钮，REST 写入仍可继续；仅在明确 error/offline 时阻断发送。

## 验证

- `npm run typecheck`
- `npm run lint -- --quiet`
- `npm run build`
- `npm run test:wenshu`（5/5）
- `npm run test:messaging-socket`（4/4）
- `git diff --check -- app/src/components/PublicImBubble.tsx`

以上命令均已通过。未在本次提交中执行生产数据库写入、客服权限变更或 SSH 部署；线上发布由受控的 `main` 分支工作流完成后再做外部业务验收。

## 交付记录

- 本文档与代码修复分开提交，便于回滚和审计。
- 本仓库工作区仍存在其他 Agent 的未提交文件，本次没有使用 `git add -A`，也没有重置或清理它们。
