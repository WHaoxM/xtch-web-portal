import { listPublicCategories } from './lib/contentQueries';
import type { CategoryScope } from './lib/contentSchema';

type VercelRequestLike = {
  method?: string;
  url?: string;
};

type VercelResponseLike = {
  status: (code: number) => VercelResponseLike;
  json: (body: unknown) => void;
};

const KNOWN_SCOPES: CategoryScope[] = ['destination', 'route'];

export default async function handler(req: VercelRequestLike, res: VercelResponseLike) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }

  const scope = parseScope(req.url);
  if (!scope) {
    res.status(400).json({ ok: false, error: 'Query param scope must be destination or route.' });
    return;
  }

  try {
    const categories = await listPublicCategories(scope);
    res.status(200).json({ ok: true, categories });
  } catch (error) {
    console.error('Public categories API failed:', error);
    res.status(500).json({ ok: false, error: 'Could not load categories.' });
  }
}

function parseScope(url: string | undefined): CategoryScope | null {
  if (!url) return null;
  const parsed = new URL(url, 'http://localhost');
  const scope = parsed.searchParams.get('scope');
  return KNOWN_SCOPES.includes(scope as CategoryScope) ? (scope as CategoryScope) : null;
}
