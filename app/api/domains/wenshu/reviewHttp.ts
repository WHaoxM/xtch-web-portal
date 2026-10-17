import { sql as database } from '../../platform/db';
import { writeAuditLog } from '../../platform/auditLog';
import { headerValue } from '../im/httpTypes';
import { deliverWenshuFollowup, readFollowupBody, renderFollowupDraft,
  sendWenshuFollowupEmail, type FollowupMail } from './followup';
import type { WenshuLeadForEmail } from './notify';
import { reviewTokenHash, validReviewToken } from './reviewAccess';

type Request = { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown };
type Response = { status: (code: number) => Response; json: (body: unknown) => void;
  setHeader?: (key: string, value: string) => void };
type ReviewRow = WenshuLeadForEmail & { review_id: string };

/** Possession of the 256-bit, 30-day mail link grants only review and one customer follow-up. */
export function createWenshuReviewHandler(
  sql = database,
  send = sendWenshuFollowupEmail,
  audit = writeAuditLog,
) {
  return async function handler(req: Request, res: Response) {
    res.setHeader?.('Cache-Control', 'no-store');
    res.setHeader?.('Referrer-Policy', 'no-referrer');
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'Unsupported operation.' }); return;
    }
    const token = headerValue(req.headers['x-wenshu-review-token']) || '';
    if (!validReviewToken(token)) {
      res.status(410).json({ ok: false, error: 'This review link is invalid or expired.' }); return;
    }
    try {
      const match = await sql<ReviewRow>`SELECT r.id AS review_id, l.id, l.name, l.phone, l.company,
        l.company_address, l.business_type, l.entry, l.page_url, l.message, l.email, l.intent
        FROM wenshu_lead_review_links r JOIN wenshu_leads l ON l.id = r.lead_id
        WHERE r.token_hash = ${reviewTokenHash(token)} AND r.expires_at > NOW()
          AND r.consumed_at IS NULL`;
      const lead = match.rows[0];
      if (!lead) {
        res.status(410).json({ ok: false, error: 'This review link is invalid, expired or already used.' }); return;
      }
      const earlier = await sql<{ id: string }>`SELECT id FROM wenshu_lead_followups
        WHERE lead_id = ${lead.id}::uuid AND sent_at IS NOT NULL LIMIT 1`;
      if (earlier.rows[0]) {
        res.status(409).json({ ok: false, error: 'A customer follow-up has already been sent for this request.' }); return;
      }
      const prior = await sql<FollowupMail>`SELECT id, lead_id, recipient_email, subject, body, sent_at
        FROM wenshu_lead_followups WHERE request_id = ${lead.review_id}::uuid`;
      const saved = prior.rows[0];
      if (req.method === 'GET') {
        res.status(200).json({ ok: true,
          lead: { id: lead.id, name: lead.name, company: lead.company, businessType: lead.business_type,
            intent: lead.intent, message: lead.message, email: lead.email },
          draft: saved ? { subject: saved.subject, body: saved.body } : renderFollowupDraft(lead),
          draftLocked: Boolean(saved),
        });
        return;
      }
      if (!lead.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) {
        res.status(409).json({ ok: false, error: 'Customer email unavailable.' }); return;
      }
      let draft: { subject: string; body: string };
      try { draft = readFollowupBody(req.body); }
      catch { res.status(400).json({ ok: false, error: 'Check the subject and email body.' }); return; }
      await sql`INSERT INTO wenshu_lead_followups
        (lead_id, request_id, recipient_email, subject, body, requested_by)
        VALUES (${lead.id}::uuid, ${lead.review_id}::uuid, ${lead.email}, ${draft.subject}, ${draft.body},
          ${process.env.WENSHU_LEAD_TO_EMAIL?.trim() || 'mail-review-link'})
        ON CONFLICT (request_id) DO NOTHING`;
      const stored = await sql<FollowupMail>`SELECT id, lead_id, recipient_email, subject, body, sent_at
        FROM wenshu_lead_followups WHERE request_id = ${lead.review_id}::uuid`;
      const mail = stored.rows[0];
      if (!mail || mail.lead_id !== lead.id || mail.recipient_email !== lead.email ||
          mail.subject !== draft.subject || mail.body !== draft.body) {
        res.status(409).json({ ok: false, error: 'This link is already bound to another email draft.' }); return;
      }
      await audit({ actorType: 'system', action: 'wenshu_customer_followup_mail_link_send',
        targetType: 'wenshu_lead', targetId: lead.id, metadata: { reviewId: lead.review_id } });
      try {
        const state = await deliverWenshuFollowup(sql, mail, send);
        if (state === 'in-progress') {
          res.status(409).json({ ok: false, error: 'The email is being sent. Please wait before retrying.' }); return;
        }
      } catch {
        res.status(503).json({ ok: false, error: 'Delivery not confirmed. Use this same link to retry without editing.' }); return;
      }
      await sql`UPDATE wenshu_lead_review_links SET consumed_at = NOW()
        WHERE lead_id = ${lead.id}::uuid AND consumed_at IS NULL`;
      res.status(201).json({ ok: true, recipientEmail: mail.recipient_email });
    } catch (error) {
      console.error('Wenshu review link API failed:', error);
      res.status(503).json({ ok: false, error: 'Review service temporarily unavailable.' });
    }
  };
}

export default createWenshuReviewHandler();
