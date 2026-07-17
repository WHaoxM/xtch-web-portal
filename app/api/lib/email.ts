import type { Order } from './bookingSchema';
import { formatDate } from './availability';
import { rotateAccessToken } from './orders';

const RESEND_API_URL = 'https://api.resend.com/emails';
/** Official Syncing Travel WhatsApp support link (same as site brand). */
const BOOKING_SUPPORT_WHATSAPP_URL = 'https://wa.me/8619380821961';

type RouteSnapshot = {
  route_slug?: string;
  route_title?: string;
  destination_slug?: string;
  departure_city?: string;
  start_date?: string;
  end_date?: string;
};

type PriceSnapshot = {
  adult_unit_price_cents?: number;
  currency?: string;
  adult_quantity?: number;
  total_price_cents?: number;
};

export async function sendBookingConfirmationEmail(order: Order): Promise<'sent' | 'failed'> {
  const fromEmail = process.env.BOOKING_FROM_EMAIL || process.env.INQUIRY_FROM_EMAIL;
  const emailMode = process.env.BOOKING_EMAIL_MODE || process.env.INQUIRY_EMAIL_MODE || 'resend';

  if (!fromEmail) {
    console.error('BOOKING_FROM_EMAIL or INQUIRY_FROM_EMAIL is not configured.');
    return 'failed';
  }

  const token = await rotateAccessToken(order.id);
  const routeSnapshot = (order.route_snapshot as RouteSnapshot) ?? {};
  const priceSnapshot = (order.price_snapshot as PriceSnapshot) ?? {};
  const policySnapshot = order.policy_snapshot;

  const unitPriceDollars = ((priceSnapshot.adult_unit_price_cents ?? 0) / 100).toFixed(2);
  const totalPriceDollars = ((priceSnapshot.total_price_cents ?? order.total_price_cents) / 100).toFixed(2);
  const orderUrl = buildOrderUrl(order.order_number, token);
  const startDate = formatTripDate(routeSnapshot.start_date ?? '');
  const endDate = formatTripDate(routeSnapshot.end_date ?? '');
  const policySummary = formatPolicySnapshot(policySnapshot);

  const subject = `Your Syncing Travel booking is confirmed · ${order.order_number}`;
  const html = buildConfirmationHtml({
    orderNumber: order.order_number,
    routeTitle: routeSnapshot.route_title ?? 'Your trip',
    departureCity: routeSnapshot.departure_city ?? '',
    startDate,
    endDate,
    adultQuantity: priceSnapshot.adult_quantity ?? order.adult_quantity,
    unitPriceDollars,
    totalPriceDollars,
    currency: priceSnapshot.currency?.toUpperCase() ?? 'USD',
    travelerDetailsDueAt: order.traveler_details_due_at,
    orderUrl,
    policySummary,
  });

  const text = buildConfirmationText({
    orderNumber: order.order_number,
    routeTitle: routeSnapshot.route_title ?? 'Your trip',
    departureCity: routeSnapshot.departure_city ?? '',
    startDate,
    endDate,
    adultQuantity: priceSnapshot.adult_quantity ?? order.adult_quantity,
    unitPriceDollars,
    totalPriceDollars,
    currency: priceSnapshot.currency?.toUpperCase() ?? 'USD',
    travelerDetailsDueAt: order.traveler_details_due_at,
    orderUrl,
    policySummary,
  });

  const intendedTo = order.lead_email;
  const overrideTo = process.env.BOOKING_EMAIL_OVERRIDE_TO?.trim();
  const toEmail = overrideTo || intendedTo;

  if (emailMode === 'console') {
    console.info('--- Booking confirmation email ---');
    console.info('To:', toEmail);
    if (overrideTo && overrideTo.toLowerCase() !== intendedTo.toLowerCase()) {
      console.info('Intended to:', intendedTo);
    }
    console.info('Subject:', subject);
    console.info(text);
    console.info('---');
    return 'sent';
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.error('RESEND_API_KEY is not configured.');
    return 'failed';
  }

  try {
    if (overrideTo && overrideTo.toLowerCase() !== intendedTo.toLowerCase()) {
      console.info(
        `[BOOKING_EMAIL_OVERRIDE_TO] Sending confirmation for ${order.order_number} to ${toEmail} (lead was ${intendedTo}).`,
      );
    }

    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${resendApiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject,
        html,
        text,
      }),
    });

    if (!response.ok) {
      const result = (await response.json().catch(() => ({}))) as { message?: string };
      console.error('Resend confirmation email failed:', result.message || response.statusText);
      return 'failed';
    }

    return 'sent';
  } catch (error) {
    console.error('Resend confirmation email error:', error);
    return 'failed';
  }
}

function buildOrderUrl(orderNumber: string, token: string): string {
  const base = process.env.PUBLIC_APP_URL || 'https://syncingtravel.com';
  return `${base}/#/orders/${encodeURIComponent(orderNumber)}?token=${encodeURIComponent(token)}`;
}

