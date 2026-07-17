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
