/** Tables included in content / business backup packs (allowlisted identifiers only). */

export const CONTENT_TABLES = [
  'destinations',
  'routes',
  'route_destinations',
  'route_itinerary_days',
  'media_assets',
  'categories',
] as const;

/** Booking, inquiries, form config, and other operational tables. */
export const BUSINESS_TABLES = [
  'custom_trip_form_fields',
  'custom_trip_form_options',
  'departures',
  'orders',
  'inventory_holds',
  'inquiries',
  'stripe_webhook_events',
  'audit_logs',
  'guide_articles',
  'route_sources',
  'route_inclusions',
] as const;

export type BackupScope = 'content' | 'business' | 'all';

export function tablesForScope(scope: BackupScope): string[] {
  if (scope === 'content') return [...CONTENT_TABLES];
  if (scope === 'business') return [...BUSINESS_TABLES];
  return [...CONTENT_TABLES, ...BUSINESS_TABLES];
}

/** Upsert conflict targets (PK or unique natural key). Import order matters for FKs. */
export const IMPORT_PLAN: { table: string; conflict: string; group: 'content' | 'business' }[] = [
  { table: 'categories', conflict: 'id', group: 'content' },
  { table: 'destinations', conflict: 'slug', group: 'content' },
  { table: 'routes', conflict: 'slug', group: 'content' },
  { table: 'route_destinations', conflict: 'route_slug, destination_slug', group: 'content' },
  { table: 'route_itinerary_days', conflict: 'id', group: 'content' },
  { table: 'media_assets', conflict: 'id', group: 'content' },
  { table: 'guide_articles', conflict: 'slug', group: 'business' },
  { table: 'route_sources', conflict: 'id', group: 'business' },
  { table: 'route_inclusions', conflict: 'id', group: 'business' },
  { table: 'custom_trip_form_fields', conflict: 'id', group: 'business' },
  { table: 'custom_trip_form_options', conflict: 'id', group: 'business' },
  { table: 'departures', conflict: 'id', group: 'business' },
  { table: 'orders', conflict: 'id', group: 'business' },
  { table: 'inventory_holds', conflict: 'id', group: 'business' },
  { table: 'inquiries', conflict: 'id', group: 'business' },
  { table: 'stripe_webhook_events', conflict: 'id', group: 'business' },
  { table: 'audit_logs', conflict: 'id', group: 'business' },
];
