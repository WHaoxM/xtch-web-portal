import { sql } from './db';
import { refillAfterConfirmedOrder } from './departureRefill';
import { hashToken } from './orders';
import type { Order } from './bookingSchema';

export async function findOrderByOrderNumber(orderNumber: string): Promise<Order | null> {
  const result = await sql<Order>`
    SELECT *
    FROM orders
    WHERE order_number = ${orderNumber}
  `;
  return (result.rows[0] as Order | undefined) ?? null;
}

export async function findOrderByStripeSessionId(stripeSessionId: string): Promise<Order | null> {
  const result = await sql<Order>`
    SELECT *
    FROM orders
    WHERE stripe_checkout_session_id = ${stripeSessionId}
  `;
  return (result.rows[0] as Order | undefined) ?? null;
}

export async function findOrderByStripePaymentIntentId(paymentIntentId: string): Promise<Order | null> {
  const result = await sql<Order>`
    SELECT *
    FROM orders
    WHERE stripe_payment_intent_id = ${paymentIntentId}
  `;
  return (result.rows[0] as Order | undefined) ?? null;
}

export async function findOrderByStripeChargeId(chargeId: string): Promise<Order | null> {
  const result = await sql<Order>`
    SELECT *
    FROM orders
    WHERE stripe_charge_id = ${chargeId}
  `;
  return (result.rows[0] as Order | undefined) ?? null;
}

export async function confirmOrderById(
  orderId: string,
  stripePaymentIntentId: string,
  stripeChargeId: string,
): Promise<void> {
  const travelerDetailsDueAt = await computeTravelerDetailsDueAt(orderId);

  await sql`
    UPDATE orders
    SET status = 'confirmed',
        payment_status = 'paid',
        stripe_payment_intent_id = ${stripePaymentIntentId},
        stripe_charge_id = ${stripeChargeId},
        paid_at = NOW(),
        confirmed_at = NOW(),
        traveler_details_due_at = ${travelerDetailsDueAt?.toISOString() ?? null}::timestamptz,
        confirmation_email_status = 'confirmation_email_pending',
        updated_at = NOW()
    WHERE id = ${orderId}
  `;
}

export async function expireOrderById(orderId: string): Promise<void> {
  await sql`
    UPDATE orders
    SET status = 'expired',
        expired_at = NOW(),
        updated_at = NOW()
    WHERE id = ${orderId}
      AND status = 'pending_payment'
  `;
}

export async function consumeHoldByOrderId(orderId: string): Promise<void> {
  await sql`
    UPDATE inventory_holds
    SET status = 'consumed',
        consumed_at = NOW(),
        updated_at = NOW()
    WHERE order_id = ${orderId}
      AND status = 'active'
  `;
}

/** Release an unpaid checkout hold (active only). */
export async function releaseHoldByOrderId(orderId: string): Promise<void> {
  await sql`
    UPDATE inventory_holds
    SET status = 'released',
        released_at = NOW(),
        updated_at = NOW()
    WHERE order_id = ${orderId}
      AND status = 'active'
  `;
}

/**
 * Release seats after a full refund: active (rare) or consumed (normal paid path).
 * Idempotent when already released/expired.
 */
export async function releaseInventoryHoldByOrderId(orderId: string): Promise<void> {
  await sql`
    UPDATE inventory_holds
    SET status = 'released',
        released_at = COALESCE(released_at, NOW()),
        updated_at = NOW()
    WHERE order_id = ${orderId}
      AND status IN ('active', 'consumed')
  `;
}

/** Mark pending_payment order failed and release its active hold (Stripe create/attach failure). */
export async function failOrderAndReleaseHold(orderId: string): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`
      UPDATE orders
      SET status = 'failed',
          payment_status = 'failed',
          updated_at = NOW()
      WHERE id = ${orderId}
        AND status = 'pending_payment'
    `;

    await tx`
      UPDATE inventory_holds
      SET status = 'released',
          released_at = NOW(),
          updated_at = NOW()
      WHERE order_id = ${orderId}
        AND status = 'active'
    `;
  });
}

/**
 * A1 lazy cleanup: expire overdue active holds and matching pending_payment orders.
 * Call from checkout and availability paths — no external cron.
 */
