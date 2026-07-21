import type { SqlClient } from '../lib/db';

export const name = '002_baseline_booking_tables';

export async function up(tx: SqlClient) {
  await tx`
    CREATE TABLE IF NOT EXISTS departures (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      public_id TEXT UNIQUE NOT NULL,
      route_slug TEXT NOT NULL,
      route_title TEXT NOT NULL,
      destination_slug TEXT,
      departure_city TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      status TEXT NOT NULL,
      guaranteed BOOLEAN NOT NULL DEFAULT false,
      adult_unit_price_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'usd',
      capacity INTEGER NOT NULL,
      included_core_items JSONB NOT NULL DEFAULT '[]'::jsonb,
      excluded_core_items JSONB NOT NULL DEFAULT '[]'::jsonb,
      important_notes JSONB NOT NULL DEFAULT '[]'::jsonb,
      cancellation_policy_snapshot JSONB NOT NULL,
      policy_version TEXT NOT NULL,
      confirmation_rule TEXT NOT NULL,
      locked_at TIMESTAMPTZ,
      closed_at TIMESTAMPTZ,
      cancelled_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT departures_price_positive CHECK (adult_unit_price_cents > 0),
      CONSTRAINT departures_capacity_positive CHECK (capacity > 0),
      CONSTRAINT departures_end_after_start CHECK (end_date >= start_date),
      CONSTRAINT departures_currency_usd CHECK (currency = 'usd'),
      CONSTRAINT departures_status_known CHECK (status IN ('draft', 'sellable', 'locked', 'closed', 'sold_out', 'cancelled'))
    )
  `;

  await tx`
    CREATE TABLE IF NOT EXISTS orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_number TEXT UNIQUE NOT NULL,
      access_token_hash TEXT NOT NULL,
      user_id TEXT,
      departure_id UUID NOT NULL REFERENCES departures(id),
      status TEXT NOT NULL,
      payment_status TEXT NOT NULL,
      refund_status TEXT NOT NULL DEFAULT 'none',
      traveler_details_status TEXT NOT NULL,
      confirmation_email_status TEXT NOT NULL,
      lead_traveler_name TEXT NOT NULL,
      lead_email TEXT NOT NULL,
      lead_phone TEXT,
      adult_quantity INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'usd',
      adult_unit_price_cents INTEGER NOT NULL,
      total_price_cents INTEGER NOT NULL,
      route_snapshot JSONB NOT NULL,
      price_snapshot JSONB NOT NULL,
      policy_snapshot JSONB NOT NULL,
      policy_version TEXT NOT NULL,
      traveler_details_due_at TIMESTAMPTZ,
      stripe_checkout_session_id TEXT UNIQUE,
      stripe_payment_intent_id TEXT,
      stripe_charge_id TEXT,
      stripe_refund_id TEXT,
      paid_at TIMESTAMPTZ,
      confirmed_at TIMESTAMPTZ,
      expired_at TIMESTAMPTZ,
      cancelled_at TIMESTAMPTZ,
      refunded_at TIMESTAMPTZ,
      cancellation_requested_at TIMESTAMPTZ,
      date_change_requested_at TIMESTAMPTZ,
      internal_notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT orders_quantity_positive CHECK (adult_quantity > 0),
      CONSTRAINT orders_price_positive CHECK (adult_unit_price_cents > 0),
      CONSTRAINT orders_total_matches CHECK (total_price_cents = adult_quantity * adult_unit_price_cents),
      CONSTRAINT orders_status_known CHECK (status IN ('pending_payment', 'confirmed', 'cancellation_requested', 'cancelled', 'refunded', 'failed', 'expired')),
      CONSTRAINT orders_payment_status_known CHECK (payment_status IN ('unpaid', 'paid', 'partially_refunded', 'refunded', 'failed')),
      CONSTRAINT orders_refund_status_known CHECK (refund_status IN ('none', 'pending', 'partially_refunded', 'refunded')),
      CONSTRAINT orders_traveler_status_known CHECK (traveler_details_status IN ('traveler_details_pending', 'traveler_details_submitted', 'needs_manual_follow_up')),
      CONSTRAINT orders_email_status_known CHECK (confirmation_email_status IN ('confirmation_email_pending', 'confirmation_email_sent', 'confirmation_email_failed', 'confirmation_email_retrying', 'confirmation_email_traveler_sent')),
      CONSTRAINT orders_currency_usd CHECK (currency = 'usd')
    )
  `;

  await tx`
    CREATE TABLE IF NOT EXISTS inventory_holds (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      departure_id UUID NOT NULL REFERENCES departures(id),
      order_id UUID NOT NULL REFERENCES orders(id),
      adult_quantity INTEGER NOT NULL,
      status TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      stripe_checkout_session_id TEXT UNIQUE,
      released_at TIMESTAMPTZ,
      consumed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT holds_quantity_positive CHECK (adult_quantity > 0),
      CONSTRAINT holds_status_known CHECK (status IN ('active', 'consumed', 'released', 'expired'))
    )
  `;

  await tx`
    CREATE TABLE IF NOT EXISTS stripe_webhook_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      stripe_event_id TEXT UNIQUE NOT NULL,
      event_type TEXT NOT NULL,
      livemode BOOLEAN NOT NULL DEFAULT false,
      object_id TEXT,
      object_type TEXT,
      processing_status TEXT NOT NULL,
      payload JSONB NOT NULL,
      error_message TEXT,
      processed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await tx`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_type TEXT NOT NULL,
      actor_email TEXT,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      ip_hash TEXT,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

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

  await tx`ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id TEXT`;

  await tx`CREATE INDEX IF NOT EXISTS departures_public_id_idx ON departures (public_id)`;
  await tx`CREATE INDEX IF NOT EXISTS departures_status_idx ON departures (status)`;
  await tx`CREATE INDEX IF NOT EXISTS departures_route_slug_idx ON departures (route_slug)`;

  await tx`CREATE INDEX IF NOT EXISTS orders_order_number_idx ON orders (order_number)`;
  await tx`CREATE INDEX IF NOT EXISTS orders_user_id_idx ON orders (user_id)`;
  await tx`CREATE INDEX IF NOT EXISTS orders_departure_id_idx ON orders (departure_id)`;
  await tx`CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status)`;
  await tx`CREATE INDEX IF NOT EXISTS orders_stripe_session_idx ON orders (stripe_checkout_session_id)`;

  await tx`CREATE INDEX IF NOT EXISTS inventory_holds_departure_id_idx ON inventory_holds (departure_id)`;
  await tx`CREATE INDEX IF NOT EXISTS inventory_holds_order_id_idx ON inventory_holds (order_id)`;
  await tx`CREATE INDEX IF NOT EXISTS inventory_holds_status_idx ON inventory_holds (status)`;
  await tx`CREATE INDEX IF NOT EXISTS inventory_holds_session_idx ON inventory_holds (stripe_checkout_session_id)`;

  await tx`CREATE INDEX IF NOT EXISTS stripe_webhook_events_event_id_idx ON stripe_webhook_events (stripe_event_id)`;
  await tx`CREATE INDEX IF NOT EXISTS audit_logs_target_idx ON audit_logs (target_type, target_id)`;

  await tx`CREATE INDEX IF NOT EXISTS inquiries_created_at_idx ON inquiries (created_at DESC)`;
  await tx`CREATE INDEX IF NOT EXISTS inquiries_email_created_at_idx ON inquiries (email, created_at DESC)`;
}
