import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeCheckoutPayload, validateCheckoutPayload } from './checkoutPayload';

const validBody = {
  departureId: 'dep-1',
  adultQuantity: 2,
  email: 'LEAD@example.com',
  travelers: [
    { name: 'Ada Lovelace', gender: 'female' },
    { name: 'Alan Turing', gender: 'male' },
  ],
};

test('normalizes self-reported traveler genders without deriving them from names', () => {
  const payload = normalizeCheckoutPayload(validBody);

  assert.deepEqual(payload.travelers, validBody.travelers);
  assert.equal(payload.name, 'Ada Lovelace');
  assert.equal(payload.email, 'lead@example.com');
  assert.equal(validateCheckoutPayload(payload), '');
});

test('rejects a missing or unsupported gender for the matching traveler slot', () => {
  const missing = normalizeCheckoutPayload({
    ...validBody,
    travelers: [{ name: 'Ada Lovelace' }, validBody.travelers[1]],
  });
  assert.equal(
    validateCheckoutPayload(missing),
    "Please select traveler 1's gender.",
  );

  const unsupported = normalizeCheckoutPayload({
    ...validBody,
    travelers: [{ name: 'Ada Lovelace', gender: 'unknown' }, validBody.travelers[1]],
  });
  assert.equal(
    validateCheckoutPayload(unsupported),
    "Please select traveler 1's gender.",
  );
});

test('requires traveler slots to align exactly with adult quantity', () => {
  const payload = normalizeCheckoutPayload({
    ...validBody,
    adultQuantity: 1,
  });

  assert.equal(
    validateCheckoutPayload(payload),
    'Traveler details must match the number of adults.',
  );
});
