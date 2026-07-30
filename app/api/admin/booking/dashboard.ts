import { requireAdminAuth } from '../../domains/identity/admin/adminAuth';
import { ensureBookingTables } from '../../domains/booking/bookingSchema';
import { ensureContentTables } from '../../domains/catalog/contentSchema';
import { ensureInquiryTable } from '../../domains/inquiry/inquirySchema';
import { sql } from '../../platform/db';

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

type DashboardCounts = {
  openInquiries: number;
  cancellationRequestedOrders: number;
  draftRoutes: number;
  reviewMedia: number;
};

export default async function handler(req: VercelRequestLike, res: VercelResponseLike) {
  const admin = await requireAdminAuth(req);
  if (!admin.ok) {
    res.status(admin.status).json({ ok: false, error: admin.error });
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }

  try {
    await Promise.all([ensureInquiryTable(), ensureBookingTables(), ensureContentTables()]);

    const result = await sql<{
      open_inquiries: string;
      cancellation_requested_orders: string;
      draft_routes: string;
      review_media: string;
    }>`
      SELECT
        (SELECT COUNT(*)::text FROM inquiries WHERE status IN ('new', 'in_progress')) AS open_inquiries,
        (SELECT COUNT(*)::text FROM orders WHERE status = 'cancellation_requested') AS cancellation_requested_orders,
        (SELECT COUNT(*)::text FROM routes WHERE status = 'draft') AS draft_routes,
        (SELECT COUNT(*)::text FROM media_assets WHERE status = 'review') AS review_media
    `;

    const row = result.rows[0];
    const counts: DashboardCounts = {
      openInquiries: Number(row?.open_inquiries ?? 0),
      cancellationRequestedOrders: Number(row?.cancellation_requested_orders ?? 0),
      draftRoutes: Number(row?.draft_routes ?? 0),
      reviewMedia: Number(row?.review_media ?? 0),
    };

    res.status(200).json({ ok: true, counts });
  } catch (error) {
    console.error('Admin dashboard API failed:', error);
    res.status(500).json({ ok: false, error: 'Admin request failed.' });
  }
}
