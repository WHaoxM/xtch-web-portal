import crypto from 'node:crypto';
import { sql } from '../../../platform/db';
import { formatDate } from '../inventory/availability';
import type { Departure, HoldStatus, OrderStatus, PaymentStatus } from '../bookingSchema';

export type PendingOrder = {
  id: string;
  orderNumber: string;
  accessToken: string;
  departureId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  adultQuantity: number;
  totalPriceCents: number;
  createdAt: string;
};

export type PendingHold = {
  id: string;
  status: HoldStatus;
  expiresAt: Date;
};

export type CheckoutInitResult = {
  order: PendingOrder;
  hold: PendingHold;
};

export type OrderTravelerSnapshot = {
  name: string;
  gender: 'male' | 'female';
};

type CheckoutInitParams = {
  departure: Departure;
  adultQuantity: number;
  leadName: string;
  leadEmail: string;
  leadPhone: string;
  travelers: OrderTravelerSnapshot[];
  notes?: string;
  holdExpiresAt: Date;
  userId?: string;
};

const ORDER_NUMBER_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ORDER_NUMBER_RANDOM_LENGTH = 4;
const ACCESS_TOKEN_BYTES = 32;

export function generateOrderNumber(date = new Date()): string {
  const yy = String(date.getFullYear()).slice(2).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const random = generateRandomString(ORDER_NUMBER_RANDOM_LENGTH, ORDER_NUMBER_ALPHABET);
  return `ST-${yy}${mm}${dd}-${random}`;
}

export function generateAccessToken(): string {
  return crypto.randomBytes(ACCESS_TOKEN_BYTES).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateRandomString(length: number, alphabet: string): string {
  const maxByte = 256 - (256 % alphabet.length);
  let result = '';
  const bytes = crypto.randomBytes(length * 2);
  for (let i = 0; i < bytes.length && result.length < length; i++) {
    if (bytes[i] < maxByte) {
      result += alphabet[bytes[i] % alphabet.length];
    }
  }
  if (result.length < length) {
    return generateRandomString(length, alphabet);
  }
  return result;
}

export async function createPendingOrderAndHold(
  params: CheckoutInitParams,
  maxRetries = 3,
): Promise<CheckoutInitResult> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await sql.begin(async (tx) => {
        const departureRows = await tx<Departure>`
          SELECT *
          FROM departures
          WHERE id = ${params.departure.id}
          FOR UPDATE
        `;

        const departure = departureRows.rows[0];
        if (!departure) {
          throw new Error('Departure not found.');
        }
        if (departure.status !== 'sellable') {
          throw new Error('This departure is no longer available for booking.');
        }

        const confirmedResult = await tx<{ adults: string }>`
          SELECT COALESCE(SUM(adult_quantity), 0)::text AS adults
          FROM orders
          WHERE departure_id = ${params.departure.id}
            AND status IN ('confirmed', 'cancellation_requested')
        `;
        const heldResult = await tx<{ adults: string }>`
          SELECT COALESCE(SUM(adult_quantity), 0)::text AS adults
          FROM inventory_holds
          WHERE departure_id = ${params.departure.id}
            AND status = 'active'
            AND expires_at > NOW()
        `;

        const concurrentHold = await tx<{ id: string }>`
          SELECT h.id
          FROM inventory_holds h
          JOIN orders o ON o.id = h.order_id
          WHERE h.departure_id = ${params.departure.id}
            AND h.status = 'active'
            AND h.expires_at > NOW()
            AND LOWER(o.lead_email) = ${params.leadEmail.toLowerCase()}
          LIMIT 1
        `;
        if (concurrentHold.rows[0]) {
          throw new Error(
            'You already have an open checkout for this departure. Finish payment or wait for it to expire.',
          );
        }

        const confirmed = Number(confirmedResult.rows[0]?.adults ?? 0);
        const held = Number(heldResult.rows[0]?.adults ?? 0);
        const availableSeats = departure.capacity - confirmed - held;

        if (params.adultQuantity > availableSeats) {
          throw new Error('Not enough seats available for this departure.');
        }

        const totalPriceCents = params.adultQuantity * departure.adult_unit_price_cents;
        const orderNumber = generateOrderNumber();
        const accessToken = generateAccessToken();
        const accessTokenHash = hashToken(accessToken);

        const routeSnapshot = {
          route_slug: departure.route_slug,
          route_title: departure.route_title,
          destination_slug: departure.destination_slug,
          departure_city: departure.departure_city,
          start_date: formatDate(departure.start_date),
          end_date: formatDate(departure.end_date),
        };

        const priceSnapshot = {
          adult_unit_price_cents: departure.adult_unit_price_cents,
          currency: departure.currency,
          adult_quantity: params.adultQuantity,
          total_price_cents: totalPriceCents,
        };

        const orderRows = await tx<{ id: string; created_at: string }>`
          INSERT INTO orders (
            order_number,
            access_token_hash,
            user_id,
            departure_id,
            status,
            payment_status,
            refund_status,
            traveler_details_status,
            confirmation_email_status,
            lead_traveler_name,
            lead_email,
            lead_phone,
            travelers,
            adult_quantity,
            currency,
            adult_unit_price_cents,
            total_price_cents,
            route_snapshot,
            price_snapshot,
            policy_snapshot,
            policy_version,
            internal_notes
          ) VALUES (
            ${orderNumber},
            ${accessTokenHash},
            ${params.userId || null},
            ${departure.id},
            'pending_payment',
            'unpaid',
            'none',
            'traveler_details_pending',
            'confirmation_email_pending',
            ${params.leadName},
            ${params.leadEmail.toLowerCase()},
            ${params.leadPhone || null},
            ${JSON.stringify(params.travelers)}::jsonb,
            ${params.adultQuantity},
            ${departure.currency},
            ${departure.adult_unit_price_cents},
            ${totalPriceCents},
            ${JSON.stringify(routeSnapshot)}::jsonb,
            ${JSON.stringify(priceSnapshot)}::jsonb,
            ${JSON.stringify(departure.cancellation_policy_snapshot)}::jsonb,
            ${departure.policy_version},
            ${params.notes || null}
          )
          RETURNING id, created_at
        `;

        const order = orderRows.rows[0];

        const holdRows = await tx<{ id: string; status: HoldStatus; expires_at: string }>`
          INSERT INTO inventory_holds (
            departure_id,
            order_id,
            adult_quantity,
            status,
            expires_at
          ) VALUES (
            ${departure.id},
            ${order.id},
            ${params.adultQuantity},
            'active',
            ${params.holdExpiresAt.toISOString()}::timestamptz
          )
          RETURNING id, status, expires_at
        `;

        const hold = holdRows.rows[0];

        return {
          order: {
            id: order.id,
            orderNumber,
            accessToken,
            departureId: departure.id,
            status: 'pending_payment',
            paymentStatus: 'unpaid',
            adultQuantity: params.adultQuantity,
            totalPriceCents,
            createdAt: order.created_at,
          },
          hold: {
            id: hold.id,
            status: hold.status,
            expiresAt: new Date(hold.expires_at),
          },
        };
      });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const isUniqueViolation =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505';
      if (isUniqueViolation && attempt < maxRetries - 1) {
        continue;
      }
      throw lastError;
    }
  }

  throw lastError ?? new Error('Failed to create pending order.');
}

