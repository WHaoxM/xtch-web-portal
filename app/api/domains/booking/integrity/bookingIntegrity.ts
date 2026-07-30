/**
 * Pure booking/payment integrity helpers (unit-testable, no DB/Stripe I/O).
 */

export type CancellationGate = 'allow' | 'idempotent' | 'deny';

export type RefundClass = 'none' | 'partial' | 'full';

/** Traveler cancellation: only confirmed+paid; already-requested is idempotent. */
export function evaluateCancellationRequest(
  status: string,
  paymentStatus: string,
): CancellationGate {
  if (status === 'cancellation_requested') return 'idempotent';
  if (status === 'confirmed' && paymentStatus === 'paid') return 'allow';
  return 'deny';
}

/** Cumulative Stripe refunded amount vs order total. */
export function classifyRefundAmount(
  amountRefundedCents: number,
  totalPriceCents: number,
): RefundClass {
  if (!Number.isFinite(amountRefundedCents) || amountRefundedCents <= 0) return 'none';
  if (amountRefundedCents >= totalPriceCents) return 'full';
  return 'partial';
}

/**
 * B1: confirm only when Stripe reports paid (or PI succeeded as belt-and-suspenders).
 * Do not confirm on unpaid / pending async settlement.
 */
export function shouldConfirmPaidCheckout(params: {
  sessionPaymentStatus?: string | null;
  paymentIntentStatus?: string | null;
}): boolean {
  if (params.sessionPaymentStatus === 'paid') return true;
  if (params.paymentIntentStatus === 'succeeded') return true;
  return false;
}

export function isTrustProxyEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env.TRUST_PROXY?.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

/**
 * Client IP for checkout rate limits.
 * - TRUST_PROXY off: only socket/peer (never trust forwarded headers).
 * - TRUST_PROXY on (Caddy): leftmost X-Forwarded-For hop, else X-Real-IP, else socket.
 */
export function resolveClientIp(params: {
  headers: Record<string, string | string[] | undefined>;
  socketRemoteAddress?: string | null;
  trustProxy?: boolean;
}): string {
  const trustProxy = params.trustProxy ?? isTrustProxyEnabled();
  const socketIp = normalizeIp(params.socketRemoteAddress);

  if (trustProxy) {
    const forwarded = headerValue(params.headers['x-forwarded-for']);
    if (forwarded) {
      const firstHop = forwarded.split(',')[0]?.trim();
      const normalized = normalizeIp(firstHop);
      if (normalized) return normalized;
    }
    const realIp = normalizeIp(headerValue(params.headers['x-real-ip']));
    if (realIp) return realIp;
  }

  return socketIp || 'unknown';
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function normalizeIp(value: string | null | undefined): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const bare = trimmed.replace(/^\[|\]$/g, '');
  if (bare.startsWith('::ffff:')) return bare.slice(7);
  return bare;
}

export const CHECKOUT_RATE_WINDOW_MS = 10 * 60 * 1000;

export const CHECKOUT_RATE_LIMITS = {
  ip: 10,
  email: 5,
  departure: 20,
} as const;

export function checkoutRateWindowId(nowMs = Date.now()): number {
  return Math.floor(nowMs / CHECKOUT_RATE_WINDOW_MS);
}

export function checkoutRateBucketKey(
  dimension: keyof typeof CHECKOUT_RATE_LIMITS,
  subjectKey: string,
  windowId: number,
): string {
  return `${dimension}:${subjectKey}:${windowId}`;
}
