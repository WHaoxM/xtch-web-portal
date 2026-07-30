import { createHmac, timingSafeEqual } from 'node:crypto';
import { isDevCheckoutBypassEnabled } from './stripe';

export type PayoneerCheckoutSessionInput = {
  orderNumber: string;
  amountCents: number;
  currency: string;
  customerEmail: string;
  customerName: string;
  productName: string;
  productDescription: string;
  successUrl: string;
  cancelUrl: string;
  notificationUrl: string;
  holdExpiresAt: Date;
};

export type PayoneerCheckoutSession = {
  listId: string;
  transactionId: string;
  checkoutUrl: string;
  mock: boolean;
};

export type PayoneerNotificationStatus =
  | 'charged'
  | 'failed'
  | 'canceled'
  | 'expired'
  | 'pending'
  | 'unknown';

export type ParsedPayoneerNotification = {
  eventId: string;
  listId: string | null;
  transactionId: string | null;
  chargeId: string | null;
  status: PayoneerNotificationStatus;
  livemode: boolean;
  raw: Record<string, unknown>;
};

type PayoneerListResponse = {
  identification?: {
    longId?: string;
    shortId?: string;
    transactionId?: string;
  };
  redirect?: {
    url?: string;
  };
  links?: {
    redirect?: string;
    self?: string;
  };
};

function trimEnv(key: string): string {
  return (process.env[key] || '').trim();
}

