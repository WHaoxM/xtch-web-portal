import { ensureBookingTables } from './lib/bookingSchema';
import { getStripe, isDevCheckoutBypassEnabled, isStripeConfigured } from './lib/stripe';
import {
  attachStripeSessionToOrder,
  createPendingOrderAndHold,
  findDepartureByPublicId,
} from './lib/orders';
import {
  confirmOrderAndConsumeHold,
  findOrderByOrderNumber,
  updateConfirmationEmailStatus,
} from './lib/orderQueries';
import { sendBookingConfirmationEmail } from './lib/email';
import { getUserFromRequest } from './lib/userAuth';

type VercelRequestLike = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type VercelResponseLike = {
  status: (code: number) => VercelResponseLike;
  json: (body: unknown) => void;
};

type CheckoutTraveler = {
  name: string;
};

type CheckoutPayload = {
  departureId?: string;
  adultQuantity?: number;
  name?: string;
  email?: string;
  phone?: string;
  notes?: string;
  travelers?: CheckoutTraveler[];
  accessToken?: string;
};

const CHECKOUT_SESSION_TTL_MINUTES = 30;
const MAX_NOTES_LENGTH = 2000;
const MAX_PHONE_LENGTH = 50;
const MAX_NAME_LENGTH = 200;
const MAX_ADULT_QUANTITY = 20;

export default async function handler(req: VercelRequestLike, res: VercelResponseLike) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }

  try {
    const stripeConfigured = isStripeConfigured();
    const checkoutBypass = !stripeConfigured && isDevCheckoutBypassEnabled();

    if (!stripeConfigured && !checkoutBypass) {
      res.status(500).json({ ok: false, error: 'Checkout is not configured.' });
      return;
    }

    const payload = normalizePayload(req.body);
    const validationError = validatePayload(payload);
    if (validationError) {
      res.status(400).json({ ok: false, error: validationError });
      return;
    }

    await ensureBookingTables();

    let userId: string | undefined;
    if (payload.accessToken) {
      const userResult = await getUserFromRequest({
        headers: { authorization: `Bearer ${payload.accessToken}` },
      });
      if (userResult.ok) {
        userId = userResult.user.id;
      }
    }

    const departure = await findDepartureByPublicId(payload.departureId!);
    if (!departure) {
      res.status(400).json({ ok: false, error: 'Please choose an available departure.' });
      return;
    }

    if (departure.status !== 'sellable') {
      res.status(400).json({ ok: false, error: 'This departure is no longer available for booking.' });
      return;
    }

    const holdExpiresAt = new Date(Date.now() + CHECKOUT_SESSION_TTL_MINUTES * 60 * 1000);

    const travelers = payload.travelers!;
    const leadName = travelers[0]?.name || payload.name!;

    const { order, hold } = await createPendingOrderAndHold({
      departure,
      adultQuantity: payload.adultQuantity!,
      leadName,
      leadEmail: payload.email!,
      leadPhone: payload.phone || '',
      travelers,
      notes: payload.notes,
      holdExpiresAt,
      userId,
    });

    const origin = getOrigin(req);

    if (checkoutBypass) {
      const sessionId = `cs_dev_bypass_${order.id}`;
      await attachStripeSessionToOrder(order.id, hold.id, sessionId);
      await confirmOrderAndConsumeHold(order.id, `pi_dev_bypass_${order.id}`, `ch_dev_bypass_${order.id}`);

      const confirmed = await findOrderByOrderNumber(order.orderNumber);
      if (confirmed) {
        const emailStatus = await sendBookingConfirmationEmail(confirmed);
        await updateConfirmationEmailStatus(
          order.id,
          emailStatus === 'sent' ? 'confirmation_email_sent' : 'confirmation_email_failed',
        );
      }

      console.warn(
        `[DEV_CHECKOUT_BYPASS] Confirmed order ${order.orderNumber} without Stripe. Do not use in production.`,
      );

      res.status(200).json({
        ok: true,
        checkoutUrl: `${origin}/#/china-trips?checkout=success&order=${encodeURIComponent(order.orderNumber)}&session_id=${encodeURIComponent(sessionId)}`,
        sessionId,
        orderNumber: order.orderNumber,
        expiresAt: holdExpiresAt.toISOString(),
      });
      return;
    }

    const stripe = getStripe();

    const successUrl =
      process.env.STRIPE_CHECKOUT_SUCCESS_URL ||
      `${origin}/#/china-trips?checkout=success&order=${encodeURIComponent(order.orderNumber)}&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl =
      process.env.STRIPE_CHECKOUT_CANCEL_URL ||
      `${origin}/#/china-trips?checkout=cancelled&order=${order.orderNumber}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: order.adultQuantity,
          price_data: {
            currency: 'usd',
            unit_amount: departure.adult_unit_price_cents,
            product_data: {
              name: `Syncing Travel · ${departure.route_title}`,
              description: `${departure.departure_city} · ${departure.start_date} to ${departure.end_date}`,
            },
          },
        },
      ],
      customer_email: payload.email!,
      client_reference_id: order.orderNumber,
      metadata: {
        type: 'fixed_departure_booking',
        order_number: order.orderNumber,
        departure_id: departure.id,
        departure_public_id: departure.public_id,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      expires_at: Math.floor(holdExpiresAt.getTime() / 1000),
      locale: 'en',
    });

    if (!session.id || !session.url) {
      throw new Error('Stripe did not return a checkout session.');
    }

    await attachStripeSessionToOrder(order.id, hold.id, session.id);

    res.status(200).json({
      ok: true,
      checkoutUrl: session.url,
      sessionId: session.id,
      orderNumber: order.orderNumber,
      expiresAt: holdExpiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Checkout session creation failed:', error);

    if (error instanceof Error) {
      if (
        error.message.includes('no longer available') ||
        error.message.includes('Not enough seats')
      ) {
        res.status(409).json({ ok: false, error: error.message });
        return;
      }
    }

    res.status(500).json({ ok: false, error: 'We could not open Stripe Checkout. Please try again.' });
  }
}

