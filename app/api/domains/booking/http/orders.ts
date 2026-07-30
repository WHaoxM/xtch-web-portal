import { URL } from 'node:url';
import { ensureBookingTables } from '../bookingSchema';
import { hashToken } from '../orders/orders';
import {
  findOrderByOrderNumber,
  findOrderByPayoneerListId,
  findOrderByStripeSessionId,
  getSafeOrderSummaryByOrderNumber,
  recordCancellationRequest,
  recordDateChangeRequest,
  type SafeOrderSummary,
} from '../orders/orderQueries';
import { getUserFromRequest } from '../../identity/traveler/userAuth';

type VercelRequestLike = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  url?: string;
  body?: unknown;
};

type VercelResponseLike = {
  status: (code: number) => VercelResponseLike;
  json: (body: unknown) => void;
};

export default async function handler(req: VercelRequestLike, res: VercelResponseLike) {
  try {
    await ensureBookingTables();

    const query = parseQuery(req.url);
    const orderNumber = query.get('orderNumber') || '';
    const token = query.get('token') || undefined;
    const sessionId = query.get('session_id') || undefined;
    const action = query.get('action') || '';

    if (req.method === 'GET') {
      if (!orderNumber && !sessionId) {
        res.status(400).json({ ok: false, error: 'Missing order identifier.' });
        return;
      }

      let summary: SafeOrderSummary | null = null;

      if (orderNumber && token) {
        summary = await lookupByToken(orderNumber, token);
      } else if (sessionId) {
        summary = await lookupBySessionId(sessionId);
      } else if (orderNumber) {
        const userResult = await getUserFromRequest(req);
        if (userResult.ok) {
          summary = await lookupByUserId(orderNumber, userResult.user.id);
        }
      }

      if (!summary) {
        res.status(404).json({ ok: false, error: 'Order not found or link has expired.' });
        return;
      }

      res.status(200).json({ ok: true, order: summary });
      return;
    }

    if (req.method === 'POST') {
      if (!orderNumber || !token) {
        res.status(400).json({ ok: false, error: 'Order number and token are required.' });
        return;
      }

      const order = await verifyToken(orderNumber, token);
      if (!order) {
        res.status(404).json({ ok: false, error: 'Order not found or link has expired.' });
        return;
      }

      if (action === 'cancellation-request') {
        const result = await recordCancellationRequest(order.id);
        if (result.status === 'not_allowed') {
          res.status(409).json({
            ok: false,
            error: 'This order cannot request cancellation from its current state.',
          });
          return;
        }
        res.status(200).json({
          ok: true,
          message:
            result.status === 'already_requested'
              ? 'Cancellation request already recorded.'
              : 'Cancellation request recorded.',
        });
        return;
      }

      if (action === 'date-change-request') {
        await recordDateChangeRequest(order.id);
        res.status(200).json({ ok: true, message: 'Date change request recorded.' });
        return;
      }

      res.status(400).json({ ok: false, error: 'Unknown action.' });
      return;
    }

    res.status(405).json({ ok: false, error: 'Method not allowed.' });
  } catch (error) {
    console.error('Order lookup failed:', error);
    res.status(500).json({ ok: false, error: 'We could not process your request. Please try again.' });
  }
}

async function lookupByToken(orderNumber: string, token: string): Promise<SafeOrderSummary | null> {
  const order = await findOrderByOrderNumber(orderNumber);
  if (!order) return null;
  if (order.access_token_hash !== hashToken(token)) return null;
  return getSafeOrderSummaryByOrderNumber(orderNumber);
}

async function lookupBySessionId(sessionId: string): Promise<SafeOrderSummary | null> {
  const order =
    (await findOrderByStripeSessionId(sessionId)) || (await findOrderByPayoneerListId(sessionId));
  if (!order) return null;
  return getSafeOrderSummaryByOrderNumber(order.order_number);
}

async function lookupByUserId(orderNumber: string, userId: string): Promise<SafeOrderSummary | null> {
  const order = await findOrderByOrderNumber(orderNumber);
  if (!order) return null;
  if (order.user_id !== userId) return null;
  return getSafeOrderSummaryByOrderNumber(orderNumber);
}

async function verifyToken(orderNumber: string, token: string) {
  const order = await findOrderByOrderNumber(orderNumber);
  if (!order) return null;
  if (order.access_token_hash !== hashToken(token)) return null;
  return order;
}

function parseQuery(url: string | undefined): URLSearchParams {
  if (!url) return new URLSearchParams();
  const parsed = new URL(url, 'http://localhost');
  return parsed.searchParams;
}
