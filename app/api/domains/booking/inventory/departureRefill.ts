import type { SqlClient } from '../../../platform/db';

type RefillChainRow = {
  chain_id: string;
  enabled: boolean;
  max_auto_activations: number;
  source_departure_id: string;
  source_sequence: number;
  capacity: number;
  featured_on_home: boolean;
  featured_priority: number;
};

/**
 * Called only after an order changed pending_payment -> confirmed, inside the
 * same transaction. The chain row lock serializes concurrent final-seat
 * confirmations and makes activation/audit insertion idempotent.
 */
export async function refillAfterConfirmedOrder(
  tx: SqlClient,
  orderId: string,
): Promise<void> {
  const chainResult = await tx<RefillChainRow>`
    SELECT
      c.id AS chain_id,
      c.enabled,
      c.max_auto_activations,
      d.id AS source_departure_id,
      m.sequence AS source_sequence,
      d.capacity,
      d.featured_on_home,
      d.featured_priority
    FROM orders o
    JOIN departures d ON d.id = o.departure_id
    JOIN departure_refill_chain_members m ON m.departure_id = d.id
    JOIN departure_refill_chains c ON c.id = m.chain_id
    WHERE o.id = ${orderId}
    FOR UPDATE OF c
  `;
  const chain = chainResult.rows[0];
  if (!chain?.enabled) return;

  const seatsResult = await tx<{ confirmed_seats: string }>`
    SELECT COALESCE(SUM(adult_quantity), 0)::text AS confirmed_seats
    FROM orders
    WHERE departure_id = ${chain.source_departure_id}
      AND status IN ('confirmed', 'cancellation_requested')
  `;
  const confirmedSeats = Number(seatsResult.rows[0]?.confirmed_seats ?? 0);
  if (confirmedSeats < chain.capacity) return;

  const activationResult = await tx<{ activation_count: string }>`
    SELECT COUNT(*)::text AS activation_count
    FROM departure_refill_events
    WHERE chain_id = ${chain.chain_id}
      AND outcome = 'activated'
  `;
  const activationCount = Number(activationResult.rows[0]?.activation_count ?? 0);

  if (activationCount >= chain.max_auto_activations) {
    await insertRefillEvent(tx, {
      chain,
      orderId,
      outcome: 'limit_reached',
      confirmedSeats,
      activationCount,
    });
    return;
  }

  const nextResult = await tx<{ id: string; status: string }>`
    SELECT d.id, d.status
    FROM departure_refill_chain_members m
    JOIN departures d ON d.id = m.departure_id
    WHERE m.chain_id = ${chain.chain_id}
      AND m.sequence > ${chain.source_sequence}
    ORDER BY m.sequence ASC
    LIMIT 1
    FOR UPDATE OF d
  `;
  const next = nextResult.rows[0];

  if (!next) {
    await insertRefillEvent(tx, {
      chain,
      orderId,
      outcome: 'no_next_departure',
      confirmedSeats,
      activationCount,
    });
    return;
  }

  if (next.status !== 'draft') {
    return;
  }

  const activated = await tx<{ id: string }>`
    UPDATE departures
    SET status = 'sellable',
        featured_on_home = ${chain.featured_on_home},
        featured_priority = ${chain.featured_priority},
        updated_at = NOW()
    WHERE id = ${next.id}
      AND status = 'draft'
    RETURNING id
  `;
  if (!activated.rows[0]) return;

  await tx`
    INSERT INTO departure_refill_events (
      chain_id, source_departure_id, trigger_order_id, activated_departure_id,
      outcome, confirmed_seats, capacity, activation_count, max_auto_activations
    ) VALUES (
      ${chain.chain_id}, ${chain.source_departure_id}, ${orderId}, ${next.id},
      'activated', ${confirmedSeats}, ${chain.capacity}, ${activationCount + 1},
      ${chain.max_auto_activations}
    )
    ON CONFLICT (trigger_order_id) DO NOTHING
  `;
}

async function insertRefillEvent(
  tx: SqlClient,
  params: {
    chain: RefillChainRow;
    orderId: string;
    outcome: 'limit_reached' | 'no_next_departure';
    confirmedSeats: number;
    activationCount: number;
  },
): Promise<void> {
  await tx`
    INSERT INTO departure_refill_events (
      chain_id, source_departure_id, trigger_order_id, outcome,
      confirmed_seats, capacity, activation_count, max_auto_activations
    ) VALUES (
      ${params.chain.chain_id}, ${params.chain.source_departure_id}, ${params.orderId},
      ${params.outcome}, ${params.confirmedSeats}, ${params.chain.capacity},
      ${params.activationCount}, ${params.chain.max_auto_activations}
    )
    ON CONFLICT (trigger_order_id) DO NOTHING
  `;
}
