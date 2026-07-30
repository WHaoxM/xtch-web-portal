import type { SqlClient } from '../platform/db';

export const name = '013_payoneer_checkout_fields';

export async function up(tx: SqlClient) {
  await tx`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS payment_provider TEXT
  `;

  await tx`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS payoneer_list_id TEXT
  `;

  await tx`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS payoneer_transaction_id TEXT
  `;

  await tx`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS payoneer_charge_id TEXT
  `;

  await tx`
    ALTER TABLE inventory_holds
    ADD COLUMN IF NOT EXISTS payoneer_list_id TEXT
  `;

  await tx`
    CREATE UNIQUE INDEX IF NOT EXISTS orders_payoneer_list_id_uidx
    ON orders (payoneer_list_id)
    WHERE payoneer_list_id IS NOT NULL
  `;

  await tx`
    CREATE UNIQUE INDEX IF NOT EXISTS inventory_holds_payoneer_list_id_uidx
    ON inventory_holds (payoneer_list_id)
    WHERE payoneer_list_id IS NOT NULL
  `;

  await tx`
    CREATE INDEX IF NOT EXISTS orders_payoneer_transaction_idx
    ON orders (payoneer_transaction_id)
  `;

  await tx`
    CREATE TABLE IF NOT EXISTS payoneer_webhook_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      payoneer_event_id TEXT UNIQUE NOT NULL,
      event_type TEXT NOT NULL,
      livemode BOOLEAN NOT NULL DEFAULT false,
      object_id TEXT,
      processing_status TEXT NOT NULL,
      payload JSONB NOT NULL,
      error_message TEXT,
      processed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await tx`
    CREATE INDEX IF NOT EXISTS payoneer_webhook_events_event_id_idx
    ON payoneer_webhook_events (payoneer_event_id)
  `;
}