function normalizePayload(body: unknown): CheckoutPayload {
  if (!body || typeof body !== 'object') return {};
  const raw = body as Record<string, unknown>;
  const travelers = normalizeTravelers(raw.travelers);
  const name = stringValue(raw.name) || travelers[0]?.name || '';

  return {
    departureId: stringValue(raw.departureId),
    adultQuantity: numberValue(raw.adultQuantity),
    name,
    email: stringValue(raw.email).toLowerCase(),
    phone: stringValue(raw.phone),
    notes: stringValue(raw.notes),
    travelers,
    accessToken: stringValue(raw.accessToken),
  };
}

function validatePayload(payload: CheckoutPayload): string {
  if (!payload.departureId) return 'Please choose an available departure.';
  if (!isSafePublicId(payload.departureId)) return 'Invalid departure selection.';

  if (
    typeof payload.adultQuantity !== 'number' ||
    !Number.isFinite(payload.adultQuantity) ||
    payload.adultQuantity < 1 ||
    payload.adultQuantity > MAX_ADULT_QUANTITY ||
    !Number.isInteger(payload.adultQuantity)
  ) {
    return `Please choose 1 to ${MAX_ADULT_QUANTITY} adult travelers.`;
  }

  const travelers = payload.travelers ?? [];
  if (travelers.length !== payload.adultQuantity) {
    return 'Traveler names must match the number of adults.';
  }

  for (let index = 0; index < travelers.length; index++) {
    const travelerName = travelers[index]?.name ?? '';
    if (!travelerName) {
      return `Please enter traveler ${index + 1}'s full name.`;
    }
    if (travelerName.length > MAX_NAME_LENGTH) {
      return `Traveler ${index + 1}'s name is too long.`;
    }
  }

  if (!payload.name || payload.name.length > MAX_NAME_LENGTH) {
    return 'Please enter the lead traveler name.';
  }

  if (!isValidEmail(payload.email)) {
    return 'Please enter a valid email address.';
  }

  if (payload.phone) {
    if (payload.phone.length > MAX_PHONE_LENGTH) {
      return 'Please enter a shorter phone number.';
    }
    if (!/^\+[1-9]\d{6,14}$/.test(payload.phone)) {
      return 'Please enter a valid international phone number, or leave it blank.';
    }
  }

  if (payload.notes && payload.notes.length > MAX_NOTES_LENGTH) {
    return 'Please keep notes under 2000 characters.';
  }

  return '';
}

function normalizeTravelers(value: unknown): CheckoutTraveler[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (!item || typeof item !== 'object') return { name: '' };
    const record = item as Record<string, unknown>;
    return { name: stringValue(record.name) };
  });
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function isValidEmail(value: string | undefined): boolean {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

function isSafePublicId(value: string | undefined): boolean {
  return Boolean(value && /^[a-z0-9_-]+$/i.test(value));
}

function getOrigin(req: VercelRequestLike): string {
  const origin = headerValue(req.headers.origin);
  if (origin) return origin;

  const proto = headerValue(req.headers['x-forwarded-proto']) || 'https';
  const host = headerValue(req.headers['x-forwarded-host']) || headerValue(req.headers.host);

  return host ? `${proto}://${host}` : 'http://localhost:3000';
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
