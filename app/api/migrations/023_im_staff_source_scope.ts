import type { SqlClient } from '../platform/db';

export const name = '023_im_staff_source_scope';

/** Additive, opt-in source scoping for staff; existing accounts stay unrestricted. */
export async function up(tx: SqlClient) {
  await tx`ALTER TABLE im_staff_accounts
    ADD COLUMN IF NOT EXISTS source_scope_enforced BOOLEAN NOT NULL DEFAULT FALSE`;
  await tx`ALTER TABLE im_staff_permissions ADD COLUMN IF NOT EXISTS scope_source TEXT`;

  await tx`ALTER TABLE im_staff_permissions
    DROP CONSTRAINT IF EXISTS im_staff_permissions_scope_type_check`;
  await tx`ALTER TABLE im_staff_permissions
    DROP CONSTRAINT IF EXISTS im_staff_permissions_check`;
  await tx`ALTER TABLE im_staff_permissions
    DROP CONSTRAINT IF EXISTS im_staff_permissions_scope_fields_check`;
  await tx`ALTER TABLE im_staff_permissions
    ADD CONSTRAINT im_staff_permissions_scope_type_check
      CHECK (scope_type IN ('global', 'tenant', 'source'))`;
  await tx`ALTER TABLE im_staff_permissions
    ADD CONSTRAINT im_staff_permissions_scope_fields_check
      CHECK (
        (scope_type = 'global' AND scope_id IS NULL AND scope_source IS NULL)
        OR (scope_type = 'tenant' AND scope_id IS NOT NULL AND scope_source IS NULL)
        OR (scope_type = 'source' AND scope_id IS NULL AND scope_source IS NOT NULL AND length(trim(scope_source)) BETWEEN 1 AND 100)
      )`;

  await tx`DROP INDEX IF EXISTS im_staff_permissions_active_uidx`;
  await tx`CREATE UNIQUE INDEX im_staff_permissions_active_uidx
    ON im_staff_permissions (
      staff_id,
      permission_code,
      scope_type,
      COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'::uuid),
      COALESCE(scope_source, '')
    )
    WHERE revoked_at IS NULL`;
  await tx`DROP INDEX IF EXISTS im_staff_permissions_lookup_idx`;
  await tx`CREATE INDEX im_staff_permissions_lookup_idx
    ON im_staff_permissions (staff_id, scope_type, scope_id, scope_source)
    WHERE revoked_at IS NULL`;
}
