import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedOrigin, readLead, validSessionToken, WENSHU_ORIGIN } from './contract';
import { createHandler } from './http';
import type { sql } from '../../platform/db';
import type { ImResponse } from '../im/httpTypes';

test('exact origin only; phone and company address required and bounded', () => {
  assert.equal(allowedOrigin(WENSHU_ORIGIN), true);
  assert.equal(allowedOrigin(WENSHU_ORIGIN + '.evil.test'), false);
  assert.equal(allowedOrigin(undefined), false);
  assert.throws(() => readLead({ phone: '13800000000' }));
  assert.throws(() => readLead({ phone: 'abc', company_address: '地址' }));
  assert.throws(() => readLead({ phone: '13800000000', company_address: 'x'.repeat(501) }));
  assert.equal(readLead({ phone: '13800000000', company_address: ' 成都 ' }).companyAddress, '成都');
  assert.equal(readLead({ phone: '13800000000', company_address: '成都', message: '需要接待方案', email: 'sales@example.com' }).message, '需要接待方案');
  assert.throws(() => readLead({ phone: '13800000000', company_address: '成都', message: 'x'.repeat(8001) }));
  assert.throws(() => readLead({ phone: '13800000000', company_address: '成都', email: 'x'.repeat(321) }));
  assert.equal(validSessionToken('ws_' + 'a'.repeat(64)), true);
  assert.equal(validSessionToken('staff-token'), false);
});

test('new classified forms require email and business type; legacy and offline requests remain compatible', () => {
  const base = { phone: '13800000000', company_address: '成都', source: 'hero-demo' };
  assert.throws(() => readLead({ ...base, intent: 'product_demo', business_type: '国际旅行社' }), /Email/);
  assert.throws(() => readLead({ ...base, intent: 'product_demo', email: 'buyer@example.com' }), /business type/);
  assert.throws(() => readLead({ ...base, intent: 'unknown', email: 'buyer@example.com', business_type: '国际旅行社' }), /Invalid intent/);
  const demo = readLead({ ...base, intent: 'product_demo', email: 'buyer@example.com', business_type: '国际旅行社' });
  assert.equal(demo.intent, 'product_demo');
  assert.equal(demo.customerConfirmationEnabled, true);
  const legacy = readLead(base);
  assert.equal(legacy.intent, 'product_demo');
  assert.equal(legacy.customerConfirmationEnabled, false);
  const offline = readLead({ ...base, source: 'offline-message', email: '' });
  assert.equal(offline.intent, 'offline_message');
  assert.equal(offline.customerConfirmationEnabled, false);
  const classifiedOffline = readLead({ ...base, source: 'offline-message', intent: 'offline_message',
    email: 'buyer@example.com', business_type: '人工客服留言' });
  assert.equal(classifiedOffline.customerConfirmationEnabled, true);
});

test('new lead sends internal and customer mails once; customer failure retries without duplicating internal mail', async () => {
  const id = '00000000-0000-4000-8000-000000000010';
  const stored = { id, name: '客户', phone: '13800000000', company: '测试', company_address: '成都',
    business_type: '国际旅行社', entry: 'nav-custom', page_url: 'https://www.zhilvtravel.com/',
    message: '', email: 'buyer@example.com', intent: 'custom_consultation',
    notification_sent_at: null as string | null, customer_confirmation_enabled: true,
    customer_confirmation_sent_at: null as string | null };
  let internal = 0, customer = 0;
  const db = (async (parts: TemplateStringsArray) => {
    const query = parts.join('');
    if (query.includes('request_limits')) return { rows: [{ count: 1 }] };
    if (query.includes('INSERT INTO wenshu_leads')) return { rows: [{ ...stored }] };
    if (query.includes('notification_claimed_at') && query.includes('RETURNING id')) return { rows: [{ id }] };
    if (query.includes('customer_confirmation_claimed_at') && query.includes('RETURNING id')) return { rows: [{ id }] };
    if (query.includes('notification_sent_at = NOW()')) stored.notification_sent_at = new Date().toISOString();
    if (query.includes('customer_confirmation_sent_at = NOW()')) stored.customer_confirmation_sent_at = new Date().toISOString();
    return { rows: [] };
  }) as unknown as typeof sql;
  const handler = createHandler(db, undefined, async () => { internal += 1; }, async () => {
    customer += 1; if (customer === 1) throw new Error('temporary customer SMTP failure');
  });
  const req = { method: 'POST', url: '/api/wenshu?action=lead', headers: {
    origin: WENSHU_ORIGIN, 'idempotency-key': id }, body: { phone: stored.phone, company_address: '成都',
    source: 'nav-custom', intent: 'custom_consultation', email: stored.email, business_type: stored.business_type } };
  const first = response(); await handler(req, first.res);
  assert.equal(first.state.status, 503);
  assert.equal(first.state.body.id, id);
  const retry = response(); await handler(req, retry.res);
  assert.equal(retry.state.status, 201);
  assert.equal(internal, 1);
  assert.equal(customer, 2);
});

