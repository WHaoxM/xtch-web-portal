import assert from 'node:assert/strict';
import test from 'node:test';
import { StaffImClient } from './staffImClient.ts';

test('exchange-only staff sessions re-exchange after a 10-minute access token expires without refresh tokens', async () => {
  const originalFetch = globalThis.fetch;
  const exchangeAuthorization = [];
  const listAuthorization = [];
  const urls = [];
  let exchangeCount = 0;

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    urls.push(url);
    if (url.endsWith('/api/im/auth/exchange')) {
      exchangeAuthorization.push(new Headers(init?.headers).get('authorization'));
      exchangeCount += 1;
      return new Response(JSON.stringify({
        ok: true,
        access_token: `im-short-${exchangeCount}`,
        expires_in: 600,
        staff: {
          id: 'staff-1',
          username: 'agent',
          display_name: 'Agent',
          account_type: 'staff',
          permissions: ['im:conversation:read'],
          tenant_ids: [],
        },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.includes('/api/im/conversations?')) {
      listAuthorization.push(new Headers(init?.headers).get('authorization'));
      if (listAuthorization.length === 1) {
        return new Response(JSON.stringify({ ok: false, error: 'IM access token expired.' }), { status: 401 });
      }
      return new Response(JSON.stringify({ ok: true, items: [], nextCursor: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const client = new StaffImClient('aq1.test-admin-session');
    const result = await client.listConversations({ scope: 'all' });
    assert.deepEqual(result, { ok: true, items: [], nextCursor: null });
    assert.equal(exchangeCount, 2);
    assert.deepEqual(exchangeAuthorization, [
      'Bearer aq1.test-admin-session',
      'Bearer aq1.test-admin-session',
    ]);
    assert.deepEqual(listAuthorization, ['Bearer im-short-1', 'Bearer im-short-2']);
    assert.equal(urls.some((url) => url.endsWith('/api/im/auth/refresh')), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
