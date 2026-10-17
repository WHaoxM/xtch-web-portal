import type { SqlClient } from '../platform/db';

/** 017 was already applied during the first rollout; provider must use a new migration. */
export const name = '018_wenshu_mail_provider';

export async function up(tx: SqlClient) {
  await tx`ALTER TABLE wenshu_leads
    ADD COLUMN IF NOT EXISTS notification_provider TEXT NOT NULL DEFAULT ''`;
}
