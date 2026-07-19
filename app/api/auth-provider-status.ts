type VercelRequestLike = {
  method?: string;
  url?: string;
  query?: Record<string, string | string[] | undefined>;
};

type VercelResponseLike = {
  status: (code: number) => VercelResponseLike;
  json: (body: unknown) => void;
};

type AuthProvider = 'google' | 'apple';

const supportedProviders = new Set<AuthProvider>(['google', 'apple']);

export default async function handler(req: VercelRequestLike, res: VercelResponseLike) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }

  const provider = queryValue(req, 'provider') as AuthProvider;
  if (!supportedProviders.has(provider)) {
    res.status(400).json({ ok: false, error: 'Unsupported auth provider.' });
    return;
  }

  const supabaseUrl = getSupabaseUrl();
  if (!supabaseUrl) {
    res.status(500).json({ ok: false, error: 'Supabase Auth is not configured.' });
    return;
  }

  const redirectTo = queryValue(req, 'redirect_to') || getDefaultRedirectUrl(req);
  const authorizeUrl = new URL(`${supabaseUrl}/auth/v1/authorize`);
  authorizeUrl.searchParams.set('provider', provider);
  authorizeUrl.searchParams.set('redirect_to', redirectTo);

  try {
    const authResponse = await fetch(authorizeUrl, { redirect: 'manual' });

    if (authResponse.status >= 300 && authResponse.status < 400) {
      res.status(200).json({ ok: true, providerEnabled: true });
      return;
    }

    const message = await readAuthError(authResponse);
    res.status(authResponse.status === 400 ? 200 : 502).json({
      ok: authResponse.status === 400,
      providerEnabled: false,
      error: friendlyProviderError(provider, message),
      providerError: message,
    });
  } catch {
    res.status(502).json({
      ok: false,
      providerEnabled: false,
      error: 'We could not verify this sign-in provider. Please continue with email.',
    });
  }
}

function getSupabaseUrl() {
  return (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/+$/, '');
}

function queryValue(req: VercelRequestLike, key: string) {
  const fromQuery = req.query?.[key];
  if (Array.isArray(fromQuery)) return fromQuery[0] || '';
  if (fromQuery) return fromQuery;

  const url = req.url ? new URL(req.url, 'http://localhost') : null;
  return url?.searchParams.get(key) || '';
}

function getDefaultRedirectUrl(req: VercelRequestLike) {
  const url = req.url ? new URL(req.url, 'http://localhost') : null;
  const origin = url?.origin === 'http://localhost' ? 'http://localhost:3000' : url?.origin || 'http://localhost:3000';
  return `${origin}/auth/callback`;
}

async function readAuthError(response: Response) {
  const body = (await response.json().catch(() => null)) as { msg?: string; message?: string; error_description?: string } | null;
  return body?.error_description || body?.message || body?.msg || '';
}

function friendlyProviderError(provider: AuthProvider, message: string) {
  const providerName = provider === 'google' ? 'Google' : 'Apple';
  if (message.toLowerCase().includes('provider is not enabled')) {
    return `${providerName} sign-in is not enabled in Supabase yet. Continue with email for now.`;
  }

  return message || `${providerName} sign-in is not available yet. Continue with email for now.`;
}
