import { sql } from '../../platform/db';

export type ContentStatus = 'published' | 'draft' | 'archived';

export type RoutePrimaryType = 'private' | 'group-tour' | 'customizable' | 'fixed-departure';

export type RoutePriceMode = 'on-request' | 'fixed-from' | 'seasonal-table' | 'per-person-range' | 'unavailable';

export type DestinationRow = {
  slug: string;
  name: string;
  description: string | null;
  image: string | null;
  display_order: number;
  status: ContentStatus;
  travel_styles: string[];
  featured_on_home: boolean;
  featured_priority: number;
  created_at: string;
  updated_at: string;
};

export type CategoryScope = 'destination' | 'route';

export type CategoryRow = {
  id: string;
  key: string;
  label: string;
  scope: CategoryScope;
  sort_order: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type RouteRow = {
  slug: string;
  legacy_numeric_id: number | null;
  title: string;
  subtitle: string | null;
  summary: string;
  duration_days: number;
  duration_nights: number | null;
  group_size_display: string | null;
  category: string | null;
  themes: string[];
  pace: string | null;
  physical_level: string | null;
  status: ContentStatus;
  featured: boolean;
  hero_image: string | null;
  pdf_url: string | null;
  price_mode: RoutePriceMode;
  price_display: string;
  price_currency: string | null;
  price_amount_from: number | null;
  price_amount_to: number | null;
  price_notes: string[];
  is_customizable: boolean;
  customization_notes: string | null;
  primary_type: RoutePrimaryType;
  available_types: RoutePrimaryType[];
  experience: string[];
  moments: string[];
  included_support: string[];
  created_at: string;
  updated_at: string;
};

export type ItineraryDayRow = {
  id: string;
  route_slug: string;
  day_number: number;
  title: string | null;
  city: string | null;
  summary: string | null;
  attractions: string[];
  meals: string | null;
  accommodation: string | null;
  transport: string | null;
  notes: string[];
};

export type MediaAssetRow = {
  id: string;
  status: 'review' | 'published' | 'rejected' | 'archived';
  type: 'image' | 'video';
  public_url: string;
  cover_url: string | null;
  title: string;
  alt_text: string | null;
  destination_slugs: string[];
  route_slugs: string[];
  tags: string[];
  rights_status: 'owned' | 'approved' | 'unknown' | 'rejected';
  created_at: string;
  updated_at: string;
};

let tablesEnsured = false;
let ensureInFlight: Promise<void> | null = null;
let columnPatchesInFlight: Promise<void> | null = null;

/**
 * CREATE INDEX IF NOT EXISTS is not fully race-safe under concurrent sessions:
 * two callers can both pass the existence check and one then hits
 * pg_class_relname_nsp_index (23505). Ignore that specific collision.
 */
async function createIndexIfMissing(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === '23505' &&
      'constraint' in error &&
      (error as { constraint?: string }).constraint === 'pg_class_relname_nsp_index'
    ) {
      return;
    }
    throw error;
  }
}

/**
 * Self-healing schema for the Phase 1 dynamic content tables (destinations,
 * routes, route_destinations, media_assets). This intentionally does not
 * reuse `migrations/001_initial_content_schema.ts` â€?that migration has no
 * confirmed run history and `db:migrate` does not exist. Mirrors the
 * `ensureBookingTables()` pattern in `bookingSchema.ts`.
 *
 * Concurrent callers (e.g. destinations + routes on first page load) share one
 * in-flight promise so DDL does not race inside the same Node process.
 */
export async function ensureContentTables() {
  await ensureContentColumnPatches();
  if (tablesEnsured) return;
  if (!ensureInFlight) {
    ensureInFlight = runEnsureContentTables()
      .then(() => {
        tablesEnsured = true;
      })
      .finally(() => {
        ensureInFlight = null;
      });
  }
  return ensureInFlight;
}

/**
 * Idempotent column backfills for tables created before a column was added.
 * Not gated by `tablesEnsured`: HMR and long-lived dev servers must still apply
 * new ADD COLUMN patches after deploy without a full process restart.
 */
async function ensureContentColumnPatches() {
  if (!columnPatchesInFlight) {
    columnPatchesInFlight = runContentColumnPatches().finally(() => {
      columnPatchesInFlight = null;
    });
  }
  return columnPatchesInFlight;
}