function response() {
  const state = { status: 0, body: {} as Record<string, unknown>, headers: {} as Record<string, unknown> };
  const res: ImResponse = { status(n) { state.status = n; return res; },
    json(body) { state.body = body as Record<string, unknown>; }, setHeader(k, v) { state.headers[k] = v; } };
  return { state, res };
}

test('CORS rejection and preflight never access the database', async () => {
  const db = (() => { throw new Error('Unexpected DB call'); }) as unknown as typeof sql;
  const handler = createHandler(db);
  const bad = response(); await handler({ method: 'POST', headers: { origin: 'https://wrong.test' } }, bad.res);
  assert.equal(bad.state.status, 403);
  const good = response(); await handler({ method: 'OPTIONS', headers: { origin: WENSHU_ORIGIN } }, good.res);
  assert.equal(good.state.status, 200);
  assert.equal(good.state.headers['Access-Control-Allow-Origin'], WENSHU_ORIGIN);
});

test('lead only acknowledged with persisted receipt; address is parameterized', async () => {
  const calls: unknown[][] = [];
  let notified = false;
  const db = (async (parts: TemplateStringsArray, ...values: unknown[]) => {
    calls.push(values);
    const query = parts.join('');
    if (query.includes('request_limits')) return { rows: [{ count: 1 }] };
    if (query.includes('INSERT INTO wenshu_leads')) return { rows: [{ id: 'stored-id', notification_sent_at: null }] };
    if (query.includes('notification_claimed_at') && query.includes('RETURNING id')) return { rows: [{ id: 'stored-id' }] };
    return { rows: [] };
  }) as unknown as typeof sql;
  const r = response();
  await createHandler(db, undefined, async () => { notified = true; })({ method: 'POST', url: '/api/wenshu?action=lead', headers: {
    origin: WENSHU_ORIGIN, 'idempotency-key': '00000000-0000-4000-8000-000000000001',
  }, body: { phone: '13800000000', company_address: '成都测试地址' } }, r.res);
  assert.equal(r.state.status, 201); assert.equal(r.state.body.id, 'stored-id');
  assert.equal(notified, true);
  assert(calls[1].includes('成都测试地址'));
  const failure = response();
  const broken = (async () => { throw new Error('DB unavailable'); }) as unknown as typeof sql;
  await createHandler(broken)({ method: 'POST', url: '/api/wenshu?action=lead', headers: { origin: WENSHU_ORIGIN } }, failure.res);
  assert.equal(failure.state.status, 503); assert.equal(failure.state.body.ok, false);
});