export async function expireExpiredHolds(departureId?: string): Promise<number> {
  return sql.begin(async (tx) => {
    if (departureId) {
      await tx`
        UPDATE orders o
        SET status = 'expired',
            expired_at = NOW(),
            updated_at = NOW()
        FROM inventory_holds h
        WHERE o.id = h.order_id
          AND o.status = 'pending_payment'
          AND h.status = 'active'
          AND h.expires_at <= NOW()
          AND h.departure_id = ${departureId}
      `;

      const holds = await tx<{ id: string }>`
        UPDATE inventory_holds
        SET status = 'expired',
            updated_at = NOW()
        WHERE status = 'active'
          AND expires_at <= NOW()
          AND departure_id = ${departureId}
        RETURNING id
      `;
      return holds.rows.length;
    }

    await tx`
      UPDATE orders o
      SET status = 'expired',
          expired_at = NOW(),
          updated_at = NOW()
      FROM inventory_holds h
      WHERE o.id = h.order_id
        AND o.status = 'pending_payment'
        AND h.status = 'active'
        AND h.expires_at <= NOW()
    `;

    const holds = await tx<{ id: string }>`
      UPDATE inventory_holds
      SET status = 'expired',
          updated_at = NOW()
      WHERE status = 'active'
        AND expires_at <= NOW()
      RETURNING id
    `;
    return holds.rows.length;
  });
}

/**
 * Full refund terminal state + inventory release in one transaction.
 * Idempotent when order is already refunded (still repairs lingering occupies).
 */
export async function applyFullRefundAndReleaseSeats(
  orderId: string,
  stripeRefundId?: string,
): Promise<'applied' | 'already'> {
  return sql.begin(async (tx) => {
    const updated = await tx<{ id: string }>`
      UPDATE orders
      SET status = 'refunded',
          payment_status = 'refunded',
          refund_status = 'refunded',
          stripe_refund_id = COALESCE(${stripeRefundId ?? null}, stripe_refund_id),
          refunded_at = COALESCE(refunded_at, NOW()),
          updated_at = NOW()
      WHERE id = ${orderId}
        AND status <> 'refunded'
      RETURNING id
    `;

    await tx`
      UPDATE inventory_holds
      SET status = 'released',
          released_at = COALESCE(released_at, NOW()),
          updated_at = NOW()
      WHERE order_id = ${orderId}
        AND status IN ('active', 'consumed')
    `;

    return updated.rows[0] ? 'applied' : 'already';
  });
}

/**
 * Confirm paid order and consume active hold.
 * Returns false when order is no longer pending_payment (concurrent/idempotent).
 */
export async function confirmOrderAndConsumeHold(
  orderId: string,
  stripePaymentIntentId: string,
  stripeChargeId: string,
): Promise<boolean> {
  const travelerDetailsDueAt = await computeTravelerDetailsDueAt(orderId);

  return sql.begin(async (tx) => {
    const updated = await tx<{ id: string }>`
      UPDATE orders
      SET status = 'confirmed',
          payment_status = 'paid',
          stripe_payment_intent_id = ${stripePaymentIntentId},
          stripe_charge_id = ${stripeChargeId},
          paid_at = NOW(),
          confirmed_at = NOW(),
          traveler_details_due_at = ${travelerDetailsDueAt?.toISOString() ?? null}::timestamptz,
          confirmation_email_status = 'confirmation_email_pending',
          updated_at = NOW()
      WHERE id = ${orderId}
        AND status = 'pending_payment'
      RETURNING id
    `;

    if (!updated.rows[0]) {
      return false;
    }

    await tx`
      UPDATE inventory_holds
      SET status = 'consumed',
          consumed_at = NOW(),
          updated_at = NOW()
      WHERE order_id = ${orderId}
        AND status = 'active'
    `;

    await refillAfterConfirmedOrder(tx, orderId);

    return true;
  });
}

export async function expireOrderAndReleaseHold(orderId: string): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`
      UPDATE orders
      SET status = 'expired',
          expired_at = NOW(),
          updated_at = NOW()
      WHERE id = ${orderId}
        AND status = 'pending_payment'
    `;

    await tx`
      UPDATE inventory_holds
      SET status = 'released',
          released_at = NOW(),
          updated_at = NOW()
      WHERE order_id = ${orderId}
        AND status = 'active'
    `;
  });
}

export async function updateOrderRefundState(
  orderId: string,
  refundStatus: 'none' | 'pending' | 'partially_refunded' | 'refunded',
  paymentStatus: 'paid' | 'partially_refunded' | 'refunded',
  stripeRefundId?: string,
): Promise<void> {
  await sql`
    UPDATE orders
    SET refund_status = ${refundStatus},
        payment_status = ${paymentStatus},
        stripe_refund_id = ${stripeRefundId ?? null},
        refunded_at = CASE WHEN ${refundStatus} = 'refunded' THEN NOW() ELSE refunded_at END,
        updated_at = NOW()
    WHERE id = ${orderId}
  `;
}

