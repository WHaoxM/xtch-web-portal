import { sql } from '../../../platform/db';
import { requireAdminAuth } from '../../identity/admin/adminAuth';
import { isAdminQuickLoginToken } from '../../identity/admin/adminQuickLogin';
import { bearerToken, getClientIp, headerValue, type ImRequest, type ImResponse } from '../httpTypes';
import { hashToken, ImAccessDeniedError, introspectXtMvpToken, issueStaffTokens } from '../imAuth';

type StaffRow = {
  id: string;
  username: string;
  display_name: string;
  account_type: 'super_admin' | 'staff';
  external_role: string | null;
};

export default async function handler(req: ImRequest, res: ImResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }

  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ ok: false, error: 'Admin or XT_MVP authentication required.' });
    return;
  }

  if (classifyImExchangeCredential(token) === 'admin_quick') {
    await exchangeAdminQuickLogin(req, res);
    return;
  }

  let matchedStaffId: string | null = null;
  try {
    const external = await introspectXtMvpToken(token);
    if (!external) {
      await writeExchangeAudit('auth.exchange.failed', null, req, 'invalid_external_token');
      res.status(401).json({ ok: false, error: 'Invalid or expired XT_MVP session.' });
      return;
    }

    const { staff, demoProvisioned } = await resolveStaff(external);
    if (!staff) {
      await writeExchangeAudit(
        'auth.exchange.denied',
        external.subject,
        req,
        isDemoAdmin(external) ? 'demo_admin_disabled' : 'no_local_mapping',
      );
      res.status(403).json({ ok: false, error: 'This XT_MVP account is not enabled for IM.' });
      return;
    }
    matchedStaffId = staff.id;

    const issued = await issueStaffTokens(staff, {
      ipHash: hashToken(getClientIp(req)),
      userAgentHash: hashToken(headerValue(req.headers['user-agent']) || 'unknown'),
      externalRole: external.role,
    });
    await writeExchangeAudit('auth.exchange', staff.id, req, demoProvisioned ? 'demo_admin_bootstrapped' : 'success');
    res.status(200).json({
      ok: true,
      access_token: issued.accessToken,
      refresh_token: issued.refreshToken,
      token_type: 'bearer',
      expires_in: issued.expiresIn,
      staff: {
        id: staff.id,
        username: staff.username,
        display_name: staff.display_name,
        account_type: staff.account_type,
        permissions: issued.permissions,
        tenant_ids: issued.tenantIds,
      },
    });
  } catch (error) {
    if (error instanceof ImAccessDeniedError) {
      await writeExchangeAudit('auth.exchange.denied', matchedStaffId, req, 'im_access_not_enabled');
      res.status(403).json({ ok: false, error: error.message });
      return;
    }
    console.error('IM auth exchange failed:', error instanceof Error ? error.message : error);
    res.status(503).json({ ok: false, error: 'IM identity service is temporarily unavailable.' });
  }
}

export function classifyImExchangeCredential(token: string): 'admin_quick' | 'xt_mvp' {
  return isAdminQuickLoginToken(token) ? 'admin_quick' : 'xt_mvp';
}

export type AdminQuickMappingCandidate = StaffRow & {
  external_provider: string | null;
  external_subject: string | null;
  status: string;
  source_scope_enforced: boolean;
};

export function resolveAdminQuickLoginStaff(email: string, candidate: AdminQuickMappingCandidate | null): StaffRow | null {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !candidate ||
      candidate.external_provider !== 'admin_quick' ||
      candidate.external_subject !== normalizedEmail ||
      candidate.status !== 'active' ||
      candidate.account_type !== 'staff' ||
      candidate.source_scope_enforced !== true) {
    return null;
  }
  return {
    id: candidate.id,
    username: candidate.username,
    display_name: candidate.display_name,
    account_type: candidate.account_type,
    external_role: candidate.external_role,
  };
}

async function exchangeAdminQuickLogin(req: ImRequest, res: ImResponse) {
  let matchedStaffId: string | null = null;
  try {
    // This is the same HMAC, expiry, configured-email, and current allowlist gate used by /api/admin/*.
    const admin = await requireAdminAuth(req);
    if (!admin.ok) {
      await writeExchangeAudit('auth.exchange.denied', null, req, 'admin_quick_auth_failed');
      res.status(admin.status).json({ ok: false, error: admin.error });
      return;
    }

    const mapping = await sql<AdminQuickMappingCandidate>`
      SELECT id, username, display_name, account_type, external_role,
        external_provider, external_subject, status, source_scope_enforced
      FROM im_staff_accounts
      WHERE external_provider = 'admin_quick'
        AND external_subject = ${admin.email}
        AND status = 'active'
        AND account_type = 'staff'
        AND source_scope_enforced = TRUE
      LIMIT 1
    `;
    const staff = resolveAdminQuickLoginStaff(admin.email, mapping.rows[0] ?? null);
    if (!staff) {
      await writeExchangeAudit('auth.exchange.denied', null, req, 'admin_quick_no_explicit_mapping');
      res.status(403).json({ ok: false, error: 'This admin account is not explicitly enabled for IM.' });
      return;
    }
    matchedStaffId = staff.id;

    const issued = await issueStaffTokens(staff, {
      ipHash: hashToken(getClientIp(req)),
      userAgentHash: hashToken(headerValue(req.headers['user-agent']) || 'unknown'),
      createRefreshSession: false,
      adminQuickEmail: admin.email,
    });
    await writeExchangeAudit('auth.exchange', staff.id, req, 'admin_quick_sso_success');
    res.status(200).json({
      ok: true,
      access_token: issued.accessToken,
      token_type: 'bearer',
      expires_in: issued.expiresIn,
      staff: {
        id: staff.id,
        username: staff.username,
        display_name: staff.display_name,
        account_type: staff.account_type,
        permissions: issued.permissions,
        tenant_ids: issued.tenantIds,
      },
    });
  } catch (error) {
    if (error instanceof ImAccessDeniedError) {
      await writeExchangeAudit('auth.exchange.denied', matchedStaffId, req, 'im_access_not_enabled');
      res.status(403).json({ ok: false, error: error.message });
      return;
    }
    console.error('IM admin quick-login exchange failed:', error instanceof Error ? error.message : error);
    res.status(503).json({ ok: false, error: 'IM identity service is temporarily unavailable.' });
  }
}

