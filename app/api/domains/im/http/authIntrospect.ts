import { bearerToken, headerValue, type ImRequest, type ImResponse } from '../httpTypes';
import { introspectImAccessToken } from '../imAuth';

/** Private Socket.IO gateway callback; never returns refresh tokens or user PII. */
export default async function handler(req: ImRequest, res: ImResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }

  const configuredSecret = process.env.MESSAGING_SOCKET_AUTH_SECRET?.trim();
  if (configuredSecret && headerValue(req.headers['x-im-introspection-secret']) !== configuredSecret) {
    res.status(403).json({ ok: false, error: 'Introspection access denied.' });
    return;
  }

  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ ok: false, error: 'Bearer token required.' });
    return;
  }

  try {
    const principal = await introspectImAccessToken(token);
    if (!principal) {
      res.status(401).json({ ok: false, error: 'Invalid or expired IM session.' });
      return;
    }
    res.status(200).json({ ok: true, ...principal });
  } catch (error) {
    console.error('IM token introspection failed:', error instanceof Error ? error.message : error);
    res.status(503).json({ ok: false, error: 'IM identity service is temporarily unavailable.' });
  }
}
