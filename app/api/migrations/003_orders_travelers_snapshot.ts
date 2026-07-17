import type { SqlClient } from '../lib/db';

export const name = '003_orders_travelers_snapshot';

export async function up(tx: SqlClient) {
  await tx`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS travelers JSONB NOT NULL DEFAULT '[]'::jsonb
  `;
}
