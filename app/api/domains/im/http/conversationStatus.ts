import { sql } from '../../../platform/db';
import { canAccessConversation } from '../conversationAccess';
import { authenticateStaffRequest, hasPermission } from '../imAuth';
import { type ImRequest, type ImResponse } from '../httpTypes';

type ConversationStatus = 'open' | 'pending' | 'closed';

/** 客服会话生命周期：关闭、重开或标记待跟进。历史消息始终保留。 */
export default async function handler(req: ImRequest, res: ImResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }
  const auth = await authenticateStaffRequest(req);
  if (auth.ok === false) {
    res.status(auth.status).json({ ok: false, error: auth.error });
    return;
  }
  if (!hasPermission(auth.principal, 'im:conversation:close')) {
    res.status(403).json({ ok: false, error: 'Conversation lifecycle permission required.' });
    return;
  }

  const conversationId = readConversationId(req.url);
  const body = isRecord(req.body) ? req.body : {};
  const status = stringValue(body.status) as ConversationStatus;
  const expectedVersion = integerValue(body.expectedVersion);
  if (!conversationId || !isUuid(conversationId)) {
    res.status(400).json({ ok: false, error: 'Valid conversation id is required.' });
    return;
  }
  if (!['open', 'pending', 'closed'].includes(status)) {
    res.status(400).json({ ok: false, error: 'Status must be open, pending, or closed.' });
    return;
  }
  if (!(await canAccessConversation(auth.principal, conversationId, 'close'))) {
    res.status(403).json({ ok: false, error: 'Conversation access denied.' });
    return;
  }

  try {
    const result = await sql.begin(async (tx) => {
      const current = await tx<{ id: string; status: ConversationStatus; version: number; closed_at: string | null }>`
        SELECT c.id, c.status, c.version, c.closed_at
        FROM im_conversations c
        JOIN im_staff_accounts s ON s.id = ${auth.principal.staffId}::uuid AND s.status = 'active'
        WHERE c.id = ${conversationId}::uuid
          AND s.source_scope_enforced = ${auth.principal.sourceScopeEnforced}
          AND (
            NOT s.source_scope_enforced
            OR EXISTS (
              SELECT 1 FROM im_staff_permissions p
              WHERE p.staff_id = s.id AND p.permission_code = 'im:conversation:close'
                AND p.scope_type = 'source' AND p.scope_source = c.source AND p.revoked_at IS NULL
            )
          )
        FOR UPDATE OF c
      `;
      const row = current.rows[0];
      if (!row) throw new ConversationStatusError('Conversation not found.', 404);
      if (expectedVersion !== null && Number(row.version) !== expectedVersion) {
        throw new ConversationStatusError('Conversation was updated by another operator. Refresh and try again.', 409);
      }

      if (row.status !== status) {
        if (status === 'closed') {
          await tx`
            UPDATE im_conversations
            SET status = 'closed', closed_at = NOW(), updated_at = NOW(), version = version + 1
            WHERE id = ${conversationId}::uuid
          `;
          await tx`
            UPDATE im_conversation_assignments
            SET status = 'ended', ended_at = NOW()
            WHERE conversation_id = ${conversationId}::uuid AND status = 'active'
          `;
          await tx`
            UPDATE im_conversation_members
            SET left_at = NOW()
            WHERE conversation_id = ${conversationId}::uuid
              AND principal_type = 'staff' AND left_at IS NULL
          `;
        } else {
          await tx`
            UPDATE im_conversations
            SET status = ${status}, closed_at = NULL, updated_at = NOW(), version = version + 1
            WHERE id = ${conversationId}::uuid
          `;
        }
        await tx`
          INSERT INTO im_audit_events (
            actor_type, actor_id, action, conversation_id, target_type, target_id,
            before_state, after_state, request_id
          ) VALUES (
            'staff', ${auth.principal.staffId}, ${`conversation.${status === 'closed' ? 'close' : 'reopen'}`},
            ${conversationId}::uuid, 'conversation', ${conversationId},
            ${JSON.stringify({ status: row.status, version: row.version })}::jsonb,
            ${JSON.stringify({ status, version: Number(row.version) + 1 })}::jsonb,
            ${headerValue(req.headers['x-request-id']) ?? null}
          )
        `;
        await tx`
          INSERT INTO im_outbox (aggregate_type, aggregate_id, conversation_id, event_type, payload)
          VALUES (
            'conversation', ${conversationId}::uuid, ${conversationId}::uuid, 'conversation.updated',
            ${JSON.stringify({ event: 'conversation.updated', conversation_id: conversationId, patch: { status }, reason: 'lifecycle' })}::jsonb
          )
        `;
      }
      const updated = await tx<{ id: string; status: ConversationStatus; version: number; closed_at: string | null; updated_at: string }>`
        SELECT id, status, version, closed_at, updated_at FROM im_conversations WHERE id = ${conversationId}::uuid
      `;
      return updated.rows[0];
    });
    res.status(200).json({ ok: true, conversation: result });
  } catch (error) {
    if (error instanceof ConversationStatusError) {
      res.status(error.status).json({ ok: false, error: error.message });
      return;
    }
    console.error('IM conversation status failed:', error instanceof Error ? error.message : error);
    res.status(500).json({ ok: false, error: 'Unable to update conversation status.' });
  }
}

function readConversationId(url: string | undefined): string | null {
  return (url ?? '').split('?')[0]?.match(/\/conversations\/([^/]+)\/status$/)?.[1] ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function integerValue(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

class ConversationStatusError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}
