import { sql } from '../../../platform/db';
import { authenticateStaffRequest, hasPermission } from '../imAuth';
import { type ImRequest, type ImResponse } from '../httpTypes';

export default async function handler(req: ImRequest, res: ImResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }
  const auth = await authenticateStaffRequest(req);
  if (!auth.ok) {
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

  try {
    const result = await sql.begin(async (tx) => {
      const current = await tx<{ id: string }>`
        SELECT id FROM im_conversations WHERE id = ${conversationId}::uuid AND status <> 'closed' FOR UPDATE
      `;
      if (!current.rows[0]) throw new AssignmentError('Conversation is unavailable.', 404);
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
        ON CONFLICT DO NOTHING
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

class AssignmentError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

