import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

export const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

export function getStripe(): Stripe {
  if (!stripe) {
    throw new Error('Stripe is not configured.');
  }
  return stripe;
}

export function isStripeConfigured(): boolean {
  return Boolean(stripe);
}

/**
 * Local-only: skip Stripe Checkout when STRIPE_SECRET_KEY is unset.
 * NEVER enable in production or any deployed environment.
 */
export function isDevCheckoutBypassEnabled(): boolean {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
    return false;
  }
  const value = process.env.DEV_CHECKOUT_BYPASS?.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}