function formatTripDate(value: string): string {
  if (!value.trim()) return '';

  const normalized = formatDate(value.trim());
  const dateOnly = /^(\d{4}-\d{2}-\d{2})$/.exec(normalized);
  const date = dateOnly ? new Date(`${dateOnly[1]}T00:00:00Z`) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function formatPolicySnapshot(policy: unknown): string {
  if (!policy) return 'See your order page for cancellation terms.';

  if (typeof policy === 'string' && policy.trim()) {
    return policy.trim();
  }

  if (Array.isArray(policy)) {
    const lines = policy
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
    return lines.length > 0 ? lines.join('\n') : 'See your order page for cancellation terms.';
  }

  if (typeof policy !== 'object') {
    return 'See your order page for cancellation terms.';
  }

  const record = policy as Record<string, unknown>;
  const lines: string[] = [];

  const fullDays = record.full_refund_until_days_before;
  if (typeof fullDays === 'number' || (typeof fullDays === 'string' && String(fullDays).trim())) {
    lines.push(`Full refund if cancelled at least ${fullDays} days before departure.`);
  }

  const partialDays = record.partial_refund_until_days_before;
  if (
    typeof partialDays === 'number' ||
    (typeof partialDays === 'string' && String(partialDays).trim())
  ) {
    lines.push(`Partial refund if cancelled at least ${partialDays} days before departure.`);
  }

  if (typeof record.full_refund_until === 'string' && record.full_refund_until.trim()) {
    lines.push(`Full refund until ${record.full_refund_until.trim()}.`);
  }
  if (typeof record.partial_refund_until === 'string' && record.partial_refund_until.trim()) {
    lines.push(`Partial refund until ${record.partial_refund_until.trim()}.`);
  }
  if (typeof record.non_refundable_after === 'string' && record.non_refundable_after.trim()) {
    lines.push(`Non-refundable after ${record.non_refundable_after.trim()}.`);
  }
  if (typeof record.summary === 'string' && record.summary.trim()) {
    lines.push(record.summary.trim());
  }
  if (typeof record.text === 'string' && record.text.trim()) {
    lines.push(record.text.trim());
  }

  return lines.length > 0 ? lines.join('\n') : 'See your order page for cancellation terms.';
}

type ConfirmationContent = {
  orderNumber: string;
  routeTitle: string;
  departureCity: string;
  startDate: string;
  endDate: string;
  adultQuantity: number;
  unitPriceDollars: string;
  totalPriceDollars: string;
  currency: string;
  travelerDetailsDueAt: string | null;
  orderUrl: string;
  policySummary: string;
};

function formatDueDate(value: string | Date | null | undefined): string {
  if (!value) return 'soon';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return 'soon';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function buildConfirmationHtml(content: ConfirmationContent): string {
  const detailsDue = formatDueDate(content.travelerDetailsDueAt);

  return `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h1 style="font-size: 20px; margin-bottom: 8px;">Your booking is confirmed</h1>
  <p style="color: #6b7280; margin-top: 0;">Order <strong>${content.orderNumber}</strong> · Paid and confirmed</p>

  <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />

  <h2 style="font-size: 16px;">Trip details</h2>
  <ul style="padding-left: 18px;">
    <li><strong>Route:</strong> ${escapeHtml(content.routeTitle)}</li>
    <li><strong>Dates:</strong> ${escapeHtml(content.startDate)} to ${escapeHtml(content.endDate)}</li>
    <li><strong>Departure city:</strong> ${escapeHtml(content.departureCity)}</li>
    <li><strong>Adults:</strong> ${content.adultQuantity}</li>
    <li><strong>Price per adult:</strong> ${content.unitPriceDollars} ${content.currency}</li>
    <li><strong>Total paid:</strong> ${content.totalPriceDollars} ${content.currency}</li>
  </ul>

  <p>Please submit traveler details by <strong>${detailsDue}</strong>.</p>

  <p><a href="${content.orderUrl}" style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 6px;">View your order</a></p>

  <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />

  <h2 style="font-size: 16px;">Cancellation policy</h2>
  <pre style="white-space: pre-wrap; font-family: inherit; margin: 0;">${escapeHtml(content.policySummary)}</pre>

  <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />

  <p style="color: #6b7280; font-size: 14px; margin-bottom: 12px;">Questions about your trip?</p>
  <p style="margin: 0 0 12px;">
    <a
      href="${BOOKING_SUPPORT_WHATSAPP_URL}"
      target="_blank"
      rel="noopener noreferrer"
      style="display: inline-block; background: #25D366; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 6px; font-weight: 600;"
    >Message our team on WhatsApp</a>
  </p>
  <p style="color: #6b7280; font-size: 13px; margin: 0;">Or reply to this email. WhatsApp: ${BOOKING_SUPPORT_WHATSAPP_URL}</p>
</body>
</html>
  `.trim();
}

function buildConfirmationText(content: ConfirmationContent): string {
  const detailsDue = formatDueDate(content.travelerDetailsDueAt);

  return `
Your booking is confirmed
Order ${content.orderNumber} · Paid and confirmed

Trip details
- Route: ${content.routeTitle}
- Dates: ${content.startDate} to ${content.endDate}
- Departure city: ${content.departureCity}
- Adults: ${content.adultQuantity}
- Price per adult: ${content.unitPriceDollars} ${content.currency}
- Total paid: ${content.totalPriceDollars} ${content.currency}

Please submit traveler details by ${detailsDue}.

View your order: ${content.orderUrl}

Cancellation policy
${content.policySummary}

Questions about your trip?
Message our team on WhatsApp: ${BOOKING_SUPPORT_WHATSAPP_URL}
Or reply to this email.
  `.trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
