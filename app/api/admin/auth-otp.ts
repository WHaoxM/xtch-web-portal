import { resolveAdminRole } from '../lib/adminAllowlist';

type VercelRequestLike = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type VercelResponseLike = {
  status: (code: number) => VercelResponseLike;
  json: (body: unknown) => void;
};

/**
 * Send a Supabase email OTP only for Admin allowlist emails.
 * Does not require an existing session (this is the sign-in step).
 * Primary UX is {{ .Token }} on the same page; email_redirect_to is link fallback only.
 */
export default async function handler(req: VercelRequestLike, res: VercelResponseLike) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }

  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
  const email = String(body.email || '')
    .trim()
    .toLowerCase();
  const emailRedirectTo = sanitizeAdminEmailRedirectTo(body.emailRedirectTo ?? body.email_redirect_to);

  if (!email || !email.includes('@')) {
    res.status(400).json({ ok: false, error: 'A valid email is required.' });
    return;
  }

  if (!resolveAdminRole(email)) {
    res.status(403).json({
      ok: false,
      error: 'This email is not on the Admin allowlist.',
    });
    return;
  }

  const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '')
    .trim()
    .replace(/\/+$/, '');
  const anonKey = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();

  if (!supabaseUrl || !anonKey) {
    res.status(503).json({ ok: false, error: 'Supabase Auth is not configured.' });
    return;
  }

  try {
    const otpBody: Record<string, unknown> = {
      email,
      create_user: false,
    };
    if (emailRedirectTo) {
      otpBody.email_redirect_to = emailRedirectTo;
    }

    const response = await fetch(`${supabaseUrl}/auth/v1/otp`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${anonKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(otpBody),
    });

    if (!response.ok) {
      const errBody = (await response.json().catch(() => null)) as {
        msg?: string;
        message?: string;
        error_description?: string;
        error_code?: string;
      } | null;
      const message =
        errBody?.error_description || errBody?.message || errBody?.msg || 'Could not send sign-in code.';
      const normalized = message.toLowerCase();
      const rateLimited =
        response.status === 429 ||
        normalized.includes('rate limit') ||
        errBody?.error_code === 'over_email_send_rate_limit';
      res.status(rateLimited ? 429 : 502).json({
        ok: false,
        error: rateLimited ? 'Too many sign-in emails. Wait a minute and try again.' : message,
      });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Admin auth OTP failed:', error);
    res.status(500).json({ ok: false, error: 'Could not send sign-in code.' });
  }
}

/** Only allow http(s) redirects that explicitly target Admin (`auth_next=admin`). */
function sanitizeAdminEmailRedirectTo(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const value = raw.trim();
  if (!value || value.length > 2048) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    const next = (url.searchParams.get('auth_next') || '').replace(/^\/+/, '');
    if (next !== 'admin' && !next.startsWith('admin?')) return undefined;
    return value;
  } catch {
    return undefined;
  }
}
