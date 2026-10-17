import { sql as database } from '../../platform/db';
import { writeAuditLog } from '../../platform/auditLog';
import { requireAdminAuth } from '../identity/admin/adminAuth';
import { validId } from './contract';
import { headerValue } from '../im/httpTypes';
import { deliverWenshuLead, deliverWenshuCustomerConfirmation, sendWenshuLeadEmail,
  sendWenshuCustomerEmail, type WenshuLeadForEmail } from './notify';
import { deliverWenshuFollowup, readFollowupBody, renderFollowupDraft, sendWenshuFollowupEmail,
  type FollowupMail } from './followup';

type Request = { method?: string; url?: string; headers: Record<string, string | string[] | undefined>; body?: unknown };
type Response = { status: (code: number) => Response; json: (body: unknown) => void; setHeader?: (key: string, value: string) => void };

export function createAdminLeadsHandler(
  sql = database,
  authorize = requireAdminAuth,
  audit = writeAuditLog,
  notify = sendWenshuLeadEmail,
  confirm = sendWenshuCustomerEmail,
  sendFollowup = sendWenshuFollowupEmail,
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
        const action = params.get('action');
        if (action === 'send-follow-up') {
          if (!id || !validId(id)) { res.status(400).json({ ok: false, error: 'Invalid lead id.' }); return; }
          const requestId = headerValue(req.headers['idempotency-key']) || '';
          let draft: { subject: string; body: string };
          try {
            if (!validId(requestId)) throw new Error('Invalid request id.');
            draft = readFollowupBody(req.body);
          } catch { res.status(400).json({ ok: false, error: 'Check the subject and email body.' }); return; }
          const leadResult = await sql<WenshuLeadForEmail>`SELECT id, name, phone, company, company_address,
            business_type, entry, page_url, message, email, intent FROM wenshu_leads WHERE id = ${id}::uuid`;
          const lead = leadResult.rows[0];
          if (!lead) { res.status(404).json({ ok: false, error: 'Lead not found.' }); return; }
          if (!lead.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) {
            res.status(409).json({ ok: false, error: 'Customer email unavailable.' }); return;
          }
          await sql`INSERT INTO wenshu_lead_followups
            (lead_id, request_id, recipient_email, subject, body, requested_by)
            VALUES (${id}::uuid, ${requestId}::uuid, ${lead.email}, ${draft.subject}, ${draft.body}, ${admin.email})
            ON CONFLICT (request_id) DO NOTHING`;
          const savedResult = await sql<FollowupMail>`SELECT id, lead_id, recipient_email, subject, body, sent_at
            FROM wenshu_lead_followups WHERE request_id = ${requestId}::uuid`;
          const saved = savedResult.rows[0];
          if (!saved) throw new Error('Follow-up receipt missing.');
          if (saved.lead_id.toLowerCase() !== id.toLowerCase() || saved.recipient_email !== lead.email ||
              saved.subject !== draft.subject || saved.body !== draft.body) {
            res.status(409).json({ ok: false, error: 'Request ID already belongs to another email.' }); return;
          }
          await audit({ actorType: 'admin', actorEmail: admin.email,
            action: 'admin_wenshu_customer_followup_send', targetType: 'wenshu_lead', targetId: id });
          try {
            const state = await deliverWenshuFollowup(sql, saved, sendFollowup);
            if (state === 'in-progress') {
              res.status(409).json({ ok: false, id: saved.id, error: 'Follow-up is in progress. Retry with the same request ID shortly.' }); return;
            }
          } catch {
            res.status(503).json({ ok: false, id: saved.id, error: 'Follow-up saved, but delivery not confirmed. Retry with the same request ID.' }); return;
          }
          res.status(201).json({ ok: true, id: saved.id, recipientEmail: saved.recipient_email });
          return;
        }
        if (!['retry-notification', 'retry-customer-confirmation'].includes(action || '') || !id || !validId(id)) {
          res.status(400).json({ ok: false, error: 'Invalid notification retry.' }); return;
        }
        const result = await sql<WenshuLeadForEmail & { notification_sent_at: string | null;
          customer_confirmation_enabled: boolean; customer_confirmation_sent_at: string | null }>`SELECT
          id, name, phone, company, company_address, business_type, entry, page_url,
          message, email, intent, notification_sent_at, customer_confirmation_enabled,
          customer_confirmation_sent_at FROM wenshu_leads WHERE id = ${id}::uuid`;
        const lead = result.rows[0];
        if (!lead) { res.status(404).json({ ok: false, error: 'Lead not found.' }); return; }
        await audit({ actorType: 'admin', actorEmail: admin.email,
          action: action === 'retry-notification' ? 'admin_wenshu_lead_notification_retry' : 'admin_wenshu_customer_confirmation_retry',
          targetType: 'wenshu_lead', targetId: id });
        if (action === 'retry-customer-confirmation' && !lead.customer_confirmation_enabled) {
          res.status(409).json({ ok: false, error: 'Customer confirmation was not requested.' }); return;
        }
        const state = action === 'retry-notification' ? await deliverWenshuLead(sql, lead, notify)
          : await deliverWenshuCustomerConfirmation(sql, lead, confirm);
        if (state === 'in-progress') {
          res.status(409).json({ ok: false, error: 'Notification already in progress.' }); return;
        }
        res.status(200).json({ ok: true, id, notificationSent: action === 'retry-notification',
          customerConfirmationSent: action === 'retry-customer-confirmation' });
        return;
      }
      if (id) {
        if (!validId(id)) { res.status(400).json({ ok: false, error: 'Invalid lead id.' }); return; }
        const result = await sql<WenshuLeadForEmail & Record<string, unknown>>`SELECT id, name, phone, company, company_address, business_type,
          entry, page_url, message, email, intent, status, created_at, notification_sent_at,
          notification_attempted_at, notification_provider, notification_last_error,
          customer_confirmation_enabled, customer_confirmation_sent_at, customer_confirmation_attempted_at,
          customer_confirmation_provider, customer_confirmation_last_error
          FROM wenshu_leads WHERE id = ${id}::uuid`;
        const lead = result.rows[0];
        if (!lead) { res.status(404).json({ ok: false, error: 'Lead not found.' }); return; }
        await audit({ actorType: 'admin', actorEmail: admin.email,
          action: 'admin_wenshu_lead_detail_view', targetType: 'wenshu_lead', targetId: id });
        const followups = await sql`SELECT id, recipient_email, subject, requested_by, created_at,
          sent_at, attempted_at, provider, last_error FROM wenshu_lead_followups
          WHERE lead_id = ${id}::uuid ORDER BY created_at DESC LIMIT 20`;
        res.status(200).json({ ok: true, lead, followups: followups.rows, followupDraft: renderFollowupDraft(lead) });
        return;
      }
      const limit = Number(params.get('limit') || '50');
      const offset = Number(params.get('offset') || '0');
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 ||
          !Number.isSafeInteger(offset) || offset < 0) {
        res.status(400).json({ ok: false, error: 'Invalid pagination.' }); return;
      }
      const result = await sql`SELECT id, name, company, entry, intent, business_type, status, created_at,
        notification_sent_at, notification_attempted_at, notification_provider,
        customer_confirmation_enabled, customer_confirmation_sent_at, customer_confirmation_attempted_at,
        customer_confirmation_provider,
        (SELECT MAX(sent_at) FROM wenshu_lead_followups WHERE lead_id = wenshu_leads.id) AS followup_sent_at
        FROM wenshu_leads ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
      res.status(200).json({ ok: true, leads: result.rows });
    } catch (error) {
      console.error('Admin Wenshu leads API failed:', error);
      res.status(503).json({ ok: false, error: 'Lead inbox unavailable.' });
    }
  };
}

export default createAdminLeadsHandler();
