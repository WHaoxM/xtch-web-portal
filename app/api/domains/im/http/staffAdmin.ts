import { sql } from '../../../platform/db';
import { IM_CONVERSATION_SOURCES } from '../conversationAccess';
import { authenticateStaffRequest, hasPermission, hashToken, IM_SOURCE_SCOPED_PERMISSION_CODES, randomToken, type ImStaffPrincipal } from '../imAuth';
import { type ImRequest, type ImResponse } from '../httpTypes';

export default async function handler(req: ImRequest, res: ImResponse) {
  const auth = await authenticateStaffRequest(req);
  if (auth.ok === false) {
    res.status(auth.status).json({ ok: false, error: auth.error });
    return;
  }
  if (!canManageStaffAdmin(auth.principal)) {
    res.status(403).json({ ok: false, error: 'Staff management permission required.' });
    return;
  }
  if (req.method === 'POST' && req.url?.split('?')[0].endsWith('/invite')) {
    await invite(req, res, auth.principal.staffId);
    return;
  }
  if (req.method === 'POST') {
    if (isRecord(req.body) && req.body.action === 'set-source-scope') {
      await changeSourceScopeEnforcement(req, res, auth.principal.staffId);
      return;
    }
    await changePermission(req, res, auth.principal.staffId);
    return;
  }
  res.status(405).json({ ok: false, error: 'Method not allowed.' });
}

export function canManageStaffAdmin(principal: ImStaffPrincipal): boolean {
  return !principal.sourceScopeEnforced && hasPermission(principal, 'im:staff:manage');
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
  const scope = parseStaffPermissionScope(body, permissionCode);
  const revoke = body.revoke === true;
  if (!isUuid(staffId) || !permissionCode || !scope) {
    res.status(400).json({ ok: false, error: 'staffId, permissionCode and scope are required.' });
    return;
  }
  const { scopeType, scopeId, scopeSource } = scope;
  try {
    if (revoke) {
      await sql`
        UPDATE im_staff_permissions
        SET revoked_at = COALESCE(revoked_at, NOW())
        WHERE staff_id = ${staffId}::uuid
          AND permission_code = ${permissionCode}
          AND scope_type = ${scopeType}
          AND scope_id IS NOT DISTINCT FROM ${scopeId}::uuid
          AND scope_source IS NOT DISTINCT FROM ${scopeSource}
          AND revoked_at IS NULL
      `;
    } else {
      await sql`
        INSERT INTO im_staff_permissions (staff_id, permission_code, scope_type, scope_id, scope_source, granted_by)
        VALUES (${staffId}::uuid, ${permissionCode}, ${scopeType}, ${scopeId}::uuid, ${scopeSource}, ${grantedBy}::uuid)
        ON CONFLICT DO NOTHING
      `;
    }
    await sql`
      INSERT INTO im_audit_events (actor_type, actor_id, action, target_type, target_id, after_state)
      VALUES ('staff', ${grantedBy}, ${revoke ? 'permission.revoke' : 'permission.grant'}, 'staff_permission', ${staffId},
        ${JSON.stringify({ permissionCode, scopeType, scopeId, scopeSource })}::jsonb)
    `;
    res.status(200).json({ ok: true });
  } catch {
    res.status(400).json({ ok: false, error: 'Unable to change staff permission.' });
  }
}

export function parseStaffPermissionScope(body: Record<string, unknown>, permissionCode?: string): {
  scopeType: 'global' | 'tenant' | 'source';
  scopeId: string | null;
  scopeSource: string | null;
} | null {
  const rawScopeType = body.scopeType === undefined ? 'global' : body.scopeType;
  if (rawScopeType !== 'global' && rawScopeType !== 'tenant' && rawScopeType !== 'source') return null;
  const scopeType = rawScopeType;
  const scopeId = scopeType === 'tenant' ? stringValue(body.scopeId) : null;
  const normalizedSource = scopeType === 'source' ? stringValue(body.scopeSource).toLowerCase() : null;
  if (scopeType === 'tenant' && !isUuid(scopeId ?? '')) return null;
  if (scopeType === 'source' &&
      (!IM_CONVERSATION_SOURCES.includes(normalizedSource as (typeof IM_CONVERSATION_SOURCES)[number]) ||
       !IM_SOURCE_SCOPED_PERMISSION_CODES.includes(permissionCode as (typeof IM_SOURCE_SCOPED_PERMISSION_CODES)[number]))) return null;
  return { scopeType, scopeId, scopeSource: normalizedSource };
}

async function changeSourceScopeEnforcement(req: ImRequest, res: ImResponse, changedBy: string) {
  const body = isRecord(req.body) ? req.body : {};
  const staffId = stringValue(body.staffId);
  const enabled = body.sourceScopeEnforced;
  if (!isUuid(staffId) || typeof enabled !== 'boolean') {
    res.status(400).json({ ok: false, error: 'staffId and boolean sourceScopeEnforced are required.' });
    return;
  }
  try {
    const result = await sql.begin(async (tx) => {
      const staff = await tx<{ id: string; source_scope_enforced: boolean }>`
        SELECT id, source_scope_enforced
        FROM im_staff_accounts
        WHERE id = ${staffId}::uuid
        FOR UPDATE
      `;
      const current = staff.rows[0];
      if (!current) throw new StaffScopeError('Staff account not found.', 404);
      if (enabled) {
        const readableSource = await tx<{ id: string }>`
          SELECT id
          FROM im_staff_permissions
          WHERE staff_id = ${staffId}::uuid
            AND permission_code = 'im:conversation:read'
            AND scope_type = 'source'
            AND revoked_at IS NULL
          LIMIT 1
        `;
        if (!readableSource.rows[0]) {
          throw new StaffScopeError('Grant at least one source-scoped conversation read permission first.', 409);
        }
      }
      await tx`
        UPDATE im_staff_accounts
        SET source_scope_enforced = ${enabled}, updated_at = NOW()
        WHERE id = ${staffId}::uuid
      `;
      await tx`
        INSERT INTO im_audit_events (actor_type, actor_id, action, target_type, target_id, before_state, after_state)
        VALUES ('staff', ${changedBy}, 'staff.source_scope.enforcement', 'staff_account', ${staffId},
          ${JSON.stringify({ sourceScopeEnforced: current.source_scope_enforced })}::jsonb,
          ${JSON.stringify({ sourceScopeEnforced: enabled })}::jsonb)
      `;
      return enabled;
    });
    res.status(200).json({ ok: true, sourceScopeEnforced: result });
  } catch (error) {
    if (error instanceof StaffScopeError) {
      res.status(error.status).json({ ok: false, error: error.message });
      return;
    }
    res.status(400).json({ ok: false, error: 'Unable to change staff source scope.' });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
}

class StaffScopeError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}
