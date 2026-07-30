/**
 * Traveler-facing payment provider copy.
 * Defaults to Payoneer; set VITE_PAYMENT_PROVIDER=stripe to show Stripe wording.
 */
export type TravelerPaymentProvider = 'payoneer' | 'stripe';

export function getTravelerPaymentProvider(): TravelerPaymentProvider {
  const raw = (import.meta.env.VITE_PAYMENT_PROVIDER || 'payoneer').toString().trim().toLowerCase();
  return raw === 'stripe' ? 'stripe' : 'payoneer';
}

export function travelerPaymentProviderName(
  provider: TravelerPaymentProvider = getTravelerPaymentProvider(),
): string {
  return provider === 'stripe' ? 'Stripe' : 'Payoneer';
}

export function hostedCheckoutTrustCopy(
  provider: TravelerPaymentProvider = getTravelerPaymentProvider(),
): string {
  const name = travelerPaymentProviderName(provider);
  return `Secure ${name} Checkout — card details stay with ${name}. Syncing Travel never stores them.`;
}

export function openingCheckoutCopy(
  provider: TravelerPaymentProvider = getTravelerPaymentProvider(),
): string {
  return `Opening ${travelerPaymentProviderName(provider)} Checkout...`;
}

export function checkoutOpenFailedCopy(
  provider: TravelerPaymentProvider = getTravelerPaymentProvider(),
): string {
  return `We could not open ${travelerPaymentProviderName(provider)} Checkout. Please try again.`;
}

export function payFullAmountReviewCopy(
  provider: TravelerPaymentProvider = getTravelerPaymentProvider(),
): string {
  return `Review your details, then pay the full amount securely with ${travelerPaymentProviderName(provider)} Checkout.`;
}

export function groupToursPaymentCopy(
  provider: TravelerPaymentProvider = getTravelerPaymentProvider(),
): string {
  return `departure here with full payment through secure ${travelerPaymentProviderName(provider)} Checkout.`;
}
