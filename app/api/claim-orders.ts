import { ensureBookingTables } from './lib/bookingSchema';
import { getUserFromRequest } from './lib/userAuth';
import { claimOrderByProof, claimOrdersByEmail } from './lib/orderQueries';

type VercelRequestLike = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type VercelResponseLike = {
  status: (code: number) => VercelResponseLike;
  json: (body: unknown) => void;
};

type ClaimBody = {
  orderNumber?: string;
  token?: string;
  sessionId?: string;
};

export default async function handler(req: VercelRequestLike, res: VercelResponseLike) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }

  const userResult = await getUserFromRequest(req);
  if (!userResult.ok) {
    res.status(401).json({ ok: false, error: 'Sign in to claim your orders.' });
    return;
  }

  try {
    await ensureBookingTables();

    const body = normalizeBody(req.body);
    const orderNumber = body.orderNumber?.trim() || '';
    const token = body.token?.trim() || '';
    const sessionId = body.sessionId?.trim() || '';

    if (orderNumber && (token || sessionId)) {
      const result = await claimOrderByProof(userResult.user.id, {
        orderNumber,
        token: token || undefined,
        sessionId: sessionId || undefined,
      });

      if (result.status === 'claimed' || result.status === 'already_linked') {
        res.status(200).json({
          ok: true,
          status: result.status,
          claimedCount: result.status === 'claimed' ? 1 : 0,
        });
        return;
      }

      if (result.status === 'linked_elsewhere') {
        res.status(409).json({
          ok: false,
          error: 'This order is already linked to another account. Please contact us for help.',
          status: result.status,
        });
        return;
      }

      if (result.status === 'not_found') {
        res.status(404).json({
          ok: false,
          error: 'Order not found.',
          status: result.status,
        });
        return;
      }

      res.status(400).json({
        ok: false,
        error: 'Invalid order link or code. Check the confirmation email and try again.',
        status: result.status,
      });
      return;
    }

    const claimedCount = await claimOrdersByEmail(userResult.user.id, userResult.user.email);
    res.status(200).json({ ok: true, claimedCount, status: 'email_claim' });
  } catch (error) {
    console.error('Claim orders failed:', error);
    res.status(500).json({ ok: false, error: 'We could not claim your orders. Please try again.' });
  }
}

function normalizeBody(body: unknown): ClaimBody {
  if (!body || typeof body !== 'object') return {};
  const record = body as Record<string, unknown>;
  return {
    orderNumber: typeof record.orderNumber === 'string' ? record.orderNumber : undefined,
    token: typeof record.token === 'string' ? record.token : undefined,
    sessionId: typeof record.sessionId === 'string' ? record.sessionId : undefined,
  };
}
