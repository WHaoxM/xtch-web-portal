import { ensureFreshSession } from '@/lib/authClient';
import { normalizeDateOnly } from '@/lib/dateOnly';

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
    return endOnly ? `${startOnly || start} 鈥?${endOnly || end}` : startOnly || start;
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

  if (sameMonth) return `${startMonth} ${startDay} 鈥?${endDay}, ${startYear}`;
  if (sameYear) return `${startMonth} ${startDay} 鈥?${endMonth} ${endDay}, ${startYear}`;

  return `${startMonth} ${startDay}, ${startYear} 鈥?${endMonth} ${endDay}, ${endYear}`;
}

/** Footnote copy for booking confirmation email status (Mini-App + OrderSuccess). */
export function formatConfirmationEmailNote(email: string, status?: string | null): string {
  if (status === 'confirmation_email_failed') {
    return `We could not send a confirmation email to ${email}. Please contact us if you need a copy of your booking.`;
  }
  if (
    status === 'confirmation_email_sent' ||
    status === 'confirmation_email_traveler_sent'
  ) {
    return `A confirmation email has been sent to ${email}. If you do not see it, please check your spam folder.`;
  }
  return `A confirmation email is on its way to ${email}. If you do not see it, please check your spam folder.`;
}

export async function fetchMyOrders(
  accessToken: string,
): Promise<
  | { ok: true; orders: SafeOrderSummary[]; accessToken?: string }
  | { ok: false; error: string; unauthorized?: boolean }
> {
  const attempt = async (token: string) => {
    const response = await fetch('/api/my-orders', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await response.json()) as { ok: boolean; orders?: SafeOrderSummary[]; error?: string };

    if (!response.ok || !data.ok || !Array.isArray(data.orders)) {
      return {
        ok: false as const,
        error: data.error || 'We could not load your orders.',
        unauthorized: response.status === 401,
        status: response.status,
      };
    }

    return { ok: true as const, orders: data.orders, accessToken: token };
  };

  let result = await attempt(accessToken);
  if (!result.ok && result.unauthorized) {
    const fresh = await ensureFreshSession();
    if (fresh?.accessToken) {
      result = await attempt(fresh.accessToken);
    }
  }

  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      unauthorized: result.unauthorized,
    };
  }

  return { ok: true, orders: result.orders, accessToken: result.accessToken };
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

export type ClaimOrderProof = {
  orderNumber: string;
  token?: string;
  sessionId?: string;
};

export type ClaimOrderResult =
  | { ok: true; status: 'claimed' | 'already_linked' | 'email_claim'; claimedCount?: number }
  | { ok: false; error: string; status?: string; unauthorized?: boolean };

/** Parse confirmation / success URLs into order claim proof. */
export function parseOrderClaimInput(input: string): ClaimOrderProof | null {
  const raw = input.trim();
  if (!raw) return null;

  let orderNumber = '';
  let token = '';
  let sessionId = '';

  try {
    const asUrl = raw.includes('://') ? new URL(raw) : null;
    if (asUrl) {
      token = asUrl.searchParams.get('token') || '';
      sessionId = asUrl.searchParams.get('session_id') || '';
      const hash = asUrl.hash.replace(/^#/, '');
      const hashPath = hash.split('?')[0] || '';
      const hashQuery = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
      const hashParams = new URLSearchParams(hashQuery);
      token = token || hashParams.get('token') || '';
      sessionId = sessionId || hashParams.get('session_id') || '';
      orderNumber =
        hashParams.get('order') ||
        asUrl.searchParams.get('order') ||
        (asUrl.pathname.match(/\/orders\/([^/?#]+)/i)?.[1] ?? '') ||
        (hashPath.match(/orders\/([^/?#]+)/i)?.[1] ?? '') ||
        '';
    } else {
      const hashIndex = raw.indexOf('#');
      const queryPart = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : '';
      const params = new URLSearchParams(queryPart.split('#')[0]);
      token = params.get('token') || '';
      sessionId = params.get('session_id') || '';
      orderNumber = params.get('order') || '';
      if (!orderNumber && hashIndex >= 0) {
        const hash = raw.slice(hashIndex + 1);
        const hashPath = hash.split('?')[0] || '';
        const hashQuery = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
        const hashParams = new URLSearchParams(hashQuery);
        token = token || hashParams.get('token') || '';
        sessionId = sessionId || hashParams.get('session_id') || '';
        orderNumber =
          hashParams.get('order') || hashPath.match(/orders\/([^/?#]+)/i)?.[1] || '';
      }
      if (!orderNumber && /^ST-[A-Z0-9-]+$/i.test(raw.split(/[\s?&#]/)[0] || '')) {
        orderNumber = raw.split(/[\s?&#]/)[0] || '';
      }
    }
  } catch {
    return null;
  }

  orderNumber = decodeURIComponent(orderNumber).trim();
  token = token.trim();
  sessionId = sessionId.trim();

  if (!orderNumber || (!token && !sessionId)) {
    return null;
  }

  return {
    orderNumber,
    token: token || undefined,
    sessionId: sessionId || undefined,
  };
}

export async function claimOrderToAccount(
  accessToken: string,
  proof?: ClaimOrderProof,
): Promise<ClaimOrderResult> {
  const attempt = async (token: string) => {
    const response = await fetch('/api/claim-orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        proof
          ? {
              orderNumber: proof.orderNumber,
              token: proof.token,
              sessionId: proof.sessionId,
            }
          : {},
      ),
    });
    const data = (await response.json()) as {
      ok?: boolean;
      error?: string;
      status?: string;
      claimedCount?: number;
    };

    if (response.status === 401) {
      return {
        ok: false as const,
        error: data.error || 'Sign in to save this booking.',
        unauthorized: true,
      };
    }

    if (!response.ok || !data.ok) {
      return {
        ok: false as const,
        error: data.error || 'We could not link this booking to your account.',
        status: data.status,
      };
    }

    const status: 'claimed' | 'already_linked' | 'email_claim' =
      data.status === 'already_linked'
        ? 'already_linked'
        : data.status === 'email_claim'
          ? 'email_claim'
          : 'claimed';

    return {
      ok: true as const,
      status,
      claimedCount: data.claimedCount,
    };
  };

  let result = await attempt(accessToken);
  if (!result.ok && result.unauthorized) {
    const fresh = await ensureFreshSession();
    if (fresh?.accessToken) {
      result = await attempt(fresh.accessToken);
    }
  }

  return result;
}
