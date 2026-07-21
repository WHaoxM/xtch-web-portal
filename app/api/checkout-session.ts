import { ensureBookingTables } from './lib/bookingSchema';
import { resolveClientIp } from './lib/bookingIntegrity';
import { assertCheckoutRateLimits } from './lib/checkoutRateLimit';
import { getStripe, isDevCheckoutBypassEnabled, isStripeConfigured } from './lib/stripe';
import {
  attachStripeSessionToOrder,
  createPendingOrderAndHold,
  findDepartureByPublicId,
} from './lib/orders';
import {
  confirmOrderAndConsumeHold,
  expireExpiredHolds,
  failOrderAndReleaseHold,
  findOrderByOrderNumber,
  updateConfirmationEmailStatus,
} from './lib/orderQueries';
import { sendBookingConfirmationEmail } from './lib/email';
import { getUserFromRequest } from './lib/userAuth';
import { normalizeCheckoutPayload, validateCheckoutPayload } from './lib/checkoutPayload';

type VercelRequestLike = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  socket?: { remoteAddress?: string | null };
};

type VercelResponseLike = {
  status: (code: number) => VercelResponseLike;
  json: (body: unknown) => void;
};

const CHECKOUT_SESSION_TTL_MINUTES = 30;

export default async function handler(req: VercelRequestLike, res: VercelResponseLike) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }

  let createdOrderId: string | undefined;

  try {
    const stripeConfigured = isStripeConfigured();
    const checkoutBypass = !stripeConfigured && isDevCheckoutBypassEnabled();

    if (!stripeConfigured && !checkoutBypass) {
      res.status(500).json({ ok: false, error: 'Checkout is not configured.' });
      return;
    }

    const payload = normalizeCheckoutPayload(req.body);
    const validationError = validateCheckoutPayload(payload);
    if (validationError) {
      res.status(400).json({ ok: false, error: validationError });
      return;
    }

    await ensureBookingTables();

    const clientIp = resolveClientIp({
      headers: req.headers,
      socketRemoteAddress: req.socket?.remoteAddress,
    });

    const rateLimit = await assertCheckoutRateLimits({
      ip: clientIp,
      email: payload.email!,
      departurePublicId: payload.departureId!,
    });
    if (!rateLimit.ok) {
      res.status(429).json({ ok: false, error: rateLimit.error });
      return;
    }

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

    await expireExpiredHolds(departure.id);

    const holdExpiresAt = new Date(Date.now() + CHECKOUT_SESSION_TTL_MINUTES * 60 * 1000);

    const travelers = payload.travelers!.map((traveler) => ({
      name: traveler.name,
      gender: traveler.gender as 'male' | 'female',
    }));
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
    createdOrderId = order.id;

    const origin = getOrigin(req);

    if (checkoutBypass) {
      const sessionId = `cs_dev_bypass_${order.id}`;
      await attachStripeSessionToOrder(order.id, hold.id, sessionId);
      await confirmOrderAndConsumeHold(order.id, `pi_dev_bypass_${order.id}`, `ch_dev_bypass_${order.id}`);

      const confirmed = await findOrderByOrderNumber(order.orderNumber);
      if (confirmed) {
        const emailStatus = await sendBookingConfirmationEmail(confirmed, {
          purpose: 'payment-confirmation',
          onTravelerSent: () =>
            updateConfirmationEmailStatus(order.id, 'confirmation_email_traveler_sent'),
        });
        await updateConfirmationEmailStatus(
          order.id,
          emailStatus === 'sent'
            ? 'confirmation_email_sent'
            : emailStatus === 'traveler_sent'
              ? 'confirmation_email_traveler_sent'
              : 'confirmation_email_failed',
        );
      }

      console.warn(
        `[DEV_CHECKOUT_BYPASS] Confirmed order ${order.orderNumber} without Stripe. Do not use in production.`,
      );

      res.status(200).json({
        ok: true,
        checkoutUrl: `${origin}/china-trips?checkout=success&order=${encodeURIComponent(order.orderNumber)}&session_id=${encodeURIComponent(sessionId)}`,
        sessionId,
        orderNumber: order.orderNumber,
        expiresAt: holdExpiresAt.toISOString(),
      });
      return;
    }

    const stripe = getStripe();

    const successUrl =
      process.env.STRIPE_CHECKOUT_SUCCESS_URL ||
      `${origin}/china-trips?checkout=success&order=${encodeURIComponent(order.orderNumber)}&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl =
      process.env.STRIPE_CHECKOUT_CANCEL_URL ||
      `${origin}/china-trips?checkout=cancelled&order=${order.orderNumber}`;

    let session;
    try {
      session = await stripe.checkout.sessions.create({
        mode: 'payment',
        // V1 B1: instant card only — no async payment methods.
        payment_method_types: ['card'],
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
    } catch (stripeError) {
      await failOrderAndReleaseHold(order.id);
      createdOrderId = undefined;
      throw stripeError;
    }

    if (!session.id || !session.url) {
      await failOrderAndReleaseHold(order.id);
      createdOrderId = undefined;
      throw new Error('Stripe did not return a checkout session.');
    }

    try {
      await attachStripeSessionToOrder(order.id, hold.id, session.id);
    } catch (attachError) {
      await failOrderAndReleaseHold(order.id);
      createdOrderId = undefined;
      throw attachError;
    }

    res.status(200).json({
      ok: true,
      checkoutUrl: session.url,
      sessionId: session.id,
      orderNumber: order.orderNumber,
      expiresAt: holdExpiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Checkout session creation failed:', error);

    if (createdOrderId) {
      try {
        await failOrderAndReleaseHold(createdOrderId);
      } catch (cleanupError) {
        console.error('Failed to release hold after checkout error:', cleanupError);
      }
    }

    if (error instanceof Error) {
      if (
        error.message.includes('no longer available') ||
        error.message.includes('Not enough seats') ||
        error.message.includes('already have an open checkout')
      ) {
        res.status(409).json({ ok: false, error: error.message });
        return;
      }
    }

    res.status(500).json({ ok: false, error: 'We could not open Stripe Checkout. Please try again.' });
  }
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