export async function updateConfirmationEmailStatus(
  orderId: string,
  status:
    | 'confirmation_email_pending'
    | 'confirmation_email_sent'
    | 'confirmation_email_failed'
    | 'confirmation_email_retrying'
    | 'confirmation_email_traveler_sent',
): Promise<void> {
  await sql`
    UPDATE orders
    SET confirmation_email_status = ${status},
        updated_at = NOW()
    WHERE id = ${orderId}
  `;
}

export type CancellationRequestResult =
  | { status: 'recorded' }
  | { status: 'already_requested' }
  | { status: 'not_allowed' };

/**
 * Traveler cancellation request (user-confirmed gate):
 * - confirmed + payment_status paid → allow
 * - already cancellation_requested → idempotent success
 * - partially_refunded / terminal / pending_payment → deny
 */
export async function recordCancellationRequest(
  orderId: string,
): Promise<CancellationRequestResult> {
  const already = await sql<{ id: string }>`
    SELECT id
    FROM orders
    WHERE id = ${orderId}
      AND status = 'cancellation_requested'
  `;
  if (already.rows[0]) {
    return { status: 'already_requested' };
  }

  const updated = await sql<{ id: string }>`
    UPDATE orders
    SET cancellation_requested_at = NOW(),
        status = 'cancellation_requested',
        updated_at = NOW()
    WHERE id = ${orderId}
      AND status = 'confirmed'
      AND payment_status = 'paid'
    RETURNING id
  `;

  if (updated.rows[0]) {
    return { status: 'recorded' };
  }

  return { status: 'not_allowed' };
}

export async function recordDateChangeRequest(orderId: string): Promise<void> {
  await sql`
    UPDATE orders
    SET date_change_requested_at = NOW(),
        updated_at = NOW()
    WHERE id = ${orderId}
  `;
}

export async function canAutoReleaseSeats(orderId: string): Promise<boolean> {
  const result = await sql<{ start_date: string; status: string; days_until_departure: number }>`
    SELECT
      d.start_date,
      d.status,
      (d.start_date - CURRENT_DATE)::int AS days_until_departure
    FROM orders o
    JOIN departures d ON d.id = o.departure_id
    WHERE o.id = ${orderId}
  `;

  const row = result.rows[0];
  if (!row) return false;

  const daysUntilDeparture = Number(row.days_until_departure);
  const departureStatus = String(row.status);

  return daysUntilDeparture >= 14 && departureStatus === 'sellable';
}
async function computeTravelerDetailsDueAt(orderId: string): Promise<Date | null> {
  const result = await sql<{ start_date: string; confirmed_at: string | null }>`
    SELECT d.start_date, o.confirmed_at
    FROM orders o
    JOIN departures d ON d.id = o.departure_id
    WHERE o.id = ${orderId}
  `;

  const row = result.rows[0];
  if (!row) return null;

  const startDate = new Date(String(row.start_date));
  const confirmedAt = row.confirmed_at ? new Date(String(row.confirmed_at)) : new Date();

  const fourteenDaysBefore = new Date(startDate);
  fourteenDaysBefore.setDate(fourteenDaysBefore.getDate() - 14);

  const twentyFourHoursAfter = new Date(confirmedAt);
  twentyFourHoursAfter.setHours(twentyFourHoursAfter.getHours() + 24);

  if (fourteenDaysBefore >= new Date()) {
    return fourteenDaysBefore;
  }
  return twentyFourHoursAfter;
}

export type SafeOrderSummary = {
  order_number: string;
  status: string;
  payment_status: string;
  refund_status: string;
  confirmation_email_status: string;
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
  paid_at: string | null;
  confirmed_at: string | null;
  cancellation_requested_at: string | null;
  date_change_requested_at: string | null;
};

export async function getSafeOrderSummaryByOrderNumber(
  orderNumber: string,
): Promise<SafeOrderSummary | null> {
  const result = await sql<SafeOrderSummary>`
    SELECT
      order_number,
      status,
      payment_status,
      refund_status,
      confirmation_email_status,
      lead_traveler_name,
      lead_email,
      lead_phone,
      COALESCE(travelers, '[]'::jsonb) AS travelers,
      adult_quantity,
      currency,
      adult_unit_price_cents,
      total_price_cents,
      route_snapshot,
      price_snapshot,
      policy_snapshot,
      policy_version,
      traveler_details_due_at::text,
      paid_at::text,
      confirmed_at::text,
      cancellation_requested_at::text,
      date_change_requested_at::text
    FROM orders
    WHERE order_number = ${orderNumber}
  `;
  return (result.rows[0] as SafeOrderSummary | undefined) ?? null;
}

