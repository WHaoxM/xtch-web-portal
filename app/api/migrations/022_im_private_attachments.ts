import type { SqlClient } from '../platform/db';

export const name = '022_im_private_attachments';

export async function up(tx: SqlClient) {
  await tx`CREATE TABLE IF NOT EXISTS im_message_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES im_conversations(id) ON DELETE CASCADE,
    uploader_type TEXT NOT NULL CHECK (uploader_type IN ('visitor', 'staff')),
    uploader_id TEXT NOT NULL,
    client_upload_id UUID NOT NULL,
    object_key TEXT NOT NULL UNIQUE,
    filename TEXT NOT NULL,
    content_type TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('image', 'file')),
    byte_size BIGINT NOT NULL CHECK (byte_size > 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'attached')),
    message_id UUID UNIQUE REFERENCES im_messages(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 day'),
    attached_at TIMESTAMPTZ,
    UNIQUE (conversation_id, uploader_type, uploader_id, client_upload_id)
  )`;
  await tx`CREATE INDEX IF NOT EXISTS im_message_attachments_conversation_idx
    ON im_message_attachments (conversation_id, created_at DESC)`;
  await tx`CREATE INDEX IF NOT EXISTS im_message_attachments_pending_expiry_idx
    ON im_message_attachments (expires_at) WHERE status = 'pending'`;
}
