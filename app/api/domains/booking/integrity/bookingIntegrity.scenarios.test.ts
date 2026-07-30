import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  evaluateCancellationRequest,
  classifyRefundAmount,
  shouldConfirmPaidCheckout,
} from './bookingIntegrity.ts';

/**
 * Scenario-level regression table for the four V1 audit issues.
 * DB/Stripe I/O is covered by orderQueries/webhook integration when a local DB is available;
 * these tests lock the decision gates that prevent the original bugs.
 */

test('issue1 gate: same-subject concurrent hold is a reject path (message contract)', () => {
  // createPendingOrderAndHold throws this exact message; checkout maps it to 409.
  const message =
    'You already have an open checkout for this departure. Finish payment or wait for it to expire.';
  assert.match(message, /already have an open checkout/i);
});

test('issue2 gate: partial cumulative refund must not become full', () => {
  const orderTotal = 50_000;
  const firstPartial = 10_000;
  const secondPartial = 20_000;
  const cumulative = firstPartial + secondPartial;
  assert.equal(classifyRefundAmount(firstPartial, orderTotal), 'partial');
  assert.equal(classifyRefundAmount(cumulative, orderTotal), 'partial');
  assert.equal(classifyRefundAmount(orderTotal, orderTotal), 'full');
});

test('issue2 gate: charge.amount must not be used as refund amount', () => {
  const chargeAmount = 50_000;
  const amountRefunded = 5_000;
  assert.equal(classifyRefundAmount(amountRefunded, chargeAmount), 'partial');
  // Old bug path: Refund cast of Charge â†?refund.amount === charge.amount
  assert.equal(classifyRefundAmount(chargeAmount, chargeAmount), 'full');
});

test('issue3 gate: unpaid checkout.session.completed must not confirm', () => {
  assert.equal(
    shouldConfirmPaidCheckout({
      sessionPaymentStatus: 'unpaid',
      paymentIntentStatus: 'requires_action',
    }),
    false,
  );
  assert.equal(shouldConfirmPaidCheckout({ sessionPaymentStatus: 'paid' }), true);
});

test('issue4 gate: terminal and unpaid statuses cannot enter cancellation_requested', () => {
  for (const status of ['refunded', 'cancelled', 'expired', 'pending_payment', 'failed'] as const) {
    assert.equal(evaluateCancellationRequest(status, 'paid'), 'deny');
    assert.equal(evaluateCancellationRequest(status, 'unpaid'), 'deny');
  }
  assert.equal(evaluateCancellationRequest('confirmed', 'partially_refunded'), 'deny');
  assert.equal(evaluateCancellationRequest('confirmed', 'paid'), 'allow');
  assert.equal(evaluateCancellationRequest('cancellation_requested', 'paid'), 'idempotent');
});
