import crypto from 'node:crypto';
import { sql, type SqlClient } from '../../platform/db';
import {
  buildPrivateChatObjectKey,
  createPrivateChatDownloadUrl,
  createPrivateChatUploadUrl,
  inspectPrivateChatObject,
  isPrivateChatMediaConfigured,
} from '../media/imChatMedia';
import { readChatAttachmentInput, type ChatAttachmentInput } from '../media/imChatMediaRules';

export type ChatAttachmentActor = { type: 'visitor' | 'staff'; id: string };
export type ChatAttachmentRow = {
  id: string;
  conversation_id: string;
  uploader_type: ChatAttachmentActor['type'];
  uploader_id: string;
  client_upload_id: string;
  object_key: string;
  filename: string;
  content_type: string;
  byteSize: number | string;
  kind: ChatAttachmentInput['kind'];
  status: 'pending' | 'attached';
  message_id: string | null;
  expires_at?: string | Date;
};

export class ChatAttachmentError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function createChatAttachmentTicket(input: {
  db?: typeof sql;
  conversationId: string;
  actor: ChatAttachmentActor;
  clientUploadId: string;
  file: unknown;
  requestOrigin?: string | null;
}): Promise<{ attachmentId: string; filename: string; contentType: string; byteSize: number; kind: string; uploadUrl: string; expiresInSeconds: number }> {
  if (!isPrivateChatMediaConfigured()) throw new ChatAttachmentError('Private attachment storage is not configured.', 503);
  const db = input.db ?? sql;
  if (!isUuid(input.conversationId) || !isUuid(input.clientUploadId)) throw new ChatAttachmentError('Invalid upload request.', 400);
  let file: ChatAttachmentInput;
  try { file = readChatAttachmentInput(input.file); }
  catch (error) { throw new ChatAttachmentError(error instanceof Error ? error.message : 'Unsupported attachment.', 400); }

  const allowedConversation = await db<{ status: string }>`
    SELECT status FROM im_conversations WHERE id = ${input.conversationId}::uuid
      AND (${input.actor.type} <> 'staff' OR status <> 'closed')
  `;
  if (!allowedConversation.rows[0]) throw new ChatAttachmentError('Conversation is not available for attachments.', 403);

  const existing = await db<ChatAttachmentRow>`
    SELECT id, conversation_id, uploader_type, uploader_id, client_upload_id, object_key,
      filename, content_type, byte_size AS "byteSize", kind, status, message_id, expires_at
    FROM im_message_attachments
    WHERE conversation_id = ${input.conversationId}::uuid
      AND uploader_type = ${input.actor.type} AND uploader_id = ${input.actor.id}
      AND client_upload_id = ${input.clientUploadId}::uuid
  `;
  let attachment = existing.rows[0];
  if (attachment && (attachment.filename !== file.filename || attachment.content_type !== file.contentType ||
      Number(attachment.byteSize) !== file.byteSize || attachment.kind !== file.kind)) {
    throw new ChatAttachmentError('This retry ID belongs to a different file. Choose the file again.', 409);
  }

  if (!attachment) {
    const pending = await db<{ count: number }>`
      SELECT COUNT(*)::int AS count FROM im_message_attachments
      WHERE conversation_id = ${input.conversationId}::uuid AND uploader_type = ${input.actor.type}
        AND uploader_id = ${input.actor.id} AND status = 'pending' AND created_at > NOW() - INTERVAL '1 day'
    `;
    if (Number(pending.rows[0]?.count || 0) >= 25) throw new ChatAttachmentError('Too many unfinished uploads. Send or retry an earlier attachment first.', 429);
    const id = crypto.randomUUID();
    const objectKey = buildPrivateChatObjectKey(id);
    await db`
      INSERT INTO im_message_attachments
        (id, conversation_id, uploader_type, uploader_id, client_upload_id, object_key, filename, content_type, kind, byte_size)
      VALUES (${id}::uuid, ${input.conversationId}::uuid, ${input.actor.type}, ${input.actor.id},
        ${input.clientUploadId}::uuid, ${objectKey}, ${file.filename}, ${file.contentType}, ${file.kind}, ${file.byteSize})
      ON CONFLICT (conversation_id, uploader_type, uploader_id, client_upload_id) DO NOTHING
    `;
    const inserted = await db<ChatAttachmentRow>`
      SELECT id, conversation_id, uploader_type, uploader_id, client_upload_id, object_key,
        filename, content_type, byte_size AS "byteSize", kind, status, message_id, expires_at
      FROM im_message_attachments
      WHERE conversation_id = ${input.conversationId}::uuid AND uploader_type = ${input.actor.type}
        AND uploader_id = ${input.actor.id} AND client_upload_id = ${input.clientUploadId}::uuid
    `;
    attachment = inserted.rows[0];
    if (!attachment) throw new ChatAttachmentError('Upload could not be prepared. Please retry.', 503);
    if (attachment.filename !== file.filename || attachment.content_type !== file.contentType ||
        Number(attachment.byteSize) !== file.byteSize || attachment.kind !== file.kind) {
      throw new ChatAttachmentError('This retry ID belongs to a different file. Choose the file again.', 409);
    }
  }
  if (attachment.status === 'pending' && isExpired(attachment.expires_at)) {
    throw new ChatAttachmentError('This upload ticket has expired. Choose the file again.', 410);
  }
  let uploadUrl: string;
  if (attachment.status === 'attached') {
    // A retry after a lost message response must be able to resend the same
    // clientMessageId. The message endpoint will return its durable row.
    // A retry after an upload response loss reuses the same idempotent ticket.
    uploadUrl = '';
  } else {
    const object = await inspectPrivateChatObject({ objectKey: attachment.object_key, contentType: file.contentType, byteSize: file.byteSize });
    if (object.ok) {
      // A retry after an upload response loss reuses the same idempotent ticket.
      uploadUrl = '';
    } else {
      if (object.reason === 'mismatch') throw new ChatAttachmentError('Uploaded attachment does not match the declared file. Choose it again.', 400);
      uploadUrl = await createPrivateChatUploadUrl({ objectKey: attachment.object_key, contentType: file.contentType,
        byteSize: file.byteSize, requestOrigin: input.requestOrigin });
    }
  }
  return { attachmentId: attachment.id, filename: attachment.filename, contentType: attachment.content_type,
    byteSize: Number(attachment.byteSize), kind: attachment.kind, uploadUrl, expiresInSeconds: uploadUrl ? 300 : 0 };
}

