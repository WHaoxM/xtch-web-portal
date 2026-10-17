import type { SqlClient } from '../platform/db';

export const name = '017_wenshu_lead_notifications';

export async function up(tx: SqlClient) {
  await tx`ALTER TABLE wenshu_leads
    ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS notification_attempted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS notification_claimed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS notification_provider TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS notification_last_error TEXT NOT NULL DEFAULT ''`;
}
