import { sql } from '../../../platform/db';
import { getUserFromRequest } from '../../identity/traveler/userAuth';
import { hashToken, randomToken } from '../imAuth';
import { getClientIp, headerValue, parseCookies, type ImRequest, type ImResponse } from '../httpTypes';

const VISITOR_COOKIE = '__Host-im_visitor';
const VISITOR_TTL_SECONDS = 30 * 24 * 60 * 60;

type VisitorRow = {
  session_id: string;
  visitor_id: string;
  display_name: string | null;
  email: string | null;
  expires_at: string;
};

export default async function handler(req: ImRequest, res: ImResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }

  try {
    const authenticated = await getUserFromRequest(req);
    const existing = await findVisitorSession(req);
    const visitor = existing ?? await createVisitorSession(req, authenticated.ok ? authenticated.user.email : null);

    if (authenticated.ok) {
      await sql`
        UPDATE im_visitors
        SET email = COALESCE(email, ${authenticated.user.email}), last_seen_at = NOW()
        WHERE id = ${visitor.visitor_id}::uuid
      `;
    }

    if (!existing) {
      const token = (visitor as VisitorRow & { rawToken?: string }).rawToken;
      if (token && res.setHeader) {
        const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
        res.setHeader(
          'set-cookie',
          `${VISITOR_COOKIE}=${encodeURIComponent(token)}; Max-Age=${VISITOR_TTL_SECONDS}; Path=/; HttpOnly; SameSite=Lax${secure}`,
        );
      }
    }

    const identity = authenticated.ok
      ? { type: 'supabase_user', subject: authenticated.user.id, assurance: 'verified' }
      : { type: 'visitor_session', subject: visitor.session_id, assurance: 'anonymous' };
    const conversations = await listConversations(identity.type, identity.subject);

    res.status(200).json({
      ok: true,
      visitor: {
        id: visitor.visitor_id,
        email: authenticated.ok ? authenticated.user.email : visitor.email,
        authenticatedUserId: authenticated.ok ? authenticated.user.id : null,
      },
      conversations,
    });
  } catch (error) {
    console.error('IM public session failed:', error instanceof Error ? error.message : error);
    res.status(500).json({ ok: false, error: 'Unable to establish messaging session.' });
  }
}

async function findVisitorSession(req: ImRequest): Promise<VisitorRow | null> {
  const raw = parseCookies(headerValue(req.headers.cookie))[VISITOR_COOKIE];
  if (!raw) return null;
  const result = await sql<VisitorRow>`
    SELECT s.id AS session_id, s.visitor_id, v.display_name, v.email, s.expires_at
    FROM im_visitor_sessions s
    JOIN im_visitors v ON v.id = s.visitor_id
    WHERE s.session_token_hash = ${hashToken(raw)}
      AND s.revoked_at IS NULL
      AND s.expires_at > NOW()
  `;
  const session = result.rows[0] ?? null;
  if (session) {
    await sql`
      UPDATE im_visitor_sessions SET last_seen_at = NOW() WHERE id = ${session.session_id}::uuid
    `;
  }
  return session;
}

async function createVisitorSession(req: ImRequest, email: string | null): Promise<VisitorRow & { rawToken: string }> {
  const rawToken = randomToken();
  const ipHash = hashToken(getClientIp(req));
  const userAgentHash = hashToken(headerValue(req.headers['user-agent']) || 'unknown');
  const result = await sql.begin(async (tx) => {
    const visitor = await tx<{ id: string; email: string | null }>`
      INSERT INTO im_visitors (email) VALUES (${email}) RETURNING id, email
    `;
    const row = visitor.rows[0];
    if (!row) throw new Error('Visitor insert returned no row.');
    const session = await tx<{ id: string; expires_at: string }>`
      INSERT INTO im_visitor_sessions (
        visitor_id, session_token_hash, expires_at, ip_hash, user_agent_hash
      ) VALUES (
        ${row.id}::uuid, ${hashToken(rawToken)}, NOW() + INTERVAL '30 days', ${ipHash}, ${userAgentHash}
      ) RETURNING id, expires_at
    `;
    const sessionRow = session.rows[0];
    if (!sessionRow) throw new Error('Visitor session insert returned no row.');
    return {
      session_id: sessionRow.id,
      visitor_id: row.id,
      display_name: null,
      email: row.email,
      expires_at: sessionRow.expires_at,
      rawToken,
    };
  });
  return result;
}

async function listConversations(identityType: string, subject: string) {
  const result = await sql<{
    id: string;
    status: string;
    last_message_seq: number;
    last_message_at: string | null;
    updated_at: string;
  }>`
    SELECT c.id, c.status, c.last_message_seq, c.last_message_at, c.updated_at
    FROM im_conversations c
    JOIN im_conversation_identities i ON i.conversation_id = c.id
    WHERE i.identity_type = ${identityType}
      AND i.identity_subject = ${subject}
      AND i.revoked_at IS NULL
    ORDER BY c.updated_at DESC
    LIMIT 50
  `;
  return result.rows;
}

