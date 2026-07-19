import type { Session } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';

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

/** Traveler flows still use intent when no explicit return path was stored. */
export type AuthIntent = 'checkout' | 'account';

type AuthProviderStatusResponse = {
  ok?: boolean;
  providerEnabled?: boolean;
  error?: string;
};

type AuthSessionListener = (session: AuthSession | null) => void;

/** Legacy key — migrated once into Supabase JS storage, then removed. */
export const AUTH_SESSION_STORAGE_KEY = 'syncing_travel_auth_session';
const authIntentStorageKey = 'syncing_travel_auth_intent';
const authReturnPathKey = 'syncing_travel_auth_return_path';
const authFocusMeKey = 'syncing_travel_auth_focus_me';
/** Traveler default after Auth when no return path (Admin always sets `/admin` + `auth_next`). */
export const TRAVELER_DEFAULT_RETURN_PATH = '/china-trips';
/** Survives OAuth opens in a new tab (sessionStorage does not). */
const RETURN_PATH_TTL_MS = 2 * 60 * 60 * 1000;
const REFRESH_SKEW_MS = 60_000;

type StoredReturnPath = {
  path: string;
  expiresAt: number;
};

let memorySession: AuthSession | null = null;
let authBootstrapped = false;
let migratePromise: Promise<void> | null = null;
const sessionListeners = new Set<AuthSessionListener>();

export function isAuthConfigured() {
  return isSupabaseConfigured();
}

function bypassSession(): AuthSession | null {
  const bypassEmail = import.meta.env.VITE_DEV_AUTH_BYPASS_EMAIL;
  if (!bypassEmail) return null;
  return {
    accessToken: 'dev-bypass-token',
    user: { id: 'dev-bypass-user-id', email: bypassEmail },
  };
}

function toAuthSession(session: Session | null | undefined): AuthSession | null {
  if (!session?.access_token || !session.user?.email) return null;
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token || undefined,
    expiresAt: session.expires_at ? session.expires_at * 1000 : undefined,
    user: {
      id: session.user.id,
      email: session.user.email,
      provider: typeof session.user.app_metadata?.provider === 'string'
        ? session.user.app_metadata.provider
        : undefined,
    },
  };
}

function setMemorySession(session: AuthSession | null) {
  const prev = memorySession;
  memorySession = session;
  if (prev?.accessToken === session?.accessToken && prev?.user.id === session?.user.id) {
    return;
  }
  for (const listener of sessionListeners) {
    try {
      listener(session);
    } catch {
      // ignore listener errors
    }
  }
}

function readLegacyStoredSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed.accessToken || !parsed.user?.email) return null;
    if (parsed.expiresAt && parsed.expiresAt < Date.now()) {
      window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    return null;
  }
}

function readSdkSessionFromStorage(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key || !key.startsWith('sb-') || !key.includes('-auth-token')) continue;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Session & { currentSession?: Session };
      const session = parsed.access_token ? parsed : parsed.currentSession;
      const mapped = toAuthSession(session);
      if (mapped) return mapped;
    } catch {
      // keep scanning
    }
  }
  return null;
}

async function migrateLegacySession() {
  if (typeof window === 'undefined') return;
  const legacy = readLegacyStoredSession();
  if (!legacy) return;

  const client = getSupabaseClient();
  if (client && legacy.refreshToken) {
    try {
      await client.auth.setSession({
        access_token: legacy.accessToken,
        refresh_token: legacy.refreshToken,
      });
    } catch {
      // Drop unusable legacy session.
    }
  }

  window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
}

function ensureAuthBootstrap() {
  if (typeof window === 'undefined' || authBootstrapped) return;
  authBootstrapped = true;

  if (!memorySession) {
    memorySession = readSdkSessionFromStorage() || readLegacyStoredSession();
  }

  migratePromise = migrateLegacySession().finally(() => {
    migratePromise = null;
  });

  const client = getSupabaseClient();
  if (!client) return;

  void client.auth.getSession().then(({ data }) => {
    setMemorySession(toAuthSession(data.session));
  });

  client.auth.onAuthStateChange((_event, session) => {
    setMemorySession(toAuthSession(session));
  });
}