export async function listChatAttachmentDownloadUrls(input: {
  db?: typeof sql;
  conversationId: string;
  attachmentIds: string[];
  requestOrigin?: string | null;
}): Promise<Record<string, string>> {
  const db = input.db ?? sql;
  if (!isUuid(input.conversationId)) throw new ChatAttachmentError('Invalid conversation.', 400);
  const ids = [...new Set(input.attachmentIds.filter(isUuid))].slice(0, 50);
  if (!ids.length) return {};
  const rows = await db<ChatAttachmentRow>`
    SELECT id, conversation_id, uploader_type, uploader_id, client_upload_id, object_key,
      filename, content_type, byte_size AS "byteSize", kind, status, message_id
    FROM im_message_attachments
    WHERE conversation_id = ${input.conversationId}::uuid AND id = ANY(${ids}::uuid[])
      AND status = 'attached' AND message_id IS NOT NULL
  `;
  const urls: Record<string, string> = {};
  await Promise.all(rows.rows.map(async attachment => {
    urls[attachment.id] = await createPrivateChatDownloadUrl({ objectKey: attachment.object_key,
      contentType: attachment.content_type, filename: attachment.filename,
      kind: attachment.kind, requestOrigin: input.requestOrigin });
  }));
  return urls;
}

export async function verifyReadyChatAttachment(input: {
  db?: typeof sql;
  conversationId: string;
  attachmentId: string;
  actor: ChatAttachmentActor;
  contentType: 'image' | 'file';
}): Promise<ChatAttachmentRow> {
  const db = input.db ?? sql;
  if (!isUuid(input.attachmentId)) throw new ChatAttachmentError('Attachment is not available.', 400);
  const rows = await db<ChatAttachmentRow>`
    SELECT id, conversation_id, uploader_type, uploader_id, client_upload_id, object_key,
      filename, content_type, byte_size AS "byteSize", kind, status, message_id, expires_at
    FROM im_message_attachments
    WHERE id = ${input.attachmentId}::uuid AND conversation_id = ${input.conversationId}::uuid
      AND uploader_type = ${input.actor.type} AND uploader_id = ${input.actor.id}
      AND status = 'pending'
    FOR UPDATE
  `;
  const attachment = rows.rows[0];
  if (!attachment || attachment.kind !== input.contentType) throw new ChatAttachmentError('Attachment is not available to this session.', 403);
  if (isExpired(attachment.expires_at)) throw new ChatAttachmentError('This upload ticket has expired. Choose the file again.', 410);
  const check = await inspectPrivateChatObject({ objectKey: attachment.object_key, contentType: attachment.content_type,
    byteSize: Number(attachment.byteSize) });
  if (!check.ok) throw new ChatAttachmentError(check.reason === 'missing'
    ? 'Upload is incomplete. Retry the attachment upload.'
    : 'Uploaded attachment failed server validation. Choose it again.', check.reason === 'missing' ? 409 : 400);
  return attachment;
}

/** Re-check the ticket under a DB row lock after S3 validation completed outside the message transaction. */
export async function lockReadyChatAttachment(tx: SqlClient, input: {
  conversationId: string;
  attachmentId: string;
  actor: ChatAttachmentActor;
  contentType: 'image' | 'file';
}): Promise<ChatAttachmentRow> {
  if (!isUuid(input.attachmentId)) throw new ChatAttachmentError('Attachment is not available.', 400);
  const rows = await tx<ChatAttachmentRow>`
    SELECT id, conversation_id, uploader_type, uploader_id, client_upload_id, object_key,
      filename, content_type, byte_size AS "byteSize", kind, status, message_id, expires_at
    FROM im_message_attachments
    WHERE id = ${input.attachmentId}::uuid AND conversation_id = ${input.conversationId}::uuid
      AND uploader_type = ${input.actor.type} AND uploader_id = ${input.actor.id}
      AND status = 'pending'
    FOR UPDATE
  `;
  const attachment = rows.rows[0];
  if (!attachment || attachment.kind !== input.contentType) throw new ChatAttachmentError('Attachment is not available to this session.', 403);
  if (isExpired(attachment.expires_at)) throw new ChatAttachmentError('This upload ticket has expired. Choose the file again.', 410);
  return attachment;
}

function isExpired(value: string | Date | undefined): boolean {
  if (!value) return false;
  const expiresAt = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(expiresAt) && expiresAt <= Date.now();
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
}
