import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveLegacyHashNavigation } from '../src/lib/hashLegacyRedirect.ts';

test('resolveLegacyHashNavigation converts #/tours/... to pathname', () => {
  assert.deepEqual(resolveLegacyHashNavigation('#/tours/example-route', ''), {
    path: '/tours/example-route',
    search: '',
  });
});

test('resolveLegacyHashNavigation prefers existing search over hash query', () => {
  assert.deepEqual(resolveLegacyHashNavigation('#/account?from=hash', '?auth_next=/admin'), {
    path: '/account',
    search: '?auth_next=/admin',
  });
});

test('resolveLegacyHashNavigation uses hash query when location has none', () => {
  assert.deepEqual(resolveLegacyHashNavigation('#/china-trips?checkout=cancelled', ''), {
    path: '/china-trips',
    search: '?checkout=cancelled',
  });
});

test('resolveLegacyHashNavigation skips supabase token fragments', () => {
  assert.equal(
    resolveLegacyHashNavigation('#access_token=abc&refresh_token=def', ''),
    null,
  );
});

test('resolveLegacyHashNavigation ignores non-route hashes', () => {
  assert.equal(resolveLegacyHashNavigation('#section', ''), null);
});
