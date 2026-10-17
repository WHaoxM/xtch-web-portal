/**
 * Shared local API route table for Vite dev middleware and serve-selfhost.
 * Values are paths relative to app/ (leading slash optional for Node resolve).
 * Public URL keys stay stable; file paths may nest under api/admin/<area>/.
 */
export const localApiRoutes: Record<string, string> = {
  '/api/wenshu': '/api/wenshu.ts',
  '/api/im/auth/exchange': '/api/im/auth-exchange.ts',
  '/api/im/auth/introspect': '/api/im/auth-introspect.ts',
  '/api/im/auth/refresh': '/api/im/auth-refresh.ts',
  '/api/im/auth/logout': '/api/im/auth-logout.ts',
  '/api/im/auth/activate': '/api/im/auth-activate.ts',
  '/api/im/auth/login': '/api/im/auth-login.ts',
  '/api/im/staff/invite': '/api/im/staff-invite.ts',
  '/api/im/staff/permissions': '/api/im/staff-permissions.ts',
  '/api/im/conversations/assign': '/api/im/assignment.ts',
  '/api/im/conversations/status': '/api/im/conversation-status.ts',
  '/api/im/conversations': '/api/im/conversations.ts',
  '/api/im/public/session': '/api/im/public-session.ts',
  '/api/im/public/conversations': '/api/im/public-conversations.ts',
  '/api/inquiries': '/api/inquiries.ts',
  '/api/checkout-session': '/api/checkout-session.ts',
  '/api/auth-provider-status': '/api/auth-provider-status.ts',
  '/api/departures': '/api/departures.ts',
  '/api/stripe-webhook': '/api/stripe-webhook.ts',
  '/api/payoneer-webhook': '/api/payoneer-webhook.ts',
  '/api/orders': '/api/orders.ts',
  '/api/my-orders': '/api/my-orders.ts',
  '/api/claim-orders': '/api/claim-orders.ts',
  '/api/custom-trip-form': '/api/custom-trip-form.ts',
  '/api/destinations': '/api/destinations.ts',
  '/api/routes': '/api/routes.ts',
  '/api/categories': '/api/categories.ts',

  '/api/admin/me': '/api/admin/auth/me.ts',
  '/api/admin/auth-otp': '/api/admin/auth/auth-otp.ts',
  '/api/admin/auth-magic-link': '/api/admin/auth/auth-magic-link.ts',
  '/api/admin/auth-password': '/api/admin/auth/auth-password.ts',

  '/api/admin/orders': '/api/admin/booking/orders.ts',
  '/api/admin/dashboard': '/api/admin/booking/dashboard.ts',

  '/api/admin/inquiries': '/api/admin/inquiry/inquiries.ts',
  '/api/admin/wenshu-leads': '/api/admin/inquiry/wenshu-leads.ts',

  '/api/admin/departures': '/api/admin/catalog/departures.ts',
  '/api/admin/custom-trip-form': '/api/admin/catalog/custom-trip-form.ts',
  '/api/admin/destinations': '/api/admin/catalog/destinations.ts',
  '/api/admin/routes': '/api/admin/catalog/routes.ts',
  '/api/admin/categories': '/api/admin/catalog/categories.ts',

  '/api/admin/media': '/api/admin/media/media.ts',
  '/api/admin/media-presign': '/api/admin/media/media-presign.ts',
};

const dynamicApiRoutes: Array<{ pattern: RegExp; modulePath: string }> = [
  {
    pattern: /^\/api\/im\/public\/conversations\/[^/]+\/identity\/link$/,
    modulePath: '/api/im/public-identity-link.ts',
  },
  {
    pattern: /^\/api\/im\/public\/conversations\/[^/]+\/messages$/,
    modulePath: '/api/im/public-messages.ts',
  },
  {
    pattern: /^\/api\/im\/conversations\/[^/]+\/messages$/,
    modulePath: '/api/im/staff-messages.ts',
  },
  {
    pattern: /^\/api\/im\/conversations\/[^/]+\/read$/,
    modulePath: '/api/im/read-cursor.ts',
  },
  {
    pattern: /^\/api\/im\/conversations\/[^/]+\/status$/,
    modulePath: '/api/im/conversation-status.ts',
  },
  {
    pattern: /^\/api\/im\/conversations\/[^/]+$/,
    modulePath: '/api/im/conversation-detail.ts',
  },
];

export function resolveLocalApiRoute(pathname: string): string | undefined {
  const direct = localApiRoutes[pathname];
  if (direct) return direct;
  return dynamicApiRoutes.find((route) => route.pattern.test(pathname))?.modulePath;
}

/** Routes that must receive the raw Buffer body (not JSON-parsed). */
export const rawBodyRoutes = new Set(['/api/stripe-webhook', '/api/payoneer-webhook']);
