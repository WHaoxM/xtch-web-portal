import { requireAdminAuth, hashIp } from '../../../identity/admin/adminAuth';
import { writeAuditLog } from '../../../../platform/auditLog';
import {
  archiveCategory,
  listAdminCategories,
  parseCategoryInput,
  reorderCategories,
  upsertCategory,
} from '../../contentQueries';
import type { CategoryScope } from '../../contentSchema';

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

const KNOWN_SCOPES: CategoryScope[] = ['destination', 'route'];

export default async function handler(req: VercelRequestLike, res: VercelResponseLike) {
  const admin = await requireAdminAuth(req);
  if (!admin.ok) {
    res.status(admin.status).json({ ok: false, error: admin.error });
    return;
  }

  try {
    if (req.method === 'GET') {
      const categories = await listAdminCategories();
      res.status(200).json({ ok: true, categories });
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'Method not allowed.' });
      return;
    }

    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const action = String(body.action || '');

    if (action === 'create' || action === 'update') {
      const parsed = parseCategoryInput(body);
      if ('error' in parsed) {
        res.status(400).json({ ok: false, error: parsed.error });
        return;
      }

      const result = await upsertCategory(parsed.data);
      if ('error' in result) {
        res.status(result.status).json({ ok: false, error: result.error });
        return;
      }

      await writeAuditLog({
        actorType: 'admin',
        actorEmail: admin.email,
        action: action === 'create' ? 'admin_category_create' : 'admin_category_update',
        targetType: 'category',
        targetId: result.id,
        ipHash: hashIp(getClientIp(req)),
        userAgent: getHeaderValue(req.headers['user-agent']),
        metadata: { key: parsed.data.key, scope: parsed.data.scope, enabled: parsed.data.enabled },
      });

      const categories = await listAdminCategories();
      res.status(200).json({ ok: true, id: result.id, categories });
      return;
    }

    if (action === 'archive') {
      const id = String(body.id || '').trim();
      if (!id) {
        res.status(400).json({ ok: false, error: 'Category ID is required.' });
        return;
      }
      const updated = await archiveCategory(id);
      if (!updated) {
        res.status(404).json({ ok: false, error: 'Category not found.' });
        return;
      }

      await writeAuditLog({
        actorType: 'admin',
        actorEmail: admin.email,
        action: 'admin_category_archive',
        targetType: 'category',
        targetId: id,
        ipHash: hashIp(getClientIp(req)),
        userAgent: getHeaderValue(req.headers['user-agent']),
      });

      const categories = await listAdminCategories();
      res.status(200).json({ ok: true, categories });
      return;
    }

    if (action === 'reorder') {
      const scope = String(body.scope || '').trim() as CategoryScope;
      const orderedIds = asStringArray(body.orderedIds ?? body.ordered_ids);
      if (!KNOWN_SCOPES.includes(scope)) {
        res.status(400).json({ ok: false, error: 'Scope must be destination or route.' });
        return;
      }
      if (orderedIds.length === 0) {
        res.status(400).json({ ok: false, error: 'orderedIds must be a non-empty array.' });
        return;
      }

      await reorderCategories(scope, orderedIds);

      await writeAuditLog({
        actorType: 'admin',
        actorEmail: admin.email,
        action: 'admin_category_reorder',
        targetType: 'category',
        targetId: scope,
        ipHash: hashIp(getClientIp(req)),
        userAgent: getHeaderValue(req.headers['user-agent']),
        metadata: { orderedIds },
      });

      const categories = await listAdminCategories();
      res.status(200).json({ ok: true, categories });
      return;
    }

    res.status(400).json({ ok: false, error: 'Action must be create, update, archive, or reorder.' });
  } catch (error) {
    console.error('Admin categories API failed:', error);
    res.status(500).json({ ok: false, error: 'Admin request failed.' });
  }
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? '').trim()).filter(Boolean);
}

function getClientIp(req: VercelRequestLike): string {
  const forwarded = getHeaderValue(req.headers['x-forwarded-for']);
  if (forwarded) return forwarded.split(',')[0].trim();
  return getHeaderValue(req.headers['x-real-ip']) || 'unknown';
}

function getHeaderValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] : value || '';
}
