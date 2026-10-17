import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminLeadsHandler } from './adminLeads';
import type { sql } from '../../platform/db';
import { resolveLocalApiRoute } from '../../../scripts/localApiRoutes';

function response() {
  const state = { status: 0, body: {} as Record<string, unknown> };
  const res = { status(n: number) { state.status = n; return res; },
    json(body: unknown) { state.body = body as Record<string, unknown>; } };
  return { state, res };
}

test('admin lead route is registered and rejects unauthenticated access before database reads', async () => {
  assert.equal(resolveLocalApiRoute('/api/admin/wenshu-leads'), '/api/admin/inquiry/wenshu-leads.ts');
  const db = (() => { throw new Error('Unexpected database read'); }) as unknown as typeof sql;
  const r = response();
  await createAdminLeadsHandler(db)({ method: 'GET', headers: {} }, r.res);
  assert.equal(r.state.status, 401);
});

test('authorized staff can list receipts and audited detail, but not an invalid id', async () => {
  let auditCount = 0;
  const id = '00000000-0000-4000-8000-000000000001';
  const db = (async (parts: TemplateStringsArray) => ({ rows: parts.join('').includes('WHERE id')
    ? [{ id, phone: '13800000000' }] : [{ id, name: '测试客户' }] })) as unknown as typeof sql;
  const authorize = async () => ({ ok: true as const, email: 'ops@example.com', role: 'ops' as const });
  const audit = async () => { auditCount += 1; };
  const handler = createAdminLeadsHandler(db, authorize, audit);
  const list = response();
  await handler({ method: 'GET', url: '/api/admin/wenshu-leads', headers: {} }, list.res);
  assert.equal(list.state.status, 200);
  assert.equal((list.state.body.leads as unknown[]).length, 1);
  const detail = response();
  await handler({ method: 'GET', url: `/api/admin/wenshu-leads?id=${id}`, headers: {} }, detail.res);
  assert.equal(detail.state.status, 200);
  assert.equal((detail.state.body.lead as Record<string, unknown>).phone, '13800000000');
  assert.equal(auditCount, 1);
  const invalid = response();
  await handler({ method: 'GET', url: '/api/admin/wenshu-leads?id=invalid', headers: {} }, invalid.res);
  assert.equal(invalid.state.status, 400);
});

test('admin can retry a failed notification without changing the lead receipt', async () => {
  const id = '00000000-0000-4000-8000-000000000001';
  let sends = 0;
  let updates = 0;
  let audits = 0;
  const db = (async (parts: TemplateStringsArray) => {
    const statement = parts.join('');
    if (statement.includes('SELECT')) return { rows: [{ id, phone: '13800000000',
      company_address: '测试地址', notification_sent_at: null }] };
    if (statement.includes('UPDATE')) { updates += 1; return { rows: statement.includes('RETURNING id') ? [{ id }] : [] }; }
    throw new Error('Unexpected query');
  }) as unknown as typeof sql;
  const handler = createAdminLeadsHandler(db,
    async () => ({ ok: true as const, email: 'ops@example.com', role: 'ops' as const }),
    async () => { audits += 1; },
    async () => { sends += 1; });
  const r = response();
  await handler({ method: 'POST', url: `/api/admin/wenshu-leads?id=${id}&action=retry-notification`, headers: {} }, r.res);
  assert.equal(r.state.status, 200);
  assert.equal(sends, 1);
  assert.equal(updates, 2);
  assert.equal(audits, 1);
});
