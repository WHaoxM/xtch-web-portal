import { sql } from '../../../platform/db';
import { canAccessConversation } from '../conversationAccess';
import { authenticateStaffRequest } from '../imAuth';
import { type ImRequest, type ImResponse } from '../httpTypes';

/** 幂等推进客服个人已读游标，不允许跳过当前会话最新 seq。 */
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
  const conversationId = readConversationId(req.url);
  if (!conversationId || !/^[0-9a-f-]{36}$/i.test(conversationId)) {
    res.status(400).json({ ok: false, error: 'Valid conversation id is required.' });
    return;
  }
  if (!(await canAccessConversation(auth.principal, conversationId, 'read'))) {
    res.status(403).json({ ok: false, error: 'Conversation access denied.' });
    return;
  }
  const body = isRecord(req.body) ? req.body : {};
  const requested = Number(body.lastReadSeq);
  if (!Number.isSafeInteger(requested) || requested < 0) {
    res.status(400).json({ ok: false, error: 'lastReadSeq must be a non-negative integer.' });
    return;
  }

  try {
    const result = await sql.begin(async (tx) => {
      const conversation = await tx<{ last_message_seq: number }>`
        SELECT last_message_seq
        FROM im_conversations
        WHERE id = ${conversationId}::uuid
      `;
      const row = conversation.rows[0];
      if (!row) throw new ReadCursorError('Conversation not found.', 404);
      const lastReadSeq = Math.min(requested, Number(row.last_message_seq));
      const cursor = await tx<{ last_read_seq: number; updated_at: string }>`
        INSERT INTO im_read_cursors (conversation_id, principal_type, principal_id, last_read_seq)
        VALUES (${conversationId}::uuid, 'staff', ${auth.principal.staffId}, ${lastReadSeq})
        ON CONFLICT (conversation_id, principal_type, principal_id)
        DO UPDATE SET
          last_read_seq = GREATEST(im_read_cursors.last_read_seq, EXCLUDED.last_read_seq),
          updated_at = NOW()
        RETURNING last_read_seq, updated_at
      `;
      const cursorRow = cursor.rows[0];
      if (!cursorRow) throw new Error('Read cursor upsert returned no row.');
      await tx`
        INSERT INTO im_audit_events (
          actor_type, actor_id, action, conversation_id, target_type, target_id, after_state
        ) VALUES (
          'staff', ${auth.principal.staffId}, 'conversation.read', ${conversationId}::uuid,
          'read_cursor', ${auth.principal.staffId}, ${JSON.stringify({ lastReadSeq: cursorRow.last_read_seq })}::jsonb
        )
      `;
      return cursorRow;
    });
    res.status(200).json({ ok: true, conversationId, lastReadSeq: result.last_read_seq, updatedAt: result.updated_at });
  } catch (error) {
    if (error instanceof ReadCursorError) {
      res.status(error.status).json({ ok: false, error: error.message });
      return;
    }
    console.error('IM read cursor failed:', error instanceof Error ? error.message : error);
    res.status(500).json({ ok: false, error: 'Unable to update read cursor.' });
  }
}

function readConversationId(url: string | undefined): string | null {
  return (url ?? '').split('?')[0]?.match(/\/conversations\/([^/]+)\/read$/)?.[1] ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

class ReadCursorError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}
