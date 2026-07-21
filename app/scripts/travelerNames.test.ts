import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resizeTravelers,
  validateTravelerDetails,
  type TravelerNameDraft,
} from '../src/lib/travelerNames';

test('resizing traveler slots preserves each self-reported gender', () => {
  const current: TravelerNameDraft[] = [
    { name: 'Ada', gender: 'female' },
    { name: 'Alan', gender: 'male' },
  ];

  assert.deepEqual(resizeTravelers(current, 3), [
    ...current,
    { name: '', gender: '' },
  ]);
});

test('traveler validation identifies a missing gender at the traveler index', () => {
  assert.deepEqual(
    validateTravelerDetails([{ name: 'Ada', gender: '' }], 1),
    {
      index: 0,
      field: 'gender',
      message: "Select traveler 1's gender.",
    },
  );
});

test('traveler validation rejects values outside male and female', () => {
  assert.deepEqual(
    validateTravelerDetails(
      [{ name: 'Ada', gender: 'unknown' as unknown as TravelerNameDraft['gender'] }],
      1,
    ),
    {
      index: 0,
      field: 'gender',
      message: "Select traveler 1's gender.",
    },
  );
});
