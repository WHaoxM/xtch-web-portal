import crypto from 'node:crypto';
import { sql as database } from '../../platform/db';
import publicMessages from '../im/http/publicMessages';
import { VISITOR_COOKIE_NAME } from '../im/visitorAuth';
import { hashToken } from '../im/imAuth';
import { getClientIp, headerValue, type ImRequest, type ImResponse } from '../im/httpTypes';
import { ChatAttachmentError, createChatAttachmentTicket, listChatAttachmentDownloadUrls } from '../im/imChatAttachments';
import { resolveRequestOrigin } from '../../platform/publicOrigin';
import { allowedOrigin, readLead, validId, validSessionToken } from './contract';
import { deliverWenshuLead, deliverWenshuCustomerConfirmation, sendWenshuLeadEmail,
  sendWenshuCustomerEmail, type WenshuLeadForEmail } from './notify';

// Dedicated cross-site visitor transport. Never accepts staff/portal credentials or cookies.
export function createHandler(sql = database, messages = publicMessages, notify = sendWenshuLeadEmail,
  confirm = sendWenshuCustomerEmail) {
return async function handler(req: ImRequest, res: ImResponse) {
  const origin = headerValue(req.headers.origin);
  res.setHeader?.('Vary', 'Origin');
  res.setHeader?.('Cache-Control', 'no-store');
  if (!allowedOrigin(origin)) { res.status(403).json({ ok: false, error: 'Origin not allowed.' }); return; }
  res.setHeader?.('Access-Control-Allow-Origin', origin!);
  res.setHeader?.('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader?.('Access-Control-Allow-Headers', 'Content-Type, X-Wenshu-Session, Idempotency-Key');
  if (req.method === 'OPTIONS') { res.status(200).json({ ok: true }); return; }
  const params = new URL(req.url || '/', 'https://localhost').searchParams;
  const action = params.get('action');
  if (!['session', 'messages', 'lead', 'media-upload', 'media-links'].includes(action || '') ||
      (req.method !== 'POST' && !(action === 'messages' && req.method === 'GET'))) {
    res.status(405).json({ ok: false, error: 'Unsupported operation.' }); return;
  }
  try {
    const bucket = hashToken(`${getClientIp(req)}:${action}`);
    const limit = action === 'messages' || action === 'media-links' ? 120 : action === 'media-upload' ? 30 : 10;
    const rate = await sql<{ count: number }>`INSERT INTO wenshu_request_limits (bucket, window_start, count)
      VALUES (${bucket}, NOW(), 1) ON CONFLICT (bucket) DO UPDATE SET
      count = CASE WHEN wenshu_request_limits.window_start < NOW() - INTERVAL '1 minute' THEN 1 ELSE wenshu_request_limits.count + 1 END,
      window_start = CASE WHEN wenshu_request_limits.window_start < NOW() - INTERVAL '1 minute' THEN NOW() ELSE wenshu_request_limits.window_start END
      RETURNING count`;
    if (Number(rate.rows[0]?.count) > limit) { res.status(429).json({ ok: false, error: 'Please try again later.' }); return; }
    if (action === 'lead') { await saveLead(req, res); return; }
    const token = headerValue(req.headers['x-wenshu-session']) || '';
    if (action === 'session' && !token) { await createSession(req, res); return; }
    if (!validSessionToken(token)) { res.status(401).json({ ok: false, error: 'Session required.' }); return; }
    const rows = await sql<{ id: string; session_id: string }>`SELECT c.id, s.id AS session_id FROM im_visitor_sessions s
      JOIN im_conversation_identities i ON i.identity_type = 'visitor_session' AND i.identity_subject = s.id::text
      JOIN im_conversations c ON c.id = i.conversation_id
      WHERE s.session_token_hash = ${hashToken(token)} AND s.revoked_at IS NULL AND s.expires_at > NOW()
      AND i.revoked_at IS NULL AND c.source = 'wenshuzhilv' ORDER BY c.created_at DESC LIMIT 1`;
    const conversation = rows.rows[0];
    if (!conversation) { res.status(401).json({ ok: false, error: 'Session expired.' }); return; }
    if (action === 'session') { res.status(200).json({ ok: true, conversation: { id: conversation.id } }); return; }
    if (params.get('conversation') !== conversation.id) { res.status(403).json({ ok: false, error: 'Conversation unavailable.' }); return; }
    if (action === 'media-upload') {
      const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? req.body as Record<string, unknown> : {};
      const ticket = await createChatAttachmentTicket({
        db: sql,
        conversationId: conversation.id,
        actor: { type: 'visitor', id: rows.rows[0].session_id },
        clientUploadId: headerValue(req.headers['idempotency-key']) || stringValue(body.clientUploadId),
        file: body.file,
        requestOrigin: resolveRequestOrigin(req),
      });
      res.status(200).json({ ok: true, ticket });
      return;
    }
    if (action === 'media-links') {
      const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? req.body as Record<string, unknown> : {};
      const ids = Array.isArray(body.attachmentIds)
        ? body.attachmentIds.filter((value): value is string => typeof value === 'string').slice(0, 50)
        : [];
      if (!ids.length || ids.some((id) => !isUuid(id))) { res.status(400).json({ ok: false, error: 'Select valid attachments.' }); return; }
      const urls = await listChatAttachmentDownloadUrls({
        db: sql,
        conversationId: conversation.id,
        attachmentIds: ids,
        requestOrigin: resolveRequestOrigin(req),
      });
      res.status(200).json({ ok: true, urls });
      return;
    }
    const seq = Number(params.get('after_seq') || 0);
    if (!Number.isSafeInteger(seq) || seq < 0) { res.status(400).json({ ok: false, error: 'Invalid cursor.' }); return; }
    await messages({ ...req,
      headers: { 'cookie': `${VISITOR_COOKIE_NAME}=${token}`, 'idempotency-key': headerValue(req.headers['idempotency-key']) },
      url: `/api/im/public/conversations/${conversation.id}/messages?after_seq=${seq}&limit=200`,
    }, res);
  } catch (error) {
    if (error instanceof ChatAttachmentError) {
      res.status(error.status).json({ ok: false, error: error.message });
      return;
    }
    res.status(503).json({ ok: false, error: 'Service temporarily unavailable. Please call our consultant.' });
  }
}
;
function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
}

async function saveLead(req: ImRequest, res: ImResponse) {
  let lead: ReturnType<typeof readLead>;
  const requestId = headerValue(req.headers['idempotency-key']) || '';
  try { lead = readLead(req.body); if (!validId(requestId)) throw new Error('Invalid request ID.'); }
  catch { res.status(400).json({ ok: false, error: 'Please check your phone, email, business type and company address.' }); return; }
  const result = await sql<WenshuLeadForEmail & { notification_sent_at: string | null;
    customer_confirmation_enabled: boolean; customer_confirmation_sent_at: string | null }>`INSERT INTO wenshu_leads
    (request_id, name, phone, company, company_address, business_type, entry, page_url, message, email,
      intent, customer_confirmation_enabled)
    VALUES (${requestId}::uuid, ${lead.name}, ${lead.phone}, ${lead.company}, ${lead.companyAddress},
      ${lead.businessType}, ${lead.entry}, ${lead.pageUrl}, ${lead.message}, ${lead.email},
      ${lead.intent}, ${lead.customerConfirmationEnabled})
    ON CONFLICT (request_id) DO UPDATE SET request_id = EXCLUDED.request_id
    RETURNING id, name, phone, company, company_address, business_type, entry, page_url,
      message, email, intent, notification_sent_at, customer_confirmation_enabled, customer_confirmation_sent_at`;
  const stored = result.rows[0];
  if (!stored) throw new Error('Wenshu lead receipt missing.');
  if (!stored.notification_sent_at) {
    try {
      const state = await deliverWenshuLead(sql, stored, notify);
      if (state === 'in-progress') {
        res.status(503).json({ ok: false, id: stored.id, error: 'Lead saved; notification is in progress. Please retry shortly.' });
        return;
      }
    } catch {
      res.status(503).json({ ok: false, id: stored.id, error: 'Lead saved, but notification not confirmed. Please retry.' });
      return;
    }
  }
  if (stored.customer_confirmation_enabled && !stored.customer_confirmation_sent_at) {
    try {
      const state = await deliverWenshuCustomerConfirmation(sql, stored, confirm);
      if (state === 'in-progress') {
        res.status(503).json({ ok: false, id: stored.id, error: 'Lead saved; customer confirmation is in progress. Please retry shortly.' });
        return;
      }
    } catch {
      res.status(503).json({ ok: false, id: stored.id, error: 'Lead saved, but customer confirmation not confirmed. Please retry.' });
      return;
    }
  }
  res.status(201).json({ ok: true, id: stored.id });
}

async function createSession(req: ImRequest, res: ImResponse) {
  const token = `ws_${crypto.randomBytes(32).toString('hex')}`;
  const conversation = await sql.begin(async tx => {
    const v = await tx<{ id: string }>`INSERT INTO im_visitors (display_name) VALUES ('文数智旅访客') RETURNING id`;
    const s = await tx<{ id: string }>`INSERT INTO im_visitor_sessions
      (visitor_id, session_token_hash, expires_at, ip_hash, user_agent_hash)
      VALUES (${v.rows[0].id}::uuid, ${hashToken(token)}, NOW() + INTERVAL '1 day',
        ${hashToken(getClientIp(req))}, ${hashToken(headerValue(req.headers['user-agent']) || '')}) RETURNING id`;
    const c = await tx<{ id: string }>`INSERT INTO im_conversations (visitor_id, source)
      VALUES (${v.rows[0].id}::uuid, 'wenshuzhilv') RETURNING id`;
    const id = c.rows[0].id; const session = s.rows[0].id;
    await tx`INSERT INTO im_conversation_identities (conversation_id, identity_type, identity_subject, assurance, is_primary)
      VALUES (${id}::uuid, 'visitor_session', ${session}, 'anonymous', true)`;
    await tx`INSERT INTO im_conversation_members (conversation_id, principal_type, principal_id, identity_assurance, member_role)
      VALUES (${id}::uuid, 'visitor', ${session}, 'anonymous', 'customer')`;
    await tx`INSERT INTO im_audit_events (actor_type, actor_id, action, conversation_id, target_type, target_id)
      VALUES ('visitor', ${session}, 'conversation.created', ${id}::uuid, 'conversation', ${id})`;
    return { id };
  });
  res.status(201).json({ ok: true, token, conversation });
}

}
export default createHandler();
