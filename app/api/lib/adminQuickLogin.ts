import crypto from 'node:crypto';
import { resolveAdminRole } from './adminAllowlist';

const TOKEN_PREFIX = 'aq1.';
const TOKEN_TTL_SECONDS = 12 * 60 * 60;
const HMAC_SALT = 'xtch-admin-quick-v1';
const GENERIC_AUTH_ERROR = 'Invalid email or password.';

/** In-memory rate limit: 10 attempts / 10 minutes per IP hash. */
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 10;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export function isAdminQuickLoginConfigured(): boolean {
  return Boolean(readQuickLoginEmail() && readQuickLoginPassword());
}

export function readQuickLoginEmail(): string {
  return String(process.env.ADMIN_QUICK_LOGIN_EMAIL || '')
    .trim()
    .toLowerCase();
}

function readQuickLoginPassword(): string {
  return String(process.env.ADMIN_QUICK_LOGIN_PASSWORD || '');
}

function hmacKeyFromPassword(password: string): Buffer {
  return crypto.createHash('sha256').update(`${HMAC_SALT}|${password}`, 'utf8').digest();
}

function base64UrlEncode(value: string | Buffer): string {
  const buf = typeof value === 'string' ? Buffer.from(value, 'utf8') : value;
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecodeToString(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLen), 'base64').toString('utf8');
}

function timingSafeEqualString(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) {
    // Still compare to reduce timing leak on length; use equal-length dummy.
    const dummy = crypto.createHash('sha256').update(bBuf).digest();
    crypto.timingSafeEqual(dummy, dummy);
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function assertQuickLoginRateLimit(ipHash: string): { ok: true } | { ok: false; error: string } {
  const key = ipHash || 'unknown';
  const now = Date.now();
  const existing = rateBuckets.get(key);
  if (!existing || existing.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { ok: true };
  }
  if (existing.count >= RATE_MAX) {
    return { ok: false, error: 'Too many sign-in attempts. Wait a few minutes and try again.' };
  }
  existing.count += 1;
  return { ok: true };
}

export function mintAdminQuickLoginToken(email: string): {
  accessToken: string;
  expiresAt: number;
} {
  const password = readQuickLoginPassword();
  if (!password) {
    throw new Error('Admin quick login is not configured.');
  }
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const payload = JSON.stringify({ email: email.trim().toLowerCase(), exp });
  const payloadPart = base64UrlEncode(payload);
  const sig = crypto
    .createHmac('sha256', hmacKeyFromPassword(password))
    .update(payloadPart)
    .digest();
  return {
    accessToken: `${TOKEN_PREFIX}${payloadPart}.${base64UrlEncode(sig)}`,
    expiresAt: exp * 1000,
  };
}

export function verifyAdminQuickLoginToken(
  token: string,
): { ok: true; email: string } | { ok: false } {
  if (!token.startsWith(TOKEN_PREFIX)) return { ok: false };
  const password = readQuickLoginPassword();
  if (!password) return { ok: false };

  const body = token.slice(TOKEN_PREFIX.length);
  const dot = body.lastIndexOf('.');
  if (dot <= 0) return { ok: false };
  const payloadPart = body.slice(0, dot);
  const sigPart = body.slice(dot + 1);
  if (!payloadPart || !sigPart) return { ok: false };

  let expectedSig: Buffer;
  try {
    expectedSig = crypto
      .createHmac('sha256', hmacKeyFromPassword(password))
      .update(payloadPart)
      .digest();
  } catch {
    return { ok: false };
  }

  let providedSig: Buffer;
  try {
    const padded = sigPart.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (padded.length % 4)) % 4;
    providedSig = Buffer.from(padded + '='.repeat(padLen), 'base64');
  } catch {
    return { ok: false };
  }

  if (providedSig.length !== expectedSig.length || !crypto.timingSafeEqual(providedSig, expectedSig)) {
    return { ok: false };
  }

  let payload: { email?: string; exp?: number };
  try {
    payload = JSON.parse(base64UrlDecodeToString(payloadPart)) as { email?: string; exp?: number };
  } catch {
    return { ok: false };
  }

  const email = String(payload.email || '')
    .trim()
    .toLowerCase();
  const exp = Number(payload.exp);
  if (!email || !Number.isFinite(exp) || exp * 1000 <= Date.now()) {
    return { ok: false };
  }

  // Password may have rotated: email must still match configured quick email.
  if (!timingSafeEqualString(email, readQuickLoginEmail())) {
    return { ok: false };
  }

  return { ok: true, email };
}

export function authenticateAdminQuickLogin(
  emailRaw: string,
  passwordRaw: string,
):
  | { ok: true; email: string; accessToken: string; expiresAt: number }
  | { ok: false; error: string; status: number } {
  if (!isAdminQuickLoginConfigured()) {
    return { ok: false, error: GENERIC_AUTH_ERROR, status: 401 };
  }

  const email = String(emailRaw || '')
    .trim()
    .toLowerCase();
  const password = String(passwordRaw || '');
  const expectedEmail = readQuickLoginEmail();
  const expectedPassword = readQuickLoginPassword();

  const emailOk = timingSafeEqualString(email, expectedEmail);
  const passwordOk = timingSafeEqualString(password, expectedPassword);
  if (!emailOk || !passwordOk) {
    return { ok: false, error: GENERIC_AUTH_ERROR, status: 401 };
  }

  if (!resolveAdminRole(email)) {
    return { ok: false, error: GENERIC_AUTH_ERROR, status: 401 };
  }

  const minted = mintAdminQuickLoginToken(email);
  return { ok: true, email, accessToken: minted.accessToken, expiresAt: minted.expiresAt };
}

export function isAdminQuickLoginToken(token: string): boolean {
  return token.startsWith(TOKEN_PREFIX);
}

export { GENERIC_AUTH_ERROR };
