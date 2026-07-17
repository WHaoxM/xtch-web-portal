import { requireAdminAuth, hashIp } from '../lib/adminAuth';
import { writeAuditLog } from '../lib/auditLog';
import {
  archiveDestination,
  listAdminDestinations,
  parseDestinationInput,
  upsertDestination,
} from '../lib/contentQueries';

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
      const destinations = await listAdminDestinations();
      res.status(200).json({ ok: true, destinations });
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'Method not allowed.' });
      return;
    }

    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const action = String(body.action || '');

    if (action === 'create' || action === 'update') {
      const parsed = parseDestinationInput(body);
      if ('error' in parsed) {
        res.status(400).json({ ok: false, error: parsed.error });
        return;
      }

      const result = await upsertDestination(parsed.data);
      if ('error' in result) {
        res.status(result.status).json({ ok: false, error: result.error });
        return;
      }

      await writeAuditLog({
        actorType: 'admin',
        actorEmail: admin.email,
        action: action === 'create' ? 'admin_destination_create' : 'admin_destination_update',
        targetType: 'destination',
        targetId: result.slug,
        ipHash: hashIp(getClientIp(req)),
        userAgent: getHeaderValue(req.headers['user-agent']),
        metadata: {
          travel_styles: parsed.data.travelStyles,
          featured_on_home: parsed.data.featuredOnHome,
          featured_priority: parsed.data.featuredPriority,
        },
      });

      const destinations = await listAdminDestinations();
      res.status(200).json({ ok: true, slug: result.slug, destinations });
      return;
    }

    if (action === 'archive') {
      const slug = String(body.slug || '').trim();
      if (!slug) {
        res.status(400).json({ ok: false, error: 'Destination slug is required.' });
        return;
      }
      const updated = await archiveDestination(slug);
      if (!updated) {
        res.status(404).json({ ok: false, error: 'Destination not found.' });
        return;
      }

      await writeAuditLog({
        actorType: 'admin',
        actorEmail: admin.email,
        action: 'admin_destination_archive',
        targetType: 'destination',
        targetId: slug,
        ipHash: hashIp(getClientIp(req)),
        userAgent: getHeaderValue(req.headers['user-agent']),
      });

      const destinations = await listAdminDestinations();
      res.status(200).json({ ok: true, destinations });
      return;
    }

    res.status(400).json({ ok: false, error: 'Action must be create, update, or archive.' });
  } catch (error) {
    console.error('Admin destinations API failed:', error);
    res.status(500).json({ ok: false, error: 'Admin request failed.' });
  }
}

function getClientIp(req: VercelRequestLike): string {
  const forwarded = getHeaderValue(req.headers['x-forwarded-for']);
  if (forwarded) return forwarded.split(',')[0].trim();
  return getHeaderValue(req.headers['x-real-ip']) || 'unknown';
}

function getHeaderValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] : value || '';
}
