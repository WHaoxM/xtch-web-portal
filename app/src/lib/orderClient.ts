import { normalizeDateOnly } from './dateOnly';

export type SafeOrderSummary = {
  order_number: string;
  status: string;
  payment_status: string;
  refund_status: string;
  confirmation_email_status?: string;
  lead_traveler_name: string;
  lead_email: string;
  lead_phone: string | null;
  adult_quantity: number;
  currency: string;
  adult_unit_price_cents: number;
  total_price_cents: number;
  route_snapshot: {
    route_slug: string;
    route_title: string;
    destination_slug: string | null;
    departure_city: string;
    start_date: string;
    end_date: string;
  };
  price_snapshot: {
    adult_unit_price_cents: number;
    currency: string;
    adult_quantity: number;
    total_price_cents: number;
  };
  policy_snapshot: unknown;
  policy_version: string;
  traveler_details_due_at: string | null;
  paid_at: string | null;
  confirmed_at: string | null;
  cancellation_requested_at: string | null;
  date_change_requested_at: string | null;
};

export function formatOrderDateRange(start: string, end: string): string {
  const startOnly = normalizeDateOnly(start);
  const endOnly = normalizeDateOnly(end);
  const startDate = new Date(`${startOnly}T00:00:00Z`);
  const endDate = new Date(`${endOnly}T00:00:00Z`);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return endOnly ? `${startOnly || start} – ${endOnly || end}` : startOnly || start;
  }

  const monthFormat = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });
  const startMonth = monthFormat.format(startDate);
  const endMonth = monthFormat.format(endDate);
  const startDay = startDate.getUTCDate();
  const endDay = endDate.getUTCDate();
  const startYear = startDate.getUTCFullYear();
  const endYear = endDate.getUTCFullYear();
  const sameYear = startYear === endYear;
  const sameMonth = sameYear && startDate.getUTCMonth() === endDate.getUTCMonth();

  if (sameMonth) return `${startMonth} ${startDay} – ${endDay}, ${startYear}`;
  if (sameYear) return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${startYear}`;

  return `${startMonth} ${startDay}, ${startYear} – ${endMonth} ${endDay}, ${endYear}`;
}

/** Footnote copy for booking confirmation email status (Mini-App + OrderSuccess). */
export function formatConfirmationEmailNote(email: string, status?: string | null): string {
  if (status === 'confirmation_email_failed') {
    return `We could not send a confirmation email to ${email}. Please contact us if you need a copy of your booking.`;
  }
  if (status === 'confirmation_email_sent') {
    return `A confirmation email has been sent to ${email}. If you do not see it, please check your spam folder.`;
  }
  return `A confirmation email is on its way to ${email}. If you do not see it, please check your spam folder.`;
}

export async function fetchMyOrders(
  accessToken: string,
): Promise<{ ok: true; orders: SafeOrderSummary[] } | { ok: false; error: string }> {
  const response = await fetch('/api/my-orders', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await response.json()) as { ok: boolean; orders?: SafeOrderSummary[]; error?: string };

  if (!response.ok || !data.ok || !Array.isArray(data.orders)) {
    return { ok: false, error: data.error || 'We could not load your orders.' };
  }

  return { ok: true, orders: data.orders };
}

export async function fetchOrderSummary(
  orderNumber: string,
  token?: string,
  sessionId?: string,
  accessToken?: string,
): Promise<{ ok: true; order: SafeOrderSummary } | { ok: false; error: string }> {
  const params = new URLSearchParams();
  if (token) params.set('token', token);
  if (sessionId) params.set('session_id', sessionId);

  const headers: Record<string, string> = {};
  if (accessToken && !token && !sessionId) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`/api/orders?orderNumber=${encodeURIComponent(orderNumber)}&${params.toString()}`, {
    headers,
  });
  const data = (await response.json()) as { ok: boolean; order?: SafeOrderSummary; error?: string };

  if (!response.ok || !data.ok) {
    return { ok: false, error: data.error || 'We could not load your order.' };
  }

  return { ok: true, order: data.order! };
}
