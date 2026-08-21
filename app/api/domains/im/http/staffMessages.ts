import crypto from 'node:crypto';
import { sql } from '../../../platform/db';
import { authenticateStaffRequest, hasPermission } from '../imAuth';
import { headerValue, type ImRequest, type ImResponse } from '../httpTypes';

export default async function handler(req: ImRequest, res: ImResponse) {
  const auth = await authenticateStaffRequest(req);
  if (!auth.ok) {
    res.status(auth.status).json({ ok: false, error: auth.error });
    return;
  }
  const conversationId = readConversationId(req.url);
  if (!conversationId) {
    res.status(400).json({ ok: false, error: 'Conversation id is required.' });
    return;
  }

  if (req.method === 'GET') {
    if (!hasPermission(auth.principal, 'im:conversation:read')) {
      res.status(403).json({ ok: false, error: 'Conversation read permission required.' });
      return;
    }
    await listMessages(conversationId, req, res);
    return;
  }

  if (req.method === 'POST') {
    if (!hasPermission(auth.principal, 'im:message:send')) {
      res.status(403).json({ ok: false, error: 'Message send permission required.' });
      return;
    }
    await sendMessage(conversationId, auth.principal.staffId, req, res);
    return;
  }

  res.status(405).json({ ok: false, error: 'Method not allowed.' });
}

async function listMessages(conversationId: string, req: ImRequest, res: ImResponse) {
  const query = new URL(req.url ?? '/', 'http://xtch.local').searchParams;
  const afterSeq = Math.max(Number(query.get('after_seq') || 0), 0);
  const limit = Math.min(Math.max(Number(query.get('limit') || 50), 1), 200);
  const result = await sql`
    SELECT id, conversation_id, seq, client_message_id, sender_type, sender_id,
      content_type, body, metadata, created_at
    FROM im_messages
    WHERE conversation_id = ${conversationId}::uuid
      AND seq > ${afterSeq}
    ORDER BY seq ASC
    LIMIT ${limit}
  `;
  res.status(200).json({ ok: true, items: result.rows, nextAfterSeq: result.rows.at(-1)?.seq ?? afterSeq });
}

async function sendMessage(conversationId: string, staffId: string, req: ImRequest, res: ImResponse) {
  const body = isRecord(req.body) ? req.body : {};
  const text = stringValue(body.body);
  const clientMessageId = stringValue(body.clientMessageId) || headerValue(req.headers['idempotency-key']) || crypto.randomUUID();
  if (!text || text.length > 8_000) {
    res.status(400).json({ ok: false, error: 'Text message must be between 1 and 8KB.' });
    return;
  }

  try {
    const message = await sql.begin(async (tx) => {
      const conversation = await tx<{ last_message_seq: number }>`
        SELECT c.last_message_seq
        FROM im_conversations c
        LEFT JOIN im_conversation_members m
          ON m.conversation_id = c.id AND m.principal_type = 'staff'
          AND m.principal_id = ${staffId} AND m.left_at IS NULL
        WHERE c.id = ${conversationId}::uuid
          AND c.status <> 'closed'
          AND (m.id IS NOT NULL OR EXISTS (
            SELECT 1 FROM im_staff_accounts s WHERE s.id = ${staffId}::uuid AND s.account_type = 'super_admin'
          ))
        FOR UPDATE OF c
      `;
      const current = conversation.rows[0];
      if (!current) throw new StaffMessageError('You are not a member of this conversation.', 403);

      const existing = await tx`
        SELECT id, conversation_id, seq, client_message_id, sender_type, sender_id,
          content_type, body, metadata, created_at
        FROM im_messages
        WHERE conversation_id = ${conversationId}::uuid
          AND sender_type = 'staff' AND sender_id = ${staffId}
          AND client_message_id = ${clientMessageId}
      `;
      if (existing.rows[0]) return existing.rows[0];

      const nextSeq = Number(current.last_message_seq) + 1;
      const inserted = await tx`
        INSERT INTO im_messages (
          conversation_id, seq, client_message_id, sender_type, sender_id, content_type, body
        ) VALUES (
          ${conversationId}::uuid, ${nextSeq}, ${clientMessageId}, 'staff', ${staffId}, 'text', ${text}
        )
        RETURNING id, conversation_id, seq, client_message_id, sender_type, sender_id,
          content_type, body, metadata, created_at
      `;
      const row = inserted.rows[0];
      if (!row) throw new Error('Message insert returned no row.');
      await tx`
        UPDATE im_conversations
        SET last_message_seq = ${nextSeq}, last_message_at = NOW(), updated_at = NOW(), version = version + 1
        WHERE id = ${conversationId}::uuid
      `;
      await tx`
        INSERT INTO im_outbox (aggregate_type, aggregate_id, conversation_id, event_type, payload)
        VALUES (
          'message', ${row.id}::uuid, ${conversationId}::uuid, 'message.created',
          ${JSON.stringify({ event: 'message.created', conversation_id: conversationId, seq: nextSeq, message: row })}::jsonb
        )
      `;
      await tx`
        INSERT INTO im_audit_events (actor_type, actor_id, action, conversation_id, target_type, target_id, after_state)
        VALUES ('staff', ${staffId}, 'message.send', ${conversationId}::uuid, 'message', ${row.id}, ${JSON.stringify({ seq: nextSeq })}::jsonb)
      `;
      return row;
    });
    res.status(201).json({ ok: true, message });
  } catch (error) {
    if (error instanceof StaffMessageError) {
      res.status(error.status).json({ ok: false, error: error.message });
      return;
    }
    console.error('IM staff message failed:', error instanceof Error ? error.message : error);
    res.status(500).json({ ok: false, error: 'Unable to send message.' });
  }
}

function readConversationId(url: string | undefined): string | null {
  const match = (url ?? '').split('?')[0]?.match(/\/conversations\/([^/]+)\/messages$/);
  return match?.[1] ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

class StaffMessageError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

