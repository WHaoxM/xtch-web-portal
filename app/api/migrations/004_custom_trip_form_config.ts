import type { SqlClient } from '../platform/db';

export const name = '004_custom_trip_form_config';

export async function up(tx: SqlClient) {
  await tx`
    CREATE TABLE IF NOT EXISTS custom_trip_form_fields (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      field_key TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      control_type TEXT NOT NULL,
      required BOOLEAN NOT NULL DEFAULT false,
      default_value JSONB NOT NULL DEFAULT 'null'::jsonb,
      form_group TEXT NOT NULL DEFAULT 'more',
      sort_order INTEGER NOT NULL DEFAULT 0,
      enabled BOOLEAN NOT NULL DEFAULT true,
      key_locked BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT custom_trip_form_fields_control_type_known
        CHECK (control_type IN ('single_select', 'multi_select', 'select', 'text', 'textarea')),
      CONSTRAINT custom_trip_form_fields_group_known
        CHECK (form_group IN ('basic', 'more'))
    )
  `;

  await tx`
    CREATE TABLE IF NOT EXISTS custom_trip_form_options (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      field_id UUID NOT NULL REFERENCES custom_trip_form_fields(id) ON DELETE CASCADE,
      option_key TEXT NOT NULL,
      label TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      enabled BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (field_id, option_key)
    )
  `;

  // Migration 002 creates inquiries; still self-heal if 004 runs alone on a partial DB.
  await tx`
    CREATE TABLE IF NOT EXISTS inquiries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      travel_month TEXT,
      travelers TEXT,
      trip_length TEXT,
      budget TEXT,
      destinations JSONB NOT NULL DEFAULT '[]'::jsonb,
      interests JSONB NOT NULL DEFAULT '[]'::jsonb,
      hotel_level TEXT,
      travel_style TEXT,
      support_preference TEXT,
      requested_tour TEXT,
      requested_destination TEXT,
      message TEXT,
      source_path TEXT,
      user_agent TEXT,
      ip_hash TEXT,
      email_status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await tx`
    ALTER TABLE inquiries
    ADD COLUMN IF NOT EXISTS custom_preferences JSONB NOT NULL DEFAULT '{}'::jsonb
  `;

  await tx`CREATE INDEX IF NOT EXISTS custom_trip_form_fields_sort_idx ON custom_trip_form_fields (form_group, sort_order)`;
  await tx`CREATE INDEX IF NOT EXISTS custom_trip_form_options_field_sort_idx ON custom_trip_form_options (field_id, sort_order)`;
}
