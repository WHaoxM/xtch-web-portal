import { ensureBookingTables } from './lib/bookingSchema';
import { getUserFromRequest } from './lib/userAuth';
import { claimOrdersByEmail } from './lib/orderQueries';

type VercelRequestLike = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
};

type VercelResponseLike = {
  status: (code: number) => VercelResponseLike;
  json: (body: unknown) => void;
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
    const claimedCount = await claimOrdersByEmail(userResult.user.id, userResult.user.email);
    res.status(200).json({ ok: true, claimedCount });
  } catch (error) {
    console.error('Claim orders failed:', error);
    res.status(500).json({ ok: false, error: 'We could not claim your orders. Please try again.' });
  }
}
