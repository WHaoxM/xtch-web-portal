import { sql } from '../../../platform/db';
import { canAccessConversation } from '../conversationAccess';
import { authenticateStaffRequest } from '../imAuth';
import { type ImRequest, type ImResponse } from '../httpTypes';

/** 客服会话详情，包含访客身份、当前分配和已读游标摘要。 */
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
  const conversationId = readConversationId(req.url);
  if (!conversationId || !/^[0-9a-f-]{36}$/i.test(conversationId)) {
    res.status(400).json({ ok: false, error: 'Valid conversation id is required.' });
    return;
  }
  if (!(await canAccessConversation(auth.principal, conversationId, 'read'))) {
    res.status(403).json({ ok: false, error: 'Conversation access denied.' });
    return;
  }

  try {
    const result = await sql`
      SELECT c.id, c.status, c.priority, c.source, c.tenant_id, c.version,
        c.last_message_seq, c.last_message_at, c.created_at, c.updated_at,
        c.visitor_id, v.display_name AS visitor_display_name, v.email AS visitor_email,
        v.phone AS visitor_phone
      FROM im_conversations c
      LEFT JOIN im_visitors v ON v.id = c.visitor_id
      WHERE c.id = ${conversationId}::uuid
    `;
    const conversation = result.rows[0];
    if (!conversation) {
      res.status(404).json({ ok: false, error: 'Conversation not found.' });
      return;
    }
    const [members, assignments, cursor] = await Promise.all([
      sql`
        SELECT m.principal_type, m.principal_id, m.identity_assurance, m.member_role,
          m.joined_at, m.left_at, s.display_name, s.username
        FROM im_conversation_members m
        LEFT JOIN im_staff_accounts s
          ON m.principal_type = 'staff' AND s.id = m.principal_id::uuid
        WHERE m.conversation_id = ${conversationId}::uuid
        ORDER BY m.joined_at ASC
      `,
      sql`
        SELECT a.staff_id, a.assignment_role, a.status, a.assigned_by, a.reason,
          a.started_at, a.ended_at, s.display_name AS staff_name
        FROM im_conversation_assignments a
        JOIN im_staff_accounts s ON s.id = a.staff_id
        WHERE a.conversation_id = ${conversationId}::uuid
        ORDER BY a.started_at DESC
      `,
      sql`
        SELECT last_read_seq, updated_at
        FROM im_read_cursors
        WHERE conversation_id = ${conversationId}::uuid
          AND principal_type = 'staff' AND principal_id = ${auth.principal.staffId}
      `,
    ]);
    res.status(200).json({
      ok: true,
      conversation,
      members: members.rows,
      assignments: assignments.rows,
      readCursor: cursor.rows[0] ?? { last_read_seq: 0, updated_at: null },
    });
  } catch (error) {
    console.error('IM conversation detail failed:', error instanceof Error ? error.message : error);
    res.status(500).json({ ok: false, error: 'Unable to load conversation.' });
  }
}

function readConversationId(url: string | undefined): string | null {
  return (url ?? '').split('?')[0]?.match(/\/conversations\/([^/]+)$/)?.[1] ?? null;
}
