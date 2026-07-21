import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Order } from './bookingSchema';
import {
  buildResendPayload,
  deliverBookingConfirmationEmails,
  type BookingEmailMessage,
} from './email';

const order = {
  id: 'order-id',
  order_number: 'XTCH-2026-0001',
  stripe_checkout_session_id: 'cs_test_stable',
  confirmation_email_status: 'confirmation_email_pending',
  lead_email: 'traveler@example.com',
  adult_quantity: 2,
  currency: 'usd',
  adult_unit_price_cents: 123400,
  total_price_cents: 246800,
  route_snapshot: { route_title: 'Silk Road Highlights' },
  price_snapshot: {
    adult_quantity: 2,
    currency: 'usd',
    total_price_cents: 246800,
  },
} as Order;

test('Resend payload uses the documented reply_to field', () => {
  const payload = buildResendPayload({
    from: 'bookings@example.com',
    to: ['traveler@example.com'],
    replyTo: ['ops@example.com'],
    subject: 'Confirmed',
    text: 'Paid',
  });

  assert.deepEqual(payload.reply_to, ['ops@example.com']);
  assert.equal('replyTo' in payload, false);
});

test('payment confirmation sends distinct traveler and operations messages', async () => {
  const messages: BookingEmailMessage[] = [];
  const stages: string[] = [];

  const result = await deliverBookingConfirmationEmails(order, {
    purpose: 'payment-confirmation',
    fromEmail: 'Syncing Travel <bookings@example.com>',
    operationsEmails: ['ops@example.com'],
    publicAppUrl: 'https://travel.example.com',
    orderUrl: 'https://travel.example.com/orders/XTCH-2026-0001?token=fresh',
    send: async (message) => {
      messages.push(message);
      return true;
    },
    onTravelerSent: async () => {
      stages.push('traveler');
    },
  });

  assert.equal(result, 'sent');
  assert.equal(messages.length, 2);
  assert.deepEqual(messages[0].to, ['traveler@example.com']);
  assert.deepEqual(messages[0].replyTo, ['ops@example.com']);
  assert.match(messages[0].html ?? '', /Your booking is confirmed/);
  assert.match(messages[0].html ?? '', /View your order/);
  assert.match(messages[0].html ?? '', /token=fresh/);
  assert.equal(messages[0].idempotencyKey, undefined);

  assert.deepEqual(messages[1].to, ['ops@example.com']);
  assert.equal(messages[1].idempotencyKey, 'booking-confirmation/order-id/operations');
  assert.match(messages[1].subject, /Paid booking/);
  assert.match(messages[1].text ?? '', /XTCH-2026-0001/);
  assert.match(messages[1].text ?? '', /traveler@example.com/);
  assert.match(messages[1].text ?? '', /2468\.00 USD/);
  assert.match(messages[1].text ?? '', /Silk Road Highlights/);
  assert.doesNotMatch(messages[1].text ?? '', /phone|traveler name|notes/i);
  assert.deepEqual(stages, ['traveler']);
});

test('payment retry after traveler stage sends only the missing operations copy', async () => {
  const messages: BookingEmailMessage[] = [];
  const partialOrder = {
    ...order,
    confirmation_email_status: 'confirmation_email_traveler_sent',
  } as Order;

  const result = await deliverBookingConfirmationEmails(partialOrder, {
    purpose: 'payment-confirmation',
    fromEmail: 'Syncing Travel <bookings@example.com>',
    operationsEmails: ['ops@example.com'],
    publicAppUrl: 'https://travel.example.com',
    orderUrl: 'https://travel.example.com/orders/XTCH-2026-0001?token=fresh',
    send: async (message) => {
      messages.push(message);
      return true;
    },
  });

  assert.equal(result, 'sent');
  assert.equal(messages.length, 1);
  assert.deepEqual(messages[0].to, ['ops@example.com']);
});

test('operations failure reports traveler stage without resending traveler', async () => {
  const messages: BookingEmailMessage[] = [];
  const stages: string[] = [];

  const result = await deliverBookingConfirmationEmails(order, {
    purpose: 'payment-confirmation',
    fromEmail: 'Syncing Travel <bookings@example.com>',
    operationsEmails: ['ops@example.com'],
    publicAppUrl: 'https://travel.example.com',
    send: async (message) => {
      messages.push(message);
      return messages.length === 1;
    },
    onTravelerSent: async () => {
      stages.push('traveler');
    },
  });

  assert.equal(result, 'traveler_sent');
  assert.equal(messages.length, 2);
  assert.deepEqual(stages, ['traveler']);
});

test('admin resend sends only the traveler confirmation', async () => {
  const messages: BookingEmailMessage[] = [];

  const result = await deliverBookingConfirmationEmails(order, {
    purpose: 'admin-resend',
    fromEmail: 'Syncing Travel <bookings@example.com>',
    operationsEmails: ['ops@example.com'],
    publicAppUrl: 'https://travel.example.com',
    orderUrl: 'https://travel.example.com/orders/XTCH-2026-0001?token=fresh',
    send: async (message) => {
      messages.push(message);
      return true;
    },
  });

  assert.equal(result, 'sent');
  assert.equal(messages.length, 1);
  assert.deepEqual(messages[0].to, ['traveler@example.com']);
  assert.deepEqual(messages[0].replyTo, ['ops@example.com']);
});
