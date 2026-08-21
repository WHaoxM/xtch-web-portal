import { sql } from '../../../platform/db';
import { authenticateStaffRequest, hasPermission, hashToken, randomToken } from '../imAuth';
import { type ImRequest, type ImResponse } from '../httpTypes';

export default async function handler(req: ImRequest, res: ImResponse) {
  const auth = await authenticateStaffRequest(req);
  if (!auth.ok) {
    res.status(auth.status).json({ ok: false, error: auth.error });
    return;
  }
  if (!hasPermission(auth.principal, 'im:staff:manage')) {
    res.status(403).json({ ok: false, error: 'Staff management permission required.' });
    return;
  }
  if (req.method === 'POST' && req.url?.split('?')[0].endsWith('/invite')) {
    await invite(req, res, auth.principal.staffId);
    return;
  }
  if (req.method === 'POST') {
    await changePermission(req, res, auth.principal.staffId);
    return;
  }
  res.status(405).json({ ok: false, error: 'Method not allowed.' });
}

async function invite(req: ImRequest, res: ImResponse, grantedBy: string) {
  const body = isRecord(req.body) ? req.body : {};
  const username = stringValue(body.username).toLowerCase();
  const email = stringValue(body.email).toLowerCase() || null;
  const displayName = stringValue(body.displayName) || username;
  if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(username) || !displayName) {
    res.status(400).json({ ok: false, error: 'Valid username and display name are required.' });
    return;
  }
  const inviteToken = randomToken();
  try {
    const result = await sql`
      INSERT INTO im_staff_accounts (
        username, email, display_name, status, invite_token_hash, invite_expires_at
      ) VALUES (
        ${username}, ${email}, ${displayName}, 'invited', ${hashToken(inviteToken)}, NOW() + INTERVAL '24 hours'
      )
      RETURNING id, username, email, display_name, status, invite_expires_at
    `;
    const staff = result.rows[0];
    if (!staff) throw new Error('Invite insert returned no row.');
    await sql`
      INSERT INTO im_audit_events (actor_type, actor_id, action, target_type, target_id, after_state)
      VALUES ('staff', ${grantedBy}, 'staff.invite', 'staff_account', ${staff.id}, ${JSON.stringify({ username })}::jsonb)
    `;
    res.status(201).json({
      ok: true,
      staff,
      // Only expose the one-time token in explicitly local development.
      activation_token: process.env.NODE_ENV === 'production' ? undefined : inviteToken,
    });
  } catch (error) {
    const message = String(error).includes('im_staff_accounts_username_uidx')
      ? 'Username is already in use.'
      : 'Unable to invite staff account.';
    res.status(400).json({ ok: false, error: message });
  }
}

async function changePermission(req: ImRequest, res: ImResponse, grantedBy: string) {
  const body = isRecord(req.body) ? req.body : {};
  const staffId = stringValue(body.staffId);
  const permissionCode = stringValue(body.permissionCode);
  const scopeType = body.scopeType === 'tenant' ? 'tenant' : 'global';
  const scopeId = scopeType === 'tenant' ? stringValue(body.scopeId) : null;
  const revoke = body.revoke === true;
  if (!staffId || !permissionCode || (scopeType === 'tenant' && !scopeId)) {
    res.status(400).json({ ok: false, error: 'staffId, permissionCode and scope are required.' });
    return;
  }
  try {
    if (revoke) {
      await sql`
        UPDATE im_staff_permissions
        SET revoked_at = COALESCE(revoked_at, NOW())
        WHERE staff_id = ${staffId}::uuid
          AND permission_code = ${permissionCode}
          AND scope_type = ${scopeType}
          AND scope_id IS NOT DISTINCT FROM ${scopeId}::uuid
          AND revoked_at IS NULL
      `;
    } else {
      await sql`
        INSERT INTO im_staff_permissions (staff_id, permission_code, scope_type, scope_id, granted_by)
        VALUES (${staffId}::uuid, ${permissionCode}, ${scopeType}, ${scopeId}::uuid, ${grantedBy}::uuid)
        ON CONFLICT DO NOTHING
      `;
    }
    await sql`
      INSERT INTO im_audit_events (actor_type, actor_id, action, target_type, target_id, after_state)
      VALUES ('staff', ${grantedBy}, ${revoke ? 'permission.revoke' : 'permission.grant'}, 'staff_permission', ${staffId},
        ${JSON.stringify({ permissionCode, scopeType, scopeId })}::jsonb)
    `;
    res.status(200).json({ ok: true });
  } catch {
    res.status(400).json({ ok: false, error: 'Unable to change staff permission.' });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

