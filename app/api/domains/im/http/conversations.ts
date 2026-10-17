import { sql } from '../../../platform/db';
import { canAccessConversation } from '../conversationAccess';
import { authenticateStaffRequest, hasGlobalPermission, hasPermission } from '../imAuth';
import { type ImRequest, type ImResponse } from '../httpTypes';

type Cursor = { updatedAt: string; id: string };

/** 客服队列/我的会话列表；结果按更新时间倒序并提供稳定 cursor。 */
export default async function handler(req: ImRequest, res: ImResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }
  const auth = await authenticateStaffRequest(req);
  if (auth.ok === false) {
    res.status(auth.status).json({ ok: false, error: auth.error });
    return;
  }
  if (!hasPermission(auth.principal, 'im:conversation:read')) {
    res.status(403).json({ ok: false, error: 'Conversation read permission required.' });
    return;
  }

  const query = new URL(req.url ?? '/', 'http://xtch.local').searchParams;
  const scope = query.get('scope') === 'mine' ? 'mine' : query.get('scope') === 'all' ? 'all' : 'queue';
  const status = query.get('status');
  const limit = Math.min(Math.max(Number(query.get('limit') || 50), 1), 100);
  const cursor = parseCursor(query.get('cursor'));
  if (query.get('cursor') && !cursor) {
    res.status(400).json({ ok: false, error: 'Invalid conversation cursor.' });
    return;
  }

  const normalizedStatus = status && ['open', 'pending', 'closed'].includes(status) ? status : null;
  const globalRead = hasGlobalPermission(auth.principal, 'im:conversation:read');
  const cursorUpdatedAt = cursor?.updatedAt ?? null;
  const cursorId = cursor?.id ?? null;

  try {
    const result = await sql<{
      id: string;
      status: string;
      priority: string;
      source: string;
      tenant_id: string | null;
      version: number;
      last_message_seq: number;
      last_message_at: string | null;
      updated_at: string;
      visitor_id: string | null;
      visitor_display_name: string | null;
      visitor_email: string | null;
      primary_staff_id: string | null;
      primary_staff_name: string | null;
      last_message_body: string | null;
      last_message_sender_type: string | null;
    }>`
      SELECT c.id, c.status, c.priority, c.source, c.tenant_id, c.version,
        c.last_message_seq, c.last_message_at, c.updated_at, c.visitor_id,
        v.display_name AS visitor_display_name, v.email AS visitor_email,
        pa.staff_id AS primary_staff_id, ps.display_name AS primary_staff_name,
        lm.body AS last_message_body, lm.sender_type AS last_message_sender_type
      FROM im_conversations c
      LEFT JOIN im_visitors v ON v.id = c.visitor_id
      LEFT JOIN LATERAL (
        SELECT a.staff_id
        FROM im_conversation_assignments a
        WHERE a.conversation_id = c.id AND a.assignment_role = 'primary' AND a.status = 'active'
        LIMIT 1
      ) pa ON TRUE
      LEFT JOIN im_staff_accounts ps ON ps.id = pa.staff_id
      LEFT JOIN LATERAL (
        SELECT m.body, m.sender_type
        FROM im_messages m
        WHERE m.conversation_id = c.id
        ORDER BY m.seq DESC
        LIMIT 1
      ) lm ON TRUE
      WHERE (
          (${normalizedStatus}::text IS NULL AND c.status <> 'closed')
          OR c.status = ${normalizedStatus}::text
        )
        AND EXISTS (
          SELECT 1 FROM im_staff_accounts current_staff
          WHERE current_staff.id = ${auth.principal.staffId}::uuid
            AND current_staff.status = 'active'
            AND current_staff.source_scope_enforced = ${auth.principal.sourceScopeEnforced}
        )
        AND (
          ${auth.principal.sourceScopeEnforced}::boolean
          OR ${globalRead}::boolean
          OR c.tenant_id = ANY(${auth.principal.tenantIds}::uuid[])
        )
        AND (
          NOT ${auth.principal.sourceScopeEnforced}::boolean
          OR EXISTS (
            SELECT 1 FROM im_staff_permissions source_read
            WHERE source_read.staff_id = ${auth.principal.staffId}::uuid
              AND source_read.permission_code = 'im:conversation:read'
              AND source_read.scope_type = 'source'
              AND source_read.scope_source = c.source
              AND source_read.revoked_at IS NULL
          )
        )
        AND (
          ${scope}::text = 'all'
          OR (
            ${scope}::text = 'mine'
            AND EXISTS (
              SELECT 1 FROM im_conversation_members m
              WHERE m.conversation_id = c.id
                AND m.principal_type = 'staff'
                AND m.principal_id = ${auth.principal.staffId}
                AND m.left_at IS NULL
            )
          )
          OR (
            ${scope}::text = 'queue'
            AND NOT EXISTS (
              SELECT 1 FROM im_conversation_assignments a
              WHERE a.conversation_id = c.id
                AND a.assignment_role = 'primary'
                AND a.status = 'active'
            )
          )
        )
        AND (
          ${cursorUpdatedAt}::timestamptz IS NULL
          OR (c.updated_at, c.id) < (${cursorUpdatedAt}::timestamptz, ${cursorId}::uuid)
        )
      ORDER BY c.updated_at DESC, c.id DESC
      LIMIT ${limit + 1}
    `;
    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
    const last = rows.at(-1);
    res.status(200).json({
      ok: true,
      items: rows,
      nextCursor: hasMore && last ? encodeCursor({ updatedAt: last.updated_at, id: last.id }) : null,
    });
  } catch (error) {
    console.error('IM conversation list failed:', error instanceof Error ? error.message : error);
    res.status(500).json({ ok: false, error: 'Unable to list conversations.' });
  }
}

function parseCursor(value: string | null): Cursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<Cursor>;
    if (typeof parsed.updatedAt !== 'string' || typeof parsed.id !== 'string') return null;
    if (!/^[0-9a-f-]{36}$/i.test(parsed.id) || Number.isNaN(Date.parse(parsed.updatedAt))) return null;
    return { updatedAt: parsed.updatedAt, id: parsed.id };
  } catch {
    return null;
  }
}

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

export async function assertConversationReadAccess(
  principal: ImStaffPrincipal,
  conversationId: string,
): Promise<boolean> {
  return canAccessConversation(principal, conversationId, 'read');
}
