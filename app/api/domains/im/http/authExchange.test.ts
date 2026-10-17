import assert from 'node:assert/strict';
import test from 'node:test';
import { requireAdminAuth } from '../../identity/admin/adminAuth';
import { isAdminQuickLoginToken, mintAdminQuickLoginToken, verifyAdminQuickLoginToken } from '../../identity/admin/adminQuickLogin';
import { classifyImExchangeCredential, resolveAdminQuickLoginStaff, type AdminQuickMappingCandidate } from './authExchange';

test('valid, expired, and tampered aq1 tokens are validated by the existing admin verifier', async () => {
  const originalEnv = {
    email: process.env.ADMIN_QUICK_LOGIN_EMAIL,
    password: process.env.ADMIN_QUICK_LOGIN_PASSWORD,
    tech: process.env.ADMIN_TECH_EMAIL_ALLOWLIST,
    ops: process.env.ADMIN_OPS_EMAIL_ALLOWLIST,
    legacy: process.env.ADMIN_EMAIL_ALLOWLIST,
  };
  const originalNow = Date.now;
  const email = 'admin-sso@example.com';
  const baseNow = 1_800_000_000_000;
  process.env.ADMIN_QUICK_LOGIN_EMAIL = email;
  process.env.ADMIN_QUICK_LOGIN_PASSWORD = 'test-only-password';
  process.env.ADMIN_TECH_EMAIL_ALLOWLIST = email;
  process.env.ADMIN_OPS_EMAIL_ALLOWLIST = '';
  process.env.ADMIN_EMAIL_ALLOWLIST = '';

  try {
    Date.now = () => baseNow;
    const token = mintAdminQuickLoginToken(email).accessToken;
    assert.equal(isAdminQuickLoginToken(token), true);
    assert.deepEqual(verifyAdminQuickLoginToken(token), { ok: true, email });
    assert.deepEqual(await requireAdminAuth({ headers: { authorization: `Bearer ${token}` } }), {
      ok: true,
      email,
      role: 'tech',
    });
    assert.equal(classifyImExchangeCredential(token), 'admin_quick');

    const [, payload, signature] = token.split('.');
    const tampered = `aq1.${payload.slice(0, -1)}${payload.endsWith('A') ? 'B' : 'A'}.${signature}`;
    assert.equal(classifyImExchangeCredential(tampered), 'admin_quick', 'malformed aq1 never falls back to XT_MVP');
    assert.deepEqual(verifyAdminQuickLoginToken(tampered), { ok: false });
    assert.equal((await requireAdminAuth({ headers: { authorization: `Bearer ${tampered}` } })).ok, false);

    Date.now = () => baseNow + 13 * 60 * 60 * 1000;
    assert.deepEqual(verifyAdminQuickLoginToken(token), { ok: false });
    assert.equal((await requireAdminAuth({ headers: { authorization: `Bearer ${token}` } })).ok, false);
  } finally {
    Date.now = originalNow;
    restoreEnv('ADMIN_QUICK_LOGIN_EMAIL', originalEnv.email);
    restoreEnv('ADMIN_QUICK_LOGIN_PASSWORD', originalEnv.password);
    restoreEnv('ADMIN_TECH_EMAIL_ALLOWLIST', originalEnv.tech);
    restoreEnv('ADMIN_OPS_EMAIL_ALLOWLIST', originalEnv.ops);
    restoreEnv('ADMIN_EMAIL_ALLOWLIST', originalEnv.legacy);
  }
});

test('legacy XT_MVP credentials remain on the XT_MVP exchange branch', () => {
  assert.equal(isAdminQuickLoginToken('aq1.not-a-real-token'), true);
  assert.equal(classifyImExchangeCredential('aq1.not-a-real-token'), 'admin_quick');
  assert.equal(classifyImExchangeCredential('xt-mvp-access-token'), 'xt_mvp');
});

test('admin quick-login SSO requires an exact active source-enforced ordinary staff mapping', () => {
  const email = 'admin-sso@example.com';
  const mapping: AdminQuickMappingCandidate = {
    id: 'staff-1',
    username: 'wenshu-agent',
    display_name: 'Wenshu Agent',
    account_type: 'staff',
    external_role: null,
    external_provider: 'admin_quick',
    external_subject: email,
    status: 'active',
    source_scope_enforced: true,
  };

  assert.deepEqual(resolveAdminQuickLoginStaff(email, mapping), {
    id: mapping.id,
    username: mapping.username,
    display_name: mapping.display_name,
    account_type: mapping.account_type,
    external_role: mapping.external_role,
  });
  assert.equal(resolveAdminQuickLoginStaff(email, null), null, 'no mapping stays opt-in and does not provision');
  assert.equal(resolveAdminQuickLoginStaff(email, { ...mapping, external_subject: 'another@example.com' }), null, 'email mapping is exact');
  assert.equal(resolveAdminQuickLoginStaff(email, { ...mapping, status: 'disabled' }), null);
  assert.equal(resolveAdminQuickLoginStaff(email, { ...mapping, source_scope_enforced: false }), null);
  assert.equal(resolveAdminQuickLoginStaff(email, { ...mapping, account_type: 'super_admin' }), null);
  assert.equal(resolveAdminQuickLoginStaff(email, { ...mapping, external_provider: 'xt_mvp' }), null);
});

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