async function runContentColumnPatches() {
  await sql`
    ALTER TABLE routes
    ADD COLUMN IF NOT EXISTS legacy_numeric_id INTEGER
  `;
  await sql`
    ALTER TABLE routes
    ADD COLUMN IF NOT EXISTS pdf_url TEXT
  `;
  await sql`
    ALTER TABLE destinations
    ADD COLUMN IF NOT EXISTS travel_styles TEXT[] NOT NULL DEFAULT '{}'
  `;
  await sql`
    ALTER TABLE destinations
    ADD COLUMN IF NOT EXISTS featured_on_home BOOLEAN NOT NULL DEFAULT false
  `;
  await sql`
    ALTER TABLE destinations
    ADD COLUMN IF NOT EXISTS featured_priority INTEGER NOT NULL DEFAULT 0
  `;
  await sql`
    ALTER TABLE routes
    ADD COLUMN IF NOT EXISTS experience TEXT[] NOT NULL DEFAULT '{}'
  `;
  await sql`
    ALTER TABLE routes
    ADD COLUMN IF NOT EXISTS moments TEXT[] NOT NULL DEFAULT '{}'
  `;
  await sql`
    ALTER TABLE routes
    ADD COLUMN IF NOT EXISTS included_support TEXT[] NOT NULL DEFAULT '{}'
  `;
  await sql`
    ALTER TABLE media_assets
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `;
  await sql`
    ALTER TABLE media_assets
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `;
  await sql`
    ALTER TABLE media_assets
    ADD COLUMN IF NOT EXISTS cover_url TEXT
  `;
}

