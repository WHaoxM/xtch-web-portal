import crypto from 'node:crypto';
import { resolveAdminRole, type AdminRole } from './adminAllowlist';

type VercelRequestLike = {
  headers: Record<string, string | string[] | undefined>;
};

type AdminAuthResult =
  | { ok: true; email: string; role: AdminRole }
  | { ok: false; error: string; status: number };

export async function requireAdminAuth(req: VercelRequestLike): Promise<AdminAuthResult> {
  const authHeader = headerValue(req.headers.authorization);
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, error: 'Admin authentication required.', status: 401 };
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return { ok: false, error: 'Admin authentication required.', status: 401 };
  }

  const bypassEmail = process.env.DEV_AUTH_BYPASS_EMAIL;
  if (bypassEmail && token === 'dev-bypass-token') {
    const role = resolveAdminRole(bypassEmail);
    if (!role) {
      return {
        ok: false,
        error: 'Dev bypass email is not in the admin ops/tech allowlist.',
        status: 403,
      };
    }
    return { ok: true, email: bypassEmail, role };
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return { ok: false, error: 'Admin authentication is not configured.', status: 500 };
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey,
      },
    });

    if (!response.ok) {
      return { ok: false, error: 'Invalid or expired admin session.', status: 401 };
    }

    const user = (await response.json()) as { email?: string };
    const email = user.email;

    if (!email) {
      return { ok: false, error: 'Admin email not found.', status: 401 };
    }

    const role = resolveAdminRole(email);
    if (!role) {
      return { ok: false, error: 'You are not authorized to access admin features.', status: 403 };
    }

    return { ok: true, email, role };
  } catch (error) {
    console.error('Admin auth verification failed:', error);
    return { ok: false, error: 'Admin authentication failed.', status: 500 };
  }
}

/** Same as requireAdminAuth, but rejects ops (and any non-tech) with 403. */
export async function requireTechAdminAuth(req: VercelRequestLike): Promise<AdminAuthResult> {
  const admin = await requireAdminAuth(req);
  if (!admin.ok) return admin;
  if (admin.role !== 'tech') {
    return {
      ok: false,
      error: 'Tech admin access required for this action.',
      status: 403,
    };
  }
  return admin;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function hashIp(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}
