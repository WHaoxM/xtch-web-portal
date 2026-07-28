import { writeAuditLog } from '../lib/auditLog';
import { hashIp } from '../lib/adminAuth';
import {
  authenticateAdminQuickLogin,
  assertQuickLoginRateLimit,
  GENERIC_AUTH_ERROR,
  isAdminQuickLoginConfigured,
} from '../lib/adminQuickLogin';

type VercelRequestLike = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type VercelResponseLike = {
  status: (code: number) => VercelResponseLike;
  json: (body: unknown) => void;
};

function getClientIp(req: VercelRequestLike): string {
  const forwarded = headerValue(req.headers['x-forwarded-for']);
  if (forwarded) return forwarded.split(',')[0]?.trim() || '';
  return headerValue(req.headers['x-real-ip']) || '';
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(req: VercelRequestLike, res: VercelResponseLike) {
  if (req.method === 'GET') {
    res.status(200).json({ ok: true, enabled: isAdminQuickLoginConfigured() });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }

  const ip = getClientIp(req) || 'unknown';
  const ipHash = hashIp(ip);
  const rate = assertQuickLoginRateLimit(ipHash);
  if (!rate.ok) {
    res.status(429).json({ ok: false, error: rate.error });
    return;
  }

  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
  const email = String(body.email || '').trim();
  const password = String(body.password || '');

  const result = authenticateAdminQuickLogin(email, password);
  if (!result.ok) {
    try {
      await writeAuditLog({
        actorType: 'admin',
        action: 'admin_quick_login_failed',
        targetType: 'admin_session',
        targetId: 'quick-login',
        ipHash,
        userAgent: headerValue(req.headers['user-agent']),
        metadata: { reason: 'auth_failed' },
      });
    } catch {
      // ignore audit failures
    }
    res.status(result.status).json({ ok: false, error: result.error || GENERIC_AUTH_ERROR });
    return;
  }

  try {
    await writeAuditLog({
      actorType: 'admin',
      actorEmail: result.email,
      action: 'admin_quick_login',
      targetType: 'admin_session',
      targetId: 'quick-login',
      ipHash,
      userAgent: headerValue(req.headers['user-agent']),
    });
  } catch {
    // ignore audit failures
  }

  res.status(200).json({
    ok: true,
    accessToken: result.accessToken,
    email: result.email,
    expiresAt: result.expiresAt,
  });
}
