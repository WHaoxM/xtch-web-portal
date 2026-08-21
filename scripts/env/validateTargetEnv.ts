/**
 * Fail-closed environment validation for deploy targets.
 * Errors mention variable names and fix hints only — never secret values or full DB URLs.
 */
import { getAdminAllowlistStatus } from '../../app/api/lib/adminAllowlist.ts';

export const PROD_TARGETS = new Set(['win11-home', 'cloud-vps']);

export const EXPECTED_PROD_DATABASE = 'xtch_prod';
export const EXPECTED_PROD_S3_BUCKET = 'xtch-prod';

export type EnvValidationIssue = {
  variable: string;
  message: string;
};

export type EnvValidationResult = {
  ok: boolean;
  issues: EnvValidationIssue[];
};

type EnvMap = Record<string, string | undefined>;

function envTruthy(env: EnvMap, name: string): boolean {
  const value = env[name]?.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

function trim(env: EnvMap, name: string): string {
  return env[name]?.trim() || '';
}

/** Detect placeholder / example values without echoing the secret. */
export function containsForbiddenPlaceholder(value: string): boolean {
  const upper = value.toUpperCase();
  if (upper.includes('CHANGE_ME')) return true;
  if (upper.includes('YOUR_DOMAIN')) return true;
  if (upper.includes('YOU@EXAMPLE.COM')) return true;
  if (/REPLACE[_-]?ME/i.test(value)) return true;
  if (/TODO[_-]?SECRET/i.test(value)) return true;
  return false;
}

/**
 * Extract database name from a Postgres URL without returning credentials.
 * Returns null when the URL cannot be parsed.
 */
export function databaseNameFromPostgresUrl(url: string): string | null {
  try {
    const normalized = url.replace(/^postgresql:/i, 'http:').replace(/^postgres:/i, 'http:');
    const parsed = new URL(normalized);
    const name = parsed.pathname.replace(/^\//, '').split('/')[0] || '';
    return name || null;
  } catch {
    return null;
  }
}

function pushIssue(issues: EnvValidationIssue[], variable: string, message: string): void {
  issues.push({ variable, message });
}

function requireNonEmpty(issues: EnvValidationIssue[], env: EnvMap, variable: string, hint: string): string {
  const value = trim(env, variable);
  if (!value) {
    pushIssue(issues, variable, `must be set. ${hint}`);
  }
  return value;
}

function rejectIfPlaceholder(issues: EnvValidationIssue[], variable: string, value: string): void {
  if (value && containsForbiddenPlaceholder(value)) {
    pushIssue(
      issues,
      variable,
      'contains a placeholder value (CHANGE_ME / YOUR_DOMAIN / you@example.com). Replace with a real value.',
    );
  }
}

function isCapabilityEnabled(value: string): boolean {
  return Boolean(value.trim());
}

export function isProdDeployTarget(target: string): boolean {
  return PROD_TARGETS.has(target);
}

/**
 * Validate env for a target. local/tunnel: no production fail-closed rules.
 * win11-home / cloud-vps: full production schema.
 */
export function validateTargetEnv(
  target: string,
  env: EnvMap = process.env,
): EnvValidationResult {
  if (!isProdDeployTarget(target)) {
    return { ok: true, issues: [] };
  }

  const issues: EnvValidationIssue[] = [];

  const appEnv = requireNonEmpty(issues, env, 'APP_ENV', 'Set APP_ENV=prod for public deploy targets.');
  if (appEnv && appEnv !== 'prod') {
    pushIssue(issues, 'APP_ENV', 'must be "prod" for win11-home and cloud-vps.');
  }

  const postgresUrl = requireNonEmpty(
    issues,
    env,
    'POSTGRES_URL',
    'Point at the isolated production database (xtch_prod).',
  );
  if (postgresUrl) {
    rejectIfPlaceholder(issues, 'POSTGRES_URL', postgresUrl);
    const dbName = databaseNameFromPostgresUrl(postgresUrl);
    if (!dbName) {
      pushIssue(issues, 'POSTGRES_URL', 'could not be parsed. Use a postgresql:// URL ending with /xtch_prod.');
    } else if (dbName !== EXPECTED_PROD_DATABASE) {
      pushIssue(
        issues,
        'POSTGRES_URL',
        `database name must be "${EXPECTED_PROD_DATABASE}" (got a different name; value not shown).`,
      );
    }
  }

  const bucket = requireNonEmpty(issues, env, 'S3_BUCKET', `Set S3_BUCKET=${EXPECTED_PROD_S3_BUCKET}.`);
  if (bucket && bucket !== EXPECTED_PROD_S3_BUCKET) {
    pushIssue(issues, 'S3_BUCKET', `must be "${EXPECTED_PROD_S3_BUCKET}" for public deploy targets.`);
  }

  for (const key of [
    'S3_ENDPOINT',
    'S3_ACCESS_KEY_ID',
    'S3_SECRET_ACCESS_KEY',
    'S3_PUBLIC_BASE_URL',
    'S3_BROWSER_ENDPOINT',
    'PUBLIC_DOMAIN',
    'PUBLIC_IP',
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_CHECKOUT_SUCCESS_URL',
    'STRIPE_CHECKOUT_CANCEL_URL',
    'VITE_TURNSTILE_SITE_KEY',
    'TURNSTILE_SECRET_KEY',
    'RESEND_API_KEY',
    'INQUIRY_FROM_EMAIL',
    'BOOKING_FROM_EMAIL',
    'BOOKING_OPERATIONS_EMAIL',
    'INQUIRY_TO_EMAIL',
  ] as const) {
    const value = trim(env, key);
    if (value) rejectIfPlaceholder(issues, key, value);
  }

  requireNonEmpty(issues, env, 'S3_ENDPOINT', 'Set the MinIO/S3 endpoint URL.');
  requireNonEmpty(issues, env, 'S3_ACCESS_KEY_ID', 'Set a real access key (not CHANGE_ME).');
  requireNonEmpty(issues, env, 'S3_SECRET_ACCESS_KEY', 'Set a real secret key (not CHANGE_ME).');

  requireNonEmpty(
    issues,
    env,
    'VITE_SUPABASE_URL',
    'Prod Auth requires a real Supabase project URL.',
  );
  requireNonEmpty(
    issues,
    env,
    'VITE_SUPABASE_ANON_KEY',
    'Prod Auth requires a real Supabase anon key.',
  );

  if (envTruthy(env, 'DEV_CHECKOUT_BYPASS')) {
    pushIssue(issues, 'DEV_CHECKOUT_BYPASS', 'must not be set for a public deploy target.');
  }
  if (trim(env, 'DEV_AUTH_BYPASS_EMAIL')) {
    pushIssue(issues, 'DEV_AUTH_BYPASS_EMAIL', 'must not be set for a public deploy target.');
  }
  if (trim(env, 'VITE_DEV_AUTH_BYPASS_EMAIL')) {
    pushIssue(issues, 'VITE_DEV_AUTH_BYPASS_EMAIL', 'must not be set for a public deploy target.');
  }

  // Allowlist status reads process.env — callers must load target env into process.env first.
  // When validating a synthetic env map in tests, sync allowlist keys onto process.env.
  const allowlist = getAdminAllowlistStatus();
  if (!allowlist.hasUsableEmails) {
    pushIssue(
      issues,
      'ADMIN_TECH_EMAIL_ALLOWLIST|ADMIN_OPS_EMAIL_ALLOWLIST',
      'must include at least one real email (not empty, not you@example.com). Legacy ADMIN_EMAIL_ALLOWLIST still accepted as tech-only.',
    );
  }

  const stripeSecret = trim(env, 'STRIPE_SECRET_KEY');
  const stripeWebhook = trim(env, 'STRIPE_WEBHOOK_SECRET');
  const stripeOn = isCapabilityEnabled(stripeSecret) || isCapabilityEnabled(stripeWebhook);
  if (stripeOn) {
    if (!stripeSecret) {
      pushIssue(issues, 'STRIPE_SECRET_KEY', 'required when Stripe is enabled (STRIPE_WEBHOOK_SECRET is set).');
    }
    if (!stripeWebhook) {
      pushIssue(issues, 'STRIPE_WEBHOOK_SECRET', 'required when Stripe is enabled (STRIPE_SECRET_KEY is set).');
    }
  }

  const paymentProvider = (trim(env, 'PAYMENT_PROVIDER') || 'payoneer').toLowerCase();
  if (paymentProvider !== 'payoneer' && paymentProvider !== 'stripe') {
    pushIssue(issues, 'PAYMENT_PROVIDER', 'must be "payoneer" or "stripe".');
  }

  const payoneerStore = trim(env, 'PAYONEER_STORE_CODE');
  const payoneerToken = trim(env, 'PAYONEER_TOKEN');
  const payoneerOn = isCapabilityEnabled(payoneerStore) || isCapabilityEnabled(payoneerToken);
  if (payoneerOn) {
    if (!payoneerStore) {
      pushIssue(issues, 'PAYONEER_STORE_CODE', 'required when Payoneer is enabled (PAYONEER_TOKEN is set).');
    }
    if (!payoneerToken) {
      pushIssue(issues, 'PAYONEER_TOKEN', 'required when Payoneer is enabled (PAYONEER_STORE_CODE is set).');
    }
  }

  // An unconfigured Payoneer provider must not take the public site offline.
  // Checkout remains unavailable: createPayoneerCheckoutSession rejects without credentials.
  if (paymentProvider === 'stripe' && !stripeOn) {
    pushIssue(
      issues,
      'STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET',
      'required when PAYMENT_PROVIDER=stripe on a public deploy target.',
    );
  }

  const turnstileSite = trim(env, 'VITE_TURNSTILE_SITE_KEY');
  const turnstileSecret = trim(env, 'TURNSTILE_SECRET_KEY');
  if (isCapabilityEnabled(turnstileSite) !== isCapabilityEnabled(turnstileSecret)) {
    if (!turnstileSite) {
      pushIssue(
        issues,
        'VITE_TURNSTILE_SITE_KEY',
        'required when TURNSTILE_SECRET_KEY is set (or clear both to disable).',
      );
    }
    if (!turnstileSecret) {
      pushIssue(
        issues,
        'TURNSTILE_SECRET_KEY',
        'required when VITE_TURNSTILE_SITE_KEY is set (or clear both to disable).',
      );
    }
  }

  const inquiryMode = (trim(env, 'INQUIRY_EMAIL_MODE') || 'off').toLowerCase();
  const bookingMode = (trim(env, 'BOOKING_EMAIL_MODE') || 'off').toLowerCase();
  const wantsResend = inquiryMode === 'resend' || bookingMode === 'resend';
  if (wantsResend && !trim(env, 'RESEND_API_KEY')) {
    pushIssue(
      issues,
      'RESEND_API_KEY',
      'required when INQUIRY_EMAIL_MODE or BOOKING_EMAIL_MODE is "resend". Set the key or set modes to "off"/"log".',
    );
  }
  if (bookingMode === 'resend') {
    if (!trim(env, 'BOOKING_FROM_EMAIL') && !trim(env, 'INQUIRY_FROM_EMAIL')) {
      pushIssue(
        issues,
        'BOOKING_FROM_EMAIL|INQUIRY_FROM_EMAIL',
        'a booking sender is required when BOOKING_EMAIL_MODE is "resend".',
      );
    }
    if (!trim(env, 'BOOKING_OPERATIONS_EMAIL') && !trim(env, 'INQUIRY_TO_EMAIL')) {
      pushIssue(
        issues,
        'BOOKING_OPERATIONS_EMAIL|INQUIRY_TO_EMAIL',
        'an operations recipient is required when BOOKING_EMAIL_MODE is "resend".',
      );
    }
  }

  return { ok: issues.length === 0, issues };
}

export function formatEnvValidationErrors(
  target: string,
  result: EnvValidationResult,
  envPathHint?: string,
): string {
  const lines = [
    `Refusing ${target} (environment validation failed):`,
    ...result.issues.map((issue) => `  - ${issue.variable}: ${issue.message}`),
  ];
  if (envPathHint) {
    lines.push(`Fix these in ${envPathHint} and retry.`);
  }
  return lines.join('\n');
}

/** Throw with a safe multi-line message when validation fails. */
export function assertTargetEnvValid(
  target: string,
  env: EnvMap = process.env,
  envPathHint?: string,
): void {
  const result = validateTargetEnv(target, env);
  if (!result.ok) {
    throw new Error(formatEnvValidationErrors(target, result, envPathHint));
  }
}

/** Checklist delivery for role 6 (docs/ops env examples). */
export function describeProdEnvRequirements(): {
  required: string[];
  conditional: string[];
  forbidden: string[];
} {
  return {
    required: [
      'APP_ENV=prod',
      'POSTGRES_URL → database xtch_prod',
      'S3_BUCKET=xtch-prod',
      'S3_ENDPOINT',
      'S3_ACCESS_KEY_ID',
      'S3_SECRET_ACCESS_KEY',
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_ANON_KEY',
      'ADMIN_TECH_EMAIL_ALLOWLIST and/or ADMIN_OPS_EMAIL_ALLOWLIST (usable emails)',
    ],
    conditional: [
      'PAYMENT_PROVIDER=payoneer|stripe (default payoneer)',
      'PAYONEER_STORE_CODE + PAYONEER_TOKEN when PAYMENT_PROVIDER=payoneer',
      'STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET when PAYMENT_PROVIDER=stripe (or if either Stripe key is set)',
      'VITE_TURNSTILE_SITE_KEY + TURNSTILE_SECRET_KEY (both or neither)',
      'RESEND_API_KEY when INQUIRY_EMAIL_MODE or BOOKING_EMAIL_MODE is resend',
      'BOOKING_FROM_EMAIL (or INQUIRY_FROM_EMAIL fallback) when BOOKING_EMAIL_MODE is resend',
      'BOOKING_OPERATIONS_EMAIL (or INQUIRY_TO_EMAIL fallback) when BOOKING_EMAIL_MODE is resend',
    ],
    forbidden: [
      'DEV_CHECKOUT_BYPASS',
      'DEV_AUTH_BYPASS_EMAIL',
      'VITE_DEV_AUTH_BYPASS_EMAIL',
      'Any value containing CHANGE_ME / YOUR_DOMAIN / you@example.com',
      'POSTGRES_URL database other than xtch_prod',
      'S3_BUCKET other than xtch-prod',
    ],
  };
}
