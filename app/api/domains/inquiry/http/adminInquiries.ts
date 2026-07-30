import { URL } from 'node:url';
import { requireAdminAuth, hashIp } from '../../identity/admin/adminAuth';
import { writeAuditLog } from '../../../platform/auditLog';
import { ensureInquiryTable } from '../inquirySchema';
import {
  getInquiryForAdmin,
  isInquiryStatus,
  listInquiriesForAdmin,
  updateInquiryInternalNotes,
  updateInquiryStatus,
  type AdminInquiry,
} from '../admin/adminInquiries';

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
    await ensureInquiryTable();

    const query = parseQuery(req.url);
    const id = query.get('id') || '';
    const action = query.get('action') || '';

    if (req.method === 'GET') {
      if (id) {
        return await handleGetInquiryDetail(req, res, admin.email, id);
      }
      return await handleListInquiries(req, res, query);
    }

    if (req.method === 'POST') {
      if (!id) {
        res.status(400).json({ ok: false, error: 'Inquiry id is required.' });
        return;
      }

      if (action === 'update-status') {
        return await handleUpdateStatus(req, res, admin.email, id);
      }

      if (action === 'internal-notes') {
        return await handleUpdateNotes(req, res, admin.email, id);
      }

      res.status(400).json({ ok: false, error: 'Unknown admin action.' });
      return;
    }

    res.status(405).json({ ok: false, error: 'Method not allowed.' });
  } catch (error) {
    console.error('Admin inquiries API failed:', error);
    res.status(500).json({ ok: false, error: 'Admin request failed.' });
  }
}

async function handleListInquiries(
  _req: VercelRequestLike,
  res: VercelResponseLike,
  query: URLSearchParams,
) {
  const status = query.get('status') || undefined;
  const type = query.get('type') || undefined;
  const search = query.get('search') || undefined;
  const limit = Number(query.get('limit') || '50');
  const offset = Number(query.get('offset') || '0');

  const inquiries = await listInquiriesForAdmin({ status, type, search, limit, offset });

  res.status(200).json({
    ok: true,
    inquiries: inquiries.map(sanitizeInquiryForList),
  });
}

async function handleGetInquiryDetail(
  req: VercelRequestLike,
  res: VercelResponseLike,
  adminEmail: string,
  id: string,
) {
  const inquiry = await getInquiryForAdmin(id);
  if (!inquiry) {
    res.status(404).json({ ok: false, error: 'Inquiry not found.' });
    return;
  }

  await writeAuditLog({
    actorType: 'admin',
    actorEmail: adminEmail,
    action: 'admin_inquiry_detail_view',
    targetType: 'inquiry',
    targetId: inquiry.id,
    ipHash: hashIp(getClientIp(req)),
    userAgent: getHeaderValue(req.headers['user-agent']),
  });

  res.status(200).json({ ok: true, inquiry });
}

async function handleUpdateStatus(
  req: VercelRequestLike,
  res: VercelResponseLike,
  adminEmail: string,
  id: string,
) {
  const existing = await getInquiryForAdmin(id);
  if (!existing) {
    res.status(404).json({ ok: false, error: 'Inquiry not found.' });
    return;
  }

  const body = normalizeBody(req.body);
  const status = String(body.status ?? '').trim();
  if (!isInquiryStatus(status)) {
    res.status(400).json({ ok: false, error: 'Invalid status.' });
    return;
  }

  await updateInquiryStatus(id, status);

  await writeAuditLog({
    actorType: 'admin',
    actorEmail: adminEmail,
    action: 'admin_update_inquiry_status',
    targetType: 'inquiry',
    targetId: id,
    metadata: { status, previousStatus: existing.status },
    ipHash: hashIp(getClientIp(req)),
    userAgent: getHeaderValue(req.headers['user-agent']),
  });

  const inquiry = await getInquiryForAdmin(id);
  res.status(200).json({ ok: true, inquiry });
}

async function handleUpdateNotes(
  req: VercelRequestLike,
  res: VercelResponseLike,
  adminEmail: string,
  id: string,
) {
  const existing = await getInquiryForAdmin(id);
  if (!existing) {
    res.status(404).json({ ok: false, error: 'Inquiry not found.' });
    return;
  }

  const body = normalizeBody(req.body);
  const notes = String(body.notes ?? '');

  await updateInquiryInternalNotes(id, notes);

  await writeAuditLog({
    actorType: 'admin',
    actorEmail: adminEmail,
    action: 'admin_update_inquiry_internal_notes',
    targetType: 'inquiry',
    targetId: id,
    ipHash: hashIp(getClientIp(req)),
    userAgent: getHeaderValue(req.headers['user-agent']),
  });

  const inquiry = await getInquiryForAdmin(id);
  res.status(200).json({ ok: true, inquiry });
}

function sanitizeInquiryForList(inquiry: AdminInquiry) {
  return {
    id: inquiry.id,
    type: inquiry.type,
    status: inquiry.status,
    name: inquiry.name,
    email: inquiry.email,
    requested_tour: inquiry.requested_tour,
    requested_destination: inquiry.requested_destination,
    source_path: inquiry.source_path,
    created_at: inquiry.created_at,
    updated_at: inquiry.updated_at,
  };
}

function normalizeBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object') return {};
  return body as Record<string, unknown>;
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
