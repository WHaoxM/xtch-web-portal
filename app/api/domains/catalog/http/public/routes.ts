import { URL } from 'node:url';
import { listPublicRoutes } from '../../contentQueries';

type VercelRequestLike = {
  method?: string;
  url?: string;
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
    const query = parseQuery(req.url);
    const destinationSlug = query.get('destination') || undefined;
    const routes = await listPublicRoutes({ destinationSlug });
    res.status(200).json({ ok: true, routes });
  } catch (error) {
    console.error('Public routes API failed:', error);
    res.status(500).json({ ok: false, error: 'Could not load routes.' });
  }
}

function parseQuery(url: string | undefined): URLSearchParams {
  if (!url) return new URLSearchParams();
  const parsed = new URL(url, 'http://localhost');
  return parsed.searchParams;
}
