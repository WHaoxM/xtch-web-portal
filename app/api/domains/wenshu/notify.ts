import type { SqlClient } from '../../platform/db';
import nodemailer from 'nodemailer';

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
};

export async function sendWenshuLeadEmail(
  lead: WenshuLeadForEmail,
  fetchImpl: typeof fetch = fetch,
  env: NodeJS.ProcessEnv = process.env,
  smtpSend: typeof sendWenshuLeadViaSmtp = sendWenshuLeadViaSmtp,
): Promise<'resend' | 'qq-smtp'> {
  const apiKey = env.RESEND_API_KEY;
  const from = env.WENSHU_RESEND_FROM_EMAIL || env.INQUIRY_FROM_EMAIL;
  const to = env.WENSHU_LEAD_TO_EMAIL?.trim();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    throw new Error('Wenshu lead notification is not configured.');
  }

  const text = [
    '文数智旅官网收到新线索，请在管理后台核对并跟进。',
    `回执编号：${lead.id}`,
    `称呼：${lead.name || '未填写'}`,
    `联系电话：${lead.phone}`,
    `公司：${lead.company || '未填写'}`,
    `公司地址：${lead.company_address}`,
    `业务类型：${lead.business_type || '未填写'}`,
    `来源：${lead.entry || '未填写'}`,
    `页面：${lead.page_url || '未填写'}`,
    `邮箱：${lead.email || '未填写'}`,
    `留言：${lead.message || '未填写'}`,
    '管理入口：https://admin.xuntingtravel.com/admin',
  ].join('\n');

  const subject = '【文数智旅】新客户线索';
  if (apiKey && from) {
    try {
      const response = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from, to: [to], subject, text }),
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
  await smtpSend({ to, subject, text }, env);
  return 'qq-smtp';
}

type MailContent = { to: string; subject: string; text: string };

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
  send: (lead: WenshuLeadForEmail) => Promise<'resend' | 'qq-smtp' | void> = sendWenshuLeadEmail,
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
