import type { SqlClient } from '../../platform/db';

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
): Promise<void> {
  const apiKey = env.RESEND_API_KEY;
  const from = env.INQUIRY_FROM_EMAIL;
  const to = env.WENSHU_LEAD_TO_EMAIL?.trim();
  if (!apiKey || !from || !to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
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

  const response = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject: '【文数智旅】新客户线索', text }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Resend rejected Wenshu lead notification (HTTP ${response.status}).`);
}

/** Claim a receipt before sending, preventing concurrent form posts and admin retries from doubling mail. */
export async function deliverWenshuLead(
  sql: SqlClient,
  lead: WenshuLeadForEmail & { notification_sent_at: string | null },
  send: (lead: WenshuLeadForEmail) => Promise<void> = sendWenshuLeadEmail,
): Promise<'sent' | 'already-sent' | 'in-progress'> {
  if (lead.notification_sent_at) return 'already-sent';
  const claim = await sql<{ id: string }>`UPDATE wenshu_leads SET notification_claimed_at = NOW()
    WHERE id = ${lead.id}::uuid AND notification_sent_at IS NULL
      AND (notification_claimed_at IS NULL OR notification_claimed_at < NOW() - INTERVAL '2 minutes')
    RETURNING id`;
  if (!claim.rows[0]) return 'in-progress';
  try {
    await send(lead);
    await sql`UPDATE wenshu_leads SET notification_sent_at = NOW(), notification_attempted_at = NOW(),
      notification_claimed_at = NULL, notification_last_error = '' WHERE id = ${lead.id}::uuid`;
    return 'sent';
  } catch (error) {
    console.error('Wenshu lead notification failed:', lead.id, error);
    await sql`UPDATE wenshu_leads SET notification_attempted_at = NOW(),
      notification_claimed_at = NULL, notification_last_error = 'Mail delivery not confirmed'
      WHERE id = ${lead.id}::uuid`;
    throw error;
  }
}
