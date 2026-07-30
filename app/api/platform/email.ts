import { formatDate } from './dateFormat';

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

/** Minimal order fields required by booking confirmation email builders. */
export type BookingConfirmationOrder = {
  id: string;
  order_number: string;
  lead_email: string;
  adult_quantity: number;
  adult_unit_price_cents: number;
  total_price_cents: number;
  currency: string;
  confirmation_email_status?: string | null;
  traveler_details_due_at?: string | null;
  route_snapshot?: unknown;
  price_snapshot?: unknown;
  policy_snapshot?: unknown;
};

export type BookingEmailDeliveryResult = 'sent' | 'traveler_sent' | 'failed';
export type BookingEmailPurpose = 'payment-confirmation' | 'admin-resend';

export type BookingEmailMessage = {
  from: string;
  to: string[];
  replyTo?: string[];
  subject: string;
  html?: string;
  text?: string;
  idempotencyKey?: string;
};

type BookingEmailDeliveryOptions = {
  purpose: BookingEmailPurpose;
  fromEmail: string;
  operationsEmails: string[];
  publicAppUrl: string;
  orderUrl?: string;
  travelerOverrideTo?: string;
  send: (message: BookingEmailMessage) => Promise<boolean>;
  onTravelerSent?: () => Promise<void>;
};

type SendBookingEmailOptions = {
  purpose?: BookingEmailPurpose;
  orderUrl?: string;
  onTravelerSent?: () => Promise<void>;
};

export async function sendBookingConfirmationEmail(
  order: BookingConfirmationOrder,
  options: SendBookingEmailOptions = {},
): Promise<BookingEmailDeliveryResult> {
  const fromEmail = process.env.BOOKING_FROM_EMAIL || process.env.INQUIRY_FROM_EMAIL;
  const emailMode = process.env.BOOKING_EMAIL_MODE || process.env.INQUIRY_EMAIL_MODE || 'resend';
  const purpose = options.purpose ?? 'payment-confirmation';
  const operationsEmails = resolveOperationsEmails(process.env);

  if (!fromEmail) {
    console.error('BOOKING_FROM_EMAIL or INQUIRY_FROM_EMAIL is not configured.');
    return 'failed';
  }
  if (operationsEmails.length === 0) {
    console.error('BOOKING_OPERATIONS_EMAIL or INQUIRY_TO_EMAIL is not configured.');
    return 'failed';
  }

  if (emailMode === 'off') {
    console.error('BOOKING_EMAIL_MODE is off.');
    return 'failed';
  }

  const isConsoleMode = emailMode === 'console' || emailMode === 'log';
  const apiKey = process.env.RESEND_API_KEY;
  if (!isConsoleMode && !apiKey) {
    console.error('RESEND_API_KEY is not configured.');
    return 'failed';
  }

  const publicAppUrl = process.env.PUBLIC_APP_URL || 'https://www.xuntingtravel.com';

  if (isConsoleMode) {
    return deliverBookingConfirmationEmails(order, {
      purpose,
      fromEmail,
      operationsEmails,
      publicAppUrl,
      orderUrl: options.orderUrl,
      travelerOverrideTo: process.env.BOOKING_EMAIL_OVERRIDE_TO?.trim(),
      onTravelerSent: options.onTravelerSent,
      send: async (message) => {
        console.info('--- Booking email preview ---');
        console.info('To:', message.to.join(', '));
        if (message.replyTo?.length) console.info('Reply-To:', message.replyTo.join(', '));
        console.info('Subject:', message.subject);
        console.info(message.text || message.html || '');
        console.info('---');
        return true;
      },
    });
  }

  return deliverBookingConfirmationEmails(order, {
    purpose,
    fromEmail,
    operationsEmails,
    publicAppUrl,
    orderUrl: options.orderUrl,
    travelerOverrideTo: process.env.BOOKING_EMAIL_OVERRIDE_TO?.trim(),
    onTravelerSent: options.onTravelerSent,
    send: (message) => sendResendEmail(apiKey!, message),
  });
}

