import type { SqlClient } from '../platform/db';

/** Keep customer mail independent of the existing internal notification state. */
export const name = '019_wenshu_customer_confirmation';

export async function up(tx: SqlClient) {
  await tx`ALTER TABLE wenshu_leads
    ADD COLUMN IF NOT EXISTS intent TEXT NOT NULL DEFAULT 'growth_plan',
    ADD COLUMN IF NOT EXISTS customer_confirmation_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS customer_confirmation_sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS customer_confirmation_attempted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS customer_confirmation_claimed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS customer_confirmation_provider TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS customer_confirmation_last_error TEXT NOT NULL DEFAULT ''`;
}
