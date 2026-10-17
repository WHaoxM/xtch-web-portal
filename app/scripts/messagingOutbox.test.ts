import assert from 'node:assert/strict';
import test from 'node:test';
import { authorizedMessagingSocketIds, mergeMessagingSocketCandidates } from './messagingOutbox';
import { mayUseRealtimeMessaging } from './messagingSocket';

test('source-scoped, revoked and disabled staff plus inactive visitors receive no socket conversation events', async () => {
  const sockets = [
    { id: 'legacy-a', data: { principal: { subject: 'legacy-active', role: 'tenant_staff' } } },
    { id: 'legacy-b', data: { principal: { subject: 'legacy-active', role: 'tenant_staff' } } },
    { id: 'source-scoped', data: { principal: { subject: 'wenshu-staff', role: 'tenant_staff' } } },
    { id: 'revoked', data: { principal: { subject: 'revoked-staff', role: 'tenant_staff' } } },
    { id: 'visitor-active', data: { principal: { subject: 'visitor-active-session', role: 'visitor' } } },
    { id: 'visitor-revoked', data: { principal: { subject: 'visitor-revoked-session', role: 'visitor' } } },
    { id: 'missing-auth', data: {} },
  ];
  const lookedUp: string[][] = [];
  const visitorLookups: string[][] = [];
  const allowed = await authorizedMessagingSocketIds(
    sockets,
    'conversation-1',
    async (staffIds) => {
      lookedUp.push(staffIds);
      // Mirrors the live DB result: disabled, revoked, and source-enforced accounts are omitted.
      return new Set(staffIds.filter((id) => id === 'legacy-active'));
    },
    async (sessionIds) => {
      visitorLookups.push(sessionIds);
      // The current database still binds only this active visitor session to the conversation.
      return new Set(sessionIds.filter((id) => id === 'visitor-active-session'));
    },
  );

  assert.deepEqual(allowed.sort(), ['legacy-a', 'legacy-b', 'visitor-active']);
  assert.equal(lookedUp.length, 1, 'authorization should be batched once for a room');
  assert.deepEqual(lookedUp[0]?.sort(), ['legacy-active', 'revoked-staff', 'wenshu-staff']);
  assert.deepEqual(visitorLookups[0], ['visitor-active-session', 'visitor-revoked-session']);
});

test('socket authorization database failure rejects delivery so caller can fail closed and retry', async () => {
  await assert.rejects(
    authorizedMessagingSocketIds(
      [{ id: 'staff-socket', data: { principal: { subject: 'staff-1', role: 'tenant_staff' } } }],
      'conversation-1',
      async () => { throw new Error('db unavailable'); },
      async () => new Set(),
    ),
    /db unavailable/,
  );
});

test('large rooms authorize unique principals in a single staff batch while preserving every live tab', async () => {
  const sockets = Array.from({ length: 1_200 }, (_, index) => ({
    id: `staff-socket-${index}`,
    data: { principal: { subject: `staff-${index}`, role: 'tenant_staff' } },
  }));
  sockets.push(
    { id: 'staff-socket-0-second-tab', data: { principal: { subject: 'staff-0', role: 'tenant_staff' } } },
    { id: 'staff-socket-0-second-room-copy', data: { principal: { subject: 'staff-0', role: 'tenant_staff' } } },
  );
  const batches: string[][] = [];
  const allowed = await authorizedMessagingSocketIds(
    sockets,
    'conversation-1',
    async (staffIds) => {
      batches.push(staffIds);
      return new Set(staffIds);
    },
    async () => new Set(),
  );

  assert.equal(batches.length, 1);
  assert.equal(batches[0]?.length, 1_200, 'duplicate tabs and overlapping rooms should not duplicate principals');
  assert.equal(allowed.length, 1_202, 'all distinct authorized tabs should receive the event');
  assert.equal(new Set(allowed).size, 1_202);
});

test('overlapping conversation, tenant and target-staff rooms deduplicate socket IDs before authorization', () => {
  const shared = { id: 'shared-tab', data: { principal: { subject: 'staff-1', role: 'tenant_staff' } } };
  const merged = mergeMessagingSocketCandidates([
    [shared, { id: 'conversation-only', data: {} }],
    [shared, { id: 'tenant-only', data: {} }],
    [shared],
  ]);

  assert.deepEqual(merged.map((socket) => socket.id).sort(), ['conversation-only', 'shared-tab', 'tenant-only']);
});

test('visitor session authorization database failure also rejects delivery', async () => {
  await assert.rejects(
    authorizedMessagingSocketIds(
      [{ id: 'visitor-socket', data: { principal: { subject: 'visitor-session', role: 'visitor' } } }],
      'conversation-1',
      async () => new Set(),
      async () => { throw new Error('visitor db unavailable'); },
    ),
    /visitor db unavailable/,
  );
});

test('source-scoped staff use REST polling instead of joining websocket rooms', () => {
  assert.equal(mayUseRealtimeMessaging({ subject: 'wenshu-1', role: 'tenant_staff', tenantId: null, scopes: [], sourceScopeEnforced: true }), false);
  assert.equal(mayUseRealtimeMessaging({ subject: 'legacy-1', role: 'tenant_staff', tenantId: null, scopes: [] }), true);
  assert.equal(mayUseRealtimeMessaging({ subject: 'visitor-1', role: 'visitor', tenantId: null, scopes: [], sourceScopeEnforced: true }), true);
});
