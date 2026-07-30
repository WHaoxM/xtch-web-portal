import { loadTargetEnv } from '../../scripts/env/targetEnv';

loadTargetEnv('local', { override: false });

import { sql } from '../api/platform/db.ts';
import { claimOrdersByEmail, listOrdersByUserId } from '../api/domains/booking/orders/orderQueries.ts';

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
