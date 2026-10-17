import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hasLegacyAssignmentScope,
  resolveConversationAccess,
  resolveLegacyConversationCloseAccess,
} from './conversationAccess';

const permissionCases = [
  ['read', 'im:conversation:read'],
  ['claim', 'im:assignment:claim'],
  ['takeover', 'im:assignment:takeover'],
  ['transfer', 'im:assignment:transfer'],
  ['send', 'im:message:send'],
  ['close', 'im:conversation:close'],
] as const;

test('source-enforced staff can perform granted actions only for the exact source', () => {
  for (const [, permission] of permissionCases) {
    const access = (conversationSource: string) => ({
      permission,
      sourceScopeEnforced: true,
      sourceGrantActive: conversationSource === 'wenshuzhilv',
      globalAccess: true,
      membership: true,
      tenantRead: true,
      conversationSource,
    });
    assert.equal(resolveConversationAccess(access('wenshuzhilv')), true, permission);
    for (const source of ['portal_web', 'portal_mobile', 'xt_mvp_mobile']) {
      assert.equal(resolveConversationAccess(access(source)), false, `${permission} ${source}`);
    }
  }
});

test('source-enforced staff are denied immediately when the live source grant is revoked or narrowed', () => {
  const base = {
    permission: 'im:conversation:read',
    sourceScopeEnforced: true,
    globalAccess: true,
    membership: true,
    tenantRead: true,
    conversationSource: 'wenshuzhilv',
  };
  assert.equal(resolveConversationAccess({ ...base, sourceGrantActive: true }), true);
  assert.equal(resolveConversationAccess({ ...base, sourceGrantActive: false }), false);
  assert.equal(resolveConversationAccess({ ...base, sourceGrantActive: false, conversationSource: 'portal_web' }), false);
});

test('accounts without explicit source enforcement preserve legacy global, membership and tenant behavior', () => {
  const base = {
    permission: 'im:conversation:read',
    sourceScopeEnforced: false,
    sourceGrantActive: false,
    conversationSource: 'portal_web',
  };
  assert.equal(resolveConversationAccess({ ...base, globalAccess: true, membership: false, tenantRead: false }), true);
  assert.equal(resolveConversationAccess({ ...base, globalAccess: false, membership: true, tenantRead: false }), true);
  assert.equal(resolveConversationAccess({ ...base, globalAccess: false, membership: false, tenantRead: true }), true);
  assert.equal(resolveConversationAccess({ ...base, globalAccess: false, membership: false, tenantRead: false }), false);
});

test('legacy close requires both lifecycle permission and the prior read-access path', () => {
  const close = (overrides: Partial<Parameters<typeof resolveLegacyConversationCloseAccess>[0]> = {}) =>
    resolveLegacyConversationCloseAccess({
      closePermission: true,
      readPermission: true,
      readGlobalAccess: false,
      membership: false,
      tenantRead: true,
      ...overrides,
    });

  assert.equal(close(), true, 'tenant read plus close permission remains allowed');
  assert.equal(close({ tenantRead: false, readGlobalAccess: true }), true, 'global read plus close remains allowed');
  assert.equal(close({ tenantRead: false, membership: true }), true, 'active member read path plus close remains allowed');
  assert.equal(close({ closePermission: false }), false, 'close permission remains required');
  assert.equal(close({ readPermission: false, readGlobalAccess: true }), false, 'global close without read permission is denied');
  assert.equal(close({ tenantRead: false, membership: false, readGlobalAccess: false }), false);
});

test('legacy assignment keeps the prior global-claim or tenant-scope gate', () => {
  assert.equal(hasLegacyAssignmentScope(true, false), true, 'global claim scope remains allowed');
  assert.equal(hasLegacyAssignmentScope(false, true), true, 'tenant scope remains allowed for claim/takeover/transfer');
  assert.equal(hasLegacyAssignmentScope(false, false), false, 'unscoped legacy account remains denied');
});

test('source-enforced access never inherits a broad permission or membership when the requested source permission is absent', () => {
  const base = {
    permission: 'im:message:send',
    sourceScopeEnforced: true,
    globalAccess: true,
    membership: true,
    tenantRead: true,
    conversationSource: 'wenshuzhilv',
  };
  assert.equal(resolveConversationAccess({ ...base, sourceGrantActive: false }), false);
});
