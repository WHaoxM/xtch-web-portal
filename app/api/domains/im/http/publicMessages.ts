import crypto from 'node:crypto';
import { sql } from '../../../platform/db';
import { getUserFromRequest } from '../../identity/traveler/userAuth';
import { getVisitorPrincipal } from '../visitorAuth';
import { headerValue, type ImRequest, type ImResponse } from '../httpTypes';
import { ChatAttachmentError, lockReadyChatAttachment, verifyReadyChatAttachment } from '../imChatAttachments';

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
  let text = stringValue(body.body);
  const contentType = stringValue(body.contentType) || 'text';
  const attachmentId = isRecord(body.metadata) ? stringValue(body.metadata.attachmentId) : '';
  const isAttachment = contentType === 'image' || contentType === 'file';
  if ((!isAttachment && contentType !== 'text') || (contentType === 'text' && (!text || text.length > 8_000)) ||
      (isAttachment && !attachmentId)) {
    res.status(400).json({ ok: false, error: 'Message must be text or an authorized image/file attachment.' });
    return;
  }

  try {
    // Retries after a lost response must return the durable row even though its
    // attachment ticket has already transitioned to attached.
    if (isAttachment) {
      const duplicate = await sql<MessageRow>`
        SELECT id, conversation_id, seq, client_message_id, sender_type, sender_id,
          content_type, body, metadata, created_at
        FROM im_messages
        WHERE conversation_id = ${conversationId}::uuid AND sender_type = 'visitor'
          AND sender_id = ${visitor.sessionId} AND client_message_id = ${clientMessageId}
          AND EXISTS (
            SELECT 1 FROM im_conversation_identities i
            WHERE i.conversation_id = im_messages.conversation_id AND i.revoked_at IS NULL
              AND ((i.identity_type = 'visitor_session' AND i.identity_subject = ${visitor.sessionId})
                OR (i.identity_type = 'supabase_user' AND i.identity_subject = ${authenticated.ok ? authenticated.user.id : ''}))
          )
      `;
      if (duplicate.rows[0]) { res.status(201).json({ ok: true, message: duplicate.rows[0] }); return; }
    }
    const attachment = isAttachment ? await verifyReadyChatAttachment({ conversationId, attachmentId,
      actor: { type: 'visitor', id: visitor.sessionId }, contentType: contentType as 'image' | 'file' }) : null;
    if (attachment) text = attachment.filename;

    const message = await sql.begin(async (tx) => {
      const conversation = await tx<{ last_message_seq: number; status: string; version: number }>`
        SELECT c.last_message_seq
          , c.status, c.version
        FROM im_conversations c
        JOIN im_conversation_identities i ON i.conversation_id = c.id
        WHERE c.id = ${conversationId}::uuid
          AND (
            (i.identity_type = 'visitor_session' AND i.identity_subject = ${visitor.sessionId})
            OR (i.identity_type = 'supabase_user' AND i.identity_subject = ${authenticated.ok ? authenticated.user.id : ''})
          )
          AND i.revoked_at IS NULL
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

      if (current.status === 'closed') {
        await tx`
          UPDATE im_conversations
          SET status = 'open', closed_at = NULL, updated_at = NOW(), version = version + 1
          WHERE id = ${conversationId}::uuid
        `;
        await tx`
          INSERT INTO im_audit_events (
            actor_type, actor_id, action, conversation_id, target_type, target_id,
            before_state, after_state
          ) VALUES (
            'visitor', ${visitor.sessionId}, 'conversation.reopen', ${conversationId}::uuid,
            'conversation', ${conversationId},
            ${JSON.stringify({ status: 'closed', version: current.version })}::jsonb,
            ${JSON.stringify({ status: 'open', reason: 'visitor_message' })}::jsonb
          )
        `;
        await tx`
          INSERT INTO im_outbox (aggregate_type, aggregate_id, conversation_id, event_type, payload)
          VALUES (
            'conversation', ${conversationId}::uuid, ${conversationId}::uuid, 'conversation.updated',
            ${JSON.stringify({ event: 'conversation.updated', conversation_id: conversationId, patch: { status: 'open' }, reason: 'visitor_message' })}::jsonb
          )
        `;
      }

      const lockedAttachment = attachment ? await lockReadyChatAttachment(tx, { conversationId, attachmentId,
        actor: { type: 'visitor', id: visitor.sessionId }, contentType: contentType as 'image' | 'file' }) : null;

      const nextSeq = Number(current.last_message_seq) + 1;
      const messageMetadata = lockedAttachment ? {
        attachmentId: lockedAttachment.id,
        filename: lockedAttachment.filename,
        contentType: lockedAttachment.content_type,
        byteSize: Number(lockedAttachment.byteSize),
        kind: lockedAttachment.kind,
      } : {};
      const inserted = await tx<MessageRow>`
        INSERT INTO im_messages (
          conversation_id, seq, client_message_id, sender_type, sender_id, content_type, body, metadata
        ) VALUES (
          ${conversationId}::uuid, ${nextSeq}, ${clientMessageId}, 'visitor', ${visitor.sessionId}, ${contentType}, ${text},
          ${JSON.stringify(messageMetadata)}::jsonb
        )
        RETURNING id, conversation_id, seq, client_message_id, sender_type, sender_id,
          content_type, body, metadata, created_at
      `;
      const row = inserted.rows[0];
      if (!row) throw new Error('Message insert returned no row.');
      if (lockedAttachment) await tx`
        UPDATE im_message_attachments SET status = 'attached', message_id = ${row.id}::uuid, attached_at = NOW()
        WHERE id = ${lockedAttachment.id}::uuid AND status = 'pending'
      `;
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
          ${JSON.stringify({ seq: nextSeq, content_type: contentType, ...(lockedAttachment ? { attachment_id: lockedAttachment.id } : {}) })}::jsonb
        )
      `;
      return row;
    });
    res.status(201).json({ ok: true, message });
  } catch (error) {
    if (error instanceof ChatAttachmentError) {
      res.status(error.status).json({ ok: false, error: error.message });
      return;
    }
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
  // Return lifecycle state with every poll. Without this, a staff-side close is
  // invisible to the cross-site visitor until the token expires.
  const conversation = await sql<{ status: string; closed_at: string | null }>`
    SELECT c.status, c.closed_at
    FROM im_conversations c
    WHERE c.id = ${conversationId}::uuid
      AND EXISTS (
        SELECT 1 FROM im_conversation_identities i
        WHERE i.conversation_id = c.id
          AND (
            (i.identity_type = 'visitor_session' AND i.identity_subject = ${visitor.sessionId})
            OR (i.identity_type = 'supabase_user' AND i.identity_subject = ${authenticated.ok ? authenticated.user.id : ''})
          )
          AND i.revoked_at IS NULL
      )
  `;
  const state = conversation.rows[0] ?? { status: 'open', closed_at: null };
  res.status(200).json({ ok: true, items: result.rows, nextAfterSeq: result.rows.at(-1)?.seq ?? afterSeq,
    conversation: { status: state.status, closedAt: state.closed_at } });
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
