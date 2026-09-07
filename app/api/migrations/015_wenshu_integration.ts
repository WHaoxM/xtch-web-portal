import type { SqlClient } from '../platform/db';
export const name = '015_wenshu_integration';
export async function up(tx: SqlClient) {
  await tx`CREATE TABLE IF NOT EXISTS wenshu_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), request_id UUID NOT NULL UNIQUE,
    source TEXT NOT NULL DEFAULT 'wenshuzhilv' CHECK (source = 'wenshuzhilv'),
    name TEXT NOT NULL, phone TEXT NOT NULL, company TEXT NOT NULL,
    company_address TEXT NOT NULL, business_type TEXT NOT NULL,
    entry TEXT NOT NULL, page_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await tx`CREATE INDEX IF NOT EXISTS wenshu_leads_created_idx ON wenshu_leads (created_at DESC)`;
  await tx`CREATE TABLE IF NOT EXISTS wenshu_request_limits (
    bucket TEXT PRIMARY KEY, window_start TIMESTAMPTZ NOT NULL, count INTEGER NOT NULL
  )`;
  await tx`ALTER TABLE im_conversations DROP CONSTRAINT IF EXISTS im_conversations_source_check`;
  await tx`ALTER TABLE im_conversations ADD CONSTRAINT im_conversations_source_check
    CHECK (source IN ('portal_web', 'portal_mobile', 'xt_mvp_mobile', 'wenshuzhilv'))`;
}
