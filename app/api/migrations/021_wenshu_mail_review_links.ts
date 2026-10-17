import type { SqlClient } from '../platform/db';

export const name = '021_wenshu_mail_review_links';

export async function up(tx: SqlClient) {
  await tx`CREATE TABLE IF NOT EXISTS wenshu_lead_review_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES wenshu_leads(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    consumed_at TIMESTAMPTZ
  )`;
  await tx`CREATE INDEX IF NOT EXISTS wenshu_lead_review_links_lead_idx
    ON wenshu_lead_review_links (lead_id, created_at DESC)`;
}
