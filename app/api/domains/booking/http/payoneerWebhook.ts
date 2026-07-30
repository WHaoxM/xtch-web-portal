import { ensureBookingTables } from '../bookingSchema';
import {
  parsePayoneerNotification,
  verifyPayoneerWebhookSignature,
} from '../payment/payoneer';
import {
  isPayoneerWebhookEventProcessed,
  recordPayoneerWebhookEvent,
} from '../payment/payoneerWebhookEvents';
import {
  confirmPayoneerOrderAndConsumeHold,
  expireOrderAndReleaseHold,
  failOrderAndReleaseHold,
  findOrderByOrderNumber,
  findOrderByPayoneerListId,
  findOrderByPayoneerTransactionId,
  updateConfirmationEmailStatus,
} from '../orders/orderQueries';
import { buildOrderAccessUrl } from '../orders/orders';
import { sendBookingConfirmationEmail } from '../../../platform/email';
import type { Order } from '../bookingSchema';

type VercelRequestLike = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: Buffer | string | unknown;
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
  const authorization =
    headerValue(req.headers.authorization) || headerValue(req.headers['x-payoneer-signature']);

  if (!verifyPayoneerWebhookSignature(rawBody, authorization)) {
    console.error('Payoneer webhook signature verification failed.');
    res.status(400).send('Invalid signature.');
    return;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'));
  } catch {
    res.status(400).send('Invalid JSON body.');
    return;
  }

  const event = parsePayoneerNotification(payload);

  try {
    await ensureBookingTables();

    if (await isPayoneerWebhookEventProcessed(event.eventId)) {
      res.status(200).json({ ok: true, received: true, processed: false });
      return;
    }

    await recordPayoneerWebhookEvent(event, 'processing');
    await processPayoneerNotification(event);
    await recordPayoneerWebhookEvent(event, 'processed');
    res.status(200).json({ ok: true, received: true, processed: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Payoneer webhook processing failed for ${event.eventId}:`, error);
    await recordPayoneerWebhookEvent(event, 'failed', message);
    res.status(500).send('Webhook processing failed.');
  }
}

async function processPayoneerNotification(
  event: ReturnType<typeof parsePayoneerNotification>,
): Promise<void> {
  switch (event.status) {
    case 'charged':
      await handleCharged(event);
      break;
    case 'expired':
    case 'canceled':
      await handleExpiredOrCanceled(event);
      break;
    case 'failed':
      await handleFailed(event);
      break;
    default:
      await recordPayoneerWebhookEvent(event, 'ignored');
  }
}

async function resolveOrder(event: ReturnType<typeof parsePayoneerNotification>): Promise<Order | null> {
  if (event.listId) {
    const byList = await findOrderByPayoneerListId(event.listId);
    if (byList) return byList;
  }
  if (event.transactionId) {
    return findOrderByPayoneerTransactionId(event.transactionId);
  }
  return null;
}

async function handleCharged(event: ReturnType<typeof parsePayoneerNotification>): Promise<void> {
  const order = await resolveOrder(event);
  if (!order) {
    console.warn(`No order found for Payoneer charged event ${event.eventId}`);
    return;
  }

  if (order.status === 'confirmed') {
    if (order.confirmation_email_status !== 'confirmation_email_sent') {
      await sendConfirmationEmail(order);
    }
    return;
  }

  if (order.status !== 'pending_payment') {
    console.warn(`Ignoring Payoneer charge for order ${order.order_number} in status ${order.status}`);
    return;
  }

  const confirmed = await confirmPayoneerOrderAndConsumeHold(
    order.id,
    event.transactionId || order.payoneer_transaction_id || event.eventId,
    event.chargeId,
  );

  if (confirmed) {
    const refreshed = await findOrderByOrderNumber(order.order_number);
    if (refreshed) await sendConfirmationEmail(refreshed);
  }
}

async function handleExpiredOrCanceled(
  event: ReturnType<typeof parsePayoneerNotification>,
): Promise<void> {
  const order = await resolveOrder(event);
  if (!order || order.status !== 'pending_payment') return;
  await expireOrderAndReleaseHold(order.id);
}

async function handleFailed(event: ReturnType<typeof parsePayoneerNotification>): Promise<void> {
  const order = await resolveOrder(event);
  if (!order || order.status !== 'pending_payment') return;
  await failOrderAndReleaseHold(order.id);
}

async function sendConfirmationEmail(order: Order): Promise<void> {
  const orderUrl =
    order.confirmation_email_status !== 'confirmation_email_traveler_sent'
      ? await buildOrderAccessUrl(order)
      : undefined;
  const emailStatus = await sendBookingConfirmationEmail(order, {
    purpose: 'payment-confirmation',
    orderUrl,
    onTravelerSent: () => updateConfirmationEmailStatus(order.id, 'confirmation_email_traveler_sent'),
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

function getRawBody(req: VercelRequestLike): string | Buffer {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return req.body;
  return JSON.stringify(req.body ?? {});
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
