import crypto from 'node:crypto';
import { sql } from '../../../platform/db';
import { getUserFromRequest } from '../../identity/traveler/userAuth';
import { getVisitorPrincipal } from '../visitorAuth';
import { headerValue, type ImRequest, type ImResponse } from '../httpTypes';

type MessageRow = {
  id: string;
  conversation_id: string;
  seq: number;
  client_message_id: string;
  sender_type: string;
  sender_id: string;
  content_type: string;
  body: string;
  metadata: unknown;
  created_at: string;
};

export default async function handler(req: ImRequest, res: ImResponse) {
  if (req.method === 'GET') {
    await listMessages(req, res);
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }
  const conversationId = readConversationId(req.url);
  const visitor = await getVisitorPrincipal(req);
  const authenticated = await getUserFromRequest(req);
  if (!conversationId || !visitor) {
    res.status(401).json({ ok: false, error: 'Messaging session and conversation are required.' });
    return;
  }

  const body = isRecord(req.body) ? req.body : {};
  const clientMessageId = stringValue(body.clientMessageId) || headerValue(req.headers['idempotency-key']) || crypto.randomUUID();
  const text = stringValue(body.body);
  const contentType = stringValue(body.contentType) || 'text';
  if (!text || text.length > 8_000 || contentType !== 'text') {
    res.status(400).json({ ok: false, error: 'Only non-empty text messages up to 8KB are supported.' });
    return;
  }

  try {
    const message = await sql.begin(async (tx) => {
      const conversation = await tx<{ last_message_seq: number }>`
        SELECT c.last_message_seq
        FROM im_conversations c
        JOIN im_conversation_identities i ON i.conversation_id = c.id
        WHERE c.id = ${conversationId}::uuid
          AND (
            (i.identity_type = 'visitor_session' AND i.identity_subject = ${visitor.sessionId})
            OR (i.identity_type = 'supabase_user' AND i.identity_subject = ${authenticated.ok ? authenticated.user.id : ''})
          )
          AND i.revoked_at IS NULL
          AND c.status <> 'closed'
        FOR UPDATE OF c
      `;
      const current = conversation.rows[0];
      if (!current) throw new PublicMessageError('Conversation is not available to this browser session.', 403);

      const existing = await tx<MessageRow>`
        SELECT id, conversation_id, seq, client_message_id, sender_type, sender_id,
          content_type, body, metadata, created_at
        FROM im_messages
        WHERE conversation_id = ${conversationId}::uuid
          AND sender_type = 'visitor'
          AND sender_id = ${visitor.sessionId}
          AND client_message_id = ${clientMessageId}
      `;
      if (existing.rows[0]) return existing.rows[0];

      const nextSeq = Number(current.last_message_seq) + 1;
      const inserted = await tx<MessageRow>`
        INSERT INTO im_messages (
          conversation_id, seq, client_message_id, sender_type, sender_id, content_type, body
        ) VALUES (
          ${conversationId}::uuid, ${nextSeq}, ${clientMessageId}, 'visitor', ${visitor.sessionId}, 'text', ${text}
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
        INSERT INTO im_outbox (
          aggregate_type, aggregate_id, conversation_id, event_type, payload
        ) VALUES (
          'message', ${row.id}::uuid, ${conversationId}::uuid, 'message.created',
          ${JSON.stringify({ event: 'message.created', conversation_id: conversationId, seq: nextSeq, message: row })}::jsonb
        )
      `;
      await tx`
        INSERT INTO im_audit_events (
          actor_type, actor_id, action, conversation_id, target_type, target_id, after_state
        ) VALUES (
          'visitor', ${visitor.sessionId}, 'message.send', ${conversationId}::uuid, 'message', ${row.id},
          ${JSON.stringify({ seq: nextSeq, content_type: 'text' })}::jsonb
        )
      `;
      return row;
    });
    res.status(201).json({ ok: true, message });
  } catch (error) {
    if (error instanceof PublicMessageError) {
      res.status(error.status).json({ ok: false, error: error.message });
      return;
    }
    console.error('IM public message failed:', error instanceof Error ? error.message : error);
    res.status(500).json({ ok: false, error: 'Unable to send message.' });
  }
}

async function listMessages(req: ImRequest, res: ImResponse) {
  const conversationId = readConversationId(req.url);
  const visitor = await getVisitorPrincipal(req);
  const authenticated = await getUserFromRequest(req);
  if (!conversationId || !visitor) {
    res.status(401).json({ ok: false, error: 'Messaging session and conversation are required.' });
    return;
  }
  const query = new URL(req.url ?? '/', 'http://xtch.local').searchParams;
  const afterSeq = Math.max(Number(query.get('after_seq') || 0), 0);
  const limit = Math.min(Math.max(Number(query.get('limit') || 50), 1), 200);
  const result = await sql`
    SELECT m.id, m.conversation_id, m.seq, m.client_message_id, m.sender_type,
      m.sender_id, m.content_type, m.body, m.metadata, m.created_at
    FROM im_messages m
    WHERE m.conversation_id = ${conversationId}::uuid
      AND EXISTS (
        SELECT 1 FROM im_conversation_identities i
        WHERE i.conversation_id = m.conversation_id
          AND (
            (i.identity_type = 'visitor_session' AND i.identity_subject = ${visitor.sessionId})
            OR (i.identity_type = 'supabase_user' AND i.identity_subject = ${authenticated.ok ? authenticated.user.id : ''})
          )
          AND i.revoked_at IS NULL
      )
      AND m.seq > ${afterSeq}
    ORDER BY m.seq ASC
    LIMIT ${limit}
  `;
  res.status(200).json({ ok: true, items: result.rows, nextAfterSeq: result.rows.at(-1)?.seq ?? afterSeq });
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

class PublicMessageError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}
