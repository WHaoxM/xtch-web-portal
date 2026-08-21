import { sql } from '../../../platform/db';
import { bearerToken, getClientIp, headerValue, type ImRequest, type ImResponse } from '../httpTypes';
import { hashToken, introspectXtMvpToken, issueStaffTokens } from '../imAuth';

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
    res.status(401).json({ ok: false, error: 'XT_MVP authentication required.' });
    return;
  }

  try {
    const external = await introspectXtMvpToken(token);
    if (!external) {
      await writeExchangeAudit('auth.exchange.failed', null, req, 'invalid_external_token');
      res.status(401).json({ ok: false, error: 'Invalid or expired XT_MVP session.' });
      return;
    }

    const result = await sql<StaffRow>`
      SELECT id, username, display_name, account_type, external_role
      FROM im_staff_accounts
      WHERE external_provider = 'xt_mvp'
        AND external_subject = ${external.subject}
        AND status = 'active'
    `;
    const staff = result.rows[0];
    if (!staff) {
      await writeExchangeAudit('auth.exchange.denied', external.subject, req, 'no_local_mapping');
      res.status(403).json({ ok: false, error: 'This XT_MVP account is not enabled for IM.' });
      return;
    }

    const issued = await issueStaffTokens(staff, {
      ipHash: hashToken(getClientIp(req)),
      userAgentHash: hashToken(headerValue(req.headers['user-agent']) || 'unknown'),
      externalRole: external.role,
    });
    await writeExchangeAudit('auth.exchange', staff.id, req, 'success');
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
    console.error('IM auth exchange failed:', error instanceof Error ? error.message : error);
    res.status(503).json({ ok: false, error: 'IM identity service is temporarily unavailable.' });
  }
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

