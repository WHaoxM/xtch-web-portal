export type AuthProvider = 'google' | 'email' | 'apple';

export type AuthUser = {
  id: string;
  email: string;
  provider?: string;
};

export type AuthSession = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  user: AuthUser;
};

export type AuthIntent = 'checkout' | 'account';

type SupabaseUserResponse = {
  id?: string;
  email?: string;
  app_metadata?: {
    provider?: string;
  };
};

type AuthProviderStatusResponse = {
  ok?: boolean;
  providerEnabled?: boolean;
  error?: string;
};

const authStorageKey = 'syncing_travel_auth_session';
const authIntentStorageKey = 'syncing_travel_auth_intent';

export function isAuthConfigured() {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

export function readStoredAuthSession() {
  if (typeof window === 'undefined') return null;

  const bypassEmail = import.meta.env.VITE_DEV_AUTH_BYPASS_EMAIL;
  if (bypassEmail) {
    return {
      accessToken: 'dev-bypass-token',
      user: { id: 'dev-bypass-user-id', email: bypassEmail },
    } as AuthSession;
  }

  try {
    const raw = window.localStorage.getItem(authStorageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed.accessToken || !parsed.user?.email) return null;

    if (parsed.expiresAt && parsed.expiresAt < Date.now()) {
      clearStoredAuthSession();
      return null;
    }

    return parsed;
  } catch {
    clearStoredAuthSession();
    return null;
  }
}

export function clearStoredAuthSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(authStorageKey);
}

export function setPendingAuthIntent(intent: AuthIntent) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(authIntentStorageKey, intent);
}

export function consumePendingAuthIntent(): AuthIntent {
  if (typeof window === 'undefined') return 'account';
  const value =
    window.localStorage.getItem(authIntentStorageKey) ||
    window.sessionStorage.getItem(authIntentStorageKey);
  window.localStorage.removeItem(authIntentStorageKey);
  window.sessionStorage.removeItem(authIntentStorageKey);
  return value === 'checkout' ? 'checkout' : 'account';
}

export async function signInWithOAuth(provider: Exclude<AuthProvider, 'email'>, intent: AuthIntent) {
  const config = requireAuthConfig();
  await assertOAuthProviderEnabled(provider);

  const authorizeUrl = new URL(`${config.supabaseUrl}/auth/v1/authorize`);
  authorizeUrl.searchParams.set('provider', provider);
  authorizeUrl.searchParams.set('redirect_to', getAuthRedirectTo());

  setPendingAuthIntent(intent);
  window.location.assign(authorizeUrl.toString());
}

