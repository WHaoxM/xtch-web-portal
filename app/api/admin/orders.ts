import { URL } from 'node:url';
import { ensureBookingTables } from '../lib/bookingSchema';
import { requireAdminAuth, hashIp } from '../lib/adminAuth';
import { writeAuditLog } from '../lib/auditLog';
import {
  getOrderDetailForAdmin,
  listOrdersForAdmin,
  updateOrderInternalNotes,
} from '../lib/adminOrders';
import { findOrderByOrderNumber } from '../lib/orderQueries';
import { sendBookingConfirmationEmail } from '../lib/email';
import { updateConfirmationEmailStatus } from '../lib/orderQueries';
import { formatDate } from '../lib/availability';

type VercelRequestLike = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  url?: string;
  body?: unknown;
};

type VercelResponseLike = {
  status: (code: number) => VercelResponseLike;
  json: (body: unknown) => void;
};

export default async function handler(req: VercelRequestLike, res: VercelResponseLike) {
  const admin = await requireAdminAuth(req);
  if (!admin.ok) {
    res.status(admin.status).json({ ok: false, error: admin.error });
    return;
  }

  try {
    await ensureBookingTables();

    const query = parseQuery(req.url);
    const orderNumber = query.get('orderNumber') || '';
    const action = query.get('action') || '';

    if (req.method === 'GET') {
      if (orderNumber) {
        return await handleGetOrderDetail(req, res, admin.email, orderNumber);
      }
      return await handleListOrders(req, res, query);
    }

    if (req.method === 'POST') {
      if (!orderNumber) {
        res.status(400).json({ ok: false, error: 'Order number is required.' });
        return;
      }

      if (action === 'resend-confirmation') {
        return await handleResendConfirmation(req, res, admin.email, orderNumber);
      }

      if (action === 'internal-notes') {
        return await handleUpdateNotes(req, res, admin.email, orderNumber);
      }

      res.status(400).json({ ok: false, error: 'Unknown admin action.' });
      return;
    }

    res.status(405).json({ ok: false, error: 'Method not allowed.' });
  } catch (error) {
    console.error('Admin orders API failed:', error);
    res.status(500).json({ ok: false, error: 'Admin request failed.' });
  }
}

async function handleListOrders(
  req: VercelRequestLike,
  res: VercelResponseLike,
  query: URLSearchParams,
) {
  const status = query.get('status') || undefined;
  const departureId = query.get('departureId') || undefined;
  const search = query.get('search') || undefined;
  const limit = Number(query.get('limit') || '50');
  const offset = Number(query.get('offset') || '0');

  const orders = await listOrdersForAdmin({ status, departureId, search, limit, offset });

  res.status(200).json({
    ok: true,
    orders: orders.map(sanitizeOrderForList),
  });
}

async function handleGetOrderDetail(
  req: VercelRequestLike,
  res: VercelResponseLike,
  adminEmail: string,
  orderNumber: string,
) {
  const order = await getOrderDetailForAdmin(orderNumber);
  if (!order) {
    res.status(404).json({ ok: false, error: 'Order not found.' });
    return;
  }

  await writeAuditLog({
    actorType: 'admin',
    actorEmail: adminEmail,
    action: 'admin_order_detail_view',
    targetType: 'order',
    targetId: order.order_number,
    ipHash: hashIp(getClientIp(req)),
    userAgent: getHeaderValue(req.headers['user-agent']),
  });

  res.status(200).json({ ok: true, order: sanitizeOrderForDetail(order) });
}

async function handleResendConfirmation(
  req: VercelRequestLike,
  res: VercelResponseLike,
  adminEmail: string,
  orderNumber: string,
) {
  const order = await findOrderByOrderNumber(orderNumber);
  if (!order) {
    res.status(404).json({ ok: false, error: 'Order not found.' });
    return;
  }

  await updateConfirmationEmailStatus(order.id, 'confirmation_email_retrying');
  const purpose =
    order.confirmation_email_status === 'confirmation_email_sent'
      ? 'admin-resend'
      : 'payment-confirmation';
  const emailStatus = await sendBookingConfirmationEmail(order, {
    purpose,
    onTravelerSent: () =>
      updateConfirmationEmailStatus(order.id, 'confirmation_email_traveler_sent'),
  });
  await updateConfirmationEmailStatus(
    order.id,
    emailStatus === 'sent'
      ? 'confirmation_email_sent'
      : emailStatus === 'traveler_sent'
        ? 'confirmation_email_traveler_sent'
        : 'confirmation_email_failed',
  );

  await writeAuditLog({
    actorType: 'admin',
    actorEmail: adminEmail,
    action: 'admin_resend_confirmation_email',
    targetType: 'order',
    targetId: order.order_number,
    metadata: { emailStatus, purpose },
    ipHash: hashIp(getClientIp(req)),
    userAgent: getHeaderValue(req.headers['user-agent']),
  });

  res.status(200).json({ ok: true, emailStatus });
}

