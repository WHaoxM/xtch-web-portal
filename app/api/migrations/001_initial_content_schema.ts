import type { SqlClient } from '../platform/db';

export const name = '001_initial_content_schema';

export async function up(tx: SqlClient) {
  await tx`
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

  await tx`
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
      CONSTRAINT routes_primary_type_known CHECK (primary_type IN ('private', 'small-group', 'customizable', 'fixed-departure'))
    )
  `;

  await tx`
    CREATE TABLE IF NOT EXISTS route_destinations (
      route_slug TEXT NOT NULL REFERENCES routes(slug) ON DELETE CASCADE,
      destination_slug TEXT NOT NULL REFERENCES destinations(slug) ON DELETE CASCADE,
      PRIMARY KEY (route_slug, destination_slug)
    )
  `;

  await tx`
    CREATE TABLE IF NOT EXISTS route_itinerary_days (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      route_slug TEXT NOT NULL REFERENCES routes(slug) ON DELETE CASCADE,
      day_number INTEGER NOT NULL,
      title TEXT NOT NULL,
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

  await tx`
    CREATE TABLE IF NOT EXISTS route_inclusions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      route_slug TEXT NOT NULL REFERENCES routes(slug) ON DELETE CASCADE,
      item TEXT NOT NULL,
      kind TEXT NOT NULL,
      CONSTRAINT route_inclusions_kind_known CHECK (kind IN ('included', 'excluded'))
    )
  `;

  await tx`
    CREATE TABLE IF NOT EXISTS media_assets (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'review',
      type TEXT NOT NULL,
      public_url TEXT NOT NULL,
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

  await tx`
    CREATE TABLE IF NOT EXISTS guide_articles (
      slug TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      eyebrow TEXT,
      image TEXT,
      summary TEXT,
      sections JSONB NOT NULL DEFAULT '[]'::jsonb
    )
  `;

  await tx`
    CREATE TABLE IF NOT EXISTS route_sources (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      route_slug TEXT NOT NULL REFERENCES routes(slug) ON DELETE CASCADE,
      raw_file_id TEXT,
      path_or_url TEXT,
      extracted_at TIMESTAMPTZ,
      evidence_notes TEXT
    )
  `;

  await tx`CREATE INDEX IF NOT EXISTS routes_status_idx ON routes (status)`;
  await tx`CREATE INDEX IF NOT EXISTS routes_featured_idx ON routes (featured) WHERE featured = true`;
  await tx`CREATE INDEX IF NOT EXISTS routes_category_idx ON routes (category)`;
  await tx`CREATE INDEX IF NOT EXISTS route_destinations_destination_idx ON route_destinations (destination_slug)`;
  await tx`CREATE INDEX IF NOT EXISTS route_itinerary_days_route_idx ON route_itinerary_days (route_slug)`;
  await tx`CREATE INDEX IF NOT EXISTS route_inclusions_route_idx ON route_inclusions (route_slug)`;
  await tx`CREATE INDEX IF NOT EXISTS media_assets_status_idx ON media_assets (status)`;
  await tx`CREATE INDEX IF NOT EXISTS media_assets_route_idx ON media_assets USING GIN (route_slugs)`;
  await tx`CREATE INDEX IF NOT EXISTS media_assets_destination_idx ON media_assets USING GIN (destination_slugs)`;
}
