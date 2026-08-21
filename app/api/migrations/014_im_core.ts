import type { SqlClient } from '../platform/db';

export const name = '014_im_core';

/** Core identity, conversation, message, outbox and audit facts for portal IM. */
export async function up(tx: SqlClient) {
  await tx`
    CREATE TABLE IF NOT EXISTS im_staff_accounts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username TEXT NOT NULL,
      email TEXT,
      display_name TEXT NOT NULL,
      password_hash TEXT,
      status TEXT NOT NULL DEFAULT 'invited'
        CHECK (status IN ('active', 'suspended', 'invited', 'disabled')),
      account_type TEXT NOT NULL DEFAULT 'staff'
        CHECK (account_type IN ('super_admin', 'staff')),
      external_provider TEXT,
      external_subject TEXT,
      external_role TEXT,
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (
        (external_provider IS NULL AND external_subject IS NULL)
        OR (external_provider IS NOT NULL AND external_subject IS NOT NULL)
      )
    )
  `;

  await tx`CREATE UNIQUE INDEX IF NOT EXISTS im_staff_accounts_username_uidx ON im_staff_accounts (LOWER(username))`;
  await tx`CREATE UNIQUE INDEX IF NOT EXISTS im_staff_accounts_email_uidx ON im_staff_accounts (LOWER(email)) WHERE email IS NOT NULL`;
  await tx`CREATE UNIQUE INDEX IF NOT EXISTS im_staff_accounts_external_uidx ON im_staff_accounts (external_provider, external_subject) WHERE external_subject IS NOT NULL`;
  await tx`CREATE INDEX IF NOT EXISTS im_staff_accounts_status_idx ON im_staff_accounts (status, created_at DESC)`;
  await tx`ALTER TABLE im_staff_accounts ADD COLUMN IF NOT EXISTS invite_token_hash TEXT`;
  await tx`ALTER TABLE im_staff_accounts ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ`;
  await tx`CREATE UNIQUE INDEX IF NOT EXISTS im_staff_accounts_invite_token_uidx ON im_staff_accounts (invite_token_hash) WHERE invite_token_hash IS NOT NULL`;

  await tx`
    CREATE TABLE IF NOT EXISTS im_staff_permissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      staff_id UUID NOT NULL REFERENCES im_staff_accounts(id) ON DELETE CASCADE,
      permission_code TEXT NOT NULL,
      scope_type TEXT NOT NULL DEFAULT 'global' CHECK (scope_type IN ('global', 'tenant')),
      scope_id UUID,
      granted_by UUID REFERENCES im_staff_accounts(id) ON DELETE SET NULL,
      revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK ((scope_type = 'global' AND scope_id IS NULL) OR (scope_type = 'tenant' AND scope_id IS NOT NULL))
    )
  `;
  await tx`
    CREATE UNIQUE INDEX IF NOT EXISTS im_staff_permissions_active_uidx
    ON im_staff_permissions (staff_id, permission_code, scope_type, COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'::uuid))
    WHERE revoked_at IS NULL
  `;
  await tx`CREATE INDEX IF NOT EXISTS im_staff_permissions_lookup_idx ON im_staff_permissions (staff_id, scope_type, scope_id) WHERE revoked_at IS NULL`;

  await tx`
    CREATE TABLE IF NOT EXISTS im_staff_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      staff_id UUID NOT NULL REFERENCES im_staff_accounts(id) ON DELETE CASCADE,
      token_family UUID NOT NULL,
      refresh_token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      revoked_at TIMESTAMPTZ,
      replaced_by UUID REFERENCES im_staff_sessions(id) ON DELETE SET NULL,
      created_ip_hash TEXT,
      user_agent_hash TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await tx`CREATE INDEX IF NOT EXISTS im_staff_sessions_staff_idx ON im_staff_sessions (staff_id, expires_at DESC) WHERE revoked_at IS NULL`;
  await tx`CREATE INDEX IF NOT EXISTS im_staff_sessions_family_idx ON im_staff_sessions (token_family) WHERE revoked_at IS NULL`;

  await tx`
    CREATE TABLE IF NOT EXISTS im_visitors (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      display_name TEXT,
      email TEXT,
      phone TEXT,
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await tx`
    CREATE TABLE IF NOT EXISTS im_visitor_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      visitor_id UUID NOT NULL REFERENCES im_visitors(id) ON DELETE CASCADE,
      session_token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      user_agent_hash TEXT,
      ip_hash TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await tx`CREATE INDEX IF NOT EXISTS im_visitor_sessions_visitor_idx ON im_visitor_sessions (visitor_id, expires_at DESC) WHERE revoked_at IS NULL`;

  await tx`
    CREATE TABLE IF NOT EXISTS im_conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      visitor_id UUID REFERENCES im_visitors(id) ON DELETE SET NULL,
      tenant_id UUID,
      source TEXT NOT NULL CHECK (source IN ('portal_web', 'portal_mobile', 'xt_mvp_mobile')),
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending', 'closed')),
      priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'urgent')),
      version BIGINT NOT NULL DEFAULT 0,
      last_message_seq BIGINT NOT NULL DEFAULT 0 CHECK (last_message_seq >= 0),
      last_message_at TIMESTAMPTZ,
      closed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await tx`CREATE INDEX IF NOT EXISTS im_conversations_queue_idx ON im_conversations (status, last_message_at DESC NULLS LAST, created_at DESC)`;
  await tx`CREATE INDEX IF NOT EXISTS im_conversations_tenant_queue_idx ON im_conversations (tenant_id, status, last_message_at DESC NULLS LAST)`;
  await tx`CREATE INDEX IF NOT EXISTS im_conversations_visitor_idx ON im_conversations (visitor_id, updated_at DESC)`;

  await tx`
    CREATE TABLE IF NOT EXISTS im_conversation_identities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID NOT NULL REFERENCES im_conversations(id) ON DELETE CASCADE,
      identity_type TEXT NOT NULL CHECK (identity_type IN ('visitor_session', 'supabase_user', 'xt_mvp_subject')),
      identity_subject TEXT NOT NULL,
      assurance TEXT NOT NULL DEFAULT 'anonymous' CHECK (assurance IN ('anonymous', 'verified')),
      is_primary BOOLEAN NOT NULL DEFAULT false,
      linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await tx`
    CREATE UNIQUE INDEX IF NOT EXISTS im_conversation_identities_active_uidx
    ON im_conversation_identities (conversation_id, identity_type, identity_subject)
    WHERE revoked_at IS NULL
  `;
  await tx`CREATE INDEX IF NOT EXISTS im_conversation_identities_subject_idx ON im_conversation_identities (identity_type, identity_subject) WHERE revoked_at IS NULL`;

  await tx`
    CREATE TABLE IF NOT EXISTS im_conversation_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID NOT NULL REFERENCES im_conversations(id) ON DELETE CASCADE,
      principal_type TEXT NOT NULL CHECK (principal_type IN ('visitor', 'staff')),
      principal_id TEXT NOT NULL,
      identity_assurance TEXT NOT NULL DEFAULT 'anonymous' CHECK (identity_assurance IN ('anonymous', 'verified')),
      member_role TEXT NOT NULL CHECK (member_role IN ('customer', 'primary', 'collaborator', 'observer')),
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      left_at TIMESTAMPTZ
    )
  `;
  await tx`
    CREATE UNIQUE INDEX IF NOT EXISTS im_conversation_members_active_uidx
    ON im_conversation_members (conversation_id, principal_type, principal_id)
    WHERE left_at IS NULL
  `;
  await tx`CREATE INDEX IF NOT EXISTS im_conversation_members_principal_idx ON im_conversation_members (principal_type, principal_id) WHERE left_at IS NULL`;

  await tx`
    CREATE TABLE IF NOT EXISTS im_conversation_assignments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID NOT NULL REFERENCES im_conversations(id) ON DELETE CASCADE,
      staff_id UUID NOT NULL REFERENCES im_staff_accounts(id) ON DELETE RESTRICT,
      assignment_role TEXT NOT NULL CHECK (assignment_role IN ('primary', 'collaborator', 'observer')),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
      assigned_by UUID REFERENCES im_staff_accounts(id) ON DELETE SET NULL,
      reason TEXT,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ended_at TIMESTAMPTZ
    )
  `;
  await tx`
    CREATE UNIQUE INDEX IF NOT EXISTS im_conversation_assignments_primary_uidx
    ON im_conversation_assignments (conversation_id)
    WHERE assignment_role = 'primary' AND status = 'active'
  `;
  await tx`CREATE INDEX IF NOT EXISTS im_conversation_assignments_staff_idx ON im_conversation_assignments (staff_id, status, started_at DESC)`;
  await tx`CREATE INDEX IF NOT EXISTS im_conversation_assignments_conversation_idx ON im_conversation_assignments (conversation_id, status, started_at DESC)`;

  await tx`
    CREATE TABLE IF NOT EXISTS im_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID NOT NULL REFERENCES im_conversations(id) ON DELETE CASCADE,
      seq BIGINT NOT NULL CHECK (seq > 0),
      client_message_id TEXT NOT NULL,
      sender_type TEXT NOT NULL CHECK (sender_type IN ('visitor', 'staff', 'system')),
      sender_id TEXT NOT NULL,
      content_type TEXT NOT NULL CHECK (content_type IN ('text', 'image', 'file', 'system')),
      body TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      reply_to_message_id UUID REFERENCES im_messages(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      edited_at TIMESTAMPTZ,
      deleted_at TIMESTAMPTZ,
      UNIQUE (conversation_id, seq),
      UNIQUE (conversation_id, sender_type, sender_id, client_message_id)
    )
  `;
  await tx`CREATE INDEX IF NOT EXISTS im_messages_conversation_seq_idx ON im_messages (conversation_id, seq DESC)`;
  await tx`CREATE INDEX IF NOT EXISTS im_messages_created_idx ON im_messages (conversation_id, created_at DESC)`;

  await tx`
    CREATE TABLE IF NOT EXISTS im_read_cursors (
      conversation_id UUID NOT NULL REFERENCES im_conversations(id) ON DELETE CASCADE,
      principal_type TEXT NOT NULL CHECK (principal_type IN ('visitor', 'staff')),
      principal_id TEXT NOT NULL,
      last_read_seq BIGINT NOT NULL DEFAULT 0 CHECK (last_read_seq >= 0),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (conversation_id, principal_type, principal_id)
    )
  `;

  await tx`
    CREATE TABLE IF NOT EXISTS im_outbox (
      id BIGSERIAL PRIMARY KEY,
      event_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
      aggregate_type TEXT NOT NULL,
      aggregate_id UUID NOT NULL,
      conversation_id UUID REFERENCES im_conversations(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      event_version INTEGER NOT NULL DEFAULT 1,
      payload JSONB NOT NULL,
      available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      published_at TIMESTAMPTZ,
      attempts INTEGER NOT NULL DEFAULT 0,
      locked_at TIMESTAMPTZ,
      locked_by TEXT,
      last_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await tx`
    CREATE INDEX IF NOT EXISTS im_outbox_pending_idx
    ON im_outbox (available_at, id)
    WHERE published_at IS NULL
  `;

  await tx`
    CREATE TABLE IF NOT EXISTS im_audit_events (
      id BIGSERIAL PRIMARY KEY,
      event_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
      actor_type TEXT NOT NULL CHECK (actor_type IN ('staff', 'visitor', 'system')),
      actor_id TEXT,
      action TEXT NOT NULL,
      conversation_id UUID REFERENCES im_conversations(id) ON DELETE SET NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      before_state JSONB,
      after_state JSONB,
      request_id TEXT,
      ip_hash TEXT,
      user_agent_hash TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await tx`CREATE INDEX IF NOT EXISTS im_audit_events_conversation_idx ON im_audit_events (conversation_id, created_at DESC)`;
  await tx`CREATE INDEX IF NOT EXISTS im_audit_events_actor_idx ON im_audit_events (actor_type, actor_id, created_at DESC)`;
}
