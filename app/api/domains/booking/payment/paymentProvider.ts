export type PaymentProvider = 'payoneer' | 'stripe';

/**
 * Traveler-facing checkout provider.
 * Default is payoneer (Stripe code retained; set PAYMENT_PROVIDER=stripe to re-enable).
 */
export function getPaymentProvider(): PaymentProvider {
  const raw = (process.env.PAYMENT_PROVIDER || 'payoneer').trim().toLowerCase();
  return raw === 'stripe' ? 'stripe' : 'payoneer';
}

export function paymentProviderDisplayName(provider: PaymentProvider = getPaymentProvider()): string {
  return provider === 'stripe' ? 'Stripe' : 'Payoneer';
}
