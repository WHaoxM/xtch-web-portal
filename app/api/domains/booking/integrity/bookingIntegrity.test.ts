import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  classifyRefundAmount,
  evaluateCancellationRequest,
  resolveClientIp,
  shouldConfirmPaidCheckout,
  checkoutRateBucketKey,
  checkoutRateWindowId,
  CHECKOUT_RATE_LIMITS,
  CHECKOUT_RATE_WINDOW_MS,
} from './bookingIntegrity.ts';

test('evaluateCancellationRequest: only confirmed+paid allowed', () => {
  assert.equal(evaluateCancellationRequest('confirmed', 'paid'), 'allow');
  assert.equal(evaluateCancellationRequest('cancellation_requested', 'paid'), 'idempotent');
  assert.equal(evaluateCancellationRequest('confirmed', 'partially_refunded'), 'deny');
  assert.equal(evaluateCancellationRequest('confirmed', 'refunded'), 'deny');
  assert.equal(evaluateCancellationRequest('pending_payment', 'unpaid'), 'deny');
  assert.equal(evaluateCancellationRequest('expired', 'unpaid'), 'deny');
  assert.equal(evaluateCancellationRequest('refunded', 'refunded'), 'deny');
  assert.equal(evaluateCancellationRequest('cancelled', 'paid'), 'deny');
  assert.equal(evaluateCancellationRequest('failed', 'failed'), 'deny');
});

test('classifyRefundAmount: cumulative partial vs full', () => {
  assert.equal(classifyRefundAmount(0, 10_000), 'none');
  assert.equal(classifyRefundAmount(100, 10_000), 'partial');
  assert.equal(classifyRefundAmount(9_999, 10_000), 'partial');
  assert.equal(classifyRefundAmount(10_000, 10_000), 'full');
  assert.equal(classifyRefundAmount(12_000, 10_000), 'full');
  // Bug regression: a single partial refund.amount must not look like full
  // when misread as charge.amount (total).
  const chargeTotalMisreadAsRefund = 10_000;
  const trueCumulativePartial = 2_000;
  assert.equal(classifyRefundAmount(trueCumulativePartial, chargeTotalMisreadAsRefund), 'partial');
  assert.notEqual(classifyRefundAmount(chargeTotalMisreadAsRefund, chargeTotalMisreadAsRefund), 'partial');
});

test('shouldConfirmPaidCheckout: B1 rejects unpaid completed sessions', () => {
  assert.equal(shouldConfirmPaidCheckout({ sessionPaymentStatus: 'paid' }), true);
  assert.equal(
    shouldConfirmPaidCheckout({ sessionPaymentStatus: 'unpaid', paymentIntentStatus: 'succeeded' }),
    true,
  );
  assert.equal(shouldConfirmPaidCheckout({ sessionPaymentStatus: 'unpaid' }), false);
  assert.equal(
    shouldConfirmPaidCheckout({
      sessionPaymentStatus: 'unpaid',
      paymentIntentStatus: 'processing',
    }),
    false,
  );
  assert.equal(
    shouldConfirmPaidCheckout({
      sessionPaymentStatus: 'no_payment_required',
      paymentIntentStatus: 'requires_action',
    }),
    false,
  );
});

test('resolveClientIp: never trusts forwarded headers when TRUST_PROXY off', () => {
  assert.equal(
    resolveClientIp({
      headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' },
      socketRemoteAddress: '127.0.0.1',
      trustProxy: false,
    }),
    '127.0.0.1',
  );
  assert.equal(
    resolveClientIp({
      headers: { 'x-forwarded-for': '9.9.9.9' },
      trustProxy: false,
    }),
    'unknown',
  );
});

test('resolveClientIp: TRUST_PROXY uses leftmost X-Forwarded-For (Caddy)', () => {
  assert.equal(
    resolveClientIp({
      headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.1' },
      socketRemoteAddress: '127.0.0.1',
      trustProxy: true,
    }),
    '203.0.113.10',
  );
  assert.equal(
    resolveClientIp({
      headers: { 'x-real-ip': '198.51.100.7' },
      socketRemoteAddress: '127.0.0.1',
      trustProxy: true,
    }),
    '198.51.100.7',
  );
});

test('checkout rate window helpers', () => {
  const windowId = checkoutRateWindowId(1_700_000_000_000);
  assert.equal(typeof windowId, 'number');
  assert.equal(
    checkoutRateBucketKey('ip', '1.2.3.4', windowId),
    `ip:1.2.3.4:${windowId}`,
  );
  assert.equal(CHECKOUT_RATE_LIMITS.ip, 10);
  assert.equal(CHECKOUT_RATE_LIMITS.email, 5);
  assert.equal(CHECKOUT_RATE_LIMITS.departure, 20);
  assert.equal(CHECKOUT_RATE_WINDOW_MS, 10 * 60 * 1000);
});

/**
 * charge.refunded object is a Charge: use amount_refunded, not amount.
 * refund.updated object is a Refund: single amount is not cumulative truth.
 */
test('refund object field selection: Charge vs Refund shapes', () => {
  const chargeLike = {
    object: 'charge',
    id: 'ch_1',
    amount: 10_000,
    amount_refunded: 2_500,
  };
  const refundLike = {
    object: 'refund',
    id: 're_1',
    amount: 2_500,
    charge: 'ch_1',
  };

  assert.equal(chargeLike.object, 'charge');
  assert.equal(refundLike.object, 'refund');
  assert.equal(classifyRefundAmount(chargeLike.amount_refunded, chargeLike.amount), 'partial');
  // Wrong cast bug: treating Charge as Refund would use charge.amount (10000) as refund.
  assert.equal(classifyRefundAmount(chargeLike.amount, chargeLike.amount), 'full');
  assert.notEqual(
    classifyRefundAmount(chargeLike.amount_refunded, chargeLike.amount),
    classifyRefundAmount(chargeLike.amount, chargeLike.amount),
  );
});
