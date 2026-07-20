export type CheckoutTraveler = {
  name: string;
};

export type FixedDepartureCheckoutPayload = {
  departureId: string;
  adultQuantity: number;
  name: string;
  email: string;
  travelers: CheckoutTraveler[];
  phone?: string;
  notes?: string;
  accessToken?: string;
};

export type CheckoutSessionResponse = {
  ok: boolean;
  checkoutUrl?: string;
  sessionId?: string;
  orderNumber?: string;
  expiresAt?: string;
  error?: string;
};

/** Minimal booking form snapshot for Stripe cancel return (sessionStorage only). */
export type CheckoutCancelFormDraft = {
  destinationSlug: string;
  routeSlug: string;
  departureId: string;
  dateRange: string;
  adultQuantity: number;
  travelers: CheckoutTraveler[];
  name: string;
  email: string;
  phoneCountry: string;
  phoneNational: string;
  phone: string;
  notes: string;
};

export const CHECKOUT_CANCEL_DRAFT_KEY = 'syncing_travel_checkout_cancel_draft';
export const CHECKOUT_CANCEL_DRAFT_TTL_MS = 30 * 60 * 1000;

type StoredCheckoutCancelDraft = {
  version: 1;
  savedAt: number;
  draft: CheckoutCancelFormDraft;
};

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asTravelerNames(value: unknown): CheckoutTraveler[] {
  if (!Array.isArray(value) || value.length === 0) return [{ name: '' }];
  return value.map((item) => ({
    name: typeof item === 'object' && item && 'name' in item ? asString((item as { name: unknown }).name) : '',
  }));
}

/** Pure parser for unit tests; rejects expired / malformed payloads. */
export function parseCheckoutCancelDraft(
  raw: string | null,
  nowMs: number = Date.now(),
  ttlMs: number = CHECKOUT_CANCEL_DRAFT_TTL_MS,
): CheckoutCancelFormDraft | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredCheckoutCancelDraft>;
    if (parsed.version !== 1 || typeof parsed.savedAt !== 'number' || !parsed.draft) {
      return null;
    }
    if (nowMs - parsed.savedAt > ttlMs) {
      return null;
    }

    const draft = parsed.draft;
    const adultQuantity = Math.max(1, Number(draft.adultQuantity) || 1);

    return {
      destinationSlug: asString(draft.destinationSlug),
      routeSlug: asString(draft.routeSlug),
      departureId: asString(draft.departureId),
      dateRange: asString(draft.dateRange),
      adultQuantity,
      travelers: asTravelerNames(draft.travelers),
      name: asString(draft.name),
      email: asString(draft.email),
      phoneCountry: asString(draft.phoneCountry),
      phoneNational: asString(draft.phoneNational),
      phone: asString(draft.phone),
      notes: asString(draft.notes),
    };
  } catch {
    return null;
  }
}

export function serializeCheckoutCancelDraft(
  draft: CheckoutCancelFormDraft,
  savedAt: number = Date.now(),
): string {
  const payload: StoredCheckoutCancelDraft = {
    version: 1,
    savedAt,
    draft: {
      destinationSlug: draft.destinationSlug,
      routeSlug: draft.routeSlug,
      departureId: draft.departureId,
      dateRange: draft.dateRange,
      adultQuantity: Math.max(1, Number(draft.adultQuantity) || 1),
      travelers: draft.travelers.map((traveler) => ({ name: traveler.name })),
      name: draft.name,
      email: draft.email,
      phoneCountry: draft.phoneCountry,
      phoneNational: draft.phoneNational,
      phone: draft.phone,
      notes: draft.notes,
    },
  };
  return JSON.stringify(payload);
}

export function saveCheckoutCancelDraft(draft: CheckoutCancelFormDraft): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(CHECKOUT_CANCEL_DRAFT_KEY, serializeCheckoutCancelDraft(draft));
}

export function clearCheckoutCancelDraft(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(CHECKOUT_CANCEL_DRAFT_KEY);
}

/** Read once and remove. Returns null when missing or expired. */
export function consumeCheckoutCancelDraft(): CheckoutCancelFormDraft | null {
  if (typeof window === 'undefined') return null;

  const raw = window.sessionStorage.getItem(CHECKOUT_CANCEL_DRAFT_KEY);
  window.sessionStorage.removeItem(CHECKOUT_CANCEL_DRAFT_KEY);
  return parseCheckoutCancelDraft(raw);
}

export async function createFixedDepartureCheckoutSession(payload: FixedDepartureCheckoutPayload) {
  const response = await fetch('/api/checkout-session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'Unexpected checkout response.',
  }))) as CheckoutSessionResponse;

  if (!response.ok || !result.ok || !result.checkoutUrl) {
    throw new Error(result.error || 'We could not open Stripe Checkout. Please try again.');
  }

  return result;
}