export async function sendEmailMagicLink(email: string, intent: AuthIntent) {
  const config = requireAuthConfig();
  setPendingAuthIntent(intent);

  const response = await fetch(`${config.supabaseUrl}/auth/v1/otp`, {
    method: 'POST',
    headers: {
      apikey: config.supabaseAnonKey,
      authorization: `Bearer ${config.supabaseAnonKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email,
      type: 'magiclink',
      options: {
        email_redirect_to: getAuthRedirectTo(),
      },
    }),
  });

  if (!response.ok) {
    const message = await readAuthError(response);
    throw new Error(friendlyEmailError(message));
  }
}

export async function consumeAuthRedirectSession() {
  const authError = findUrlParam('error_description') || findUrlParam('error');
  if (authError) {
    cleanupAuthUrl();
    throw new Error(decodeURIComponent(authError));
  }

  const accessToken = findUrlParam('access_token');
  if (!accessToken) return null;

  const config = requireAuthConfig();
  const user = await fetchAuthUser(config.supabaseUrl, config.supabaseAnonKey, accessToken);
  const expiresIn = Number(findUrlParam('expires_in') || '0');
  const session: AuthSession = {
    accessToken,
    refreshToken: findUrlParam('refresh_token') || undefined,
    expiresAt: expiresIn > 0 ? Date.now() + expiresIn * 1000 : undefined,
    user,
  };

  window.localStorage.setItem(authStorageKey, JSON.stringify(session));
  cleanupAuthUrl();

  // Best-effort: associate past guest orders placed with this email to the signed-in user.
  claimOrders(session.accessToken).catch(() => {
    // Ignore claim failures; the user is still signed in.
  });

  return session;
}

async function assertOAuthProviderEnabled(provider: Exclude<AuthProvider, 'email'>) {
  const statusUrl = new URL('/api/auth-provider-status', window.location.origin);
  statusUrl.searchParams.set('provider', provider);
  statusUrl.searchParams.set('redirect_to', getAuthRedirectTo());

  const response = await fetch(statusUrl.toString(), {
    headers: { accept: 'application/json' },
  });

  const result = (await response.json().catch(() => ({
    ok: false,
    providerEnabled: false,
    error: 'We could not verify this sign-in provider. Please continue with email.',
  }))) as AuthProviderStatusResponse;

  if (!response.ok || !result.providerEnabled) {
    throw new Error(result.error || `${providerName(provider)} sign-in is not available yet. Continue with email for now.`);
  }
}

function providerName(provider: Exclude<AuthProvider, 'email'>) {
  return provider === 'google' ? 'Google' : 'Apple';
}

function friendlyEmailError(message: string) {
  if (!message) return 'We could not send the sign-in email. Please try again.';
  const normalizedMessage = message.toLowerCase();
  if (normalizedMessage.includes('email address') && normalizedMessage.includes('invalid')) {
    return 'Use a real email address for the sign-in link.';
  }
  if (normalizedMessage.includes('rate limit')) {
    return 'Too many sign-in emails. Wait a minute and try again.';
  }

  return message;
}

function getSupabaseUrl() {
  return import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, '') || '';
}

function getSupabaseAnonKey() {
  return import.meta.env.VITE_SUPABASE_ANON_KEY || '';
}

function requireAuthConfig() {
  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase Auth is not configured.');
  }

  return { supabaseUrl, supabaseAnonKey };
}

function getAuthRedirectTo() {
  if (import.meta.env.VITE_AUTH_REDIRECT_URL) return import.meta.env.VITE_AUTH_REDIRECT_URL;
  return `${window.location.origin}${window.location.pathname}#/china-trips?auth=callback`;
}

async function fetchAuthUser(supabaseUrl: string, supabaseAnonKey: string, accessToken: string): Promise<AuthUser> {
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseAnonKey,
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const message = await readAuthError(response);
    throw new Error(message || 'We could not verify your sign-in session.');
  }

  const user = (await response.json()) as SupabaseUserResponse;
  if (!user.id || !user.email) {
    throw new Error('Your sign-in session did not include an email address.');
  }

  return {
    id: user.id,
    email: user.email,
    provider: user.app_metadata?.provider,
  };
}

function findUrlParam(name: string) {
  const hash = window.location.hash.replace(/^#/, '');
  const nestedHashIndex = hash.indexOf('#');
  const hashQueryIndex = hash.indexOf('?');
  const values = [
    new URLSearchParams(window.location.search),
    new URLSearchParams(hash),
    new URLSearchParams(nestedHashIndex >= 0 ? hash.slice(nestedHashIndex + 1) : ''),
    new URLSearchParams(hashQueryIndex >= 0 ? hash.slice(hashQueryIndex + 1).split('#')[0] : ''),
  ];

  for (const params of values) {
    const value = params.get(name);
    if (value) return value;
  }

  return '';
}

function cleanupAuthUrl() {
  const cleanUrl = `${window.location.origin}${window.location.pathname}#/china-trips`;
  window.history.replaceState(null, '', cleanUrl);
}

async function claimOrders(accessToken: string) {
  await fetch('/api/claim-orders', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
  });
}

async function readAuthError(response: Response) {
  const body = (await response.json().catch(() => null)) as { msg?: string; message?: string; error_description?: string } | null;
  return body?.error_description || body?.message || body?.msg || '';
}
