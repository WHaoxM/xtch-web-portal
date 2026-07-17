import type { SqlClient } from '../lib/db';

export const name = '009_normalize_order_route_snapshot_dates';

/**
 * Normalize orders.route_snapshot start_date / end_date to YYYY-MM-DD.
 * Does not touch departures rows.
 *
 * ISO timestamps like 2026-07-16T16:00:00.000Z are local-midnight Date
 * serializations (UTC+8); convert via Asia/Shanghai calendar date.
 */
export async function up(tx: SqlClient) {
  await tx`
    UPDATE orders
    SET route_snapshot = jsonb_set(
      jsonb_set(
        route_snapshot,
        '{start_date}',
        to_jsonb(
          CASE
            WHEN COALESCE(route_snapshot->>'start_date', '') = '' THEN ''
            WHEN route_snapshot->>'start_date' ~ '^\d{4}-\d{2}-\d{2}$'
              THEN route_snapshot->>'start_date'
            WHEN route_snapshot->>'start_date' ~ 'T'
              THEN to_char(
                (route_snapshot->>'start_date')::timestamptz AT TIME ZONE 'Asia/Shanghai',
                'YYYY-MM-DD'
              )
            WHEN route_snapshot->>'start_date' ~ '^\d{4}-\d{2}-\d{2}'
              THEN left(route_snapshot->>'start_date', 10)
            ELSE route_snapshot->>'start_date'
          END
        ),
        true
      ),
      '{end_date}',
      to_jsonb(
        CASE
          WHEN COALESCE(route_snapshot->>'end_date', '') = '' THEN ''
          WHEN route_snapshot->>'end_date' ~ '^\d{4}-\d{2}-\d{2}$'
            THEN route_snapshot->>'end_date'
          WHEN route_snapshot->>'end_date' ~ 'T'
            THEN to_char(
              (route_snapshot->>'end_date')::timestamptz AT TIME ZONE 'Asia/Shanghai',
              'YYYY-MM-DD'
            )
          WHEN route_snapshot->>'end_date' ~ '^\d{4}-\d{2}-\d{2}'
            THEN left(route_snapshot->>'end_date', 10)
          ELSE route_snapshot->>'end_date'
        END
      ),
      true
    ),
    updated_at = NOW()
    WHERE route_snapshot ? 'start_date'
      OR route_snapshot ? 'end_date'
  `;
}
