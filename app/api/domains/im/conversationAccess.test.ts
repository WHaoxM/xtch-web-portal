import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveConversationAccess } from './conversationAccess';

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
