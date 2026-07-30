import type { SqlClient } from '../platform/db';

export const name = '006_inquiries_admin_follow_up';

export async function up(tx: SqlClient) {
  await tx`
    ALTER TABLE inquiries
    ADD COLUMN IF NOT EXISTS internal_notes TEXT NOT NULL DEFAULT ''
  `;

  await tx`
    ALTER TABLE inquiries
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `;

  await tx`
    UPDATE inquiries
    SET status = 'new'
    WHERE status IS NULL
       OR status NOT IN ('new', 'in_progress', 'closed')
  `;

  await tx`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'inquiries_status_check'
      ) THEN
        ALTER TABLE inquiries
        ADD CONSTRAINT inquiries_status_check
        CHECK (status IN ('new', 'in_progress', 'closed'));
      END IF;
    END
    $$
  `;

  await tx`
    CREATE INDEX IF NOT EXISTS inquiries_status_created_at_idx
    ON inquiries (status, created_at DESC)
  `;
}
