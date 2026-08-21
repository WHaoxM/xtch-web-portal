import { sql } from '../../../platform/db';
import { getVisitorPrincipal } from '../visitorAuth';
import { type ImRequest, type ImResponse } from '../httpTypes';

export default async function handler(req: ImRequest, res: ImResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }
  const visitor = await getVisitorPrincipal(req);
  if (!visitor) {
    res.status(401).json({ ok: false, error: 'Messaging session required.' });
    return;
  }

  const body = isRecord(req.body) ? req.body : {};
  const source = body.source === 'portal_mobile' ? 'portal_mobile' : 'portal_web';
  const tenantId = typeof body.tenantId === 'string' ? body.tenantId : null;

  try {
    const conversation = await sql.begin(async (tx) => {
      const created = await tx<{ id: string; created_at: string }>`
        INSERT INTO im_conversations (visitor_id, tenant_id, source)
        VALUES (${visitor.visitorId}::uuid, ${tenantId}::uuid, ${source})
        RETURNING id, created_at
      `;
      const row = created.rows[0];
      if (!row) throw new Error('Conversation insert returned no row.');
      await tx`
        INSERT INTO im_conversation_identities (
          conversation_id, identity_type, identity_subject, assurance, is_primary
        ) VALUES (${row.id}::uuid, 'visitor_session', ${visitor.sessionId}, 'anonymous', true)
      `;
      await tx`
        INSERT INTO im_conversation_members (
          conversation_id, principal_type, principal_id, identity_assurance, member_role
        ) VALUES (${row.id}::uuid, 'visitor', ${visitor.sessionId}, 'anonymous', 'customer')
      `;
      await tx`
        INSERT INTO im_audit_events (
          actor_type, actor_id, action, conversation_id, target_type, target_id
        ) VALUES ('visitor', ${visitor.sessionId}, 'conversation.created', ${row.id}::uuid, 'conversation', ${row.id})
      `;
      return row;
    });
    res.status(201).json({ ok: true, conversation });
  } catch (error) {
    console.error('IM public conversation create failed:', error instanceof Error ? error.message : error);
    res.status(500).json({ ok: false, error: 'Unable to create conversation.' });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

