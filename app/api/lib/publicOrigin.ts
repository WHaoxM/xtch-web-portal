import os from 'node:os';

/**
 * Resolve the canonical public site origin for deploy targets.
 * Priority: PUBLIC_DOMAIN > PUBLIC_IP > first non-internal LAN IPv4.
 * Does not probe the internet for a public IP.
 */

export function isPlaceholderUrl(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (!v) return true;
  return (
    v.includes('your_domain') ||
    v.includes('your-domain') ||
    v.includes('change_me') ||
    v === 'https://' ||
    v === 'http://'
  );
}

/** First non-internal IPv4 from local interfaces, or null. */
export function detectLanIPv4(): string | null {
  const nets = os.networkInterfaces();
  for (const entries of Object.values(nets)) {
    if (!entries) continue;
    for (const entry of entries) {
      if (entry.family !== 'IPv4' && entry.family !== 4) continue;
      if (entry.internal) continue;
      const address = entry.address?.trim();
      if (address) return address;
    }
  }
  return null;
}

function normalizeHostOrOrigin(raw: string, { preferHttps }: { preferHttps: boolean }): string | null {
  const trimmed = raw.trim().replace(/\/$/, '');
  if (!trimmed || isPlaceholderUrl(trimmed)) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      return `${url.protocol}//${url.host}`;
    } catch {
      return null;
    }
  }

  // host[:port] without scheme
  const host = trimmed.replace(/^\/+/, '');
  if (!host || /\s/.test(host)) return null;
  const scheme = preferHttps ? 'https' : 'http';
  return `${scheme}://${host}`;
}

function allowLanFallback(env: NodeJS.ProcessEnv): boolean {
  const appEnv = env.APP_ENV?.trim().toLowerCase();
  if (appEnv === 'prod' || appEnv === 'production') return true;
  if (env.DEPLOY_TARGET?.trim()) return true;
  if (env.SELFHOST_HOST?.trim()) return true;
  // Explicit opt-in for scripts/tests
  const flag = env.PUBLIC_ORIGIN_USE_LAN?.trim().toLowerCase();
  return flag === '1' || flag === 'true' || flag === 'yes';
}

/**
 * Canonical origin from env (+ optional LAN detect).
 * Domain defaults to https when scheme omitted; IP defaults to http.
 * LAN auto-detect only for deploy/prod (or PUBLIC_ORIGIN_USE_LAN=1).
 */
export function resolvePublicOrigin(env: NodeJS.ProcessEnv = process.env): string | null {
  const domain = env.PUBLIC_DOMAIN?.trim();
  if (domain) {
    const fromDomain = normalizeHostOrOrigin(domain, { preferHttps: true });
    if (fromDomain) return fromDomain;
  }

  const publicIp = env.PUBLIC_IP?.trim();
  if (publicIp) {
    const fromIp = normalizeHostOrOrigin(publicIp, { preferHttps: false });
    if (fromIp) return fromIp;
  }

  if (!allowLanFallback(env)) return null;

  const lan = detectLanIPv4();
  if (lan) {
    const port = env.SELFHOST_PORT?.trim() || env.PORT?.trim() || '3000';
    const withPort = port && port !== '80' && port !== '443' ? `${lan}:${port}` : lan;
    return normalizeHostOrOrigin(withPort, { preferHttps: false });
  }

  return null;
}

type HeaderBag = Record<string, string | string[] | undefined>;

function headerValue(headers: HeaderBag, name: string): string {
  const raw = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0]?.trim() || '';
  return typeof raw === 'string' ? raw.trim() : '';
}

/**
 * Origin of the current browser request (Caddy-friendly via X-Forwarded-*).
 */
export function resolveRequestOrigin(req: {
  headers: HeaderBag;
}): string | null {
  const forwardedHost = headerValue(req.headers, 'x-forwarded-host');
  const host = forwardedHost || headerValue(req.headers, 'host');
  if (!host) return null;

  const forwardedProto = headerValue(req.headers, 'x-forwarded-proto').split(',')[0]?.trim();
  let proto = forwardedProto;
  if (!proto) {
    // Direct IP / LAN access is almost always http
    proto = 'http';
  }
  if (proto !== 'http' && proto !== 'https') proto = 'http';

  try {
    return `${proto}://${host}`.replace(/\/$/, '');
  } catch {
    return null;
  }
}

/** `{origin}/s3` for browser-facing MinIO proxy path. */
export function resolveS3BrowserEndpoint(
  env: NodeJS.ProcessEnv = process.env,
  requestOrigin?: string | null,
): string | null {
  if (requestOrigin) {
    return `${requestOrigin.replace(/\/$/, '')}/s3`;
  }

  const configured = env.S3_BROWSER_ENDPOINT?.trim().replace(/\/$/, '');
  if (configured && !isPlaceholderUrl(configured)) {
    return configured;
  }

  const origin = resolvePublicOrigin(env);
  return origin ? `${origin}/s3` : null;
}
