import { URL } from 'node:url';
import { requireAdminAuth, hashIp } from '../../../identity/admin/adminAuth';
import { writeAuditLog } from '../../../../platform/auditLog';
import { archiveRoute, listAdminRoutes, parseRouteInput, upsertRoute } from '../../contentQueries';

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
      const routes = await listAdminRoutes({
        status: query.get('status') || undefined,
        search: query.get('search') || undefined,
      });
      res.status(200).json({ ok: true, routes });
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'Method not allowed.' });
      return;
    }

    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const action = String(body.action || '');

    if (action === 'create' || action === 'update') {
      const parsed = parseRouteInput(body);
      if ('error' in parsed) {
        res.status(400).json({ ok: false, error: parsed.error });
        return;
      }

      const result = await upsertRoute(parsed.data);
      if ('error' in result) {
        res.status(result.status).json({ ok: false, error: result.error });
        return;
      }

      await writeAuditLog({
        actorType: 'admin',
        actorEmail: admin.email,
        action: action === 'create' ? 'admin_route_create' : 'admin_route_update',
        targetType: 'route',
        targetId: result.slug,
        ipHash: hashIp(getClientIp(req)),
        userAgent: getHeaderValue(req.headers['user-agent']),
        metadata: { featured: parsed.data.featured, status: parsed.data.status },
      });

      const routes = await listAdminRoutes();
      res.status(200).json({ ok: true, slug: result.slug, routes });
      return;
    }

    if (action === 'archive') {
      const slug = String(body.slug || '').trim();
      if (!slug) {
        res.status(400).json({ ok: false, error: 'Route slug is required.' });
        return;
      }
      const updated = await archiveRoute(slug);
      if (!updated) {
        res.status(404).json({ ok: false, error: 'Route not found.' });
        return;
      }

      await writeAuditLog({
        actorType: 'admin',
        actorEmail: admin.email,
        action: 'admin_route_archive',
        targetType: 'route',
        targetId: slug,
        ipHash: hashIp(getClientIp(req)),
        userAgent: getHeaderValue(req.headers['user-agent']),
      });

      const routes = await listAdminRoutes();
      res.status(200).json({ ok: true, routes });
      return;
    }

    res.status(400).json({ ok: false, error: 'Action must be create, update, or archive.' });
  } catch (error) {
    console.error('Admin routes API failed:', error);
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
