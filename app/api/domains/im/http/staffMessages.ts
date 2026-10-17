import crypto from 'node:crypto';
import { sql } from '../../../platform/db';
import { canAccessConversation } from '../conversationAccess';
import { authenticateStaffRequest, hasPermission } from '../imAuth';
import { headerValue, type ImRequest, type ImResponse } from '../httpTypes';
import { ChatAttachmentError, lockReadyChatAttachment, verifyReadyChatAttachment } from '../imChatAttachments';

export default async function handler(req: ImRequest, res: ImResponse) {
  const auth = await authenticateStaffRequest(req);
  if (auth.ok === false) {
    res.status(auth.status).json({ ok: false, error: auth.error });
    return;
  }
  const conversationId = readConversationId(req.url);
  if (!conversationId) {
    res.status(400).json({ ok: false, error: 'Conversation id is required.' });
    return;
  }

  const accessMode = req.method === 'GET' ? 'read' : req.method === 'POST' ? 'write' : null;
  if (accessMode && !(await canAccessConversation(auth.principal, conversationId, accessMode))) {
    res.status(403).json({ ok: false, error: 'Conversation access denied.' });
    return;
  }

  if (req.method === 'GET') {
    if (!hasPermission(auth.principal, 'im:conversation:read')) {
      res.status(403).json({ ok: false, error: 'Conversation read permission required.' });
      return;
    }
    await listMessages(conversationId, auth.principal.staffId, auth.principal.sourceScopeEnforced, req, res);
    return;
  }

  if (req.method === 'POST') {
    if (!hasPermission(auth.principal, 'im:message:send')) {
      res.status(403).json({ ok: false, error: 'Message send permission required.' });
      return;
    }
    await sendMessage(conversationId, auth.principal.staffId, auth.principal.sourceScopeEnforced, req, res);
    return;
  }

  res.status(405).json({ ok: false, error: 'Method not allowed.' });
}

async function listMessages(conversationId: string, staffId: string, sourceScopeEnforced: boolean, req: ImRequest, res: ImResponse) {
  const query = new URL(req.url ?? '/', 'http://xtch.local').searchParams;
  const afterSeq = Math.max(Number(query.get('after_seq') || 0), 0);
  const limit = Math.min(Math.max(Number(query.get('limit') || 50), 1), 200);
  const result = await sql`
    SELECT m.id, m.conversation_id, m.seq, m.client_message_id, m.sender_type, m.sender_id,
      m.content_type, m.body, m.metadata, m.created_at
    FROM im_messages m
    JOIN im_conversations c ON c.id = m.conversation_id
    JOIN im_staff_accounts s ON s.id = ${staffId}::uuid AND s.status = 'active'
    WHERE m.conversation_id = ${conversationId}::uuid
      AND s.source_scope_enforced = ${sourceScopeEnforced}
      AND (
        NOT s.source_scope_enforced
        OR EXISTS (
          SELECT 1 FROM im_staff_permissions p
          WHERE p.staff_id = s.id AND p.permission_code = 'im:conversation:read'
            AND p.scope_type = 'source' AND p.scope_source = c.source AND p.revoked_at IS NULL
        )
      )
      AND m.seq > ${afterSeq}
    ORDER BY m.seq ASC
    LIMIT ${limit}
  `;
  res.status(200).json({ ok: true, items: result.rows, nextAfterSeq: result.rows.at(-1)?.seq ?? afterSeq });
}

