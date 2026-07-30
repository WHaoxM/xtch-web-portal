import type { SqlClient } from '../platform/db';

export const name = '005_departures_featured_home';

export async function up(tx: SqlClient) {
  await tx`
    ALTER TABLE departures
    ADD COLUMN IF NOT EXISTS featured_on_home BOOLEAN NOT NULL DEFAULT false
  `;

  await tx`
    ALTER TABLE departures
    ADD COLUMN IF NOT EXISTS featured_priority INTEGER NOT NULL DEFAULT 0
  `;

  await tx`
    CREATE INDEX IF NOT EXISTS departures_featured_home_idx
    ON departures (featured_on_home, featured_priority ASC, start_date ASC)
  `;
}
