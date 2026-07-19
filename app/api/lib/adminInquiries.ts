import { sql } from './db';

export const INQUIRY_STATUSES = ['new', 'in_progress', 'closed'] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

export const INQUIRY_TYPES = ['quick_contact', 'custom_trip', 'route_private', 'group_tour_inquiry'] as const;
export type InquiryType = (typeof INQUIRY_TYPES)[number];

export type AdminInquiry = {
  id: string;
  type: string;
  status: string;
  name: string;
  email: string;
  phone: string | null;
  travel_month: string | null;
  travelers: string | null;
  trip_length: string | null;
  budget: string | null;
  destinations: unknown;
  interests: unknown;
  hotel_level: string | null;
  travel_style: string | null;
  support_preference: string | null;
  requested_tour: string | null;
  requested_destination: string | null;
  message: string | null;
  source_path: string | null;
  user_agent: string | null;
  email_status: string;
  custom_preferences: unknown;
  internal_notes: string;
  created_at: string;
  updated_at: string;
};

export type AdminInquiryListFilters = {
  /** Single status, or `open` for new + in_progress. Omit for all. */
  status?: string;
  type?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

export function isInquiryStatus(value: string): value is InquiryStatus {
  return (INQUIRY_STATUSES as readonly string[]).includes(value);
}

export async function listInquiriesForAdmin(
  filters: AdminInquiryListFilters,
): Promise<AdminInquiry[]> {
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const offset = Math.max(filters.offset ?? 0, 0);
  const statusFilter = filters.status?.trim() || null;
  const typeFilter = filters.type?.trim() || null;
  const search = filters.search?.trim() || null;
  const openOnly = statusFilter === 'open';
  const exactStatus = openOnly || !statusFilter ? null : statusFilter;

  const result = await sql<AdminInquiry>`
    SELECT
      id,
      type,
      status,
      name,
      email,
      phone,
      travel_month,
      travelers,
      trip_length,
      budget,
      destinations,
      interests,
      hotel_level,
      travel_style,
      support_preference,
      requested_tour,
      requested_destination,
      message,
      source_path,
      user_agent,
      email_status,
      custom_preferences,
      COALESCE(internal_notes, '') AS internal_notes,
      created_at,
      COALESCE(updated_at, created_at) AS updated_at
    FROM inquiries
    WHERE (
        ${openOnly}::boolean = false
        OR status IN ('new', 'in_progress')
      )
      AND (
        ${exactStatus}::text IS NULL
        OR status = ${exactStatus}
      )
      AND (
        ${typeFilter}::text IS NULL
        OR type = ${typeFilter}
      )
      AND (
        ${search}::text IS NULL
        OR name ILIKE '%' || ${search} || '%'
        OR email ILIKE '%' || ${search} || '%'
      )
    ORDER BY created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  return result.rows as AdminInquiry[];
}

export async function getInquiryForAdmin(id: string): Promise<AdminInquiry | null> {
  const result = await sql<AdminInquiry>`
    SELECT
      id,
      type,
      status,
      name,
      email,
      phone,
      travel_month,
      travelers,
      trip_length,
      budget,
      destinations,
      interests,
      hotel_level,
      travel_style,
      support_preference,
      requested_tour,
      requested_destination,
      message,
      source_path,
      user_agent,
      email_status,
      custom_preferences,
      COALESCE(internal_notes, '') AS internal_notes,
      created_at,
      COALESCE(updated_at, created_at) AS updated_at
    FROM inquiries
    WHERE id = ${id}::uuid
  `;

  return (result.rows[0] as AdminInquiry | undefined) ?? null;
}

export async function updateInquiryStatus(id: string, status: InquiryStatus): Promise<void> {
  await sql`
    UPDATE inquiries
    SET status = ${status},
        updated_at = NOW()
    WHERE id = ${id}::uuid
  `;
}

export async function updateInquiryInternalNotes(id: string, notes: string): Promise<void> {
  await sql`
    UPDATE inquiries
    SET internal_notes = ${notes},
        updated_at = NOW()
    WHERE id = ${id}::uuid
  `;
}