test('offline message details are persisted with the lead receipt', async () => {
  const calls: unknown[][] = [];
  const db = (async (parts: TemplateStringsArray, ...values: unknown[]) => {
    calls.push(values);
    const query = parts.join('');
    if (query.includes('request_limits')) return { rows: [{ count: 1 }] };
    if (query.includes('INSERT INTO wenshu_leads')) return { rows: [{ id: 'offline-lead-id', notification_sent_at: null }] };
    if (query.includes('notification_claimed_at') && query.includes('RETURNING id')) return { rows: [{ id: 'offline-lead-id' }] };
    return { rows: [] };
  }) as unknown as typeof sql;
  const r = response();
  await createHandler(db, undefined, async () => {})({ method: 'POST', url: '/api/wenshu?action=lead', headers: {
    origin: WENSHU_ORIGIN, 'idempotency-key': '00000000-0000-4000-8000-000000000002',
  }, body: { phone: '13800000000', company_address: '成都测试地址', message: '请安排英文导游', email: 'sales@example.com' } }, r.res);
  assert.equal(r.state.status, 201);
  assert(calls[1].includes('请安排英文导游'));
  assert(calls[1].includes('sales@example.com'));
});

test('failed mail leaves a durable lead and returns retryable failure', async () => {
  const queries: string[] = [];
  const db = (async (parts: TemplateStringsArray) => {
    const query = parts.join(''); queries.push(query);
    if (query.includes('request_limits')) return { rows: [{ count: 1 }] };
    if (query.includes('INSERT INTO wenshu_leads')) return { rows: [{ id: 'stored-id', notification_sent_at: null }] };
    if (query.includes('notification_claimed_at') && query.includes('RETURNING id')) return { rows: [{ id: 'stored-id' }] };
    return { rows: [] };
  }) as unknown as typeof sql;
  const r = response();
  await createHandler(db, undefined, async () => { throw new Error('Mail unavailable'); })({
    method: 'POST', url: '/api/wenshu?action=lead', headers: {
      origin: WENSHU_ORIGIN, 'idempotency-key': '00000000-0000-4000-8000-000000000003',
    }, body: { phone: '13800000000', company_address: '测试地址' },
  }, r.res);
  assert.equal(r.state.status, 503);
  assert.equal(r.state.body.id, 'stored-id');
  assert(queries.some(query => query.includes('notification_last_error')));
});

test('repeated lead receipt does not send duplicate notification', async () => {
  const db = (async (parts: TemplateStringsArray) => ({ rows: parts.join('').includes('request_limits')
    ? [{ count: 1 }] : [{ id: 'stored-id', notification_sent_at: new Date().toISOString() }] })) as unknown as typeof sql;
  const r = response();
  await createHandler(db, undefined, async () => { throw new Error('Must not resend'); })({
    method: 'POST', url: '/api/wenshu?action=lead', headers: {
      origin: WENSHU_ORIGIN, 'idempotency-key': '00000000-0000-4000-8000-000000000004',
    }, body: { phone: '13800000000', company_address: '测试地址' },
  }, r.res);
  assert.equal(r.state.status, 201);
});

test('conversation substitution denied; staff authorization and cookies not forwarded', async () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const db = (async (parts: TemplateStringsArray) => ({ rows:
    parts.join('').includes('request_limits') ? [{ count: 1 }] : [{ id }] })) as unknown as typeof sql;
  let forwarded = false;
  const handler = createHandler(db, async (req, res) => {
    forwarded = true; assert.equal(req.headers.authorization, undefined);
    assert(!String(req.headers.cookie).includes('admin'));
    res.status(200).json({ ok: true, items: [] });
  });
  const headers = { origin: WENSHU_ORIGIN, 'x-wenshu-session': 'ws_' + 'a'.repeat(64), cookie: 'admin=secret', authorization: 'Bearer staff' };
  const bad = response();
  await handler({ method: 'GET', url: '/api/wenshu?action=messages&conversation=other', headers }, bad.res);
  assert.equal(bad.state.status, 403); assert.equal(forwarded, false);
  const good = response();
  await handler({ method: 'GET', url: `/api/wenshu?action=messages&conversation=${id}`, headers }, good.res);
  assert.equal(good.state.status, 200); assert.equal(forwarded, true);
});
