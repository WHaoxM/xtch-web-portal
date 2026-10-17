import type { SqlClient } from '../../platform/db';
import nodemailer from 'nodemailer';
import { resolveBusinessSegment, type WenshuLeadIntent } from './intent';
import { issueReviewToken, validReviewToken } from './reviewAccess';

export type WenshuLeadForEmail = {
  id: string;
  name: string;
  phone: string;
  company: string;
  company_address: string;
  business_type: string;
  entry: string;
  page_url: string;
  message: string;
  email: string;
  intent: WenshuLeadIntent;
};

const INTENT_LABELS: Record<WenshuLeadIntent, string> = {
  growth_plan: '获取方案', product_demo: '预约体验', custom_consultation: '定制化咨询',
  resource_request: '资料获取', offline_message: '人工客服留言',
};
const SEGMENT_LABELS = {
  travel_agency: '旅行社', ground_operator: '入境游地接', boutique: '精品旅游',
  scenic: '景区/文旅', other: '其他业务',
};

export function renderInternalLeadMail(lead: WenshuLeadForEmail, reviewToken: string) {
  if (!validReviewToken(reviewToken)) throw new Error('Invalid review link token.');
  const intent = INTENT_LABELS[lead.intent] || INTENT_LABELS.growth_plan;
  const segment = SEGMENT_LABELS[resolveBusinessSegment(lead.business_type)];
  const reviewUrl = `https://www.xuntingtravel.com/wenshu/review#review=${reviewToken}`;
  return {
    subject: `【文数智旅·${intent}·${segment}】新客户线索`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.7;color:#17213a"><p>文数智旅收到新线索。请先审核，再向客户邮箱发送正式跟进。仅打开链接不会发信。</p><p><a href="${reviewUrl}" style="display:inline-block;padding:12px 18px;background:#143d82;color:#fff;text-decoration:none;border-radius:6px">免登录审核并发送跟进</a></p><p>回执编号：${lead.id}</p><p>链接 30 天内有效，仅供客服使用，请勿转发。如按钮无法打开，请使用纯文本邮件中的审核链接。</p></div>`,
    text: [
      `文数智旅官网收到「${intent}」线索，请在管理后台审核，并向客户邮箱发送正式跟进邮件。`,
      `回执编号：${lead.id}`,
      `需求类型：${intent}`,
      `业务分类：${segment}`,
      `称呼：${lead.name || '未填写'}`,
      `联系电话：${lead.phone}`,
      `公司：${lead.company || '未填写'}`,
      `公司地址：${lead.company_address}`,
      `业务类型：${lead.business_type || '未填写'}`,
      `来源：${lead.entry || '未填写'}`,
      `页面：${lead.page_url || '未填写'}`,
      `邮箱：${lead.email || '未填写'}`,
      `留言：${lead.message || '未填写'}`,
      `免登录审核链接（打开不会发信，核对后须点击确认发送；30 天有效，请勿转发）：${reviewUrl}`,
    ].join('\n'),
  };
}

export function renderCustomerLeadMail(lead: WenshuLeadForEmail) {
  const english = /^https:\/\/www\.zhilvtravel\.com\/en(?:\/|$)/.test(lead.page_url);
  const segment = resolveBusinessSegment(lead.business_type);
  const focus = {
    travel_agency: english ? 'traveler acquisition and inquiry follow-up' : '客源拓展与询盘承接',
    ground_operator: english ? 'ground operations and resource coordination' : '地接履约与资源协同',
    boutique: english ? 'tailored itineraries and proposal efficiency' : '定制线路与方案效率',
    scenic: english ? 'visitor outreach and destination promotion' : '游客触达与目的地推广',
    other: english ? 'your stated business needs' : '您填写的业务需求',
  }[segment];
  const intro = {
    growth_plan: english ? 'We received your request for a growth plan.' : '我们已收到您的「获取方案」申请。',
    product_demo: english ? 'We received your product demo request.' : '我们已收到您的「预约体验」申请。',
    custom_consultation: english ? 'We received your custom consultation request.' : '我们已收到您的「定制化咨询」申请。',
    resource_request: english ? 'We received your request for more information.' : '我们已收到您的「资料获取」申请。',
    offline_message: english ? 'We received your message.' : '我们已收到您的留言。',
  }[lead.intent] || '我们已收到您的申请。';
  return english ? {
    subject: `[Wenshu Travel] ${({ growth_plan: 'Growth plan', product_demo: 'Product demo', custom_consultation: 'Custom consultation', resource_request: 'Information request', offline_message: 'Message' } as Record<WenshuLeadIntent, string>)[lead.intent] || 'Request'} received`,
    text: `Hello${lead.name ? ` ${lead.name}` : ''},\n\n${intro}\nOur team will review ${focus} for your ${lead.business_type} business and follow up at this email address after review. This is a confirmation, not an attached proposal or a booked appointment.\n\nReceipt: ${lead.id}\nBusiness type: ${lead.business_type}\nPhone: ${lead.phone}\n\nWenshu Travel`,
  } : {
    subject: `【文数智旅】${INTENT_LABELS[lead.intent] || '申请'}已收到`,
    text: `${lead.name || '客户'}，您好：\n\n${intro}\n顾问会结合您填写的业务类型（${lead.business_type}），重点核对${focus}相关需求，审核后通过本邮箱向您发送正式跟进邮件。本邮件仅确认收到申请，不代表方案已发送或体验时间已预约成功。\n\n回执编号：${lead.id}\n联系电话：${lead.phone}\n\n文数智旅团队`,
  };
}

