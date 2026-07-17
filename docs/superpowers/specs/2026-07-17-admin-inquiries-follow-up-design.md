# Admin 询盘跟进设计

Status: Implemented  
Date: 2026-07-17

## Goal

运营在 Admin「交易」组处理公网询盘：列表默认看未关闭，详情改三态、写内部备注。

## Scope

- 做：侧栏「询盘」、列表+整页详情、`new`/`in_progress`/`closed`、单字段备注覆盖、Admin API+审计、中文操作层
- 不做：负责人、站内回信、备注时间线、改登录默认页、通知角标

## Data

`inquiries` 增量：`internal_notes`、`updated_at`；可选 `status` CHECK。自愈在 `ensureInquiryTable`；migration `006_inquiries_admin_follow_up`。

## API

`GET/POST /api/admin/inquiries`：列表（`status=open|new|in_progress|closed`）、详情、`update-status`、`internal-notes`。需 `requireAdminAuth` + `writeAuditLog`。

## UI

`Admin.tsx` → `InquiriesPanel`；导航顺序：订单 / 询盘 / 班期。
