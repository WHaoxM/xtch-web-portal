import { sql } from '../../../platform/db';
import { type ImRequest, type ImResponse } from '../httpTypes';
import { hashToken, ImAccessDeniedError, issueStaffTokens } from '../imAuth';

type SessionRow = {
  session_id: string;
  token_family: string;
  staff_id: string;
  username: string;
  display_name: string;
  account_type: 'super_admin' | 'staff';
};

export default async function handler(req: ImRequest, res: ImResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }
  const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
  const refreshToken = typeof body.refresh_token === 'string' ? body.refresh_token.trim() : '';
  if (!refreshToken || refreshToken.length < 32) {
    res.status(401).json({ ok: false, error: 'Refresh token required.' });
    return;
  }

  try {
    const result = await sql<SessionRow>`
      SELECT s.id AS session_id, s.token_family, a.id AS staff_id, a.username,
        a.display_name, a.account_type
      FROM im_staff_sessions s
      JOIN im_staff_accounts a ON a.id = s.staff_id
      WHERE s.refresh_token_hash = ${hashToken(refreshToken)}
        AND s.revoked_at IS NULL
        AND s.expires_at > NOW()
        AND a.status = 'active'
    `;
    const session = result.rows[0];
    if (!session) {
      res.status(401).json({ ok: false, error: 'Invalid or expired refresh token.' });
      return;
    }

    const issued = await issueStaffTokens(
      {
        id: session.staff_id,
        username: session.username,
        display_name: session.display_name,
        account_type: session.account_type,
      },
      { tokenFamily: session.token_family },
    );
    await sql`
      UPDATE im_staff_sessions
      SET revoked_at = NOW(), replaced_by = ${issued.sessionId}::uuid, last_used_at = NOW()
      WHERE id = ${session.session_id}::uuid AND revoked_at IS NULL
    `;
    res.status(200).json({
      ok: true,
      access_token: issued.accessToken,
      refresh_token: issued.refreshToken,
      token_type: 'bearer',
      expires_in: issued.expiresIn,
    });
  } catch (error) {
    if (error instanceof ImAccessDeniedError) {
      res.status(403).json({ ok: false, error: error.message });
      return;
    }
    console.error('IM refresh failed:', error instanceof Error ? error.message : error);
    res.status(503).json({ ok: false, error: 'IM session service is temporarily unavailable.' });
  }
}