export async function sendWenshuLeadEmail(
  lead: WenshuLeadForEmail,
  reviewToken: string,
  fetchImpl: typeof fetch = fetch,
  env: NodeJS.ProcessEnv = process.env,
  smtpSend: typeof sendWenshuLeadViaSmtp = sendWenshuLeadViaSmtp,
): Promise<'resend' | 'qq-smtp'> {
  const apiKey = env.RESEND_API_KEY;
  const from = env.WENSHU_RESEND_FROM_EMAIL?.trim();
  const to = env.WENSHU_LEAD_TO_EMAIL?.trim();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    throw new Error('Wenshu lead notification is not configured.');
  }

  const { text, subject, html } = renderInternalLeadMail(lead, reviewToken);
  if (apiKey && from) {
    try {
      const response = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from, to: [to], subject, text, html }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error(`Resend HTTP ${response.status}`);
      return 'resend';
    } catch (error) {
      if (!smtpConfigured(env)) throw error;
      console.warn('Wenshu lead Resend delivery failed; using QQ SMTP fallback:', error);
    }
  }
  if (!smtpConfigured(env)) throw new Error('Wenshu lead notification is not configured.');
  await smtpSend({ to, subject, text, html }, env);
  return 'qq-smtp';
}

export async function sendWenshuCustomerEmail(
  lead: WenshuLeadForEmail,
  fetchImpl: typeof fetch = fetch,
  env: NodeJS.ProcessEnv = process.env,
  smtpSend: typeof sendWenshuLeadViaSmtp = sendWenshuLeadViaSmtp,
): Promise<'resend' | 'qq-smtp'> {
  if (!lead.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) throw new Error('Customer email unavailable.');
  const { subject, text } = renderCustomerLeadMail(lead);
  const from = env.WENSHU_RESEND_FROM_EMAIL?.trim();
  if (env.RESEND_API_KEY && from) {
    try {
      const response = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from, to: [lead.email], subject, text }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error(`Resend HTTP ${response.status}`);
      return 'resend';
    } catch (error) {
      if (!smtpConfigured(env)) throw error;
      console.warn('Wenshu customer Resend delivery failed; using QQ SMTP fallback:', error);
    }
  }
  if (!smtpConfigured(env)) throw new Error('Wenshu customer confirmation is not configured.');
  await smtpSend({ to: lead.email, subject, text }, env);
  return 'qq-smtp';
}

type MailContent = { to: string; subject: string; text: string; html?: string; replyTo?: string };

function smtpConfigured(env: NodeJS.ProcessEnv): boolean {
  return Boolean(env.WENSHU_SMTP_USER?.trim() && env.WENSHU_SMTP_APP_PASSWORD?.trim());
}