/** Subscribe to session changes (SDK + in-tab). Prefer over listening for the legacy storage key. */
export function subscribeAuthSession(listener: AuthSessionListener) {
  ensureAuthBootstrap();
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}

export function readStoredAuthSession() {
  if (typeof window === 'undefined') return null;

  const bypass = bypassSession();
  if (bypass) return bypass;

  ensureAuthBootstrap();
  return memorySession;
}

export async function getAccessToken(): Promise<string | null> {
  const bypass = bypassSession();
  if (bypass) return bypass.accessToken;

  const fresh = await ensureFreshSession();
  return fresh?.accessToken ?? null;
}

/** Refresh when expired or within skew; returns current session or null. */
export async function ensureFreshSession(): Promise<AuthSession | null> {
  const bypass = bypassSession();
  if (bypass) return bypass;

  ensureAuthBootstrap();
  if (migratePromise) await migratePromise;

  const client = getSupabaseClient();
  if (!client) {
    setMemorySession(null);
    return null;
  }

  const { data, error } = await client.auth.getSession();
  if (error || !data.session) {
    setMemorySession(null);
    return null;
  }

  const expiresAtMs = data.session.expires_at ? data.session.expires_at * 1000 : 0;
  const needsRefresh = !expiresAtMs || expiresAtMs - Date.now() < REFRESH_SKEW_MS;

  if (needsRefresh) {
    const refreshed = await client.auth.refreshSession();
    if (refreshed.error || !refreshed.data.session) {
      setMemorySession(null);
      return null;
    }
    const mapped = toAuthSession(refreshed.data.session);
    setMemorySession(mapped);
    return mapped;
  }

  const mapped = toAuthSession(data.session);
  setMemorySession(mapped);
  return mapped;
}

export function clearStoredAuthSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  setMemorySession(null);
  const client = getSupabaseClient();
  if (client) {
    void client.auth.signOut({ scope: 'local' });
  }
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

/** Store a same-origin app path (`/china-trips`) to return to after Auth. */
export function setPendingReturnPath(path?: string) {
  if (typeof window === 'undefined') return;
  const fallbackCurrent = `${window.location.pathname}${window.location.search || ''}`;
  const candidate = normalizeReturnPath(path ?? fallbackCurrent);
  if (!candidate) return;

  const payload: StoredReturnPath = {
    path: candidate,
    expiresAt: Date.now() + RETURN_PATH_TTL_MS,
  };
  // localStorage: OAuth redirects often open a new tab (sessionStorage would be empty).
  window.localStorage.setItem(authReturnPathKey, JSON.stringify(payload));
  window.sessionStorage.removeItem(authReturnPathKey);
}

export function consumePendingReturnPath(fallback = '/'): string {
  if (typeof window === 'undefined') return fallback;

  const fromUrl = readAuthNextFromUrl();
  const fromStore = readAndClearStoredReturnPath();
  if (fromUrl) return fromUrl;
  if (fromStore) return fromStore;
  return normalizeReturnPath(fallback) || '/';
}

export function isSafeInternalPath(path: string): boolean {
  if (!path.startsWith('/')) return false;
  if (path.includes('://')) return false;
  if (path.includes('..')) return false;
  if (path.includes('\\')) return false;
  return true;
}

/** @deprecated Use isSafeInternalPath — accepts legacy `#/…` or `/…`. */
export function isSafeInternalHashPath(path: string): boolean {
  return Boolean(normalizeReturnPath(path));
}

/**
 * Build Supabase redirect_to. Optional next path is embedded as `?auth_next=`
 * so it survives when Supabase replaces the hash with tokens (and new-tab opens).
 */
