import { listPublicDestinations } from '../../contentQueries';

type VercelRequestLike = {
  method?: string;
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

  try {
    const destinations = await listPublicDestinations();
    res.status(200).json({ ok: true, destinations });
  } catch (error) {
    console.error('Public destinations API failed:', error);
    res.status(500).json({ ok: false, error: 'Could not load destinations.' });
  }
}
