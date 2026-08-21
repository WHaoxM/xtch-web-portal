export type ImRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  url?: string;
  socket?: { remoteAddress?: string };
};

export type ImResponse = {
  status: (code: number) => ImResponse;
  json: (body: unknown) => void;
  setHeader?: (name: string, value: string | string[]) => void;
};

export function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function getClientIp(req: ImRequest): string {
  const forwarded = headerValue(req.headers['x-forwarded-for']);
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  return headerValue(req.headers['x-real-ip']) || req.socket?.remoteAddress || 'unknown';
}

export function bearerToken(req: ImRequest): string | null {
  const value = headerValue(req.headers.authorization);
  if (!value || !value.startsWith('Bearer ')) return null;
  const token = value.slice('Bearer '.length).trim();
  return token || null;
}

export function parseCookies(value: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of (value ?? '').split(';')) {
    const index = part.indexOf('=');
    if (index <= 0) continue;
    const key = part.slice(0, index).trim();
    const raw = part.slice(index + 1).trim();
    if (!key || !raw) continue;
    try {
      result[key] = decodeURIComponent(raw);
    } catch {
      // Ignore malformed cookie values.
    }
  }
  return result;
}

