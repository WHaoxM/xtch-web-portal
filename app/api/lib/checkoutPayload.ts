export type TravelerGender = 'male' | 'female';

export type CheckoutTraveler = {
  name: string;
  gender: TravelerGender | '';
};

export type CheckoutPayload = {
  departureId?: string;
  adultQuantity?: number;
  name?: string;
  email?: string;
  phone?: string;
  notes?: string;
  travelers?: CheckoutTraveler[];
  accessToken?: string;
};

const MAX_NOTES_LENGTH = 2000;
const MAX_PHONE_LENGTH = 50;
const MAX_NAME_LENGTH = 200;
const MAX_ADULT_QUANTITY = 20;

export function normalizeCheckoutPayload(body: unknown): CheckoutPayload {
  if (!body || typeof body !== 'object') return {};
  const raw = body as Record<string, unknown>;
  const travelers = normalizeTravelers(raw.travelers);
  const name = stringValue(raw.name) || travelers[0]?.name || '';

  return {
    departureId: stringValue(raw.departureId),
    adultQuantity: numberValue(raw.adultQuantity),
    name,
    email: stringValue(raw.email).toLowerCase(),
    phone: stringValue(raw.phone),
    notes: stringValue(raw.notes),
    travelers,
    accessToken: stringValue(raw.accessToken),
  };
}

export function validateCheckoutPayload(payload: CheckoutPayload): string {
  if (!payload.departureId) return 'Please choose an available departure.';
  if (!isSafePublicId(payload.departureId)) return 'Invalid departure selection.';

  if (
    typeof payload.adultQuantity !== 'number' ||
    !Number.isFinite(payload.adultQuantity) ||
    payload.adultQuantity < 1 ||
    payload.adultQuantity > MAX_ADULT_QUANTITY ||
    !Number.isInteger(payload.adultQuantity)
  ) {
    return `Please choose 1 to ${MAX_ADULT_QUANTITY} adult travelers.`;
  }

  const travelers = payload.travelers ?? [];
  if (travelers.length !== payload.adultQuantity) {
    return 'Traveler details must match the number of adults.';
  }

  for (let index = 0; index < travelers.length; index++) {
    const traveler = travelers[index];
    if (!traveler?.name) {
      return `Please enter traveler ${index + 1}'s full name.`;
    }
    if (traveler.name.length > MAX_NAME_LENGTH) {
      return `Traveler ${index + 1}'s name is too long.`;
    }
    if (traveler.gender !== 'male' && traveler.gender !== 'female') {
      return `Please select traveler ${index + 1}'s gender.`;
    }
  }

  if (!payload.name || payload.name.length > MAX_NAME_LENGTH) {
    return 'Please enter the lead traveler name.';
  }
  if (!isValidEmail(payload.email)) {
    return 'Please enter a valid email address.';
  }
  if (payload.phone) {
    if (payload.phone.length > MAX_PHONE_LENGTH) {
      return 'Please enter a shorter phone number.';
    }
    if (!/^\+[1-9]\d{6,14}$/.test(payload.phone)) {
      return 'Please enter a valid international phone number, or leave it blank.';
    }
  }
  if (payload.notes && payload.notes.length > MAX_NOTES_LENGTH) {
    return 'Please keep notes under 2000 characters.';
  }
  return '';
}

function normalizeTravelers(value: unknown): CheckoutTraveler[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (!item || typeof item !== 'object') return { name: '', gender: '' };
    const record = item as Record<string, unknown>;
    const gender = stringValue(record.gender);
    return {
      name: stringValue(record.name),
      gender: gender === 'male' || gender === 'female' ? gender : '',
    };
  });
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function isValidEmail(value: string | undefined): boolean {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

function isSafePublicId(value: string | undefined): boolean {
  return Boolean(value && /^[a-z0-9_-]+$/i.test(value));
}
