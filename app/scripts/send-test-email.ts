import { loadTargetEnv } from '../../scripts/env/targetEnv';

loadTargetEnv('local', { override: false });

const { sendBookingConfirmationEmail } = await import('../api/lib/email.ts');

const order = {
  id: '7f6945ef-199f-4e02-9741-666b9af56b55',
  order_number: 'ST-TEST-001',
  lead_email: 'emonakhatun64@gmail.com',
  lead_traveler_name: 'Test User',
  adult_quantity: 1,
  total_price_cents: 180000,
  currency: 'usd',
  route_snapshot: {
    route_title: '5 Days and 4 Nights in Beijing',
    departure_city: 'Beijing',
    start_date: '2026-10-12',
    end_date: '2026-10-16',
  },
  price_snapshot: {
    adult_unit_price_cents: 180000,
    total_price_cents: 180000,
    adult_quantity: 1,
    currency: 'usd',
  },
  policy_snapshot: {
    full_refund_until: '2026-09-12',
    partial_refund_until: '2026-09-27',
    non_refundable_after: '2026-09-28',
  },
  traveler_details_due_at: '2026-09-27T16:00:00.000Z',
  status: 'confirmed',
  payment_status: 'paid',
  refund_status: 'none',
  confirmation_email_status: 'confirmation_email_pending',
};

import type { Order } from '../api/lib/bookingSchema';

const result = await sendBookingConfirmationEmail(order as Order);
console.log('Email result:', result);
await import('../api/lib/db.ts').then((m) => m.sql.end?.());