export function getAuthRedirectTo(options?: { nextHash?: string; nextPath?: string }) {
  const callbackUrl = resolveAuthCallbackUrl();
  const nextPath = normalizeReturnPath(options?.nextPath || options?.nextHash || '');
  if (!nextPath) return callbackUrl.toString();

  callbackUrl.searchParams.set('auth_next', nextPath.replace(/^\//, ''));
  return callbackUrl.toString();
}

function resolveAuthCallbackUrl(): URL {
  const envRedirect = (import.meta.env.VITE_AUTH_REDIRECT_URL as string | undefined)?.trim();
  try {
    if (envRedirect) {
      const parsed = new URL(envRedirect, window.location.origin);
      const looksLegacyHash =
        parsed.hash.includes('/auth/callback') ||
        parsed.hash.includes('/china-trips') ||
        parsed.pathname.includes('china-trips');
      if (looksLegacyHash || !parsed.pathname.includes('/auth/callback')) {
        return new URL(`${parsed.origin}/auth/callback`);
      }
      parsed.hash = '';
      return parsed;
    }
  } catch {
    // fall through
  }
  return new URL(`${window.location.origin}/auth/callback`);
}

export async function signInWithOAuth(
  provider: Exclude<AuthProvider, 'email'>,
  intent: AuthIntent,
  options?: { returnPath?: string },
) {
  const client = requireSupabaseClient();

  if (options?.returnPath) setPendingReturnPath(options.returnPath);
  else setPendingReturnPath();
  setPendingAuthIntent(intent);

  await assertOAuthProviderEnabled(provider);

  const returnPath = peekStoredReturnPath();
  const { error } = await client.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: getAuthRedirectTo(returnPath ? { nextPath: returnPath } : undefined),
      skipBrowserRedirect: false,
    },
  });

  if (error) {
    throw new Error(error.message || `${providerName(provider)} sign-in is not available yet.`);
  }
}

/** Traveler email OTP: send 6-digit code; email link also returns to Mini-App (not Admin). */
export async function sendEmailOtp(email: string, intent: AuthIntent) {
  const client = requireSupabaseClient();
  setPendingReturnPath();
  setPendingAuthIntent(intent);

  // Mail apps often open the link in a fresh browser with empty localStorage.
  // Embed auth_next so confirmation/magic links never fall through to Admin.
  let nextPath = peekStoredReturnPath() || TRAVELER_DEFAULT_RETURN_PATH;
  if (nextPath === '/admin' || nextPath.startsWith('/admin?')) {
    nextPath = TRAVELER_DEFAULT_RETURN_PATH;
  }

  const { error } = await client.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      shouldCreateUser: true,
      emailRedirectTo: getAuthRedirectTo({ nextPath }),
    },
  });

  if (error) {
    throw new Error(friendlyEmailError(error.message));
  }
}

/** @deprecated Use sendEmailOtp — kept briefly for any stray imports. */
export async function sendEmailMagicLink(email: string, intent: AuthIntent) {
  return sendEmailOtp(email, intent);
}

/** Admin-only OTP: server checks allowlist before calling Supabase. */
export async function sendAdminOtp(email: string) {
  setPendingReturnPath('/admin');
  setPendingAuthIntent('account');

  const response = await fetch('/api/admin/auth-otp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      email: email.trim(),
      // Link fallback when user clicks email instead of entering the 6-digit code.
      emailRedirectTo: getAuthRedirectTo({ nextPath: '/admin' }),
    }),
  });

  const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!response.ok || !result?.ok) {
    if (response.status === 404) {
      throw new Error(
        'Admin OTP API is missing. Rebuild with build:win11-home and restart deploy:serve.',
      );
    }
    throw new Error(result?.error || friendlyEmailError(''));
  }
}

/** @deprecated Use sendAdminOtp */
export async function sendAdminMagicLink(email: string) {
  return sendAdminOtp(email);
}

/** Verify 6-digit email OTP and establish session. */
export async function verifyEmailOtp(email: string, token: string): Promise<AuthSession> {
  const client = requireSupabaseClient();
  const code = token.replace(/\s+/g, '');

  const { data, error } = await client.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code,
    type: 'email',
  });

  if (error || !data.session) {
    throw new Error(friendlyOtpError(error?.message || ''));
  }

  const session = toAuthSession(data.session);
  if (!session) {
    throw new Error('Your sign-in session did not include an email address.');
  }

  setMemorySession(session);
  claimOrders(session.accessToken).catch(() => {
    // Ignore claim failures; the user is still signed in.
  });

  return session;
}