function equalHex(a: string, b: string): boolean {
  try {
    const left = Buffer.from(a, 'hex');
    const right = Buffer.from(b, 'hex');
    if (left.length === 0 || left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

export function getPayoneerApiBaseUrl(): string {
  const override = trimEnv('PAYONEER_API_BASE_URL');
  if (override) return override.replace(/\/$/, '');

  const env = trimEnv('PAYONEER_CHECKOUT_ENV').toLowerCase() || 'test';
  if (env === 'live' || env === 'prod' || env === 'production') {
    return 'https://api.live.oscato.com';
  }
  return 'https://api.sandbox.oscato.com';
}

export function isPayoneerConfigured(): boolean {
  return Boolean(trimEnv('PAYONEER_STORE_CODE') && trimEnv('PAYONEER_TOKEN'));
}

export function isPayoneerCheckoutMockEnabled(): boolean {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
    return false;
  }
  const value = trimEnv('PAYONEER_CHECKOUT_MOCK').toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

/** Traveler Payoneer path is ready when credentials exist, or local mock/bypass is on. */
export function isPayoneerCheckoutReady(): boolean {
  if (isPayoneerConfigured()) return true;
  if (isPayoneerCheckoutMockEnabled()) return true;
  if (isDevCheckoutBypassEnabled()) return true;
  return false;
}

function centsToMajorAmount(cents: number): number {
  return Math.round(cents) / 100;
}

function buildAuthHeader(): string {
  const token = trimEnv('PAYONEER_TOKEN');
  const scheme = (trimEnv('PAYONEER_AUTH_SCHEME') || 'Bearer').trim();
  if (scheme.toLowerCase() === 'basic') {
    return `Basic ${Buffer.from(token, 'utf8').toString('base64')}`;
  }
  return `Bearer ${token}`;
}

export async function createPayoneerCheckoutSession(
  input: PayoneerCheckoutSessionInput,
): Promise<PayoneerCheckoutSession> {
  const transactionId = `xtch_${input.orderNumber}_${Date.now()}`;

  if (!isPayoneerConfigured()) {
    if (!isPayoneerCheckoutMockEnabled() && !isDevCheckoutBypassEnabled()) {
      throw new Error('Payoneer Checkout is not configured.');
    }

    const listId = `po_mock_${input.orderNumber}`;
    return {
      listId,
      transactionId,
      checkoutUrl: input.successUrl.includes('session_id=')
        ? input.successUrl.replace(/\{CHECKOUT_SESSION_ID\}/g, listId)
        : `${input.successUrl}${input.successUrl.includes('?') ? '&' : '?'}session_id=${encodeURIComponent(listId)}`,
      mock: true,
    };
  }

  const storeCode = trimEnv('PAYONEER_STORE_CODE');
  const country = (trimEnv('PAYONEER_CHECKOUT_COUNTRY') || 'US').toUpperCase();
  const body = {
    transactionId,
    country,
    integration: 'HOSTED',
    division: storeCode,
    callback: {
      returnUrl: input.successUrl.replace(/\{CHECKOUT_SESSION_ID\}/g, '{longId}'),
      cancelUrl: input.cancelUrl,
      notificationUrl: input.notificationUrl,
    },
    customer: {
      number: input.orderNumber,
      email: input.customerEmail,
      name: {
        firstName: input.customerName.split(/\s+/)[0] || input.customerName,
        lastName: input.customerName.split(/\s+/).slice(1).join(' ') || 'Traveler',
      },
    },
    payment: {
      amount: centsToMajorAmount(input.amountCents),
      currency: input.currency.toUpperCase(),
      reference: input.orderNumber,
    },
    style: {
      language: 'en_US',
    },
  };

  const response = await fetch(`${getPayoneerApiBaseUrl()}/api/lists`, {
    method: 'POST',
    headers: {
      Authorization: buildAuthHeader(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => ({}))) as PayoneerListResponse & {
    message?: string;
    resultInfo?: string;
  };

  if (!response.ok) {
    const detail = payload.message || payload.resultInfo || `HTTP ${response.status}`;
    throw new Error(`Payoneer list creation failed: ${detail}`);
  }

  const listId = payload.identification?.longId;
  const checkoutUrl = payload.redirect?.url || payload.links?.redirect;
  if (!listId || !checkoutUrl) {
    throw new Error('Payoneer did not return a hosted checkout redirect.');
  }

  return {
    listId,
    transactionId: payload.identification?.transactionId || transactionId,
    checkoutUrl: checkoutUrl.replace(/\{longId\}/g, listId),
    mock: false,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readNestedString(root: Record<string, unknown>, path: string[]): string | null {
  let current: unknown = root;
  for (const key of path) {
    const record = asRecord(current);
    if (!record) return null;
    current = record[key];
  }
  return typeof current === 'string' && current.trim() ? current.trim() : null;
}

function mapPayoneerStatus(raw: string | null): PayoneerNotificationStatus {
  const code = (raw || '').trim().toLowerCase();
  if (!code) return 'unknown';
  if (['charged', 'paid', 'success', 'succeeded', 'captured'].includes(code)) return 'charged';
  if (['failed', 'declined', 'error', 'rejected'].includes(code)) return 'failed';
  if (['canceled', 'cancelled', 'abort', 'aborted'].includes(code)) return 'canceled';
  if (['expired', 'timeout'].includes(code)) return 'expired';
  if (['pending', 'preauthorized', 'authorized', 'in_progress'].includes(code)) return 'pending';
  return 'unknown';
}

export function parsePayoneerNotification(payload: unknown): ParsedPayoneerNotification {
  const raw = asRecord(payload) ?? {};
  const listId =
    readNestedString(raw, ['identification', 'longId']) ||
    readNestedString(raw, ['longId']) ||
    readNestedString(raw, ['listId']);
  const transactionId =
    readNestedString(raw, ['identification', 'transactionId']) ||
    readNestedString(raw, ['transactionId']) ||
    readNestedString(raw, ['payment', 'reference']);
  const chargeId =
    readNestedString(raw, ['identification', 'shortId']) ||
    readNestedString(raw, ['chargeId']) ||
    readNestedString(raw, ['payment', 'reference']);
  const statusCode =
    readNestedString(raw, ['status', 'code']) ||
    readNestedString(raw, ['statusCode']) ||
    readNestedString(raw, ['resultInfo']) ||
    readNestedString(raw, ['interaction', 'reason']);

  const eventId =
    readNestedString(raw, ['notificationId']) ||
    readNestedString(raw, ['eventId']) ||
    readNestedString(raw, ['id']) ||
    [listId || 'unknown', transactionId || 'unknown', statusCode || 'unknown'].join(':');

  const livemodeHint = readNestedString(raw, ['environment']) || readNestedString(raw, ['env']);
  const livemode = (livemodeHint || '').toLowerCase() === 'live';

  return {
    eventId,
    listId,
    transactionId,
    chargeId,
    status: mapPayoneerStatus(statusCode),
    livemode,
    raw,
  };
}

/**
 * Optional HMAC verification for Payoneer notifications.
 * When PAYONEER_WEBHOOK_SECRET is unset, signature checks are skipped (sandbox bootstrap).
 */
export function verifyPayoneerWebhookSignature(
  rawBody: string | Buffer,
  authorizationHeader: string | undefined,
): boolean {
  const secret = trimEnv('PAYONEER_WEBHOOK_SECRET');
  if (!secret) return true;
  if (!authorizationHeader) return false;

  const header = authorizationHeader.trim();
  const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');

  if (header.toLowerCase().startsWith('hmacauth ')) {
    const parts = header.slice('hmacauth '.length).split(':');
    if (parts.length < 4) return false;
    const [, signature, nonce, timestamp] = parts;
    const payload = `${body}${nonce}${timestamp}`;
    const expected = createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
    return equalHex(expected, signature);
  }

  const match = /^sha256=(.+)$/i.exec(header);
  if (match) {
    const expected = createHmac('sha256', secret).update(body, 'utf8').digest('hex');
    return equalHex(expected, match[1]);
  }

  return false;
}
