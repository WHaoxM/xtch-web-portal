import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvLocal() {
  try {
    const content = readFileSync(resolve(import.meta.dirname, '../.env.local'), 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // ignore
  }
}

loadEnvLocal();

const orderNumber = process.argv[2];
if (!orderNumber) {
  console.error('Usage: npx tsx scripts/check-order.ts <order-number>');
  process.exit(1);
}

const { sql } = await import('../api/lib/db.ts');

const orderResult = await sql`
  SELECT
    id,
    order_number,
    status,
    payment_status,
    refund_status,
    stripe_checkout_session_id,
    stripe_payment_intent_id,
    stripe_charge_id,
    confirmation_email_status,
    created_at,
    paid_at,
    confirmed_at,
    traveler_details_due_at,
    adult_quantity,
    departure_id
  FROM orders
  WHERE order_number = ${orderNumber}
`;

const order = orderResult.rows[0];
if (!order) {
  console.log('Order not found.');
  await sql.end?.();
  process.exit(0);
}

const holdResult = await sql`
  SELECT id, status, created_at, consumed_at, released_at
  FROM inventory_holds
  WHERE order_id = ${order.id}
  ORDER BY created_at DESC
`;

const eventResult = await sql`
  SELECT stripe_event_id, event_type, processing_status, processed_at, error_message
  FROM stripe_webhook_events
  WHERE object_id = ${order.stripe_checkout_session_id}
     OR payload -> 'data' -> 'object' ->> 'payment_intent' = ${order.stripe_payment_intent_id}
     OR payload -> 'data' -> 'object' ->> 'client_reference_id' = ${orderNumber}
  ORDER BY created_at DESC
`;

const departureResult = await sql`
  SELECT public_id, status, capacity
  FROM departures
  WHERE id = ${order.departure_id}
`;

console.log('Order:');
console.log(JSON.stringify(order, null, 2));
console.log('\nInventory holds:');
console.log(JSON.stringify(holdResult.rows, null, 2));
console.log('\nStripe webhook events:');
console.log(JSON.stringify(eventResult.rows, null, 2));
console.log('\nDeparture:');
console.log(JSON.stringify(departureResult.rows[0] ?? null, null, 2));

await sql.end?.();