async function sendMessage(conversationId: string, staffId: string, sourceScopeEnforced: boolean, req: ImRequest, res: ImResponse) {
  const body = isRecord(req.body) ? req.body : {};
  let text = stringValue(body.body);
  const contentType = stringValue(body.contentType) || 'text';
  const clientMessageId = stringValue(body.clientMessageId) || headerValue(req.headers['idempotency-key']) || crypto.randomUUID();
  const attachmentId = isRecord(body.metadata) ? stringValue(body.metadata.attachmentId) : '';
  const isAttachment = contentType === 'image' || contentType === 'file';
  if ((!isAttachment && contentType !== 'text') || (contentType === 'text' && (!text || text.length > 8_000)) ||
      (isAttachment && !attachmentId)) {
    res.status(400).json({ ok: false, error: 'Text message must be between 1 and 8KB.' });
    return;
  }

  try {
    if (isAttachment) {
      const duplicate = await sql`
        SELECT id, conversation_id, seq, client_message_id, sender_type, sender_id,
          content_type, body, metadata, created_at
        FROM im_messages
        WHERE conversation_id = ${conversationId}::uuid AND sender_type = 'staff'
          AND sender_id = ${staffId} AND client_message_id = ${clientMessageId}
      `;
      if (duplicate.rows[0]) { res.status(201).json({ ok: true, message: duplicate.rows[0] }); return; }
    }
    const attachment = isAttachment ? await verifyReadyChatAttachment({ conversationId, attachmentId,
      actor: { type: 'staff', id: staffId }, contentType: contentType as 'image' | 'file' }) : null;
    if (attachment) text = attachment.filename;
    const message = await sql.begin(async (tx) => {
      const conversation = await tx<{ last_message_seq: number }>`
        SELECT c.last_message_seq
        FROM im_conversations c
        JOIN im_staff_accounts s ON s.id = ${staffId}::uuid AND s.status = 'active'
        LEFT JOIN im_conversation_members m
          ON m.conversation_id = c.id AND m.principal_type = 'staff'
          AND m.principal_id = ${staffId} AND m.left_at IS NULL
        WHERE c.id = ${conversationId}::uuid
          AND c.status <> 'closed'
          AND s.source_scope_enforced = ${sourceScopeEnforced}
          AND (
            NOT s.source_scope_enforced
            OR EXISTS (
              SELECT 1 FROM im_staff_permissions p
              WHERE p.staff_id = s.id AND p.permission_code = 'im:message:send'
                AND p.scope_type = 'source' AND p.scope_source = c.source AND p.revoked_at IS NULL
            )
          )
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

      const lockedAttachment = attachment ? await lockReadyChatAttachment(tx, { conversationId, attachmentId,
        actor: { type: 'staff', id: staffId }, contentType: contentType as 'image' | 'file' }) : null;

      const nextSeq = Number(current.last_message_seq) + 1;
      const inserted = await tx`
        INSERT INTO im_messages (
          conversation_id, seq, client_message_id, sender_type, sender_id, content_type, body, metadata
        ) VALUES (
          ${conversationId}::uuid, ${nextSeq}, ${clientMessageId}, 'staff', ${staffId}, ${contentType}, ${text},
          ${JSON.stringify(lockedAttachment ? {
            attachmentId: lockedAttachment.id,
            filename: lockedAttachment.filename,
            contentType: lockedAttachment.content_type,
            byteSize: Number(lockedAttachment.byteSize),
            kind: lockedAttachment.kind,
          } : {})}::jsonb
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
        INSERT INTO im_outbox (aggregate_type, aggregate_id, conversation_id, event_type, payload)
        VALUES (
          'message', ${row.id}::uuid, ${conversationId}::uuid, 'message.created',
          ${JSON.stringify({ event: 'message.created', conversation_id: conversationId, seq: nextSeq, message: row })}::jsonb
        )
      `;
      await tx`
        INSERT INTO im_audit_events (actor_type, actor_id, action, conversation_id, target_type, target_id, after_state)
        VALUES ('staff', ${staffId}, 'message.send', ${conversationId}::uuid, 'message', ${row.id},
          ${JSON.stringify({ seq: nextSeq, content_type: contentType, ...(lockedAttachment ? { attachment_id: lockedAttachment.id } : {}) })}::jsonb)
      `;
      return row;
    });
    res.status(201).json({ ok: true, message });
  } catch (error) {
    if (error instanceof ChatAttachmentError) {
      res.status(error.status).json({ ok: false, error: error.message });
      return;
    }
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
