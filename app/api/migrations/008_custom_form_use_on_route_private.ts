import type { SqlClient } from '../platform/db';

export const name = '008_custom_form_use_on_route_private';

export async function up(tx: SqlClient) {
  await tx`
    ALTER TABLE custom_trip_form_fields
    ADD COLUMN IF NOT EXISTS use_on_route_private BOOLEAN NOT NULL DEFAULT false
  `;

  // Preserve previous short-form behavior: basic-group fields appear on route private.
  await tx`
    UPDATE custom_trip_form_fields
    SET use_on_route_private = true
    WHERE form_group = 'basic'
      AND use_on_route_private = false
  `;
}
