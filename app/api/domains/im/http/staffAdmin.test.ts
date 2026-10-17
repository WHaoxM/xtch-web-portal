import assert from 'node:assert/strict';
import test from 'node:test';
import { parseStaffPermissionScope } from './staffAdmin';

test('permission scope defaults to global only when scopeType is omitted', () => {
  assert.deepEqual(parseStaffPermissionScope({}), {
    scopeType: 'global',
    scopeId: null,
    scopeSource: null,
  });
});

test('unknown explicit permission scopes fail closed instead of becoming global', () => {
  for (const scopeType of ['sorce', '', null, 'GLOBAL', 1]) {
    assert.equal(parseStaffPermissionScope({ scopeType }), null, String(scopeType));
  }
});

test('source permission scope is normalized to an exact canonical source and unknown source is rejected', () => {
  assert.deepEqual(parseStaffPermissionScope({ scopeType: 'source', scopeSource: ' WenshuZhiLv ' }, 'im:conversation:read'), {
    scopeType: 'source',
    scopeId: null,
    scopeSource: 'wenshuzhilv',
  });
  assert.equal(parseStaffPermissionScope({ scopeType: 'source', scopeSource: 'wenshu-zhi-lv' }, 'im:conversation:read'), null);
  assert.equal(parseStaffPermissionScope({ scopeType: 'source', scopeSource: 'wenshuzhilv' }, 'im:staff:manage'), null);
});

test('tenant permission scope requires a UUID and does not accept a source field as tenant scope', () => {
  assert.equal(parseStaffPermissionScope({ scopeType: 'tenant', scopeId: 'bad', scopeSource: 'wenshuzhilv' }), null);
  assert.deepEqual(parseStaffPermissionScope({ scopeType: 'tenant', scopeId: '123e4567-e89b-42d3-a456-426614174000' }), {
    scopeType: 'tenant',
    scopeId: '123e4567-e89b-42d3-a456-426614174000',
    scopeSource: null,
  });
});