export async function deliverBookingConfirmationEmails(
  order: BookingConfirmationOrder,
  options: BookingEmailDeliveryOptions,
): Promise<BookingEmailDeliveryResult> {
  const intendedTo = order.lead_email;
  const travelerTo = options.travelerOverrideTo || intendedTo;
  const travelerAlreadySent =
    options.purpose === 'payment-confirmation' &&
    order.confirmation_email_status === 'confirmation_email_traveler_sent';

  if (!travelerAlreadySent) {
    const content = buildConfirmationContent(order, resolveOrderUrl(order, options));
    const travelerSent = await options.send({
      from: options.fromEmail,
      to: [travelerTo],
      replyTo: options.operationsEmails,
      subject: `Your Syncing Travel booking is confirmed · ${order.order_number}`,
      html: buildConfirmationHtml(content),
      text: buildConfirmationText(content),
    });
    if (!travelerSent) return 'failed';
    await options.onTravelerSent?.();
  }

  if (options.purpose === 'admin-resend') {
    return 'sent';
  }

  const operationsSent = await options.send({
    from: options.fromEmail,
    to: options.operationsEmails,
    subject: `[Syncing Travel] Paid booking · ${order.order_number}`,
    text: buildOperationsCopyText(order),
    html: buildOperationsCopyHtml(order),
    idempotencyKey: `booking-confirmation/${order.id}/operations`,
  });

  return operationsSent ? 'sent' : 'traveler_sent';
}

function resolveOrderUrl(order: BookingConfirmationOrder, options: BookingEmailDeliveryOptions): string {
  if (options.orderUrl) return options.orderUrl;
  return `${options.publicAppUrl.replace(/\/$/, '')}/orders/${encodeURIComponent(order.order_number)}`;
}

function buildConfirmationContent(order: BookingConfirmationOrder, orderUrl: string): ConfirmationContent {
  const routeSnapshot = (order.route_snapshot as RouteSnapshot) ?? {};
  const priceSnapshot = (order.price_snapshot as PriceSnapshot) ?? {};
  return {
    orderNumber: order.order_number,
    routeTitle: routeSnapshot.route_title ?? 'Your trip',
    departureCity: routeSnapshot.departure_city ?? '',
    startDate: formatTripDate(routeSnapshot.start_date ?? ''),
    endDate: formatTripDate(routeSnapshot.end_date ?? ''),
    adultQuantity: priceSnapshot.adult_quantity ?? order.adult_quantity,
    unitPriceDollars: ((priceSnapshot.adult_unit_price_cents ?? order.adult_unit_price_cents) / 100).toFixed(2),
    totalPriceDollars: ((priceSnapshot.total_price_cents ?? order.total_price_cents) / 100).toFixed(2),
    currency: priceSnapshot.currency?.toUpperCase() ?? order.currency.toUpperCase(),
    travelerDetailsDueAt: order.traveler_details_due_at ?? null,
    orderUrl,
    policySummary: formatPolicySnapshot(order.policy_snapshot),
  };
}

function buildOperationsCopyText(order: BookingConfirmationOrder): string {
  const routeSnapshot = (order.route_snapshot as RouteSnapshot) ?? {};
  return [
    'A paid booking has been confirmed.',
    `Order: ${order.order_number}`,
    `Traveler email: ${order.lead_email}`,
    `Amount: ${(order.total_price_cents / 100).toFixed(2)} ${order.currency.toUpperCase()}`,
    `Route: ${routeSnapshot.route_title ?? 'Not provided'}`,
  ].join('\n');
}

function buildOperationsCopyHtml(order: BookingConfirmationOrder): string {
  return `<pre style="font-family: system-ui, sans-serif; white-space: pre-wrap;">${escapeHtml(buildOperationsCopyText(order))}</pre>`;
}

function resolveOperationsEmails(env: NodeJS.ProcessEnv): string[] {
  const configured = env.BOOKING_OPERATIONS_EMAIL?.trim() || env.INQUIRY_TO_EMAIL?.trim() || '';
  return configured
    .split(',')
    .map((value) => value.trim())
    .filter((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

export function buildResendPayload(message: BookingEmailMessage) {
  return {
    from: message.from,
    to: message.to,
    ...(message.replyTo?.length ? { reply_to: message.replyTo } : {}),
    subject: message.subject,
    ...(message.html !== undefined ? { html: message.html } : {}),
    ...(message.text !== undefined ? { text: message.text } : {}),
  };
}

async function sendResendEmail(apiKey: string, message: BookingEmailMessage): Promise<boolean> {
  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        ...(message.idempotencyKey ? { 'idempotency-key': message.idempotencyKey } : {}),
      },
      body: JSON.stringify(buildResendPayload(message)),
    });
    if (!response.ok) {
      const result = (await response.json().catch(() => ({}))) as { message?: string };
      console.error('Resend booking email failed:', result.message || response.statusText);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Resend booking email error:', error);
    return false;
  }
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
