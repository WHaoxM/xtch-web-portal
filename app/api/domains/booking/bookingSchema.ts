import { sql } from '../../platform/db';

export type DepartureStatus =
  | 'draft'
  | 'sellable'
  | 'locked'
  | 'closed'
  | 'sold_out'
  | 'cancelled';

export type OrderStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'cancellation_requested'
  | 'cancelled'
  | 'refunded'
  | 'failed'
  | 'expired';

export type PaymentStatus = 'unpaid' | 'paid' | 'partially_refunded' | 'refunded' | 'failed';

export type RefundStatus = 'none' | 'pending' | 'partially_refunded' | 'refunded';

export type TravelerDetailsStatus =
  | 'traveler_details_pending'
  | 'traveler_details_submitted'
  | 'needs_manual_follow_up';

export type ConfirmationEmailStatus =
  | 'confirmation_email_pending'
  | 'confirmation_email_sent'
  | 'confirmation_email_failed'
  | 'confirmation_email_retrying'
  | 'confirmation_email_traveler_sent';

export type HoldStatus = 'active' | 'consumed' | 'released' | 'expired';

export type WebhookProcessingStatus = 'processing' | 'processed' | 'ignored' | 'failed';

export type { ActorType } from '../../platform/actorTypes';

export type PaymentProviderName = 'stripe' | 'payoneer';

