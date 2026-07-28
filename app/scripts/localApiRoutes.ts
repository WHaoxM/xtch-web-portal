/**
 * Shared local API route table for Vite dev middleware and serve-selfhost.
 * Values are paths relative to app/ (leading slash optional for Node resolve).
 */
export const localApiRoutes: Record<string, string> = {
  '/api/inquiries': '/api/inquiries.ts',
  '/api/checkout-session': '/api/checkout-session.ts',
  '/api/auth-provider-status': '/api/auth-provider-status.ts',
  '/api/departures': '/api/departures.ts',
  '/api/stripe-webhook': '/api/stripe-webhook.ts',
  '/api/orders': '/api/orders.ts',
  '/api/my-orders': '/api/my-orders.ts',
  '/api/claim-orders': '/api/claim-orders.ts',
  '/api/admin/me': '/api/admin/me.ts',
  '/api/admin/auth-otp': '/api/admin/auth-otp.ts',
  '/api/admin/auth-magic-link': '/api/admin/auth-magic-link.ts',
  '/api/admin/auth-password': '/api/admin/auth-password.ts',

  '/api/admin/orders': '/api/admin/orders.ts',
  '/api/admin/dashboard': '/api/admin/dashboard.ts',
  '/api/admin/inquiries': '/api/admin/inquiries.ts',
  '/api/admin/departures': '/api/admin/departures.ts',
  '/api/custom-trip-form': '/api/custom-trip-form.ts',
  '/api/admin/custom-trip-form': '/api/admin/custom-trip-form.ts',
  '/api/destinations': '/api/destinations.ts',
  '/api/routes': '/api/routes.ts',
  '/api/admin/destinations': '/api/admin/destinations.ts',
  '/api/admin/routes': '/api/admin/routes.ts',
  '/api/admin/media': '/api/admin/media.ts',
  '/api/admin/media-presign': '/api/admin/media-presign.ts',
  '/api/categories': '/api/categories.ts',
  '/api/admin/categories': '/api/admin/categories.ts',
};

/** Routes that must receive the raw Buffer body (not JSON-parsed). */
export const rawBodyRoutes = new Set(['/api/stripe-webhook']);