export async function consumeAuthRedirectSession() {
  const authError = findUrlParam('error_description') || findUrlParam('error');
  if (authError) {
    cleanupAuthUrl();
    throw new Error(decodeURIComponent(authError));
  }

  ensureAuthBootstrap();
  if (migratePromise) await migratePromise;

  // Copy ?auth_next= into storage before cleanupAuthUrl strips the query string.
  const authNext = readAuthNextFromUrl();
  if (authNext) setPendingReturnPath(authNext);

  const accessToken = findUrlParam('access_token');
  const refreshToken = findUrlParam('refresh_token') || '';
  const client = getSupabaseClient();

  if (accessToken && client) {
    const { data, error } = await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    cleanupAuthUrl();
    if (error || !data.session) {
      throw new Error(error?.message || 'We could not verify your sign-in session.');
    }
    const session = toAuthSession(data.session);
    if (!session) {
      throw new Error('Your sign-in session did not include an email address.');
    }
    setMemorySession(session);
    claimOrders(session.accessToken).catch(() => {
      // Ignore claim failures; the user is still signed in.
    });
    return session;
  }

  if (!accessToken && client) {
    // detectSessionInUrl may have already hydrated the SDK session.
    const { data } = await client.auth.getSession();
    const session = toAuthSession(data.session);
    if (session && urlHasAuthTokens()) {
      cleanupAuthUrl();
      setMemorySession(session);
      claimOrders(session.accessToken).catch(() => {
        // ignore
      });
      return session;
    }
  }

  return null;
}

/**
 * Consume tokens (if present) and navigate to the pending return path.
 * @returns true when a session was established from the URL.
 */
export async function completeAuthRedirectNavigation(): Promise<boolean> {
  const session = await consumeAuthRedirectSession();
  if (!session) return false;

  navigateToAppPath(await resolvePostAuthReturnPath(session));
  return true;
}

/**
 * Prefer stored/auth_next path; else traveler default.
 * Never infer `/admin` from allowlist alone — traveler mail-app browsers lose
 * localStorage, and allowlisted test emails must still return to Mini-App.
 * Admin links must carry `?auth_next=admin` (or stored `/admin`).
 */
export async function resolvePostAuthReturnPath(_session: AuthSession): Promise<string> {
  void _session;
  const intent = consumePendingAuthIntent();
  const returnPath = consumePendingReturnPath('');
  if (returnPath) {
    if (isChinaTripsPath(returnPath) && intent === 'account') markPostAuthMeFocus();
    return returnPath;
  }

  if (intent === 'checkout') return '/china-trips';

  if (intent === 'account') markPostAuthMeFocus();
  return TRAVELER_DEFAULT_RETURN_PATH;
}

export function navigateToAppPath(path: string) {
  const normalized = normalizeReturnPath(path) || '/';
  window.location.replace(`${window.location.origin}${normalized}`);
}

/** After traveler account sign-in, China Trips should open the Me tab once. */
export function markPostAuthMeFocus() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(authFocusMeKey, '1');
}

export function consumePostAuthMeFocus(): boolean {
  if (typeof window === 'undefined') return false;
  const value = window.sessionStorage.getItem(authFocusMeKey);
  window.sessionStorage.removeItem(authFocusMeKey);
  return value === '1';
}

function isChinaTripsPath(path: string): boolean {
  const normalized = normalizeReturnPath(path);
  return (
    normalized === '/china-trips' ||
    normalized.startsWith('/china-trips?') ||
    normalized === '/china-tours' ||
    normalized.startsWith('/china-tours?')
  );
}

export function urlHasAuthTokens(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.hash.includes('access_token') ||
    window.location.search.includes('access_token') ||
    Boolean(findUrlParam('access_token'))
  );
}

