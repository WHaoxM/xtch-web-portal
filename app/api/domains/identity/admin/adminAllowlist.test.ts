import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import {
  getAdminAllowlistStatus,
  resetAdminAllowlistWarnForTests,
  resolveAdminRole,
} from './adminAllowlist';

const ENV_KEYS = [
  'ADMIN_TECH_EMAIL_ALLOWLIST',
  'ADMIN_OPS_EMAIL_ALLOWLIST',
  'ADMIN_EMAIL_ALLOWLIST',
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

test('resolveAdminRole: ops only', () => {
  process.env.ADMIN_OPS_EMAIL_ALLOWLIST = 'ops@example.com';
  process.env.ADMIN_TECH_EMAIL_ALLOWLIST = 'tech@example.com';
  assert.equal(resolveAdminRole('ops@example.com'), 'ops');
});

test('resolveAdminRole: tech only', () => {
  process.env.ADMIN_OPS_EMAIL_ALLOWLIST = 'ops@example.com';
  process.env.ADMIN_TECH_EMAIL_ALLOWLIST = 'tech@example.com';
  assert.equal(resolveAdminRole('tech@example.com'), 'tech');
});

test('resolveAdminRole: both lists â†?tech wins', () => {
  process.env.ADMIN_OPS_EMAIL_ALLOWLIST = 'both@example.com';
  process.env.ADMIN_TECH_EMAIL_ALLOWLIST = 'both@example.com';
  assert.equal(resolveAdminRole('both@example.com'), 'tech');
});

test('resolveAdminRole: legacy ADMIN_EMAIL_ALLOWLIST â†?tech (C1)', () => {
  process.env.ADMIN_EMAIL_ALLOWLIST = 'legacy@example.com, Other@Example.com';
  assert.equal(resolveAdminRole('legacy@example.com'), 'tech');
  assert.equal(resolveAdminRole('other@example.com'), 'tech');
  assert.equal(resolveAdminRole('stranger@example.com'), null);
});

test('resolveAdminRole: not on any list â†?null', () => {
  process.env.ADMIN_OPS_EMAIL_ALLOWLIST = 'ops@example.com';
  process.env.ADMIN_TECH_EMAIL_ALLOWLIST = 'tech@example.com';
  assert.equal(resolveAdminRole('nobody@example.com'), null);
});

test('resolveAdminRole: new lists take precedence over legacy', () => {
  process.env.ADMIN_TECH_EMAIL_ALLOWLIST = 'tech@example.com';
  process.env.ADMIN_EMAIL_ALLOWLIST = 'legacy@example.com';
  assert.equal(resolveAdminRole('legacy@example.com'), null);
  assert.equal(resolveAdminRole('tech@example.com'), 'tech');
});

test('getAdminAllowlistStatus: empty / placeholder / usable', () => {
  assert.deepEqual(getAdminAllowlistStatus(), {
    configured: false,
    usingDeprecatedOnly: false,
    onlyPlaceholders: false,
    hasUsableEmails: false,
  });

  process.env.ADMIN_TECH_EMAIL_ALLOWLIST = 'you@example.com';
  assert.equal(getAdminAllowlistStatus().onlyPlaceholders, true);
  assert.equal(getAdminAllowlistStatus().hasUsableEmails, false);

  process.env.ADMIN_OPS_EMAIL_ALLOWLIST = 'ops@real.example';
  assert.equal(getAdminAllowlistStatus().hasUsableEmails, true);
  assert.equal(getAdminAllowlistStatus().onlyPlaceholders, false);
});

test('getAdminAllowlistStatus: deprecated-only flag', () => {
  process.env.ADMIN_EMAIL_ALLOWLIST = 'legacy@example.com';
  const status = getAdminAllowlistStatus();
  assert.equal(status.usingDeprecatedOnly, true);
  assert.equal(status.hasUsableEmails, true);
});
