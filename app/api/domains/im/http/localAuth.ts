import { sql } from '../../../platform/db';
import { hashPassword, hashToken, issueStaffTokens, verifyPassword } from '../imAuth';
import { getClientIp, headerValue, type ImRequest, type ImResponse } from '../httpTypes';

type StaffRow = {
  id: string;
  username: string;
  display_name: string;
  account_type: 'super_admin' | 'staff';
  password_hash: string | null;
};

export async function activate(req: ImRequest, res: ImResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  const body = record(req.body);
  const inviteToken = value(body.invite_token);
  const password = value(body.password);
  if (inviteToken.length < 32 || password.length < 10) {
    res.status(400).json({ ok: false, error: 'Invite token and a 10-character password are required.' });
    return;
  }
  const result = await sql<StaffRow>`
    SELECT id, username, display_name, account_type, password_hash
    FROM im_staff_accounts
    WHERE invite_token_hash = ${hashToken(inviteToken)}
      AND invite_expires_at > NOW() AND status = 'invited'
  `;
  const staff = result.rows[0];
  if (!staff) {
    res.status(401).json({ ok: false, error: 'Invite is invalid or expired.' });
    return;
  }
  await sql`
    UPDATE im_staff_accounts
    SET password_hash = ${hashPassword(password)}, status = 'active', invite_token_hash = NULL,
      invite_expires_at = NULL, updated_at = NOW()
    WHERE id = ${staff.id}::uuid
  `;
  res.status(200).json({ ok: true, staff: { id: staff.id, username: staff.username } });
}

export async function login(req: ImRequest, res: ImResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  const body = record(req.body);
  const username = value(body.username).toLowerCase();
  const password = value(body.password);
  const result = await sql<StaffRow>`
    SELECT id, username, display_name, account_type, password_hash
    FROM im_staff_accounts
    WHERE LOWER(username) = ${username} AND status = 'active'
  `;
  const staff = result.rows[0];
  if (!staff?.password_hash || !verifyPassword(password, staff.password_hash)) {
    res.status(401).json({ ok: false, error: 'Invalid username or password.' });
    return;
  }
  const issued = await issueStaffTokens(staff, {
    ipHash: hashToken(getClientIp(req)),
    userAgentHash: hashToken(headerValue(req.headers['user-agent']) || 'unknown'),
  });
  res.status(200).json({
    ok: true,
    access_token: issued.accessToken,
    refresh_token: issued.refreshToken,
    token_type: 'bearer',
    expires_in: issued.expiresIn,
    staff: { id: staff.id, username: staff.username, display_name: staff.display_name, permissions: issued.permissions },
  });
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function value(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

