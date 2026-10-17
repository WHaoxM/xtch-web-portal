import { sql } from '../../platform/db';
import { hasGlobalPermission, hasPermission, type ImStaffPrincipal } from './imAuth';

export type ConversationAccessMode = 'read' | 'write' | 'assign' | 'close';

export type ConversationAccessDecision = {
  permission: string;
  conversationSource: string;
  sourceScopeEnforced: boolean;
  sourceGrantActive: boolean;
  globalAccess: boolean;
  membership: boolean;
  tenantRead: boolean;
};

export const IM_CONVERSATION_SOURCES = [
  'portal_web',
  'portal_mobile',
  'xt_mvp_mobile',
  'wenshuzhilv',
] as const;

/** Pure decision function; source grants take precedence over every legacy bypass. */
export function resolveConversationAccess(input: ConversationAccessDecision): boolean {
  if (input.sourceScopeEnforced) return input.sourceGrantActive;
  return input.globalAccess || input.membership || (input.permission === 'im:conversation:read' && input.tenantRead);
}

export function permissionForConversationMode(mode: ConversationAccessMode): string {
  return mode === 'read'
    ? 'im:conversation:read'
    : mode === 'write'
      ? 'im:message:send'
      : mode === 'close'
        ? 'im:conversation:close'
        : 'im:assignment:claim';
}

/**
 * Central conversation ACL used by list/detail/messages/read endpoints.
 * Super admins are global; staff can see their active memberships and
 * conversations in tenant scopes explicitly present in their IM token.
 */
export async function canAccessConversation(
  principal: ImStaffPrincipal,
  conversationId: string,
  mode: ConversationAccessMode,
  permissionOverride?: string,
): Promise<boolean> {
  const permission = permissionOverride ?? permissionForConversationMode(mode);
  if (!hasPermission(principal, permission)) return false;
  const globalAccess = hasGlobalPermission(principal, permission);

  const result = await sql<{
    source: string;
    tenant_id: string | null;
    source_scope_enforced: boolean;
    source_grant_active: boolean;
    member_access: boolean;
  }>`
    SELECT c.source, c.tenant_id, s.source_scope_enforced,
      EXISTS (
        SELECT 1 FROM im_staff_permissions p
        WHERE p.staff_id = s.id
          AND p.permission_code = ${permission}
          AND p.scope_type = 'source'
          AND p.scope_source = c.source
          AND p.revoked_at IS NULL
      ) AS source_grant_active,
      EXISTS (
        SELECT 1 FROM im_conversation_members m
        WHERE m.conversation_id = c.id
          AND m.principal_type = 'staff'
          AND m.principal_id = ${principal.staffId}
          AND m.left_at IS NULL
      ) AS member_access
    FROM im_conversations c
    JOIN im_staff_accounts s ON s.id = ${principal.staffId}::uuid AND s.status = 'active'
    WHERE c.id = ${conversationId}::uuid
      AND s.source_scope_enforced = ${principal.sourceScopeEnforced}
  `;
  const row = result.rows[0];
  if (!row) return false;
  return resolveConversationAccess({
    permission,
    conversationSource: row.source,
    sourceScopeEnforced: row.source_scope_enforced,
    sourceGrantActive: row.source_grant_active,
    globalAccess,
    membership: row.member_access,
    tenantRead: mode !== 'write' && Boolean(row.tenant_id && principal.tenantIds.includes(row.tenant_id)),
  });
}

/** Live legacy staff read authorization used by websocket subscribe/outbox; source-scoped accounts use REST polling. */
export async function canStaffReadConversationsNow(staffIds: string[], conversationId: string): Promise<Set<string>> {
  const uniqueStaffIds = [...new Set(staffIds.filter((staffId) => /^[0-9a-f-]{36}$/i.test(staffId)))];
  if (uniqueStaffIds.length === 0) return new Set();
  const result = await sql<{ id: string }>`
    SELECT s.id
    FROM im_conversations c
    JOIN im_staff_accounts s ON s.id = ANY(${uniqueStaffIds}::uuid[]) AND s.status = 'active'
    WHERE c.id = ${conversationId}::uuid
      AND NOT s.source_scope_enforced
      AND (
        s.account_type = 'super_admin'
        OR EXISTS (
          SELECT 1 FROM im_staff_permissions p
          WHERE p.staff_id = s.id AND p.permission_code = 'im:conversation:read'
            AND p.scope_type = 'global' AND p.revoked_at IS NULL
        )
        OR EXISTS (
          SELECT 1 FROM im_conversation_members m
          WHERE m.conversation_id = c.id AND m.principal_type = 'staff'
            AND m.principal_id = s.id::text AND m.left_at IS NULL
        )
        OR (c.tenant_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM im_staff_permissions p
          WHERE p.staff_id = s.id AND p.permission_code = 'im:conversation:read'
            AND p.scope_type = 'tenant' AND p.scope_id = c.tenant_id AND p.revoked_at IS NULL
        ))
      )
  `;
  return new Set(result.rows.map((row) => row.id));
}

export async function canStaffReadConversationNow(staffId: string, conversationId: string): Promise<boolean> {
  return (await canStaffReadConversationsNow([staffId], conversationId)).has(staffId);
}

/** Current visitor-session authorization for socket event delivery. */
export async function canVisitorReadConversationsNow(sessionIds: string[], conversationId: string): Promise<Set<string>> {
  const uniqueSessionIds = [...new Set(sessionIds.filter((sessionId) => /^[0-9a-f-]{36}$/i.test(sessionId)))];
  if (uniqueSessionIds.length === 0) return new Set();
  const result = await sql<{ id: string }>`
    SELECT s.id
    FROM im_visitor_sessions s
    JOIN im_conversation_identities i
      ON i.identity_type = 'visitor_session'
      AND i.identity_subject = s.id::text
      AND i.revoked_at IS NULL
    WHERE s.id = ANY(${uniqueSessionIds}::uuid[])
      AND s.revoked_at IS NULL
      AND s.expires_at > NOW()
      AND i.conversation_id = ${conversationId}::uuid
  `;
  return new Set(result.rows.map((row) => row.id));
}
