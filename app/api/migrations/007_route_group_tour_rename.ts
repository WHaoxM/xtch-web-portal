import type { SqlClient } from '../lib/db';

export const name = '007_route_group_tour_rename';

export async function up(tx: SqlClient) {
  await tx`ALTER TABLE routes DROP CONSTRAINT IF EXISTS routes_primary_type_known`;
  await tx`UPDATE routes SET primary_type = 'group-tour' WHERE primary_type = 'small-group'`;
  await tx`UPDATE routes SET available_types = array_replace(available_types, 'small-group', 'group-tour')`;
  await tx`ALTER TABLE routes ADD CONSTRAINT routes_primary_type_known
    CHECK (primary_type IN ('private', 'group-tour', 'customizable', 'fixed-departure'))`;
}
