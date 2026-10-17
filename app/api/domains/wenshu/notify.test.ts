import test from 'node:test';
import assert from 'node:assert/strict';
import { sendWenshuLeadEmail, type WenshuLeadForEmail } from './notify';

const lead: WenshuLeadForEmail = {
  id: '00000000-0000-4000-8000-000000000001', name: '测试客户', phone: '13800000000',
  company: '测试公司', company_address: '测试地址', business_type: '旅行社',
  entry: 'final-cta', page_url: 'https://www.zhilvtravel.com/', message: '请联系', email: '',
};

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
  await sendWenshuLeadEmail(lead, fakeFetch, {
    RESEND_API_KEY: 'test-key', INQUIRY_FROM_EMAIL: 'no-reply@example.com',
    WENSHU_LEAD_TO_EMAIL: 'ops@example.com',
  });
  assert.equal(called, 1);
});

test('missing recipient or Resend rejection never reports notification success', async () => {
  await assert.rejects(sendWenshuLeadEmail(lead, fetch, {}), /not configured/);
  const rejected = (async () => new Response('{}', { status: 403 })) as typeof fetch;
  await assert.rejects(sendWenshuLeadEmail(lead, rejected, {
    RESEND_API_KEY: 'test-key', INQUIRY_FROM_EMAIL: 'no-reply@example.com',
    WENSHU_LEAD_TO_EMAIL: 'ops@example.com',
  }), /HTTP 403/);
});