export type Departure = {
  id: string;
  public_id: string;
  route_slug: string;
  route_title: string;
  destination_slug: string | null;
  departure_city: string;
  start_date: string;
  end_date: string;
  status: DepartureStatus;
  guaranteed: boolean;
  adult_unit_price_cents: number;
  currency: string;
  capacity: number;
  featured_on_home: boolean;
  featured_priority: number;
  included_core_items: unknown[];
  excluded_core_items: unknown[];
  important_notes: unknown[];
  cancellation_policy_snapshot: unknown;
  policy_version: string;
  confirmation_rule: string;
  locked_at: string | null;
  closed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomerDeparture = {
  public_id: string;
  route_slug: string;
  route_title: string;
  destination_slug: string | null;
  departure_city: string;
  start_date: string;
  end_date: string;
  guaranteed: boolean;
  adult_unit_price_cents: number;
  currency: string;
  capacity: number;
  available_seats: number;
  confirmed_roster: {
    male: number;
    female: number;
    unknown: number;
    total: number;
  };
  included_core_items: unknown[];
  excluded_core_items: unknown[];
  important_notes: unknown[];
  cancellation_policy_snapshot: unknown;
  confirmation_rule: string;
};

export type Order = {
  id: string;
  order_number: string;
  access_token_hash: string;
  user_id: string | null;
  departure_id: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  refund_status: RefundStatus;
  traveler_details_status: TravelerDetailsStatus;
  confirmation_email_status: ConfirmationEmailStatus;
  lead_traveler_name: string;
  lead_email: string;
  lead_phone: string | null;
  travelers: unknown;
  adult_quantity: number;
  currency: string;
  adult_unit_price_cents: number;
  total_price_cents: number;
  route_snapshot: unknown;
  price_snapshot: unknown;
  policy_snapshot: unknown;
  policy_version: string;
  traveler_details_due_at: string | null;
  payment_provider: PaymentProviderName | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  stripe_refund_id: string | null;
  payoneer_list_id: string | null;
  payoneer_transaction_id: string | null;
  payoneer_charge_id: string | null;
  paid_at: string | null;
  confirmed_at: string | null;
  expired_at: string | null;
  cancelled_at: string | null;
  refunded_at: string | null;
  cancellation_requested_at: string | null;
  date_change_requested_at: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
};

let tablesEnsured = false;

export async function ensureBookingTables() {
  if (tablesEnsured) return;

  await sql`
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

  await sql`
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
      travelers JSONB NOT NULL DEFAULT '[]'::jsonb,
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

  await sql`
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

  await sql`
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

  await sql`
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

  await sql`
    CREATE TABLE IF NOT EXISTS departure_refill_chains (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      chain_key TEXT UNIQUE NOT NULL,
      route_slug TEXT NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT false,
      max_auto_activations INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT refill_chain_key_not_blank CHECK (BTRIM(chain_key) <> ''),
      CONSTRAINT refill_chain_max_range CHECK (max_auto_activations BETWEEN 1 AND 1000)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS departure_refill_chain_members (
      chain_id UUID NOT NULL REFERENCES departure_refill_chains(id) ON DELETE CASCADE,
      departure_id UUID PRIMARY KEY REFERENCES departures(id) ON DELETE CASCADE,
      sequence INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT refill_member_sequence_range CHECK (sequence BETWEEN 1 AND 1000),
      CONSTRAINT refill_member_chain_sequence_unique UNIQUE (chain_id, sequence)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS departure_refill_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      chain_id UUID NOT NULL REFERENCES departure_refill_chains(id),
      source_departure_id UUID NOT NULL REFERENCES departures(id),
      trigger_order_id UUID NOT NULL REFERENCES orders(id),
      activated_departure_id UUID REFERENCES departures(id),
      outcome TEXT NOT NULL,
      confirmed_seats INTEGER NOT NULL,
      capacity INTEGER NOT NULL,
      activation_count INTEGER NOT NULL,
      max_auto_activations INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT refill_event_trigger_unique UNIQUE (trigger_order_id),
      CONSTRAINT refill_event_outcome_known CHECK (
        outcome IN ('activated', 'limit_reached', 'no_next_departure')
      )
    )
  `;

  await sql`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS user_id TEXT
  `;

  await sql`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS travelers JSONB NOT NULL DEFAULT '[]'::jsonb
  `;

  await sql`
    ALTER TABLE departures
    ADD COLUMN IF NOT EXISTS featured_on_home BOOLEAN NOT NULL DEFAULT false
  `;

  await sql`
    ALTER TABLE departures
    ADD COLUMN IF NOT EXISTS featured_priority INTEGER NOT NULL DEFAULT 0
  `;

  await sql`CREATE INDEX IF NOT EXISTS departures_public_id_idx ON departures (public_id)`;
  await sql`CREATE INDEX IF NOT EXISTS departures_status_idx ON departures (status)`;
  await sql`CREATE INDEX IF NOT EXISTS departures_route_slug_idx ON departures (route_slug)`;
  await sql`
    CREATE INDEX IF NOT EXISTS departures_featured_home_idx
    ON departures (featured_on_home, featured_priority ASC, start_date ASC)
  `;

  await sql`CREATE INDEX IF NOT EXISTS orders_order_number_idx ON orders (order_number)`;
  await sql`CREATE INDEX IF NOT EXISTS orders_user_id_idx ON orders (user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS orders_departure_id_idx ON orders (departure_id)`;
  await sql`CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status)`;
  await sql`CREATE INDEX IF NOT EXISTS orders_stripe_session_idx ON orders (stripe_checkout_session_id)`;

  await sql`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS payment_provider TEXT
  `;
  await sql`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS payoneer_list_id TEXT
  `;
  await sql`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS payoneer_transaction_id TEXT
  `;
  await sql`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS payoneer_charge_id TEXT
  `;
  await sql`
    ALTER TABLE inventory_holds
    ADD COLUMN IF NOT EXISTS payoneer_list_id TEXT
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS orders_payoneer_list_id_uidx
    ON orders (payoneer_list_id)
    WHERE payoneer_list_id IS NOT NULL
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS inventory_holds_payoneer_list_id_uidx
    ON inventory_holds (payoneer_list_id)
    WHERE payoneer_list_id IS NOT NULL
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS orders_payoneer_transaction_idx
    ON orders (payoneer_transaction_id)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS payoneer_webhook_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      payoneer_event_id TEXT UNIQUE NOT NULL,
      event_type TEXT NOT NULL,
      livemode BOOLEAN NOT NULL DEFAULT false,
      object_id TEXT,
      processing_status TEXT NOT NULL,
      payload JSONB NOT NULL,
      error_message TEXT,
      processed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS inventory_holds_departure_id_idx ON inventory_holds (departure_id)`;
  await sql`CREATE INDEX IF NOT EXISTS inventory_holds_order_id_idx ON inventory_holds (order_id)`;
  await sql`CREATE INDEX IF NOT EXISTS inventory_holds_status_idx ON inventory_holds (status)`;
  await sql`CREATE INDEX IF NOT EXISTS inventory_holds_session_idx ON inventory_holds (stripe_checkout_session_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS checkout_rate_buckets (
      bucket_key TEXT PRIMARY KEY,
      dimension TEXT NOT NULL,
      subject_key TEXT NOT NULL,
      hit_count INTEGER NOT NULL DEFAULT 0,
      window_start TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT checkout_rate_buckets_hit_positive CHECK (hit_count >= 0)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS checkout_rate_buckets_expires_at_idx
    ON checkout_rate_buckets (expires_at)
  `;

  await sql`CREATE INDEX IF NOT EXISTS stripe_webhook_events_event_id_idx ON stripe_webhook_events (stripe_event_id)`;
  await sql`CREATE INDEX IF NOT EXISTS payoneer_webhook_events_event_id_idx ON payoneer_webhook_events (payoneer_event_id)`;
  await sql`CREATE INDEX IF NOT EXISTS audit_logs_target_idx ON audit_logs (target_type, target_id)`;
  await sql`
    CREATE INDEX IF NOT EXISTS refill_members_chain_idx
    ON departure_refill_chain_members (chain_id, sequence)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS refill_events_chain_idx
    ON departure_refill_events (chain_id, created_at DESC)
  `;

  tablesEnsured = true;
}
