import { sql as database } from '../../platform/db';
import { writeAuditLog } from '../../platform/auditLog';
import { requireAdminAuth } from '../identity/admin/adminAuth';
import { validId } from './contract';
import { deliverWenshuLead, sendWenshuLeadEmail, type WenshuLeadForEmail } from './notify';

type Request = { method?: string; url?: string; headers: Record<string, string | string[] | undefined> };
type Response = { status: (code: number) => Response; json: (body: unknown) => void; setHeader?: (key: string, value: string) => void };

export function createAdminLeadsHandler(
  sql = database,
  authorize = requireAdminAuth,
  audit = writeAuditLog,
  notify = sendWenshuLeadEmail,
) {
  return async function handler(req: Request, res: Response) {
    res.setHeader?.('Cache-Control', 'no-store');
    const admin = await authorize(req);
    if (!admin.ok) { res.status(admin.status).json({ ok: false, error: admin.error }); return; }
    if (req.method !== 'GET' && req.method !== 'POST') { res.status(405).json({ ok: false, error: 'Method not allowed.' }); return; }
    const params = new URL(req.url || '/', 'https://localhost').searchParams;
    const id = params.get('id');
    try {
      if (req.method === 'POST') {
        if (params.get('action') !== 'retry-notification' || !id || !validId(id)) {
          res.status(400).json({ ok: false, error: 'Invalid notification retry.' }); return;
        }
        const result = await sql<WenshuLeadForEmail & { notification_sent_at: string | null }>`SELECT
          id, name, phone, company, company_address, business_type, entry, page_url,
          message, email, notification_sent_at FROM wenshu_leads WHERE id = ${id}::uuid`;
        const lead = result.rows[0];
        if (!lead) { res.status(404).json({ ok: false, error: 'Lead not found.' }); return; }
        await audit({ actorType: 'admin', actorEmail: admin.email,
          action: 'admin_wenshu_lead_notification_retry', targetType: 'wenshu_lead', targetId: id });
        const state = await deliverWenshuLead(sql, lead, notify);
        if (state === 'in-progress') {
          res.status(409).json({ ok: false, error: 'Notification already in progress.' }); return;
        }
        res.status(200).json({ ok: true, id, notificationSent: true });
        return;
      }
      if (id) {
        if (!validId(id)) { res.status(400).json({ ok: false, error: 'Invalid lead id.' }); return; }
        const result = await sql`SELECT id, name, phone, company, company_address, business_type,
          entry, page_url, message, email, status, created_at, notification_sent_at,
          notification_attempted_at, notification_provider, notification_last_error
          FROM wenshu_leads WHERE id = ${id}::uuid`;
        const lead = result.rows[0];
        if (!lead) { res.status(404).json({ ok: false, error: 'Lead not found.' }); return; }
        await audit({ actorType: 'admin', actorEmail: admin.email,
          action: 'admin_wenshu_lead_detail_view', targetType: 'wenshu_lead', targetId: id });
        res.status(200).json({ ok: true, lead });
        return;
      }
      const limit = Number(params.get('limit') || '50');
      const offset = Number(params.get('offset') || '0');
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 ||
          !Number.isSafeInteger(offset) || offset < 0) {
        res.status(400).json({ ok: false, error: 'Invalid pagination.' }); return;
      }
      const result = await sql`SELECT id, name, company, entry, status, created_at,
        notification_sent_at, notification_attempted_at, notification_provider
        FROM wenshu_leads ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
      res.status(200).json({ ok: true, leads: result.rows });
    } catch (error) {
      console.error('Admin Wenshu leads API failed:', error);
      res.status(503).json({ ok: false, error: 'Lead inbox unavailable.' });
    }
  };
}

export default createAdminLeadsHandler();
