import { sql } from '../../../platform/db';
import { canAccessConversation, hasLegacyAssignmentScope } from '../conversationAccess';
import { authenticateStaffRequest, hasGlobalPermission, hasPermission } from '../imAuth';
import { type ImRequest, type ImResponse } from '../httpTypes';

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
  const body = isRecord(req.body) ? req.body : {};
  const conversationId = stringValue(body.conversationId);
  const action = stringValue(body.action) || 'claim';
  const targetStaffId = stringValue(body.targetStaffId) || auth.principal.staffId;
  const reason = stringValue(body.reason) || null;
  const permission = action === 'claim'
    ? 'im:assignment:claim'
    : action === 'takeover'
      ? 'im:assignment:takeover'
      : action === 'transfer'
        ? 'im:assignment:transfer'
        : '';
  if (!conversationId || !permission || !hasPermission(auth.principal, permission)) {
    res.status(403).json({ ok: false, error: 'Assignment permission or valid action is missing.' });
    return;
  }
  if (!isUuid(conversationId) || !isUuid(targetStaffId)) {
    res.status(400).json({ ok: false, error: 'Valid conversation and staff ids are required.' });
    return;
  }
  if (auth.principal.sourceScopeEnforced &&
      !(await canAccessConversation(auth.principal, conversationId, 'assign', permission))) {
    res.status(403).json({ ok: false, error: 'Conversation assignment access denied.' });
    return;
  }

  try {
    const result = await sql.begin(async (tx) => {
      const current = await tx<{ id: string; tenant_id: string | null; source: string }>`
        SELECT c.id, c.tenant_id, c.source
        FROM im_conversations c
        JOIN im_staff_accounts actor ON actor.id = ${auth.principal.staffId}::uuid AND actor.status = 'active'
        WHERE c.id = ${conversationId}::uuid AND c.status <> 'closed'
          AND actor.source_scope_enforced = ${auth.principal.sourceScopeEnforced}
          AND (
            NOT actor.source_scope_enforced
            OR EXISTS (
              SELECT 1 FROM im_staff_permissions p
              WHERE p.staff_id = actor.id AND p.permission_code = ${permission}
                AND p.scope_type = 'source' AND p.scope_source = c.source AND p.revoked_at IS NULL
            )
          )
        FOR UPDATE OF c
      `;
      if (!current.rows[0]) throw new AssignmentError('Conversation is unavailable.', 404);
      const conversationRow = current.rows[0];
      if (
        !auth.principal.sourceScopeEnforced &&
        !hasLegacyAssignmentScope(
          hasGlobalPermission(auth.principal, 'im:assignment:claim'),
          Boolean(conversationRow.tenant_id && auth.principal.tenantIds.includes(conversationRow.tenant_id)),
        )
      ) {
        throw new AssignmentError('Conversation is outside your tenant scope.', 403);
      }
      const target = await tx<{
        id: string;
        account_type: string;
        source_scope_enforced: boolean;
        source_read_granted: boolean;
        source_send_granted: boolean;
      }>`
        SELECT target.id, target.account_type, target.source_scope_enforced,
          EXISTS (
            SELECT 1 FROM im_staff_permissions p
            WHERE p.staff_id = target.id AND p.permission_code = 'im:conversation:read'
              AND p.scope_type = 'source' AND p.scope_source = ${conversationRow.source} AND p.revoked_at IS NULL
          ) AS source_read_granted,
          EXISTS (
            SELECT 1 FROM im_staff_permissions p
            WHERE p.staff_id = target.id AND p.permission_code = 'im:message:send'
              AND p.scope_type = 'source' AND p.scope_source = ${conversationRow.source} AND p.revoked_at IS NULL
          ) AS source_send_granted
        FROM im_staff_accounts target
        WHERE target.id = ${targetStaffId}::uuid AND target.status = 'active'
      `;
      if (!target.rows[0]) throw new AssignmentError('Target staff account is inactive or missing.', 409);
      if (target.rows[0].source_scope_enforced &&
          (!target.rows[0].source_read_granted || !target.rows[0].source_send_granted)) {
        throw new AssignmentError('Target staff is outside the conversation source scope or cannot reply.', 409);
      }
      if (conversationRow.tenant_id && !target.rows[0].source_scope_enforced && target.rows[0].account_type !== 'super_admin') {
        const targetScope = await tx<{ staff_id: string }>`
          SELECT staff_id
          FROM im_staff_permissions
          WHERE staff_id = ${targetStaffId}::uuid
            AND permission_code = 'im:conversation:read'
            AND scope_type = 'tenant'
            AND scope_id = ${conversationRow.tenant_id}::uuid
            AND revoked_at IS NULL
          LIMIT 1
        `;
        if (!targetScope.rows[0]) throw new AssignmentError('Target staff is outside the conversation tenant scope.', 409);
      }
      const primary = await tx<{ staff_id: string }>`
        SELECT staff_id FROM im_conversation_assignments
        WHERE conversation_id = ${conversationId}::uuid AND assignment_role = 'primary' AND status = 'active'
      `;
      if (action === 'claim' && primary.rows[0]) throw new AssignmentError('Conversation is already claimed.', 409);
      if (action !== 'claim' && action !== 'takeover' && action !== 'transfer') {
        throw new AssignmentError('Unsupported assignment action.', 400);
      }
      if (action !== 'claim') {
        await tx`
          UPDATE im_conversation_assignments
          SET status = 'ended', ended_at = NOW()
          WHERE conversation_id = ${conversationId}::uuid
            AND assignment_role = 'primary' AND status = 'active'
        `;
        await tx`
          UPDATE im_conversation_members
          SET left_at = NOW()
          WHERE conversation_id = ${conversationId}::uuid
            AND principal_type = 'staff' AND member_role = 'primary' AND left_at IS NULL
        `;
      }
      await tx`
        INSERT INTO im_conversation_assignments (
          conversation_id, staff_id, assignment_role, assigned_by, reason
        ) VALUES (${conversationId}::uuid, ${targetStaffId}::uuid, 'primary', ${auth.principal.staffId}::uuid, ${reason})
      `;
      await tx`
        INSERT INTO im_conversation_members (
          conversation_id, principal_type, principal_id, identity_assurance, member_role
        ) VALUES (${conversationId}::uuid, 'staff', ${targetStaffId}, 'verified', 'primary')
        ON CONFLICT (conversation_id, principal_type, principal_id) WHERE left_at IS NULL
        DO UPDATE SET identity_assurance = 'verified', member_role = 'primary', left_at = NULL
      `;
      await tx`
        UPDATE im_conversations SET version = version + 1, updated_at = NOW() WHERE id = ${conversationId}::uuid
      `;
      await tx`
        INSERT INTO im_audit_events (actor_type, actor_id, action, conversation_id, target_type, target_id, after_state)
        VALUES ('staff', ${auth.principal.staffId}, ${`conversation.${action}`}, ${conversationId}::uuid,
          'assignment', ${targetStaffId}, ${JSON.stringify({ targetStaffId, reason })}::jsonb)
      `;
      await tx`
        INSERT INTO im_outbox (aggregate_type, aggregate_id, conversation_id, event_type, payload)
        VALUES ('conversation', ${conversationId}::uuid, ${conversationId}::uuid, 'assignment.changed',
          ${JSON.stringify({ conversation_id: conversationId, action, target_staff_id: targetStaffId })}::jsonb)
      `;
      return { conversationId, action, targetStaffId };
    });
    res.status(200).json({ ok: true, assignment: result });
  } catch (error) {
    if (error instanceof AssignmentError) {
      res.status(error.status).json({ ok: false, error: error.message });
      return;
    }
    console.error('IM assignment failed:', error instanceof Error ? error.message : error);
    res.status(500).json({ ok: false, error: 'Unable to update assignment.' });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

class AssignmentError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}
