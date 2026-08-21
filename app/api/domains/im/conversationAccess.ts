import { sql } from '../../platform/db';
import { hasPermission, type ImStaffPrincipal } from './imAuth';

export type ConversationAccessMode = 'read' | 'write' | 'assign';

/**
 * Central conversation ACL used by list/detail/messages/read endpoints.
 * Super admins are global; staff can see their active memberships and
 * conversations in tenant scopes explicitly present in their IM token.
 */
export async function canAccessConversation(
  principal: ImStaffPrincipal,
  conversationId: string,
  mode: ConversationAccessMode,
): Promise<boolean> {
  const permission = mode === 'read'
    ? 'im:conversation:read'
    : mode === 'write'
      ? 'im:message:send'
      : 'im:assignment:claim';
  if (!hasPermission(principal, permission)) return false;
  if (principal.accountType === 'super_admin') return true;

  const result = await sql<{ id: string }>`
    SELECT c.id
    FROM im_conversations c
    WHERE c.id = ${conversationId}::uuid
      AND (
        EXISTS (
          SELECT 1 FROM im_conversation_members m
          WHERE m.conversation_id = c.id
            AND m.principal_type = 'staff'
            AND m.principal_id = ${principal.staffId}
            AND m.left_at IS NULL
        )
        OR (
          ${mode === 'read' ? sql`c.tenant_id = ANY(${principal.tenantIds}::uuid[])` : sql`FALSE`}
        )
      )
  `;
  return Boolean(result.rows[0]);
}

export function tenantScopeCondition(principal: ImStaffPrincipal) {
  if (principal.accountType === 'super_admin') return sql``;
  if (principal.tenantIds.length === 0) return sql`AND FALSE`;
  return sql`AND c.tenant_id = ANY(${principal.tenantIds}::uuid[])`;
}
