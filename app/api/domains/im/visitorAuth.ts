import { sql } from '../../platform/db';
import { hashToken } from './imAuth';
import { headerValue, parseCookies, type ImRequest } from './httpTypes';

/** __Host- cookies require Secure; local HTTP development uses a compatible name. */
export const VISITOR_COOKIE_NAME = process.env.NODE_ENV === 'production' ? '__Host-im_visitor' : 'im_visitor';

export type VisitorPrincipal = {
  sessionId: string;
  visitorId: string;
};

export async function getVisitorPrincipal(req: ImRequest): Promise<VisitorPrincipal | null> {
  const raw = parseCookies(headerValue(req.headers.cookie))[VISITOR_COOKIE_NAME];
  if (!raw) return null;
  const result = await sql<VisitorPrincipal>`
    SELECT id AS "sessionId", visitor_id AS "visitorId"
    FROM im_visitor_sessions
    WHERE session_token_hash = ${hashToken(raw)}
      AND revoked_at IS NULL
      AND expires_at > NOW()
  `;
  const principal = result.rows[0] ?? null;
  if (principal) {
    await sql`UPDATE im_visitor_sessions SET last_seen_at = NOW() WHERE id = ${principal.sessionId}::uuid`;
  }
  return principal;
}
