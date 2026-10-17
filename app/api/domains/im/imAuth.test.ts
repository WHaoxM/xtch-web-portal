import assert from 'node:assert/strict';
import test from 'node:test';
import { hasGlobalPermission, hasPermission, isActiveImStaffStatus, resolveStaffPermissionSets, type ImStaffPrincipal } from './imAuth';

test('staff status gate fails closed immediately when the account is no longer active', () => {
  assert.equal(isActiveImStaffStatus('active'), true);
  assert.equal(isActiveImStaffStatus('suspended'), false);
  assert.equal(isActiveImStaffStatus('disabled'), false);
  assert.equal(isActiveImStaffStatus('invited'), false);
  assert.equal(isActiveImStaffStatus(null), false);
});

test('source-only permissions are never flattened into JWT claims for legacy accounts', () => {
  const rows = [
    { permission_code: 'im:conversation:read', scope_type: 'source' as const, scope_id: null },
    { permission_code: 'im:message:send', scope_type: 'source' as const, scope_id: null },
  ];
  const sets = resolveStaffPermissionSets(rows, false);

  assert.deepEqual(sets.permissions, []);
  assert.deepEqual(sets.tokenPermissions, []);
  assert.deepEqual(sets.sourcePermissions, []);
});

test('source-enforced accounts do not retain old global or tenant grants in generated token permission sets', () => {
  const sets = resolveStaffPermissionSets([
    { permission_code: 'im:conversation:read', scope_type: 'source', scope_id: null },
    { permission_code: 'im:message:send', scope_type: 'source', scope_id: null },
    { permission_code: 'im:staff:manage', scope_type: 'global', scope_id: null },
    { permission_code: 'im:conversation:read', scope_type: 'tenant', scope_id: 'tenant-1' },
  ], true);

  assert.deepEqual(sets.tokenPermissions, []);
  assert.deepEqual(sets.permissions, ['im:conversation:read', 'im:message:send']);
  assert.deepEqual(sets.sourcePermissions, ['im:conversation:read', 'im:message:send']);
  assert.deepEqual(sets.globalPermissions, []);
  assert.deepEqual(sets.tenantIds, []);
});

test('source-only management or unrelated permission codes are not elevated into the staff API', () => {
  const sets = resolveStaffPermissionSets([
    { permission_code: 'im:staff:manage', scope_type: 'source', scope_id: null },
    { permission_code: 'im:conversation:read', scope_type: 'source', scope_id: null },
  ], true);

  assert.deepEqual(sets.sourcePermissions, ['im:conversation:read']);
  assert.equal(sets.permissions.includes('im:staff:manage'), false);
});

test('source-only action codes are recognized only while the account is source-enforced', () => {
  const principal: ImStaffPrincipal = {
    staffId: 'staff-1',
    username: 'agent',
    displayName: 'Agent',
    accountType: 'staff',
    permissions: [],
    globalPermissions: [],
    tenantIds: [],
    sourceScopeEnforced: true,
    sourcePermissions: ['im:message:send'],
  };
  assert.equal(hasPermission(principal, 'im:message:send'), true);
  assert.equal(hasPermission({ ...principal, sourcePermissions: ['im:staff:manage'] }, 'im:staff:manage'), false);
  assert.equal(hasPermission({ ...principal, sourcePermissions: [] }, 'im:message:send'), false);
  assert.equal(hasPermission({ ...principal, sourceScopeEnforced: false }, 'im:message:send'), false);
});

test('source enforcement ignores super-admin and historical global or tenant permission claims', () => {
  const principal: ImStaffPrincipal = {
    staffId: 'staff-1',
    username: 'agent',
    displayName: 'Agent',
    accountType: 'super_admin',
    permissions: ['im:staff:manage', 'im:conversation:read'],
    globalPermissions: ['im:staff:manage', 'im:conversation:read'],
    tenantIds: ['tenant-1'],
    sourceScopeEnforced: true,
    sourcePermissions: ['im:conversation:read'],
  };

  assert.equal(hasPermission(principal, 'im:conversation:read'), true, 'current database source grant is honored');
  assert.equal(hasPermission(principal, 'im:staff:manage'), false, 'legacy JWT/global grant is ignored');
  assert.equal(hasGlobalPermission(principal, 'im:conversation:read'), false);
  assert.equal(hasGlobalPermission(principal, 'im:staff:manage'), false);
});