export async function listOrdersByUserId(userId: string): Promise<SafeOrderSummary[]> {
  const result = await sql<SafeOrderSummary>`
    SELECT
      order_number,
      status,
      payment_status,
      refund_status,
      confirmation_email_status,
      lead_traveler_name,
      lead_email,
      lead_phone,
      COALESCE(travelers, '[]'::jsonb) AS travelers,
      adult_quantity,
      currency,
      adult_unit_price_cents,
      total_price_cents,
      route_snapshot,
      price_snapshot,
      policy_snapshot,
      policy_version,
      traveler_details_due_at::text,
      paid_at::text,
      confirmed_at::text,
      cancellation_requested_at::text,
      date_change_requested_at::text
    FROM orders
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;
  return result.rows as SafeOrderSummary[];
}

export async function claimOrdersByEmail(userId: string, email: string): Promise<number> {
  const normalizedEmail = email.trim().toLowerCase();
  const result = await sql`
    UPDATE orders
    SET user_id = ${userId},
        updated_at = NOW()
    WHERE LOWER(lead_email) = ${normalizedEmail}
      AND user_id IS NULL
  `;
  return result.rowCount ?? 0;
}

export type ClaimOrderByProofResult =
  | { status: 'claimed' }
  | { status: 'already_linked' }
  | { status: 'linked_elsewhere' }
  | { status: 'not_found' }
  | { status: 'invalid_proof' };

/** Bind one order to the signed-in user using order access token and/or Stripe session id. */
export async function claimOrderByProof(
  userId: string,
  params: { orderNumber: string; token?: string; sessionId?: string },
): Promise<ClaimOrderByProofResult> {
  const orderNumber = params.orderNumber.trim();
  const token = params.token?.trim() || '';
  const sessionId = params.sessionId?.trim() || '';

  if (!orderNumber || (!token && !sessionId)) {
    return { status: 'invalid_proof' };
  }

  const order = await findOrderByOrderNumber(orderNumber);
  if (!order) {
    return { status: 'not_found' };
  }

  let proofOk = false;
  if (token) {
    if (order.access_token_hash === hashToken(token)) {
      proofOk = true;
    }
  }
  if (!proofOk && sessionId) {
    if (order.stripe_checkout_session_id && order.stripe_checkout_session_id === sessionId) {
      proofOk = true;
    }
  }

  if (!proofOk) {
    return { status: 'invalid_proof' };
  }

  if (order.user_id === userId) {
    return { status: 'already_linked' };
  }
  if (order.user_id) {
    return { status: 'linked_elsewhere' };
  }

  const result = await sql`
    UPDATE orders
    SET user_id = ${userId},
        updated_at = NOW()
    WHERE order_number = ${orderNumber}
      AND user_id IS NULL
  `;

  if ((result.rowCount ?? 0) > 0) {
    return { status: 'claimed' };
  }

  // Race: another request linked it between SELECT and UPDATE.
  const refreshed = await findOrderByOrderNumber(orderNumber);
  if (refreshed?.user_id === userId) {
    return { status: 'already_linked' };
  }
  return { status: 'linked_elsewhere' };
}

export async function listOrdersByLeadEmail(email: string): Promise<SafeOrderSummary[]> {
  const normalizedEmail = email.trim().toLowerCase();
  const result = await sql<SafeOrderSummary>`
    SELECT
      order_number,
      status,
      payment_status,
      refund_status,
      confirmation_email_status,
      lead_traveler_name,
      lead_email,
      lead_phone,
      COALESCE(travelers, '[]'::jsonb) AS travelers,
      adult_quantity,
      currency,
      adult_unit_price_cents,
      total_price_cents,
      route_snapshot,
      price_snapshot,
      policy_snapshot,
      policy_version,
      traveler_details_due_at::text,
      paid_at::text,
      confirmed_at::text,
      cancellation_requested_at::text,
      date_change_requested_at::text
    FROM orders
    WHERE LOWER(lead_email) = ${normalizedEmail}
    ORDER BY created_at DESC
  `;
  return result.rows as SafeOrderSummary[];
}
