import type { SqlClient } from '../platform/db';

export const name = '020_wenshu_customer_followup';

export async function up(tx: SqlClient) {
  await tx`CREATE TABLE IF NOT EXISTS wenshu_lead_followups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES wenshu_leads(id) ON DELETE CASCADE,
    request_id UUID NOT NULL UNIQUE,
    recipient_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    requested_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    claimed_at TIMESTAMPTZ,
    attempted_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    provider TEXT NOT NULL DEFAULT '',
    last_error TEXT NOT NULL DEFAULT ''
  )`;
  await tx`CREATE INDEX IF NOT EXISTS wenshu_lead_followups_lead_created_idx
    ON wenshu_lead_followups (lead_id, created_at DESC)`;
}
