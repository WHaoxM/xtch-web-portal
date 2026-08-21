import { sql } from '../../../platform/db';
import { type ImRequest, type ImResponse } from '../httpTypes';
import { hashToken } from '../imAuth';

export default async function handler(req: ImRequest, res: ImResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }
  const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
  const refreshToken = typeof body.refresh_token === 'string' ? body.refresh_token.trim() : '';
  if (refreshToken) {
    await sql`
      UPDATE im_staff_sessions
      SET revoked_at = NOW()
      WHERE refresh_token_hash = ${hashToken(refreshToken)} AND revoked_at IS NULL
    `;
  }
  res.status(200).json({ ok: true });
}