/** Normalize legacy `#/path` or `path` into a safe `/path`. */
export function normalizeReturnPath(path: string): string {
  let candidate = (path || '').trim();
  if (!candidate) return '';
  if (candidate.startsWith('#/')) candidate = candidate.slice(1);
  else if (candidate.startsWith('#')) candidate = candidate.slice(1);
  if (!candidate.startsWith('/')) candidate = `/${candidate}`;
  if (!isSafeInternalPath(candidate)) return '';
  if (
    candidate.includes('access_token') ||
    candidate === '/auth/callback' ||
    candidate.startsWith('/auth/callback?')
  ) {
    return '';
  }
  return candidate;
}

/** Read `?auth_next=admin` (survives Supabase replacing the hash with tokens). */
function readAuthNextFromUrl(): string {
  if (typeof window === 'undefined') return '';
  const raw = new URLSearchParams(window.location.search).get('auth_next') || '';
  return normalizeReturnPath(raw);
}

function peekStoredReturnPath(): string {
  if (typeof window === 'undefined') return '';
  return readStoredReturnPath(false);
}

function readAndClearStoredReturnPath(): string {
  return readStoredReturnPath(true);
}

function readStoredReturnPath(clear: boolean): string {
  if (typeof window === 'undefined') return '';

  const sources = [window.localStorage, window.sessionStorage];
  let found = '';

  for (const storage of sources) {
    const raw = storage.getItem(authReturnPathKey);
    if (!raw) continue;

    // Legacy: plain "#/admin" or "/admin" string in sessionStorage
    if ((raw.startsWith('#/') || raw.startsWith('/')) && !raw.startsWith('{')) {
      const normalized = normalizeReturnPath(raw);
      if (normalized) {
        found = normalized;
        break;
      }
    }

    try {
      const parsed = JSON.parse(raw) as StoredReturnPath;
      const normalized = normalizeReturnPath(parsed?.path || '');
      if (!normalized) continue;
      if (parsed.expiresAt && parsed.expiresAt < Date.now()) continue;
      found = normalized;
      break;
    } catch {
      continue;
    }
  }

  if (clear) {
    window.localStorage.removeItem(authReturnPathKey);
    window.sessionStorage.removeItem(authReturnPathKey);
  }
  return found;
}

async function assertOAuthProviderEnabled(provider: Exclude<AuthProvider, 'email'>) {
  const statusUrl = new URL('/api/auth-provider-status', window.location.origin);
  statusUrl.searchParams.set('provider', provider);
  statusUrl.searchParams.set(
    'redirect_to',
    getAuthRedirectTo({ nextPath: peekStoredReturnPath() || undefined }),
  );

  const response = await fetch(statusUrl.toString(), {
    headers: { accept: 'application/json' },
  });

  const result = (await response.json().catch(() => ({
    ok: false,
    providerEnabled: false,
    error: 'We could not verify this sign-in provider. Please continue with email.',
  }))) as AuthProviderStatusResponse;

  if (!response.ok || !result.providerEnabled) {
    throw new Error(
      result.error ||
        `${providerName(provider)} sign-in is not available yet. Continue with email for now.`,
    );
  }
}

function providerName(provider: Exclude<AuthProvider, 'email'>) {
  return provider === 'google' ? 'Google' : 'Apple';
}

function friendlyEmailError(message: string) {
  if (!message) return 'We could not send the sign-in code. Please try again.';
  const normalizedMessage = message.toLowerCase();
  if (normalizedMessage.includes('email address') && normalizedMessage.includes('invalid')) {
    return 'Use a real email address for the sign-in code.';
  }
  if (normalizedMessage.includes('rate limit') || normalizedMessage.includes('security purposes')) {
    return 'Too many sign-in emails. Wait a minute and try again.';
  }
  if (normalizedMessage.includes('allowlist')) {
    return message;
  }

  return message;
}

function friendlyOtpError(message: string) {
  if (!message) return 'That code is invalid or expired. Request a new one.';
  const normalized = message.toLowerCase();
  if (normalized.includes('expired') || normalized.includes('invalid') || normalized.includes('otp')) {
    return 'That code is invalid or expired. Request a new one.';
  }
  return message;
}

function requireSupabaseClient() {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase Auth is not configured.');
  }
  return client;
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
  // Leave a stable callback path; caller navigates to the real return path next.
  const cleanUrl = `${window.location.origin}/auth/callback`;
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
