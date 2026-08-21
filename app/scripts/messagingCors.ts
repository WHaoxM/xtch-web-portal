type HeaderResponse = {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
};

type HeaderRequest = {
  method?: string;
  headers: { origin?: string | string[] };
};

export function parseMessagingRestOrigins(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/** Apply explicit-origin CORS and consume preflight for `/api/im/*` only. */
export function handleMessagingCors(
  pathname: string,
  req: HeaderRequest,
  res: HeaderResponse,
  allowedOrigins: string[],
): boolean {
  if (!(pathname === '/api/im' || pathname.startsWith('/api/im/'))) return false;
  const origin = Array.isArray(req.headers.origin) ? req.headers.origin[0] : req.headers.origin;
  const allowed = Boolean(origin && allowedOrigins.includes(origin));
  if (origin) res.setHeader('Vary', 'Origin');
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin!);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key, X-IM-Introspection-Secret');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  if (req.method === 'OPTIONS') {
    res.statusCode = allowed ? 204 : 403;
    res.end();
    return true;
  }
  return false;
}
