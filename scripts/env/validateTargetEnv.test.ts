import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { resetAdminAllowlistWarnForTests } from '../../app/api/lib/adminAllowlist.ts';
import {
  containsForbiddenPlaceholder,
  databaseNameFromPostgresUrl,
  formatEnvValidationErrors,
  validateTargetEnv,
} from './validateTargetEnv.ts';

const ENV_KEYS = [
  'APP_ENV',
  'POSTGRES_URL',
  'S3_BUCKET',
  'S3_ENDPOINT',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'ADMIN_TECH_EMAIL_ALLOWLIST',
  'ADMIN_OPS_EMAIL_ALLOWLIST',
  'ADMIN_EMAIL_ALLOWLIST',
  'DEV_CHECKOUT_BYPASS',
  'DEV_AUTH_BYPASS_EMAIL',
  'VITE_DEV_AUTH_BYPASS_EMAIL',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'VITE_TURNSTILE_SITE_KEY',
  'TURNSTILE_SECRET_KEY',
  'INQUIRY_EMAIL_MODE',
  'BOOKING_EMAIL_MODE',
  'INQUIRY_FROM_EMAIL',
  'BOOKING_FROM_EMAIL',
  'BOOKING_OPERATIONS_EMAIL',
  'INQUIRY_TO_EMAIL',
  'RESEND_API_KEY',
] as const;

const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  resetAdminAllowlistWarnForTests();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = saved[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  resetAdminAllowlistWarnForTests();
});

function applyEnv(map: Record<string, string>) {
  for (const [key, value] of Object.entries(map)) {
    process.env[key] = value;
  }
}

function validProdEnv(overrides: Record<string, string> = {}) {
  return {
    APP_ENV: 'prod',
    POSTGRES_URL: 'postgresql://postgres:secret@127.0.0.1:5432/xtch_prod',
    S3_BUCKET: 'xtch-prod',
    S3_ENDPOINT: 'http://127.0.0.1:9000',
    S3_ACCESS_KEY_ID: 'minioadmin',
    S3_SECRET_ACCESS_KEY: 'minioadmin-secret',
    VITE_SUPABASE_URL: 'https://example.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'anon-key-value',
    ADMIN_TECH_EMAIL_ALLOWLIST: 'tech-operator@syncingtravel.com',
    INQUIRY_EMAIL_MODE: 'off',
    BOOKING_EMAIL_MODE: 'off',
    ...overrides,
  };
}

test('local target is not fail-closed by production rules', () => {
  const result = validateTargetEnv('local', {
    APP_ENV: 'dev',
    POSTGRES_URL: 'postgresql://postgres:x@127.0.0.1:5432/xtch',
    DEV_CHECKOUT_BYPASS: '1',
  });
  assert.equal(result.ok, true);
  assert.equal(result.issues.length, 0);
});

test('tunnel target is not fail-closed by production rules', () => {
  const result = validateTargetEnv('tunnel', { DEV_CHECKOUT_BYPASS: 'true' });
  assert.equal(result.ok, true);
});

test('win11-home and cloud-vps accept a complete production env', () => {
  for (const target of ['win11-home', 'cloud-vps'] as const) {
    const env = validProdEnv();
    applyEnv(env);
    const result = validateTargetEnv(target, env);
    assert.equal(result.ok, true, `${target}: ${JSON.stringify(result.issues)}`);
  }
});

test('rejects wrong database name without leaking URL', () => {
  const env = validProdEnv({
    POSTGRES_URL: 'postgresql://postgres:super-secret-password@127.0.0.1:5432/xtch',
  });
  applyEnv(env);
  const result = validateTargetEnv('win11-home', env);
  assert.equal(result.ok, false);
  const message = formatEnvValidationErrors('win11-home', result, 'env/win11-home/.env');
  assert.match(message, /POSTGRES_URL/);
  assert.doesNotMatch(message, /super-secret-password/);
  assert.doesNotMatch(message, /postgresql:\/\/postgres:super-secret/);
});

test('rejects wrong S3 bucket', () => {
  const env = validProdEnv({ S3_BUCKET: 'xtch' });
  applyEnv(env);
  const result = validateTargetEnv('cloud-vps', env);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.variable === 'S3_BUCKET'));
});

test('rejects placeholder credentials', () => {
  const env = validProdEnv({ S3_ACCESS_KEY_ID: 'CHANGE_ME_MINIO_USER' });
  applyEnv(env);
  const result = validateTargetEnv('win11-home', env);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.variable === 'S3_ACCESS_KEY_ID'));
});

test('rejects DEV bypass flags', () => {
  const env = validProdEnv({ DEV_CHECKOUT_BYPASS: '1' });
  applyEnv(env);
  const result = validateTargetEnv('win11-home', env);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.variable === 'DEV_CHECKOUT_BYPASS'));
});

test('rejects half-configured Stripe', () => {
  const env = validProdEnv({ STRIPE_SECRET_KEY: 'sk_test_x' });
  applyEnv(env);
  const result = validateTargetEnv('win11-home', env);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.variable === 'STRIPE_WEBHOOK_SECRET'));
});

test('rejects half-configured Turnstile', () => {
  const env = validProdEnv({ VITE_TURNSTILE_SITE_KEY: 'site' });
  applyEnv(env);
  const result = validateTargetEnv('cloud-vps', env);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.variable === 'TURNSTILE_SECRET_KEY'));
});

test('rejects resend mode without API key', () => {
  const env = validProdEnv({ INQUIRY_EMAIL_MODE: 'resend' });
  applyEnv(env);
  const result = validateTargetEnv('win11-home', env);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.variable === 'RESEND_API_KEY'));
});

test('booking resend mode requires an operations recipient', () => {
  const env = validProdEnv({
    BOOKING_EMAIL_MODE: 'resend',
    RESEND_API_KEY: 're_test',
    BOOKING_FROM_EMAIL: 'bookings@syncingtravel.com',
  });
  applyEnv(env);
  const result = validateTargetEnv('win11-home', env);
  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some(
      (issue) => issue.variable === 'BOOKING_OPERATIONS_EMAIL|INQUIRY_TO_EMAIL',
    ),
  );
});

test('booking resend mode accepts inquiry recipient as operations fallback', () => {
  const env = validProdEnv({
    BOOKING_EMAIL_MODE: 'resend',
    RESEND_API_KEY: 're_test',
    BOOKING_FROM_EMAIL: 'bookings@syncingtravel.com',
    INQUIRY_TO_EMAIL: 'ops@syncingtravel.com',
  });
  applyEnv(env);
  const result = validateTargetEnv('cloud-vps', env);
  assert.equal(result.ok, true, JSON.stringify(result.issues));
});

test('placeholder and db-name helpers', () => {
  assert.equal(containsForbiddenPlaceholder('https://YOUR_DOMAIN/s3'), true);
  assert.equal(containsForbiddenPlaceholder('https://cdn.example.com'), false);
  assert.equal(databaseNameFromPostgresUrl('postgresql://u:p@h:5432/xtch_prod'), 'xtch_prod');
  assert.equal(databaseNameFromPostgresUrl('not-a-url'), null);
});
