import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CHECKOUT_CANCEL_DRAFT_TTL_MS,
  parseCheckoutCancelDraft,
  serializeCheckoutCancelDraft,
} from '../src/lib/checkoutClient.ts';

const sampleDraft = {
  destinationSlug: 'beijing',
  routeSlug: 'beijing-essentials',
  departureId: 'dep-1',
  dateRange: '2026-08-01 – 2026-08-05',
  adultQuantity: 2,
  travelers: [{ name: 'Ada' }, { name: 'Bob' }],
  name: 'Ada',
  email: 'ada@example.com',
  phoneCountry: 'US',
  phoneNational: '5550100',
  phone: '+15550100',
  notes: 'Window seats',
};

test('serialize + parse round-trips checkout cancel draft', () => {
  const now = 1_700_000_000_000;
  const raw = serializeCheckoutCancelDraft(sampleDraft, now);
  assert.deepEqual(parseCheckoutCancelDraft(raw, now), sampleDraft);
});

test('parseCheckoutCancelDraft rejects expired drafts', () => {
  const savedAt = 1_700_000_000_000;
  const raw = serializeCheckoutCancelDraft(sampleDraft, savedAt);
  assert.equal(
    parseCheckoutCancelDraft(raw, savedAt + CHECKOUT_CANCEL_DRAFT_TTL_MS + 1),
    null,
  );
});

test('parseCheckoutCancelDraft rejects malformed JSON', () => {
  assert.equal(parseCheckoutCancelDraft('{'), null);
  assert.equal(parseCheckoutCancelDraft(null), null);
});

test('parseCheckoutCancelDraft never keeps access tokens or card fields', () => {
  const now = 1_700_000_000_000;
  const raw = JSON.stringify({
    version: 1,
    savedAt: now,
    draft: {
      ...sampleDraft,
      accessToken: 'secret',
      cardNumber: '4242424242424242',
    },
  });
  const parsed = parseCheckoutCancelDraft(raw, now);
  assert.ok(parsed);
  assert.equal('accessToken' in parsed, false);
  assert.equal('cardNumber' in parsed, false);
  assert.equal(parsed.email, 'ada@example.com');
});
