import assert from 'node:assert/strict';
import test from 'node:test';
import {
  departureAvailability,
  formatDeparturePrice,
  groupDeparturesByRoute,
  normalizeConfirmedRoster,
  type PublicDeparture,
} from '../src/lib/departuresClient';

const baseDeparture: PublicDeparture = {
  publicId: 'dep-1',
  routeSlug: 'jiuzhaigou-loop',
  routeTitle: 'Jiuzhaigou Loop',
  destinationSlug: 'jiuzhaigou',
  departureCity: 'Chengdu',
  startDate: '2026-09-10',
  endDate: '2026-09-14',
  guaranteed: true,
  adultPriceCents: 128000,
  currency: 'usd',
  capacity: 12,
  availableSeats: 4,
  confirmedRoster: {
    male: 3,
    female: 4,
    unknown: 1,
    total: 8,
  },
};

test('formats the stored fixed price without inventing a starting price', () => {
  assert.equal(formatDeparturePrice(baseDeparture), '$1,280');
});

test('derives availability from current public inventory', () => {
  assert.deepEqual(departureAvailability(baseDeparture), {
    label: '4 seats left',
    bookable: true,
  });
  assert.deepEqual(departureAvailability({ ...baseDeparture, availableSeats: 0 }), {
    label: 'Sold out',
    bookable: false,
  });
});

test('groups departures by route while preserving API order', () => {
  const groups = groupDeparturesByRoute([
    baseDeparture,
    { ...baseDeparture, publicId: 'dep-2', startDate: '2026-10-10' },
    {
      ...baseDeparture,
      publicId: 'dep-3',
      routeSlug: 'beijing-classic',
      routeTitle: 'Beijing Classic',
    },
  ]);

  assert.deepEqual(
    groups.map((group) => ({
      routeSlug: group.routeSlug,
      departureIds: group.departures.map((departure) => departure.publicId),
    })),
    [
      { routeSlug: 'jiuzhaigou-loop', departureIds: ['dep-1', 'dep-2'] },
      { routeSlug: 'beijing-classic', departureIds: ['dep-3'] },
    ],
  );
});

test('public departure roster contains aggregate counts only', () => {
  assert.deepEqual(baseDeparture.confirmedRoster, {
    male: 3,
    female: 4,
    unknown: 1,
    total: 8,
  });
  assert.equal(Array.isArray(baseDeparture.confirmedRoster), false);
});

test('normalizes missing historical genders into unknown aggregate count', () => {
  assert.deepEqual(
    normalizeConfirmedRoster({ male: 1, female: 1, total: 4 }),
    { male: 1, female: 1, unknown: 2, total: 4 },
  );
});
