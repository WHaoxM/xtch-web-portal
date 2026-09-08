import type { SqlClient } from '../platform/db';

/** Persist the complete offline-message payload alongside the lead receipt. */
export const name = '016_wenshu_lead_details';

export async function up(tx: SqlClient) {
  await tx`ALTER TABLE wenshu_leads
    ADD COLUMN IF NOT EXISTS message TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT ''`;
}
