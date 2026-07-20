import { sql } from './db';
import {
  CHECKOUT_RATE_LIMITS,
  CHECKOUT_RATE_WINDOW_MS,
  checkoutRateBucketKey,
  checkoutRateWindowId,
} from './bookingIntegrity';

let rateTableEnsured = false;

export async function ensureCheckoutRateLimitTable(): Promise<void> {
  if (rateTableEnsured) return;

  await sql`
    CREATE TABLE IF NOT EXISTS checkout_rate_buckets (
      bucket_key TEXT PRIMARY KEY,
      dimension TEXT NOT NULL,
      subject_key TEXT NOT NULL,
      hit_count INTEGER NOT NULL DEFAULT 0,
      window_start TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT checkout_rate_buckets_hit_positive CHECK (hit_count >= 0)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS checkout_rate_buckets_expires_at_idx
    ON checkout_rate_buckets (expires_at)
  `;

  rateTableEnsured = true;
}

export type CheckoutRateLimitResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Postgres-backed checkout rate limits (IP / email / departure), 10-minute windows.
 * Multi-process safe via atomic upsert + row lock.
 */
export async function assertCheckoutRateLimits(params: {
  ip: string;
  email: string;
  departurePublicId: string;
  nowMs?: number;
}): Promise<CheckoutRateLimitResult> {
  await ensureCheckoutRateLimitTable();

  const nowMs = params.nowMs ?? Date.now();
  const windowId = checkoutRateWindowId(nowMs);
  const windowStartIso = new Date(windowId * CHECKOUT_RATE_WINDOW_MS).toISOString();
  const expiresAtIso = new Date((windowId + 1) * CHECKOUT_RATE_WINDOW_MS).toISOString();

  // Opportunistic prune of stale windows (A1-style, no external cron).
  await sql`
    DELETE FROM checkout_rate_buckets
    WHERE expires_at < NOW() - INTERVAL '1 hour'
  `;

  const checks: Array<{
    dimension: keyof typeof CHECKOUT_RATE_LIMITS;
    subjectKey: string;
    limit: number;
  }> = [
    { dimension: 'ip', subjectKey: params.ip || 'unknown', limit: CHECKOUT_RATE_LIMITS.ip },
    {
      dimension: 'email',
      subjectKey: params.email.trim().toLowerCase(),
      limit: CHECKOUT_RATE_LIMITS.email,
    },
    {
      dimension: 'departure',
      subjectKey: params.departurePublicId,
      limit: CHECKOUT_RATE_LIMITS.departure,
    },
  ];

  for (const check of checks) {
    const bucketKey = checkoutRateBucketKey(check.dimension, check.subjectKey, windowId);
    const result = await sql<{ hit_count: number }>`
      INSERT INTO checkout_rate_buckets (
        bucket_key,
        dimension,
        subject_key,
        hit_count,
        window_start,
        expires_at
      ) VALUES (
        ${bucketKey},
        ${check.dimension},
        ${check.subjectKey},
        1,
        ${windowStartIso}::timestamptz,
        ${expiresAtIso}::timestamptz
      )
      ON CONFLICT (bucket_key) DO UPDATE
      SET hit_count = checkout_rate_buckets.hit_count + 1,
          updated_at = NOW()
      WHERE checkout_rate_buckets.hit_count < ${check.limit}
      RETURNING hit_count
    `;

    if (!result.rows[0]) {
      return {
        ok: false,
        error: 'Too many checkout attempts. Please wait a few minutes and try again.',
      };
    }
  }

  return { ok: true };
}

/** Test helper: allow re-running ensure after schema changes in tests. */
export function resetCheckoutRateLimitTableFlagForTests(): void {
  rateTableEnsured = false;
}
