import { ensureBookingTables } from '../bookingSchema';
import { resolveClientIp } from '../integrity/bookingIntegrity';
import { assertCheckoutRateLimits } from '../checkout/checkoutRateLimit';
import { getStripe, isDevCheckoutBypassEnabled, isStripeConfigured } from '../payment/stripe';
import {
  createPayoneerCheckoutSession,
  isPayoneerCheckoutMockEnabled,
  isPayoneerCheckoutReady,
  isPayoneerConfigured,
} from '../payment/payoneer';
import { getPaymentProvider, paymentProviderDisplayName } from '../payment/paymentProvider';
import {
  attachPayoneerSessionToOrder,
  attachStripeSessionToOrder,
  buildOrderAccessUrl,
  createPendingOrderAndHold,
  findDepartureByPublicId,
} from '../orders/orders';
import {
  confirmOrderAndConsumeHold,
  confirmPayoneerOrderAndConsumeHold,
  expireExpiredHolds,
  failOrderAndReleaseHold,
  findOrderByOrderNumber,
  updateConfirmationEmailStatus,
} from '../orders/orderQueries';
import { sendBookingConfirmationEmail } from '../../../platform/email';
import { getUserFromRequest } from '../../identity/traveler/userAuth';
import { normalizeCheckoutPayload, validateCheckoutPayload } from '../checkout/checkoutPayload';

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
  const provider = getPaymentProvider();
  const providerLabel = paymentProviderDisplayName(provider);

  try {
    const checkoutReady =
      provider === 'stripe'
        ? isStripeConfigured() || isDevCheckoutBypassEnabled()
        : isPayoneerCheckoutReady();

    if (!checkoutReady) {
      res.status(500).json({ ok: false, error: 'Checkout is not configured.' });
      return;
    }

    const checkoutBypass =
      provider === 'stripe'
        ? !isStripeConfigured() && isDevCheckoutBypassEnabled()
        : !isPayoneerConfigured() &&
          !isPayoneerCheckoutMockEnabled() &&
          isDevCheckoutBypassEnabled();

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
      if (provider === 'payoneer') {
        const listId = `po_dev_bypass_${order.id}`;
        const transactionId = `po_tx_dev_bypass_${order.id}`;
        await attachPayoneerSessionToOrder(order.id, hold.id, listId, transactionId);
        await confirmPayoneerOrderAndConsumeHold(order.id, transactionId, `po_ch_dev_bypass_${order.id}`);
        await sendBypassConfirmation(order.id, order.orderNumber);

        console.warn(
          `[DEV_CHECKOUT_BYPASS] Confirmed order ${order.orderNumber} without Payoneer. Do not use in production.`,
        );

        res.status(200).json({
          ok: true,
          checkoutUrl: `${origin}/china-trips?checkout=success&order=${encodeURIComponent(order.orderNumber)}&session_id=${encodeURIComponent(listId)}`,
          sessionId: listId,
          orderNumber: order.orderNumber,
          expiresAt: holdExpiresAt.toISOString(),
          provider: 'payoneer',
        });
        return;
      }

      const sessionId = `cs_dev_bypass_${order.id}`;
      await attachStripeSessionToOrder(order.id, hold.id, sessionId);
      await confirmOrderAndConsumeHold(order.id, `pi_dev_bypass_${order.id}`, `ch_dev_bypass_${order.id}`);
      await sendBypassConfirmation(order.id, order.orderNumber);

      console.warn(
        `[DEV_CHECKOUT_BYPASS] Confirmed order ${order.orderNumber} without Stripe. Do not use in production.`,
      );

      res.status(200).json({
        ok: true,
        checkoutUrl: `${origin}/china-trips?checkout=success&order=${encodeURIComponent(order.orderNumber)}&session_id=${encodeURIComponent(sessionId)}`,
        sessionId,
        orderNumber: order.orderNumber,
        expiresAt: holdExpiresAt.toISOString(),
        provider: 'stripe',
      });
      return;
    }

    if (provider === 'payoneer') {
      const successUrl =
        process.env.PAYONEER_CHECKOUT_SUCCESS_URL ||
        process.env.STRIPE_CHECKOUT_SUCCESS_URL ||
        `${origin}/china-trips?checkout=success&order=${encodeURIComponent(order.orderNumber)}&session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl =
        process.env.PAYONEER_CHECKOUT_CANCEL_URL ||
        process.env.STRIPE_CHECKOUT_CANCEL_URL ||
        `${origin}/china-trips?checkout=cancelled&order=${order.orderNumber}`;
      const notificationUrl =
        process.env.PAYONEER_NOTIFICATION_URL || `${origin}/api/payoneer-webhook`;

      let session;
      try {
        session = await createPayoneerCheckoutSession({
          orderNumber: order.orderNumber,
          amountCents: order.totalPriceCents,
          currency: departure.currency || 'usd',
          customerEmail: payload.email!,
          customerName: leadName,
          productName: `Syncing Travel · ${departure.route_title}`,
          productDescription: `${departure.departure_city} · ${departure.start_date} to ${departure.end_date}`,
          successUrl,
          cancelUrl,
          notificationUrl,
          holdExpiresAt,
        });
      } catch (payoneerError) {
        await failOrderAndReleaseHold(order.id);
        createdOrderId = undefined;
        throw payoneerError;
      }

      // Local mock without real credentials: auto-confirm like bypass so travelers can finish flows.
      if (session.mock && isPayoneerCheckoutMockEnabled() && !isPayoneerConfigured()) {
        await attachPayoneerSessionToOrder(order.id, hold.id, session.listId, session.transactionId);
        await confirmPayoneerOrderAndConsumeHold(
          order.id,
          session.transactionId,
          `po_ch_mock_${order.id}`,
        );
        await sendBypassConfirmation(order.id, order.orderNumber);
        console.warn(
          `[PAYONEER_CHECKOUT_MOCK] Confirmed order ${order.orderNumber} without live Payoneer. Do not use in production.`,
        );
        res.status(200).json({
          ok: true,
          checkoutUrl: `${origin}/china-trips?checkout=success&order=${encodeURIComponent(order.orderNumber)}&session_id=${encodeURIComponent(session.listId)}`,
          sessionId: session.listId,
          orderNumber: order.orderNumber,
          expiresAt: holdExpiresAt.toISOString(),
          provider: 'payoneer',
        });
        return;
      }

      try {
        await attachPayoneerSessionToOrder(order.id, hold.id, session.listId, session.transactionId);
      } catch (attachError) {
        await failOrderAndReleaseHold(order.id);
        createdOrderId = undefined;
        throw attachError;
      }

      res.status(200).json({
        ok: true,
        checkoutUrl: session.checkoutUrl,
        sessionId: session.listId,
        orderNumber: order.orderNumber,
        expiresAt: holdExpiresAt.toISOString(),
        provider: 'payoneer',
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
      provider: 'stripe',
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

    res.status(500).json({
      ok: false,
      error: `We could not open ${providerLabel} Checkout. Please try again.`,
    });
  }
}

async function sendBypassConfirmation(orderId: string, orderNumber: string): Promise<void> {
  const confirmed = await findOrderByOrderNumber(orderNumber);
  if (!confirmed) return;

  const orderUrl =
    confirmed.confirmation_email_status !== 'confirmation_email_traveler_sent'
      ? await buildOrderAccessUrl(confirmed)
      : undefined;
  const emailStatus = await sendBookingConfirmationEmail(confirmed, {
    purpose: 'payment-confirmation',
    orderUrl,
    onTravelerSent: () => updateConfirmationEmailStatus(orderId, 'confirmation_email_traveler_sent'),
  });
  await updateConfirmationEmailStatus(
    orderId,
    emailStatus === 'sent'
      ? 'confirmation_email_sent'
      : emailStatus === 'traveler_sent'
        ? 'confirmation_email_traveler_sent'
        : 'confirmation_email_failed',
  );
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