async function handleUpdateNotes(
  req: VercelRequestLike,
  res: VercelResponseLike,
  adminEmail: string,
  orderNumber: string,
) {
  const order = await findOrderByOrderNumber(orderNumber);
  if (!order) {
    res.status(404).json({ ok: false, error: 'Order not found.' });
    return;
  }

  const body = normalizeBody(req.body);
  const notes = String(body.notes ?? '').trim();

  await updateOrderInternalNotes(order.id, notes);

  await writeAuditLog({
    actorType: 'admin',
    actorEmail: adminEmail,
    action: 'admin_update_internal_notes',
    targetType: 'order',
    targetId: order.order_number,
    ipHash: hashIp(getClientIp(req)),
    userAgent: getHeaderValue(req.headers['user-agent']),
  });

  res.status(200).json({ ok: true });
}

type RouteSnapshotFields = {
  route_title?: string;
  departure_city?: string;
  start_date?: string;
  end_date?: string;
  route_slug?: string;
};

function readRouteSnapshot(value: unknown): RouteSnapshotFields {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const snapshot = value as Record<string, unknown>;
  const startRaw =
    typeof snapshot.start_date === 'string'
      ? snapshot.start_date
      : snapshot.start_date != null
        ? String(snapshot.start_date)
        : undefined;
  const endRaw =
    typeof snapshot.end_date === 'string'
      ? snapshot.end_date
      : snapshot.end_date != null
        ? String(snapshot.end_date)
        : undefined;
  return {
    route_title: typeof snapshot.route_title === 'string' ? snapshot.route_title : undefined,
    departure_city: typeof snapshot.departure_city === 'string' ? snapshot.departure_city : undefined,
    start_date: startRaw ? formatDate(startRaw) : undefined,
    end_date: endRaw ? formatDate(endRaw) : undefined,
    route_slug: typeof snapshot.route_slug === 'string' ? snapshot.route_slug : undefined,
  };
}

type AdminOrderRow = NonNullable<Awaited<ReturnType<typeof getOrderDetailForAdmin>>>;

function sanitizeOrderForList(order: AdminOrderRow) {
  const route = readRouteSnapshot(order.route_snapshot);

  return {
    id: order.id,
    order_number: order.order_number,
    status: order.status,
    payment_status: order.payment_status,
    refund_status: order.refund_status,
    confirmation_email_status: order.confirmation_email_status,
    lead_traveler_name: order.lead_traveler_name,
    lead_email: order.lead_email,
    adult_quantity: order.adult_quantity,
    total_price_cents: order.total_price_cents,
    currency: order.currency,
    route_title: route.route_title || '',
    departure_city: route.departure_city || '',
    start_date: route.start_date || '',
    end_date: route.end_date || '',
    route_slug: route.route_slug || '',
    created_at: order.created_at,
    updated_at: order.updated_at,
  };
}

/** Detail payload: list fields + notes and Stripe/tech timestamps (no secrets). */
function sanitizeOrderForDetail(order: AdminOrderRow) {
  return {
    ...sanitizeOrderForList(order),
    internal_notes: order.internal_notes ?? '',
    stripe_checkout_session_id: order.stripe_checkout_session_id,
    stripe_payment_intent_id: order.stripe_payment_intent_id,
    stripe_charge_id: order.stripe_charge_id,
    stripe_refund_id: order.stripe_refund_id,
    paid_at: order.paid_at,
    confirmed_at: order.confirmed_at,
    cancelled_at: order.cancelled_at,
    refunded_at: order.refunded_at,
    cancellation_requested_at: order.cancellation_requested_at,
    expired_at: order.expired_at,
  };
}

function normalizeBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object') return {};
  return body as Record<string, unknown>;
}

function parseQuery(url: string | undefined): URLSearchParams {
  if (!url) return new URLSearchParams();
  const parsed = new URL(url, 'http://localhost');
  return parsed.searchParams;
}

function getClientIp(req: VercelRequestLike): string {
  const forwarded = getHeaderValue(req.headers['x-forwarded-for']);
  if (forwarded) return forwarded.split(',')[0].trim();
  return getHeaderValue(req.headers['x-real-ip']) || 'unknown';
}

function getHeaderValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] : value || '';
}
