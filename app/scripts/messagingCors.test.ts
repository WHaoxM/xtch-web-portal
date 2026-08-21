import test from 'node:test';
import assert from 'node:assert/strict';
import { handleMessagingCors } from './messagingCors.ts';

function response() {
  const headers = new Map<string, string>();
  return {
    statusCode: 200,
    headers,
    setHeader(name: string, value: string) { headers.set(name, value); },
    end() { /* test double */ },
  };
}

test('IM CORS allows explicit Capacitor origin with credentials', () => {
  const res = response();
  const handled = handleMessagingCors(
    '/api/im/auth/exchange',
    { method: 'POST', headers: { origin: 'capacitor://localhost' } },
    res,
    ['capacitor://localhost'],
  );
  assert.equal(handled, false);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'capacitor://localhost');
  assert.equal(res.headers.get('Access-Control-Allow-Credentials'), 'true');
});

test('IM CORS rejects unlisted preflight origin', () => {
  const res = response();
  const handled = handleMessagingCors(
    '/api/im/auth/exchange',
    { method: 'OPTIONS', headers: { origin: 'https://evil.example' } },
    res,
    ['capacitor://localhost'],
  );
  assert.equal(handled, true);
  assert.equal(res.statusCode, 403);
});
