import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parsePayoneerNotification,
  verifyPayoneerWebhookSignature,
} from './payoneer';
import { getPaymentProvider } from './paymentProvider';
import { createHmac } from 'node:crypto';

test('getPaymentProvider defaults to payoneer', () => {
  const previous = process.env.PAYMENT_PROVIDER;
  delete process.env.PAYMENT_PROVIDER;
  assert.equal(getPaymentProvider(), 'payoneer');
  process.env.PAYMENT_PROVIDER = 'stripe';
  assert.equal(getPaymentProvider(), 'stripe');
  process.env.PAYMENT_PROVIDER = 'Payoneer';
  assert.equal(getPaymentProvider(), 'payoneer');
  if (previous === undefined) delete process.env.PAYMENT_PROVIDER;
  else process.env.PAYMENT_PROVIDER = previous;
});

test('parsePayoneerNotification maps charged status and ids', () => {
  const parsed = parsePayoneerNotification({
    identification: {
      longId: 'list_abc',
      shortId: 'chg_1',
      transactionId: 'tx_1',
    },
    status: { code: 'charged' },
    environment: 'test',
  });

  assert.equal(parsed.listId, 'list_abc');
  assert.equal(parsed.transactionId, 'tx_1');
  assert.equal(parsed.chargeId, 'chg_1');
  assert.equal(parsed.status, 'charged');
  assert.equal(parsed.livemode, false);
});

test('parsePayoneerNotification maps expired and canceled', () => {
  assert.equal(parsePayoneerNotification({ status: { code: 'expired' } }).status, 'expired');
  assert.equal(parsePayoneerNotification({ status: { code: 'canceled' } }).status, 'canceled');
  assert.equal(parsePayoneerNotification({ status: { code: 'failed' } }).status, 'failed');
});

test('verifyPayoneerWebhookSignature accepts sha256 header when secret set', () => {
  const previous = process.env.PAYONEER_WEBHOOK_SECRET;
  process.env.PAYONEER_WEBHOOK_SECRET = 'whsec_test';
  const body = '{"status":{"code":"charged"}}';
  const digest = createHmac('sha256', 'whsec_test').update(body, 'utf8').digest('hex');
  assert.equal(verifyPayoneerWebhookSignature(body, `sha256=${digest}`), true);
  assert.equal(verifyPayoneerWebhookSignature(body, 'sha256=deadbeef'), false);
  if (previous === undefined) delete process.env.PAYONEER_WEBHOOK_SECRET;
  else process.env.PAYONEER_WEBHOOK_SECRET = previous;
});

test('verifyPayoneerWebhookSignature skips when secret unset', () => {
  const previous = process.env.PAYONEER_WEBHOOK_SECRET;
  delete process.env.PAYONEER_WEBHOOK_SECRET;
  assert.equal(verifyPayoneerWebhookSignature('{}', undefined), true);
  if (previous === undefined) delete process.env.PAYONEER_WEBHOOK_SECRET;
  else process.env.PAYONEER_WEBHOOK_SECRET = previous;
});
