import { sql } from '../../../platform/db';
import type { Order } from '../bookingSchema';

export type AdminOrderListFilters = {
  status?: string;
  departureId?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

export async function listOrdersForAdmin(filters: AdminOrderListFilters): Promise<Order[]> {
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const offset = Math.max(filters.offset ?? 0, 0);

  const result = await sql<Order>`
    SELECT *
    FROM orders
    WHERE (${filters.status}::text IS NULL OR status = ${filters.status})
      AND (${filters.departureId}::text IS NULL OR departure_id = ${filters.departureId}::uuid)
      AND (
        ${filters.search}::text IS NULL OR
        order_number ILIKE '%' || ${filters.search} || '%' OR
        lead_email ILIKE '%' || ${filters.search} || '%' OR
        lead_traveler_name ILIKE '%' || ${filters.search} || '%'
      )
    ORDER BY created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  return result.rows as Order[];
}

export async function getOrderDetailForAdmin(orderNumber: string): Promise<Order | null> {
  const result = await sql<Order>`
    SELECT *
    FROM orders
    WHERE order_number = ${orderNumber}
  `;
  return (result.rows[0] as Order | undefined) ?? null;
}

export async function updateOrderInternalNotes(orderId: string, notes: string): Promise<void> {
  await sql`
    UPDATE orders
    SET internal_notes = ${notes},
        updated_at = NOW()
    WHERE id = ${orderId}
  `;
}
