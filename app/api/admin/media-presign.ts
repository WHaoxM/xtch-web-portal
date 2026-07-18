import { requireAdminAuth, hashIp } from '../lib/adminAuth';
import { writeAuditLog } from '../lib/auditLog';
import { resolveRequestOrigin } from '../lib/publicOrigin';
import { buildObjectKey, createPresignedUploadUrl, isS3Configured } from '../lib/s3';

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

const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'video/mp4',
  'video/webm',
  'application/pdf',
]);

export default async function handler(req: VercelRequestLike, res: VercelResponseLike) {
  const admin = await requireAdminAuth(req);
  if (!admin.ok) {
    res.status(admin.status).json({ ok: false, error: admin.error });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }

  if (!isS3Configured()) {
    res.status(503).json({
      ok: false,
      error: 'Object storage is not configured. Set S3_* env vars on the API server.',
    });
    return;
  }

  try {
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const filename = String(body.filename || '').trim();
    const contentType = String(body.contentType || '').trim().toLowerCase();

    if (!filename) {
      res.status(400).json({ ok: false, error: 'filename is required.' });
      return;
    }

    if (!contentType || !ALLOWED_CONTENT_TYPES.has(contentType)) {
      res.status(400).json({ ok: false, error: 'contentType is not allowed for upload.' });
      return;
    }

    const objectKey = buildObjectKey(filename, contentType);
    const requestOrigin = resolveRequestOrigin(req);
    const presigned = await createPresignedUploadUrl({
      objectKey,
      contentType,
      requestOrigin,
    });

    await writeAuditLog({
      actorType: 'admin',
      actorEmail: admin.email,
      action: 'admin_media_presign',
      targetType: 'media_asset',
      targetId: objectKey,
      ipHash: hashIp(getClientIp(req)),
      userAgent: getHeaderValue(req.headers['user-agent']),
    });

    res.status(200).json({
      ok: true,
      objectKey,
      uploadUrl: presigned.uploadUrl,
      publicUrl: presigned.publicUrl,
      contentType,
    });
  } catch (error) {
    console.error('Admin media presign failed:', error);
    res.status(500).json({ ok: false, error: 'Presigned upload URL could not be created.' });
  }
}

function getClientIp(req: VercelRequestLike): string {
  const forwarded = getHeaderValue(req.headers['x-forwarded-for']);
  if (forwarded) return forwarded.split(',')[0].trim();
  return getHeaderValue(req.headers['x-real-ip']) || 'unknown';
}

function getHeaderValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] : value || '';
}
