import { ensureBookingTables } from './lib/bookingSchema';
import { getUserFromRequest } from './lib/userAuth';
import { listOrdersByLeadEmail, listOrdersByUserId } from './lib/orderQueries';

type VercelRequestLike = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
};

type VercelResponseLike = {
  status: (code: number) => VercelResponseLike;
  json: (body: unknown) => void;
};

export default async function handler(req: VercelRequestLike, res: VercelResponseLike) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }

  const userResult = await getUserFromRequest(req);
  if (!userResult.ok) {
    res.status(401).json({ ok: false, error: 'Sign in to view your orders.' });
    return;
  }

  try {
    await ensureBookingTables();
    const orders =
      userResult.user.id === 'dev-bypass-user-id'
        ? await listOrdersByLeadEmail(userResult.user.email)
        : await listOrdersByUserId(userResult.user.id);
    res.status(200).json({ ok: true, orders });
  } catch (error) {
    console.error('List my orders failed:', error);
    res.status(500).json({ ok: false, error: 'We could not load your orders. Please try again.' });
  }
}
