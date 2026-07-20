import Stripe from 'stripe';
import { sql } from './lib/db';
import { ensureBookingTables } from './lib/bookingSchema';
import { classifyRefundAmount, shouldConfirmPaidCheckout } from './lib/bookingIntegrity';
import { getStripe } from './lib/stripe';
import {
  applyFullRefundAndReleaseSeats,
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
    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge;
      await handleChargeRefunded(charge);
      break;
    }
    case 'charge.refund.updated':
    case 'refund.updated': {
      const refund = event.data.object as Stripe.Refund;
      await handleRefundObjectEvent(refund);
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

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id;

  let paymentIntentStatus: string | null = null;
  let chargeId = '';

  if (paymentIntentId) {
    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    paymentIntentStatus = paymentIntent.status;
    chargeId =
      typeof paymentIntent.latest_charge === 'string'
        ? paymentIntent.latest_charge
        : paymentIntent.latest_charge?.id || '';
  }

  // V1 B1: only confirm when Stripe reports paid / PI succeeded.
  if (
    !shouldConfirmPaidCheckout({
      sessionPaymentStatus: session.payment_status,
      paymentIntentStatus,
    })
  ) {
    console.warn(
      `Session ${session.id} completed but not paid (payment_status=${session.payment_status}, pi=${paymentIntentStatus}); skipping confirmation.`,
    );
    return;
  }

  if (!paymentIntentId) {
    console.warn(`No payment_intent on paid session ${session.id}`);
    return;
  }

  const confirmed = await confirmOrderAndConsumeHold(order.id, paymentIntentId, chargeId);
  if (confirmed) {
    await sendConfirmationEmail(order);
  }
}

async function sendConfirmationEmail(
  order: Awaited<ReturnType<typeof findOrderByStripeSessionId>>,
): Promise<void> {
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

async function handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
  const chargeId = charge.id;
  const paymentIntentId =
    typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : charge.payment_intent?.id ?? null;
  const amountRefundedCents = charge.amount_refunded;
  const refundId = charge.refunds?.data?.[0]?.id;

  await applyRefundByCharge({
    chargeId,
    paymentIntentId,
    amountRefundedCents,
    refundId,
    refundStatusHint: charge.refunded ? 'succeeded' : undefined,
  });
}

async function handleRefundObjectEvent(refund: Stripe.Refund): Promise<void> {
  if (refund.status !== 'succeeded' && refund.status !== 'pending') {
    return;
  }

  const chargeId = typeof refund.charge === 'string' ? refund.charge : refund.charge?.id ?? null;
  const paymentIntentId =
    typeof refund.payment_intent === 'string'
      ? refund.payment_intent
      : refund.payment_intent?.id ?? null;

  let amountRefundedCents = refund.amount;
  if (chargeId) {
    const charge = await getStripe().charges.retrieve(chargeId);
    amountRefundedCents = charge.amount_refunded;
  }

  await applyRefundByCharge({
    chargeId,
    paymentIntentId,
    amountRefundedCents,
    refundId: refund.id,
    refundStatusHint: refund.status,
  });
}

async function applyRefundByCharge(params: {
  chargeId: string | null;
  paymentIntentId: string | null;
  amountRefundedCents: number;
  refundId?: string;
  refundStatusHint?: string;
}): Promise<void> {
  let order = params.chargeId ? await findOrderByStripeChargeId(params.chargeId) : null;
  if (!order && params.paymentIntentId) {
    order = await findOrderByStripePaymentIntentId(params.paymentIntentId);
  }

  if (!order) {
    console.warn(
      `No order found for refund charge=${params.chargeId} pi=${params.paymentIntentId}`,
    );
    return;
  }

  if (params.refundStatusHint && params.refundStatusHint !== 'succeeded' && params.refundStatusHint !== 'pending') {
    return;
  }

  const refundClass = classifyRefundAmount(params.amountRefundedCents, order.total_price_cents);

  if (refundClass === 'none') {
    return;
  }

  if (refundClass === 'full') {
    const autoRelease = await canAutoReleaseSeats(order.id);
    if (autoRelease) {
      await applyFullRefundAndReleaseSeats(order.id, params.refundId);
    } else {
      // Near-departure / non-sellable: keep seats occupied for manual review.
      if (order.refund_status !== 'refunded' && order.status !== 'refunded') {
        await updateOrderRefundState(order.id, 'pending', 'paid', params.refundId);
        await sql`
          UPDATE orders
          SET internal_notes = COALESCE(internal_notes, '') || E'\nRefund received but seats held for manual review due to departure window or status.',
              updated_at = NOW()
          WHERE id = ${order.id}
            AND status <> 'refunded'
        `;
      }
    }
    return;
  }

  // Partial: never treat single refund.amount as full; use cumulative amount_refunded.
  if (order.payment_status !== 'refunded' && order.status !== 'refunded') {
    await updateOrderRefundState(
      order.id,
      'partially_refunded',
      'partially_refunded',
      params.refundId,
    );
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