export async function sendWenshuLeadViaSmtp(
  mail: MailContent,
  env: NodeJS.ProcessEnv = process.env,
  createTransport: typeof nodemailer.createTransport = nodemailer.createTransport,
): Promise<void> {
  const user = env.WENSHU_SMTP_USER?.trim();
  const pass = env.WENSHU_SMTP_APP_PASSWORD?.trim();
  if (!user || !/^\d+@qq\.com$/i.test(user) || !pass) {
    throw new Error('QQ SMTP notification is not configured.');
  }
  const transport = createTransport({
    host: 'smtp.qq.com', port: 465, secure: true,
    auth: { user, pass },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
    tls: { servername: 'smtp.qq.com', minVersion: 'TLSv1.2' },
  });
  try {
    const result = await transport.sendMail({ from: `文数智旅 <${user}>`, ...mail });
    if (!result.accepted?.includes(mail.to)) throw new Error('QQ SMTP did not accept the recipient.');
  } finally {
    transport.close();
  }
}

/** Claim a receipt before sending, preventing concurrent form posts and admin retries from doubling mail. */
export async function deliverWenshuLead(
  sql: SqlClient,
  lead: WenshuLeadForEmail & { notification_sent_at: string | null },
  send: (lead: WenshuLeadForEmail, reviewToken: string) => Promise<'resend' | 'qq-smtp' | void> = sendWenshuLeadEmail,
): Promise<'sent' | 'already-sent' | 'in-progress'> {
  if (lead.notification_sent_at) return 'already-sent';
  const claim = await sql<{ id: string }>`UPDATE wenshu_leads SET notification_claimed_at = NOW()
    WHERE id = ${lead.id}::uuid AND notification_sent_at IS NULL
      AND (notification_claimed_at IS NULL OR notification_claimed_at < NOW() - INTERVAL '2 minutes')
    RETURNING id`;
  if (!claim.rows[0]) return 'in-progress';
  try {
    const provider = await send(lead);
    await sql`UPDATE wenshu_leads SET notification_sent_at = NOW(), notification_attempted_at = NOW(),
      notification_claimed_at = NULL, notification_provider = ${provider || ''},
      notification_last_error = '' WHERE id = ${lead.id}::uuid`;
    return 'sent';
  } catch (error) {
    console.error('Wenshu lead notification failed:', lead.id, error);
    await sql`UPDATE wenshu_leads SET notification_attempted_at = NOW(),
      notification_claimed_at = NULL, notification_last_error = 'Mail delivery not confirmed'
      WHERE id = ${lead.id}::uuid`;
    throw error;
  }
}

/** Independent delivery marker: retrying either mail never resends the other. */
export async function deliverWenshuCustomerConfirmation(
  sql: SqlClient,
  lead: WenshuLeadForEmail & { customer_confirmation_enabled: boolean; customer_confirmation_sent_at: string | null },
  send: (lead: WenshuLeadForEmail) => Promise<'resend' | 'qq-smtp' | void> = sendWenshuCustomerEmail,
): Promise<'sent' | 'already-sent' | 'in-progress' | 'not-required'> {
  if (!lead.customer_confirmation_enabled) return 'not-required';
  if (lead.customer_confirmation_sent_at) return 'already-sent';
  const claim = await sql<{ id: string }>`UPDATE wenshu_leads SET customer_confirmation_claimed_at = NOW()
    WHERE id = ${lead.id}::uuid AND customer_confirmation_enabled = TRUE
      AND customer_confirmation_sent_at IS NULL
      AND (customer_confirmation_claimed_at IS NULL OR customer_confirmation_claimed_at < NOW() - INTERVAL '2 minutes')
    RETURNING id`;
  if (!claim.rows[0]) return 'in-progress';
  try {
    const reviewToken = await issueReviewToken(sql, lead.id);
    const provider = await send(lead, reviewToken);
    await sql`UPDATE wenshu_leads SET customer_confirmation_sent_at = NOW(), customer_confirmation_attempted_at = NOW(),
      customer_confirmation_claimed_at = NULL, customer_confirmation_provider = ${provider || ''},
      customer_confirmation_last_error = '' WHERE id = ${lead.id}::uuid`;
    return 'sent';
  } catch (error) {
    console.error('Wenshu customer confirmation failed:', lead.id, error);
    await sql`UPDATE wenshu_leads SET customer_confirmation_attempted_at = NOW(),
      customer_confirmation_claimed_at = NULL, customer_confirmation_last_error = 'Mail delivery not confirmed'
      WHERE id = ${lead.id}::uuid`;
    throw error;
  }
}
