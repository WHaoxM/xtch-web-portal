import Stripe from 'stripe';
import { sql } from './lib/db';
import { ensureBookingTables } from './lib/bookingSchema';
import { getStripe } from './lib/stripe';
import {
  canAutoReleaseSeats,
  confirmOrderAndConsumeHold,
  expireOrderAndReleaseHold,
  findOrderByStripeChargeId,
  findOrderByStripePaymentIntentId,
  findOrderByStripeSessionId,
  updateConfirmationEmailStatus,
  updateOrderRefundState,
} from './lib/orderQueries';
import { isWebhookEventProcessed, recordWebhookEvent } from './lib/webhookEvents';
import { sendBookingConfirmationEmail } from './lib/email';

type VercelRequestLike = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: Buffer | string;
};

type VercelResponseLike = {
  status: (code: number) => VercelResponseLike;
  json: (body: unknown) => void;
  send: (body: string) => void;
};

export default async function handler(req: VercelRequestLike, res: VercelResponseLike) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }

  const rawBody = getRawBody(req);
  const signature = headerValue(req.headers['stripe-signature']);
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not configured.');
    res.status(500).send('Webhook secret not configured.');
    return;
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(rawBody, signature || '', webhookSecret);
  } catch (error) {
    console.error('Stripe webhook signature verification failed:', error);
    res.status(400).send('Invalid signature.');
    return;
  }

  try {
    await ensureBookingTables();

    if (await isWebhookEventProcessed(event.id)) {
      res.status(200).json({ ok: true, received: true, processed: false });
      return;
    }

    await recordWebhookEvent(event, 'processing');

    await processStripeEvent(event);

    await recordWebhookEvent(event, 'processed');
    res.status(200).json({ ok: true, received: true, processed: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Stripe webhook processing failed for ${event.id}:`, error);
    await recordWebhookEvent(event, 'failed', message);
    res.status(500).send('Webhook processing failed.');
  }
}

async function processStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutSessionCompleted(session);
      break;
    }
    case 'checkout.session.expired': {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutSessionExpired(session);
      break;
    }
    case 'charge.refunded':
    case 'charge.refund.updated':
    case 'refund.updated': {
      const refund = event.data.object as Stripe.Refund;
      await handleRefundEvent(refund);
      break;
    }
    default:
      await recordWebhookEvent(event, 'ignored');
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const order = await findOrderByStripeSessionId(session.id);
  if (!order) {
    console.warn(`No order found for completed session ${session.id}`);
    return;
  }

  if (order.status === 'confirmed') {
    if (order.confirmation_email_status !== 'confirmation_email_sent') {
      await sendConfirmationEmail(order);
    }
    return;
  }

  if (order.status !== 'pending_payment') {
    console.warn(`Order ${order.order_number} is not pending_payment; skipping confirmation.`);
    return;
  }

  const paymentIntentId = session.payment_intent as string | undefined;
  if (!paymentIntentId) {
    console.warn(`No payment_intent on completed session ${session.id}`);
    return;
  }

  const stripe = getStripe();
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  const chargeId = paymentIntent.latest_charge as string | undefined;

  await confirmOrderAndConsumeHold(order.id, paymentIntentId, chargeId || '');
  await sendConfirmationEmail(order);
}

async function sendConfirmationEmail(order: Awaited<ReturnType<typeof findOrderByStripeSessionId>>): Promise<void> {
  if (!order) return;

  const emailStatus = await sendBookingConfirmationEmail(order);
  await updateConfirmationEmailStatus(
    order.id,
    emailStatus === 'sent' ? 'confirmation_email_sent' : 'confirmation_email_failed',
  );
}

async function handleCheckoutSessionExpired(session: Stripe.Checkout.Session): Promise<void> {
  const order = await findOrderByStripeSessionId(session.id);
  if (!order) {
    console.warn(`No order found for expired session ${session.id}`);
    return;
  }

  if (order.status !== 'pending_payment') {
    return;
  }

  await expireOrderAndReleaseHold(order.id);
}

async function handleRefundEvent(refund: Stripe.Refund): Promise<void> {
  const chargeId = typeof refund.charge === 'string' ? refund.charge : refund.charge?.id;
  const paymentIntentId = typeof refund.payment_intent === 'string' ? refund.payment_intent : null;

  let order = chargeId ? await findOrderByStripeChargeId(chargeId) : null;
  if (!order && paymentIntentId) {
    order = await findOrderByStripePaymentIntentId(paymentIntentId);
  }

  if (!order) {
    console.warn(`No order found for refund ${refund.id}`);
    return;
  }

  const totalPriceCents = order.total_price_cents;
  const refundedCents = refund.amount;

  if (refund.status !== 'succeeded' && refund.status !== 'pending') {
    return;
  }

  if (refundedCents >= totalPriceCents) {
    const autoRelease = await canAutoReleaseSeats(order.id);
    if (autoRelease) {
      await updateOrderRefundState(order.id, 'refunded', 'refunded', refund.id);
      await releaseHoldByOrderId(order.id);
    } else {
      await updateOrderRefundState(order.id, 'pending', 'paid', refund.id);
      await sql`
        UPDATE orders
        SET internal_notes = COALESCE(internal_notes, '') || E'\nRefund received but seats held for manual review due to departure window or status.',
            updated_at = NOW()
        WHERE id = ${order.id}
      `;
    }
  } else if (refundedCents > 0) {
    await updateOrderRefundState(order.id, 'partially_refunded', 'partially_refunded', refund.id);
  }
}

function getRawBody(req: VercelRequestLike): string {
  if (Buffer.isBuffer(req.body)) {
    return req.body.toString('utf8');
  }
  if (typeof req.body === 'string') {
    return req.body;
  }
  return '';
}

function headerValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] : value || '';
}

export const config = {
  api: {
    bodyParser: false,
  },
};
