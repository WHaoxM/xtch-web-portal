import { URL } from 'node:url';
import { requireAdminAuth, hashIp } from '../../identity/admin/adminAuth';
import { writeAuditLog } from '../../../platform/auditLog';
import { archiveMedia, listAdminMedia, parseMediaInput, upsertMedia } from '../../catalog/contentQueries';

type VercelRequestLike = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  url?: string;
  body?: unknown;
};

type VercelResponseLike = {
  status: (code: number) => VercelResponseLike;
  json: (body: unknown) => void;
};

export default async function handler(req: VercelRequestLike, res: VercelResponseLike) {
  const admin = await requireAdminAuth(req);
  if (!admin.ok) {
    res.status(admin.status).json({ ok: false, error: admin.error });
    return;
  }

  try {
    if (req.method === 'GET') {
      const query = parseQuery(req.url);
      const media = await listAdminMedia({
        routeSlug: query.get('routeSlug') || undefined,
        destinationSlug: query.get('destinationSlug') || undefined,
        status: query.get('status') || undefined,
        search: query.get('search') || undefined,
      });
      res.status(200).json({ ok: true, media });
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'Method not allowed.' });
      return;
    }

    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const action = String(body.action || '');

    if (action === 'create' || action === 'update') {
      const parsed = parseMediaInput(body);
      if ('error' in parsed) {
        res.status(400).json({ ok: false, error: parsed.error });
        return;
      }

      const result = await upsertMedia(parsed.data);

      await writeAuditLog({
        actorType: 'admin',
        actorEmail: admin.email,
        action: action === 'create' ? 'admin_media_create' : 'admin_media_update',
        targetType: 'media_asset',
        targetId: result.id,
        ipHash: hashIp(getClientIp(req)),
        userAgent: getHeaderValue(req.headers['user-agent']),
      });

      const media = await listAdminMedia();
      res.status(200).json({ ok: true, id: result.id, media });
      return;
    }

    if (action === 'archive') {
      const id = String(body.id || '').trim();
      if (!id) {
        res.status(400).json({ ok: false, error: 'Media ID is required.' });
        return;
      }
      const updated = await archiveMedia(id);
      if (!updated) {
        res.status(404).json({ ok: false, error: 'Media asset not found.' });
        return;
      }

      await writeAuditLog({
        actorType: 'admin',
        actorEmail: admin.email,
        action: 'admin_media_archive',
        targetType: 'media_asset',
        targetId: id,
        ipHash: hashIp(getClientIp(req)),
        userAgent: getHeaderValue(req.headers['user-agent']),
      });

      const media = await listAdminMedia();
      res.status(200).json({ ok: true, media });
      return;
    }

    res.status(400).json({ ok: false, error: 'Action must be create, update, or archive.' });
  } catch (error) {
    console.error('Admin media API failed:', error);
    res.status(500).json({ ok: false, error: 'Admin request failed.' });
  }
}

function parseQuery(url: string | undefined): URLSearchParams {
  if (!url) return new URLSearchParams();
  const parsed = new URL(url, 'http://localhost');
  return parsed.searchParams;
}

function getClientIp(req: VercelRequestLike): string {
  const forwarded = getHeaderValue(req.headers['x-forwarded-for']);
  if (forwarded) return forwarded.split(',')[0].trim();
  return getHeaderValue(req.headers['x-real-ip']) || 'unknown';
}

function getHeaderValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] : value || '';
}