async function runEnsureContentTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS destinations (
      slug TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      image TEXT,
      display_order INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'published',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT destinations_status_known CHECK (status IN ('published', 'draft', 'archived'))
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS routes (
      slug TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      subtitle TEXT,
      summary TEXT NOT NULL,
      duration_days INTEGER NOT NULL,
      duration_nights INTEGER,
      group_size_display TEXT,
      category TEXT,
      themes TEXT[] NOT NULL DEFAULT '{}',
      pace TEXT,
      physical_level TEXT,
      status TEXT NOT NULL DEFAULT 'published',
      featured BOOLEAN NOT NULL DEFAULT false,
      hero_image TEXT,
      price_mode TEXT NOT NULL DEFAULT 'on-request',
      price_display TEXT NOT NULL DEFAULT 'On request',
      price_currency TEXT,
      price_amount_from INTEGER,
      price_amount_to INTEGER,
      price_notes TEXT[] NOT NULL DEFAULT '{}',
      is_customizable BOOLEAN NOT NULL DEFAULT true,
      customization_notes TEXT,
      primary_type TEXT NOT NULL DEFAULT 'customizable',
      available_types TEXT[] NOT NULL DEFAULT '{customizable}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT routes_status_known CHECK (status IN ('published', 'draft', 'archived', 'rejected')),
      CONSTRAINT routes_price_mode_known CHECK (price_mode IN ('on-request', 'fixed-from', 'seasonal-table', 'per-person-range', 'unavailable')),
      CONSTRAINT routes_duration_positive CHECK (duration_days > 0),
      CONSTRAINT routes_primary_type_known CHECK (primary_type IN ('private', 'group-tour', 'customizable', 'fixed-departure'))
    )
  `;

  // Not part of the original 001 migration: needed to keep routePdfDetails.ts
  // (keyed by numeric id) linked after routes move into the database.
  await createIndexIfMissing(
    () =>
      sql`CREATE UNIQUE INDEX IF NOT EXISTS routes_legacy_numeric_id_idx ON routes (legacy_numeric_id) WHERE legacy_numeric_id IS NOT NULL`,
  );

  // Not part of the original 001 migration: dynamic Places/Routes filter
  // categories, managed from Admin instead of the old hardcoded slug/keyword
  // lists in ChinaTripsMobile.tsx. `travel_styles` (below) and `routes.themes`
  // store `categories.key` as a soft reference (no FK) so archiving a
  // category never cascades into an unexpected destination/route delete.
  await sql`
    CREATE TABLE IF NOT EXISTS categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key TEXT NOT NULL,
      label TEXT NOT NULL,
      scope TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      enabled BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT categories_scope_known CHECK (scope IN ('destination', 'route')),
      CONSTRAINT categories_key_scope_unique UNIQUE (key, scope)
    )
  `;

  // Not part of the original 001 migration: structured day-by-day itinerary
  // fields, editable from Admin, that get assembled into the existing
  // "one day, one paragraph" accordion text on both RouteDetail.tsx and
  // ChinaTripsMobile.tsx (see app/src/lib/itineraryText.ts).
  await sql`
    CREATE TABLE IF NOT EXISTS route_itinerary_days (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      route_slug TEXT NOT NULL REFERENCES routes(slug) ON DELETE CASCADE,
      day_number INTEGER NOT NULL,
      title TEXT,
      city TEXT,
      summary TEXT,
      attractions TEXT[] NOT NULL DEFAULT '{}',
      meals TEXT,
      accommodation TEXT,
      transport TEXT,
      notes TEXT[] NOT NULL DEFAULT '{}',
      CONSTRAINT route_itinerary_days_day_positive CHECK (day_number > 0),
      CONSTRAINT route_itinerary_days_unique_day UNIQUE (route_slug, day_number)
    )
  `;
  await createIndexIfMissing(
    () => sql`CREATE INDEX IF NOT EXISTS route_itinerary_days_route_idx ON route_itinerary_days (route_slug)`,
  );

  await sql`
    CREATE TABLE IF NOT EXISTS route_destinations (
      route_slug TEXT NOT NULL REFERENCES routes(slug) ON DELETE CASCADE,
      destination_slug TEXT NOT NULL REFERENCES destinations(slug) ON DELETE CASCADE,
      PRIMARY KEY (route_slug, destination_slug)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS media_assets (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'review',
      type TEXT NOT NULL,
      public_url TEXT NOT NULL,
      cover_url TEXT,
      original_path TEXT,
      title TEXT NOT NULL,
      alt_text TEXT,
      destination_slugs TEXT[] NOT NULL DEFAULT '{}',
      route_slugs TEXT[] NOT NULL DEFAULT '{}',
      usage TEXT[] NOT NULL DEFAULT '{}',
      orientation TEXT,
      tags TEXT[] NOT NULL DEFAULT '{}',
      rights_status TEXT NOT NULL DEFAULT 'unknown',
      internal_source_trace TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT media_assets_status_known CHECK (status IN ('review', 'published', 'rejected', 'archived')),
      CONSTRAINT media_assets_type_known CHECK (type IN ('image', 'video')),
      CONSTRAINT media_assets_rights_known CHECK (rights_status IN ('owned', 'approved', 'unknown', 'rejected'))
    )
  `;

  await createIndexIfMissing(() => sql`CREATE INDEX IF NOT EXISTS destinations_status_idx ON destinations (status)`);
  await createIndexIfMissing(
    () =>
      sql`CREATE INDEX IF NOT EXISTS destinations_featured_home_idx ON destinations (featured_on_home, featured_priority ASC)`,
  );
  await createIndexIfMissing(
    () => sql`CREATE INDEX IF NOT EXISTS categories_scope_idx ON categories (scope, sort_order ASC)`,
  );
  await createIndexIfMissing(() => sql`CREATE INDEX IF NOT EXISTS routes_status_idx ON routes (status)`);
  await createIndexIfMissing(
    () => sql`CREATE INDEX IF NOT EXISTS routes_featured_idx ON routes (featured) WHERE featured = true`,
  );
  await createIndexIfMissing(
    () => sql`CREATE INDEX IF NOT EXISTS route_destinations_destination_idx ON route_destinations (destination_slug)`,
  );
  await createIndexIfMissing(() => sql`CREATE INDEX IF NOT EXISTS media_assets_status_idx ON media_assets (status)`);
  await createIndexIfMissing(
    () => sql`CREATE INDEX IF NOT EXISTS media_assets_route_idx ON media_assets USING GIN (route_slugs)`,
  );
  await createIndexIfMissing(
    () => sql`CREATE INDEX IF NOT EXISTS media_assets_destination_idx ON media_assets USING GIN (destination_slugs)`,
  );
}
