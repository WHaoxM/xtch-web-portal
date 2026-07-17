import { readFileSync } from 'node:fs';

const content = readFileSync(new URL('../.env.local', import.meta.url), 'utf-8');
for (const line of content.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx === -1) continue;
  const key = trimmed.slice(0, idx).trim();
  let value = trimmed.slice(idx + 1).trim();
  if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
  if (!(key in process.env)) process.env[key] = value;
}

import { sql } from '../api/lib/db.ts';
import { claimOrdersByEmail, listOrdersByUserId } from '../api/lib/orderQueries.ts';

const TEST_USER_ID = 'test-user-id-emonakhatun';
const TEST_EMAIL = 'emonakhatun64@gmail.com';

async function main() {
  console.log('Before claim:');
  const before = await sql`
    SELECT order_number, status, payment_status, lead_email, user_id, created_at
    FROM orders
    WHERE lead_email = ${TEST_EMAIL}
    ORDER BY created_at DESC
  `;
  console.log(JSON.stringify(before.rows, null, 2));

  const claimedCount = await claimOrdersByEmail(TEST_USER_ID, TEST_EMAIL);
  console.log(`\nClaimed ${claimedCount} order(s).`);

  console.log('\nAfter claim:');
  const after = await sql`
    SELECT order_number, status, payment_status, lead_email, user_id, created_at
    FROM orders
    WHERE lead_email = ${TEST_EMAIL}
    ORDER BY created_at DESC
  `;
  console.log(JSON.stringify(after.rows, null, 2));

  console.log('\nOrders by user_id:');
  const userOrders = await listOrdersByUserId(TEST_USER_ID);
  console.log(JSON.stringify(userOrders, null, 2));

  await sql.end?.();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
