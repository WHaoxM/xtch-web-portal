import { sql } from '../../../platform/db';
import { getUserFromRequest } from '../../identity/traveler/userAuth';
import { getVisitorPrincipal } from '../visitorAuth';
import { type ImRequest, type ImResponse } from '../httpTypes';

export default async function handler(req: ImRequest, res: ImResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }
  const conversationId = readConversationId(req.url);
  if (!conversationId) {
    res.status(400).json({ ok: false, error: 'Conversation id is required.' });
    return;
  }

  const user = await getUserFromRequest(req);
  if (!user.ok) {
    res.status(401).json({ ok: false, error: 'Portal login required to save this conversation.' });
    return;
  }
  const visitor = await getVisitorPrincipal(req);
  if (!visitor) {
    res.status(401).json({ ok: false, error: 'The anonymous browser session is missing or expired.' });
    return;
  }

  try {
    await sql.begin(async (tx) => {
      const owned = await tx<{ id: string }>`
        SELECT c.id
        FROM im_conversations c
        JOIN im_conversation_identities i ON i.conversation_id = c.id
        WHERE c.id = ${conversationId}::uuid
          AND i.identity_type = 'visitor_session'
          AND i.identity_subject = ${visitor.sessionId}
          AND i.revoked_at IS NULL
        FOR UPDATE OF c
      `;
      if (!owned.rows[0]) throw new IdentityLinkError('Conversation is not owned by this browser session.');

      await tx`
        INSERT INTO im_conversation_identities (
          conversation_id, identity_type, identity_subject, assurance, is_primary
        ) VALUES (
          ${conversationId}::uuid, 'supabase_user', ${user.user.id}, 'verified', true
        )
        ON CONFLICT (conversation_id, identity_type, identity_subject)
        WHERE revoked_at IS NULL DO NOTHING
      `;
      await tx`
        UPDATE im_conversation_identities
        SET revoked_at = NOW(), is_primary = false
        WHERE conversation_id = ${conversationId}::uuid
          AND identity_type = 'visitor_session'
          AND identity_subject = ${visitor.sessionId}
          AND revoked_at IS NULL
      `;
      await tx`
        INSERT INTO im_audit_events (
          actor_type, actor_id, action, conversation_id, target_type, target_id, after_state
        ) VALUES (
          'visitor', ${user.user.id}, 'identity.link', ${conversationId}::uuid,
          'conversation_identity', ${user.user.id},
          ${JSON.stringify({ identity_type: 'supabase_user', assurance: 'verified' })}::jsonb
        )
      `;
      await tx`
        INSERT INTO im_outbox (
          aggregate_type, aggregate_id, conversation_id, event_type, payload
        ) VALUES (
          'conversation', ${conversationId}::uuid, ${conversationId}::uuid, 'conversation.updated',
          ${JSON.stringify({ conversation_id: conversationId, reason: 'identity.link' })}::jsonb
        )
      `;
    });
    res.status(200).json({ ok: true, conversationId, identity: { type: 'supabase_user', id: user.user.id } });
  } catch (error) {
    if (error instanceof IdentityLinkError) {
      res.status(403).json({ ok: false, error: error.message });
      return;
    }
    console.error('IM identity link failed:', error instanceof Error ? error.message : error);
    res.status(500).json({ ok: false, error: 'Unable to save this conversation.' });
  }
}

function readConversationId(url: string | undefined): string | null {
  const match = (url ?? '').split('?')[0]?.match(/\/conversations\/([^/]+)\/identity\/link$/);
  return match?.[1] ?? null;
}

class IdentityLinkError extends Error {}

