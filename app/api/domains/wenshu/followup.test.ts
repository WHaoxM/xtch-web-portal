import test from 'node:test';
import assert from 'node:assert/strict';
import type { sql } from '../../platform/db';
import { deliverWenshuFollowup, readFollowupBody, renderFollowupDraft,
  sendWenshuFollowupEmail, type FollowupMail } from './followup';
import type { WenshuLeadForEmail } from './notify';

const lead: WenshuLeadForEmail = {
  id: '00000000-0000-4000-8000-000000000021', name: '客户', phone: '13800000000',
  company: '公司', company_address: '成都', business_type: '国际旅行社', entry: 'hero',
  page_url: 'https://www.zhilvtravel.com/', message: '', email: 'buyer@example.com', intent: 'growth_plan',
};

test('follow-up draft differs by intent and segment; sales may edit before sending', () => {
  const plan = renderFollowupDraft(lead);
  const demo = renderFollowupDraft({ ...lead, intent: 'product_demo' });
  const custom = renderFollowupDraft({ ...lead, intent: 'custom_consultation', business_type: '入境游地接社' });
  assert.match(plan.body, /客源拓展/);
  assert.match(demo.body, /体验的功能/);
  assert.match(custom.body, /现有流程/);
  assert.match(custom.body, /地接履约/);
  assert.notEqual(plan.subject, demo.subject);
  const english = renderFollowupDraft({ ...lead, intent: 'product_demo',
    page_url: 'https://www.zhilvtravel.com/en/index.html' });
  assert.match(english.body, /time slots/);
});

test('follow-up draft validates plain-text subject and body', () => {
  assert.deepEqual(readFollowupBody({ subject: '  Hello ', body: ' Message ' }), { subject: 'Hello', body: 'Message' });
  assert.throws(() => readFollowupBody({ subject: 'Hello\nBcc: buyer@example.com', body: 'x' }));
  assert.throws(() => readFollowupBody({ subject: '', body: 'x' }));
  assert.throws(() => readFollowupBody({ subject: 'x', body: 'x'.repeat(5001) }));
});

test('formal follow-up recipient is customer; replies route to internal sales inbox', async () => {
  const mail: FollowupMail = { id: lead.id, lead_id: lead.id, recipient_email: lead.email,
    subject: '跟进方案', body: '您好', sent_at: null };
  let sentTo = '', replyTo = '';
  const provider = await sendWenshuFollowupEmail(mail, { WENSHU_LEAD_TO_EMAIL: 'sales@example.com' },
    async content => { sentTo = content.to; replyTo = content.replyTo || ''; });
  assert.equal(provider, 'qq-smtp');
  assert.equal(sentTo, 'buyer@example.com');
  assert.equal(replyTo, 'sales@example.com');
  await assert.rejects(sendWenshuFollowupEmail(mail, {}, async () => {}), /reply address/);
});

test('claimed follow-up is sent once and remains retryable after failure', async () => {
  const mail: FollowupMail = { id: lead.id, lead_id: lead.id, recipient_email: lead.email,
    subject: '跟进方案', body: '您好', sent_at: null };
  let sends = 0;
  const db = (async (parts: TemplateStringsArray) => {
    const statement = parts.join('');
    if (statement.includes('RETURNING id')) return { rows: [{ id: mail.id }] };
    if (statement.includes('SET sent_at = NOW()')) mail.sent_at = new Date().toISOString();
    return { rows: [] };
  }) as unknown as typeof sql;
  assert.equal(await deliverWenshuFollowup(db, mail, async () => { sends += 1; }), 'sent');
  assert.equal(await deliverWenshuFollowup(db, mail, async () => { sends += 1; }), 'already-sent');
  assert.equal(sends, 1);
  const failed = { ...mail, sent_at: null };
  await assert.rejects(deliverWenshuFollowup(db, failed, async () => { throw new Error('SMTP unavailable'); }), /SMTP unavailable/);
  assert.equal(await deliverWenshuFollowup(db, failed, async () => { sends += 1; }), 'sent');
  assert.equal(sends, 2);
});
