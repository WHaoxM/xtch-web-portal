import type { SqlClient } from '../../platform/db';
import { resolveBusinessSegment } from './intent';
import { sendWenshuLeadViaSmtp, type WenshuLeadForEmail } from './notify';

export type FollowupMail = {
  id: string;
  lead_id: string;
  recipient_email: string;
  subject: string;
  body: string;
  sent_at: string | null;
};

export function readFollowupBody(value: unknown): { subject: string; body: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid email draft.');
  const raw = value as Record<string, unknown>;
  if (typeof raw.subject !== 'string' || typeof raw.body !== 'string') throw new Error('Invalid email draft.');
  const subject = raw.subject.trim();
  const body = raw.body.trim();
  if (!subject || subject.length > 160 || [...subject].some(char => char.charCodeAt(0) < 32) ||
      !body || body.length > 5000) {
    throw new Error('Invalid email draft.');
  }
  return { subject, body };
}

/** A reviewed, editable starting point. No follow-up is sent on lead submission. */
export function renderFollowupDraft(lead: WenshuLeadForEmail) {
  const english = /^https:\/\/www\.zhilvtravel\.com\/en(?:\/|$)/.test(lead.page_url);
  const intent = {
    growth_plan: english ? 'growth plan' : '增长方案',
    product_demo: english ? 'product experience' : '产品体验',
    custom_consultation: english ? 'custom consultation' : '定制化咨询',
    resource_request: english ? 'information request' : '资料需求',
    offline_message: english ? 'support message' : '客服留言',
  }[lead.intent] || (english ? 'request' : '咨询');
  const focus = {
    travel_agency: english ? 'traveler acquisition and inquiry follow-up' : '客源拓展与询盘承接',
    ground_operator: english ? 'ground operations and resource coordination' : '地接履约与资源协同',
    boutique: english ? 'tailored itineraries and proposal efficiency' : '定制线路与方案效率',
    scenic: english ? 'visitor outreach and destination promotion' : '游客触达与目的地推广',
    other: english ? 'your business needs' : '您的业务需求',
  }[resolveBusinessSegment(lead.business_type || '')];
  const next = {
    growth_plan: english ? 'Please reply with your target markets, key routes and current acquisition goals.' : '欢迎直接回复本邮件，补充目标客源国、主推线路和当前获客目标。',
    product_demo: english ? 'Please reply with the features you would like to experience and two suitable time slots, including your time zone.' : '欢迎直接回复本邮件，告诉我们希望体验的功能，以及两个方便的日期和时段。',
    custom_consultation: english ? 'Please reply with your business goals, current workflow and any integration requirements.' : '欢迎直接回复本邮件，补充业务目标、现有流程和需要对接的系统。',
    resource_request: english ? 'Please reply with the topics or materials you need most.' : '欢迎直接回复本邮件，说明您最关注的资料主题。',
    offline_message: english ? 'Please reply with any details that would help us address your question.' : '欢迎直接回复本邮件，补充有助于解答问题的细节。',
  }[lead.intent] || '';
  return english ? {
    subject: `[Wenshu Travel] Following up on your ${intent}`,
    body: `Hello${lead.name ? ` ${lead.name}` : ''},\n\nThank you for contacting Wenshu Travel about your ${intent}. We have reviewed your ${lead.business_type || 'business'} request and would like to discuss ${focus}.\n\n${next}\n\nThis email is a follow-up, not a confirmed booking or an attached proposal.\n\nReceipt: ${lead.id}\nWenshu Travel`,
  } : {
    subject: `【文数智旅】跟进您的${intent}需求`,
    body: `${lead.name || '客户'}，您好：\n\n感谢您联系文数智旅。我们已查看您提交的${intent}需求，希望进一步沟通${focus}。\n\n${next}\n\n如需安排具体体验时间或交付方案，我们会与您另行确认。\n\n回执编号：${lead.id}\n文数智旅团队`,
  };
}

export async function sendWenshuFollowupEmail(
  mail: FollowupMail,
  env: NodeJS.ProcessEnv = process.env,
  smtpSend: typeof sendWenshuLeadViaSmtp = sendWenshuLeadViaSmtp,
): Promise<'qq-smtp'> {
  const replyTo = env.WENSHU_LEAD_TO_EMAIL?.trim();
  if (!replyTo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo)) throw new Error('Wenshu follow-up reply address is not configured.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail.recipient_email)) throw new Error('Customer email unavailable.');
  await smtpSend({ to: mail.recipient_email, replyTo, subject: mail.subject, text: mail.body }, env);
  return 'qq-smtp';
}

export async function deliverWenshuFollowup(
  sql: SqlClient,
  mail: FollowupMail,
  send: (mail: FollowupMail) => Promise<'qq-smtp' | void> = sendWenshuFollowupEmail,
): Promise<'sent' | 'already-sent' | 'in-progress'> {
  if (mail.sent_at) return 'already-sent';
  const claim = await sql<{ id: string }>`UPDATE wenshu_lead_followups SET claimed_at = NOW()
    WHERE id = ${mail.id}::uuid AND sent_at IS NULL
      AND (claimed_at IS NULL OR claimed_at < NOW() - INTERVAL '2 minutes') RETURNING id`;
  if (!claim.rows[0]) return 'in-progress';
  try {
    const provider = await send(mail);
    await sql`UPDATE wenshu_lead_followups SET sent_at = NOW(), attempted_at = NOW(),
      claimed_at = NULL, provider = ${provider || ''}, last_error = '' WHERE id = ${mail.id}::uuid`;
    return 'sent';
  } catch (error) {
    console.error('Wenshu customer follow-up failed:', mail.id, error);
    await sql`UPDATE wenshu_lead_followups SET attempted_at = NOW(), claimed_at = NULL,
      last_error = 'Mail delivery not confirmed' WHERE id = ${mail.id}::uuid`;
    throw error;
  }
}
