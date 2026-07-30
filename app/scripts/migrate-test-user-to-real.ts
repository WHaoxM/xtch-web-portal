import { loadTargetEnv } from '../../scripts/env/targetEnv';

loadTargetEnv('local', { override: false });

import { sql } from '../api/platform/db.ts';

const REAL_USER_ID = 'ac510925-173d-45e1-bb98-a7ba5e682b01';
const TEST_USER_ID = 'test-user-id-emonakhatun';
const EMAIL = 'emonakhatun64@gmail.com';

async function main() {
  console.log('Before update:');
  const before = await sql`
    SELECT order_number, status, payment_status, lead_email, user_id, created_at
    FROM orders
    WHERE lead_email = ${EMAIL}
    ORDER BY created_at DESC
  `;
  console.log(JSON.stringify(before.rows, null, 2));

  await sql`
    UPDATE orders
    SET user_id = ${REAL_USER_ID},
        updated_at = NOW()
    WHERE LOWER(lead_email) = ${EMAIL.toLowerCase()}
      AND user_id = ${TEST_USER_ID}
  `;

  console.log('\nAfter update:');
  const after = await sql`
    SELECT order_number, status, payment_status, lead_email, user_id, created_at
    FROM orders
    WHERE lead_email = ${EMAIL}
    ORDER BY created_at DESC
  `;
  console.log(JSON.stringify(after.rows, null, 2));

  await sql.end?.();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
