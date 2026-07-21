import type { SqlClient } from '../lib/db';

export const name = '012_departure_refill_chains';

export async function up(tx: SqlClient) {
  await tx`
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

  await tx`
    CREATE TABLE IF NOT EXISTS departure_refill_chain_members (
      chain_id UUID NOT NULL REFERENCES departure_refill_chains(id) ON DELETE CASCADE,
      departure_id UUID PRIMARY KEY REFERENCES departures(id) ON DELETE CASCADE,
      sequence INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT refill_member_sequence_range CHECK (sequence BETWEEN 1 AND 1000),
      CONSTRAINT refill_member_chain_sequence_unique UNIQUE (chain_id, sequence)
    )
  `;

  await tx`
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

  await tx`
    CREATE INDEX IF NOT EXISTS refill_members_chain_idx
    ON departure_refill_chain_members (chain_id, sequence)
  `;
  await tx`
    CREATE INDEX IF NOT EXISTS refill_events_chain_idx
    ON departure_refill_events (chain_id, created_at DESC)
  `;
}
