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
 * Omits email_redirect_to so the Magic Link template's {{ .Token }} is the primary path.
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
    const response = await fetch(`${supabaseUrl}/auth/v1/otp`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${anonKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email,
        create_user: false,
      }),
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
