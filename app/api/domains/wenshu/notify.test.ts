import test from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import { renderCustomerLeadMail, renderInternalLeadMail, sendWenshuCustomerEmail,
  sendWenshuLeadEmail, sendWenshuLeadViaSmtp, type WenshuLeadForEmail } from './notify';

const lead: WenshuLeadForEmail = {
  id: '00000000-0000-4000-8000-000000000001', name: '测试客户', phone: '13800000000',
  company: '测试公司', company_address: '测试地址', business_type: '旅行社',
  entry: 'final-cta', page_url: 'https://www.zhilvtravel.com/', message: '请联系', email: '', intent: 'growth_plan',
};

test('request intent and business segment distinguish internal and customer copy', () => {
  const base = { ...lead, email: 'buyer@example.com' };
  const plan = renderCustomerLeadMail({ ...base, intent: 'growth_plan' });
  const demo = renderCustomerLeadMail({ ...base, intent: 'product_demo' });
  const custom = renderCustomerLeadMail({ ...base, intent: 'custom_consultation' });
  assert.notEqual(plan.subject, demo.subject);
  assert.notEqual(demo.subject, custom.subject);
  assert.match(custom.text, /定制化咨询/);
  assert.match(renderInternalLeadMail({ ...base, intent: 'custom_consultation', business_type: '入境游地接社' }).subject,
    /定制化咨询·入境游地接/);
  const english = renderCustomerLeadMail({ ...base, intent: 'product_demo',
    page_url: 'https://www.zhilvtravel.com/en/index.html', business_type: 'Inbound Ground Operator' });
  assert.match(english.subject, /Product demo/);
  assert.doesNotMatch(english.text, /预约体验/);
});

test('customer confirmation goes to submitted email, never the internal recipient', async () => {
  const delivered: string[] = [];
  const provider = await sendWenshuCustomerEmail({ ...lead, email: 'buyer@example.com', intent: 'product_demo' },
    (async () => { throw new Error('Resend must not be used without dedicated Wenshu from address'); }) as typeof fetch,
    { WENSHU_LEAD_TO_EMAIL: 'ops@example.com', WENSHU_SMTP_USER: '12345678@qq.com',
      WENSHU_SMTP_APP_PASSWORD: 'test-app-code', RESEND_API_KEY: 'test-key' },
    async mail => { delivered.push(mail.to); assert.match(mail.subject, /预约体验/); });
  assert.equal(provider, 'qq-smtp');
  assert.deepEqual(delivered, ['buyer@example.com']);
});

test('new Wenshu lead uses existing Resend service with fixed recipient', async () => {
  let called = 0;
  const fakeFetch = (async (url: string, init: RequestInit) => {
    called += 1;
    assert.equal(url, 'https://api.resend.com/emails');
    assert.equal(new Headers(init.headers).get('Idempotency-Key'), null);
    const payload = JSON.parse(String(init.body));
    assert.deepEqual(payload.to, ['ops@example.com']);
    assert.match(payload.text, /测试地址/);
    assert.match(payload.text, /13800000000/);
    return new Response('{}', { status: 200 });
  }) as typeof fetch;
  const provider = await sendWenshuLeadEmail(lead, fakeFetch, {
    RESEND_API_KEY: 'test-key', WENSHU_RESEND_FROM_EMAIL: 'no-reply@example.com',
    WENSHU_LEAD_TO_EMAIL: 'ops@example.com',
  });
  assert.equal(called, 1);
  assert.equal(provider, 'resend');
});

test('missing recipient or Resend rejection never reports notification success', async () => {
  await assert.rejects(sendWenshuLeadEmail(lead, fetch, {}), /not configured/);
  const rejected = (async () => new Response('{}', { status: 403 })) as typeof fetch;
  await assert.rejects(sendWenshuLeadEmail(lead, rejected, {
    RESEND_API_KEY: 'test-key', WENSHU_RESEND_FROM_EMAIL: 'no-reply@example.com',
    WENSHU_LEAD_TO_EMAIL: 'ops@example.com',
  }), /HTTP 403/);
});

test('Resend rejection falls back to QQ SMTP, while a successful Resend send does not', async () => {
  let smtpCalls = 0;
  const fallback = async (mail: { to: string; subject: string; text: string }) => {
    smtpCalls += 1;
    assert.equal(mail.to, 'ops@example.com');
    assert.match(mail.text, /13800000000/);
  };
  const env = { RESEND_API_KEY: 'test-key', WENSHU_RESEND_FROM_EMAIL: 'lead@mail.example.com',
    WENSHU_LEAD_TO_EMAIL: 'ops@example.com', WENSHU_SMTP_USER: '12345678@qq.com',
    WENSHU_SMTP_APP_PASSWORD: 'test-app-code' };
  const rejected = (async () => new Response('{}', { status: 403 })) as typeof fetch;
  assert.equal(await sendWenshuLeadEmail(lead, rejected, env, fallback), 'qq-smtp');
  assert.equal(smtpCalls, 1);
  const accepted = (async () => new Response('{}', { status: 200 })) as typeof fetch;
  assert.equal(await sendWenshuLeadEmail(lead, accepted, env, fallback), 'resend');
  assert.equal(smtpCalls, 1);
});

test('QQ SMTP uses verified TLS, authorization code and checks recipient acceptance', async () => {
  let closed = false;
  const createTransport = ((options: { host: string; port: number; secure: boolean; auth: { user: string; pass: string } }) => {
    assert.equal(options.host, 'smtp.qq.com');
    assert.equal(options.port, 465);
    assert.equal(options.secure, true);
    assert.equal(options.auth.user, '12345678@qq.com');
    assert.equal(options.auth.pass, 'test-app-code');
    return { sendMail: async (mail: { to: string }) => ({ accepted: [mail.to] }),
      close: () => { closed = true; } };
  }) as unknown as typeof nodemailer.createTransport;
  await sendWenshuLeadViaSmtp({ to: 'ops@example.com', subject: 'Test', text: 'Test' },
    { WENSHU_SMTP_USER: '12345678@qq.com', WENSHU_SMTP_APP_PASSWORD: 'test-app-code' }, createTransport);
  assert.equal(closed, true);
});

test('QQ SMTP can send when Resend is not configured', async () => {
  let sent = false;
  const unavailableFetch = (async () => { throw new Error('Resend must not be called'); }) as typeof fetch;
  const provider = await sendWenshuLeadEmail(lead, unavailableFetch, {
    WENSHU_LEAD_TO_EMAIL: 'ops@example.com', WENSHU_SMTP_USER: '12345678@qq.com',
    WENSHU_SMTP_APP_PASSWORD: 'test-app-code',
  }, async () => { sent = true; });
  assert.equal(provider, 'qq-smtp');
  assert.equal(sent, true);
});