async function resolveStaff(external: Awaited<ReturnType<typeof introspectXtMvpToken>>): Promise<{
  staff: StaffRow | null;
  demoProvisioned: boolean;
}> {
  if (!external) return { staff: null, demoProvisioned: false };
  const mapped = await sql<StaffRow>`
    SELECT id, username, display_name, account_type, external_role
    FROM im_staff_accounts
    WHERE external_provider = 'xt_mvp'
      AND external_subject = ${external.subject}
      AND status = 'active'
  `;
  if (mapped.rows[0]) {
    // demo_admin 可能早于新增权限存在。每次 exchange 都对齐其固定权限集合，
    // 避免旧账号永久缺少后来加入的会话生命周期能力。
    if (isDemoAdmin(external)) await ensureDemoAdminPermissions(mapped.rows[0].id);
    return { staff: mapped.rows[0], demoProvisioned: false };
  }
  if (!isDemoAdmin(external) || process.env.XTCH_IM_DEMO_ADMIN_ENABLED !== 'true') {
    return { staff: null, demoProvisioned: false };
  }

  const existing = await sql<StaffRow & { external_provider: string | null; external_subject: string | null }>`
    SELECT id, username, display_name, account_type, external_role, external_provider, external_subject
    FROM im_staff_accounts
    WHERE LOWER(username) = 'demo_admin'
    LIMIT 1
  `;
  const row = existing.rows[0];
  if (row?.external_subject && row.external_subject !== external.subject) {
    return { staff: null, demoProvisioned: false };
  }

  let staff: StaffRow | null = row
    ? (await sql<StaffRow>`
        UPDATE im_staff_accounts
        SET status = 'active', external_provider = 'xt_mvp', external_subject = ${external.subject},
          external_role = ${external.role}, updated_at = NOW()
        WHERE id = ${row.id}::uuid AND account_type = 'staff'
        RETURNING id, username, display_name, account_type, external_role
      `).rows[0] ?? null
    : (await sql<StaffRow>`
        INSERT INTO im_staff_accounts (
          username, display_name, status, account_type, external_provider, external_subject, external_role
        ) VALUES ('demo_admin', 'Demo Admin', 'active', 'staff', 'xt_mvp', ${external.subject}, ${external.role})
        ON CONFLICT DO NOTHING
        RETURNING id, username, display_name, account_type, external_role
      `).rows[0] ?? null;

  if (!staff) {
    const retry = await sql<StaffRow>`
      SELECT id, username, display_name, account_type, external_role
      FROM im_staff_accounts
      WHERE LOWER(username) = 'demo_admin' AND status = 'active' AND account_type = 'staff'
    `;
    staff = retry.rows[0] ?? null;
  }
  if (!staff) return { staff: null, demoProvisioned: false };

  await ensureDemoAdminPermissions(staff.id);
  return { staff, demoProvisioned: true };
}

async function ensureDemoAdminPermissions(staffId: string): Promise<void> {
  for (const permissionCode of ['im:conversation:read', 'im:conversation:close', 'im:message:send', 'im:assignment:claim']) {
    await sql`
      INSERT INTO im_staff_permissions (staff_id, permission_code, scope_type, scope_id)
      VALUES (${staffId}::uuid, ${permissionCode}, 'global', NULL)
      ON CONFLICT DO NOTHING
    `;
  }
}

function isDemoAdmin(external: { username?: string; role: string }): boolean {
  return external.username?.trim().toLowerCase() === 'demo_admin'
    && external.role.trim().toLowerCase() === 'tenant_admin';
}

async function writeExchangeAudit(
  action: string,
  actorId: string | null,
  req: ImRequest,
  reason: string,
) {
  await sql`
    INSERT INTO im_audit_events (
      actor_type, actor_id, action, target_type, target_id, after_state, ip_hash, user_agent_hash
    ) VALUES (
      ${actorId ? 'staff' : 'system'}, ${actorId}, ${action}, 'im_staff_session', 'exchange',
      ${JSON.stringify({ reason })}::jsonb,
      ${hashToken(getClientIp(req))},
      ${hashToken(headerValue(req.headers['user-agent']) || 'unknown')}
    )
  `;
}
