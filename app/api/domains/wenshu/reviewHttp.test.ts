import test from 'node:test';
import assert from 'node:assert/strict';
import type { sql } from '../../platform/db';
import { resolveLocalApiRoute } from '../../../scripts/localApiRoutes';
import { createWenshuReviewHandler } from './reviewHttp';
import { issueReviewToken, reviewTokenHash, validReviewToken } from './reviewAccess';

function response() {
  const state = { status: 0, body: {} as Record<string, unknown> };
  const res = { status(n: number) { state.status = n; return res; },
    json(value: unknown) { state.body = value as Record<string, unknown>; }, setHeader() {} };
  return { state, res };
}

test('review URL token is random, hashed at rest, and route is registered', async () => {
  assert.equal(resolveLocalApiRoute('/api/wenshu-review'), '/api/wenshu-review.ts');
  let stored = '';
  const db = (async (_parts: TemplateStringsArray, ...values: unknown[]) => {
    stored = String(values[1]); return { rows: [] };
  }) as unknown as typeof sql;
  const token = await issueReviewToken(db, '00000000-0000-4000-8000-000000000011');
  assert.equal(validReviewToken(token), true);
  assert.notEqual(token, stored);
  assert.equal(stored, reviewTokenHash(token));
});

test('mail-link GET is read-only; explicit POST sends only to stored customer and consumes link', async () => {
  const token = 'A'.repeat(43);
  const leadId = '00000000-0000-4000-8000-000000000021';
  const reviewId = '00000000-0000-4000-8000-000000000022';
  const lead = { review_id: reviewId, id: leadId, name: '客户', phone: '13800000000', company: '测试',
    company_address: '成都', business_type: '国际旅行社', entry: 'hero', page_url: 'https://www.zhilvtravel.com/',
    message: '请给方案', email: 'buyer@example.com', intent: 'growth_plan' };
  let consumed = false, sent = false, sends = 0, audits = 0;
  let saved: { id: string; lead_id: string; recipient_email: string; subject: string; body: string;
    sent_at: string | null } | null = null;
  const db = (async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const statement = parts.join('');
    if (statement.includes('FROM wenshu_lead_review_links r JOIN')) {
      assert.equal(values[0], reviewTokenHash(token));
      return { rows: consumed ? [] : [lead] };
    }
    if (statement.includes('WHERE lead_id') && statement.includes('sent_at IS NOT NULL')) {
      return { rows: sent ? [{ id: reviewId }] : [] };
    }
    if (statement.includes('FROM wenshu_lead_followups WHERE request_id')) return { rows: saved ? [{ ...saved }] : [] };
    if (statement.includes('INSERT INTO wenshu_lead_followups')) {
      if (!saved) saved = { id: reviewId, lead_id: leadId, recipient_email: lead.email,
        subject: String(values[3]), body: String(values[4]), sent_at: null };
      return { rows: [] };
    }
    if (statement.includes('SET claimed_at = NOW()')) return { rows: [{ id: reviewId }] };
    if (statement.includes('SET sent_at = NOW()')) { sent = true; if (saved) saved.sent_at = new Date().toISOString(); return { rows: [] }; }
    if (statement.includes('SET consumed_at = NOW()')) { consumed = true; return { rows: [] }; }
    throw new Error('Unexpected query: ' + statement);
  }) as unknown as typeof sql;
  const handler = createWenshuReviewHandler(db, async mail => {
    sends += 1;
    assert.equal(mail.recipient_email, 'buyer@example.com');
    return 'qq-smtp';
  }, async () => { audits += 1; });
  const headers = { 'x-wenshu-review-token': token };
  const get = response(); await handler({ method: 'GET', headers }, get.res);
  assert.equal(get.state.status, 200);
  assert.equal((get.state.body.lead as { email: string }).email, 'buyer@example.com');
  assert.equal(sends, 0);
  const draft = get.state.body.draft as { subject: string; body: string };
  const post = response(); await handler({ method: 'POST', headers, body: draft }, post.res);
  assert.equal(post.state.status, 201);
  assert.equal(post.state.body.recipientEmail, 'buyer@example.com');
  assert.equal(sends, 1);
  assert.equal(audits, 1);
  assert.equal(consumed, true);
  const replay = response(); await handler({ method: 'POST', headers, body: draft }, replay.res);
  assert.equal(replay.state.status, 410);
  assert.equal(sends, 1);
});

test('invalid review token is rejected before database access', async () => {
  const db = (() => { throw new Error('Unexpected database access'); }) as unknown as typeof sql;
  const r = response();
  await createWenshuReviewHandler(db)({ method: 'GET', headers: { 'x-wenshu-review-token': 'bad' } }, r.res);
  assert.equal(r.state.status, 410);
});
