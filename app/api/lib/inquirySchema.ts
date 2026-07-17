import { sql } from './db';

/**
 * Self-heal inquiries table for fresh local DBs that never ran migration 002
 * and have not yet hit POST /api/inquiries.
 */
export async function ensureInquiryTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS inquiries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      travel_month TEXT,
      travelers TEXT,
      trip_length TEXT,
      budget TEXT,
      destinations JSONB NOT NULL DEFAULT '[]'::jsonb,
      interests JSONB NOT NULL DEFAULT '[]'::jsonb,
      hotel_level TEXT,
      travel_style TEXT,
      support_preference TEXT,
      requested_tour TEXT,
      requested_destination TEXT,
      message TEXT,
      source_path TEXT,
      user_agent TEXT,
      ip_hash TEXT,
      email_status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS inquiries_created_at_idx
    ON inquiries (created_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS inquiries_email_created_at_idx
    ON inquiries (email, created_at DESC)
  `;

  await sql`
    ALTER TABLE inquiries
    ADD COLUMN IF NOT EXISTS custom_preferences JSONB NOT NULL DEFAULT '{}'::jsonb
  `;

  await sql`
    ALTER TABLE inquiries
    ADD COLUMN IF NOT EXISTS internal_notes TEXT NOT NULL DEFAULT ''
  `;

  await sql`
    ALTER TABLE inquiries
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `;

  await sql`
    UPDATE inquiries
    SET status = 'new'
    WHERE status IS NULL
       OR status NOT IN ('new', 'in_progress', 'closed')
  `;

  try {
    await sql`
      ALTER TABLE inquiries
      ADD CONSTRAINT inquiries_status_check
      CHECK (status IN ('new', 'in_progress', 'closed'))
    `;
  } catch (error) {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: unknown }).code ?? '')
        : '';
    const message = error instanceof Error ? error.message : String(error);
    // 42710 = duplicate_object
    if (code !== '42710' && !message.includes('inquiries_status_check')) {
      throw error;
    }
  }

  await sql`
    CREATE INDEX IF NOT EXISTS inquiries_status_created_at_idx
    ON inquiries (status, created_at DESC)
  `;
}