export async function findDepartureByPublicId(publicId: string): Promise<Departure | null> {
  const result = await sql<Departure>`
    SELECT *
    FROM departures
    WHERE public_id = ${publicId}
  `;
  return (result.rows[0] as Departure | undefined) ?? null;
}

export async function attachStripeSessionToOrder(
  orderId: string,
  holdId: string,
  stripeCheckoutSessionId: string,
): Promise<void> {
  await sql`
    UPDATE orders
    SET payment_provider = 'stripe',
        stripe_checkout_session_id = ${stripeCheckoutSessionId},
        updated_at = NOW()
    WHERE id = ${orderId}
  `;

  await sql`
    UPDATE inventory_holds
    SET stripe_checkout_session_id = ${stripeCheckoutSessionId},
        updated_at = NOW()
    WHERE id = ${holdId}
  `;
}

export async function attachPayoneerSessionToOrder(
  orderId: string,
  holdId: string,
  payoneerListId: string,
  payoneerTransactionId: string,
): Promise<void> {
  await sql`
    UPDATE orders
    SET payment_provider = 'payoneer',
        payoneer_list_id = ${payoneerListId},
        payoneer_transaction_id = ${payoneerTransactionId},
        updated_at = NOW()
    WHERE id = ${orderId}
  `;

  await sql`
    UPDATE inventory_holds
    SET payoneer_list_id = ${payoneerListId},
        updated_at = NOW()
    WHERE id = ${holdId}
  `;
}

export async function rotateAccessToken(orderId: string): Promise<string> {
  const token = generateAccessToken();
  const hash = hashToken(token);

  await sql`
    UPDATE orders
    SET access_token_hash = ${hash},
        updated_at = NOW()
    WHERE id = ${orderId}
  `;

  return token;
}

export async function buildOrderAccessUrl(
  order: { id: string; order_number: string },
  publicAppUrl?: string,
): Promise<string> {
  const token = await rotateAccessToken(order.id);
  const base = (publicAppUrl || process.env.PUBLIC_APP_URL || 'https://www.xuntingtravel.com').replace(
    /\/$/,
    '',
  );
  return `${base}/orders/${encodeURIComponent(order.order_number)}?token=${encodeURIComponent(token)}`;
}