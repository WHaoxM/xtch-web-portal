import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  isPlaceholderUrl,
  resolvePublicOrigin,
  resolveS3BrowserEndpoint,
} from './publicOrigin';

export type S3Config = {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  region: string;
  publicBaseUrl: string;
};

export function getS3Config(env: NodeJS.ProcessEnv = process.env): S3Config | null {
  const endpoint = env.S3_ENDPOINT?.trim();
  const accessKeyId = env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY?.trim();
  const bucket = env.S3_BUCKET?.trim();
  const region = env.S3_REGION?.trim() || 'us-east-1';
  let publicBaseUrl = env.S3_PUBLIC_BASE_URL?.trim().replace(/\/$/, '') || '';

  if (publicBaseUrl && isPlaceholderUrl(publicBaseUrl)) {
    publicBaseUrl = '';
  }
  if (!publicBaseUrl && bucket) {
    const origin = resolvePublicOrigin(env);
    if (origin) {
      publicBaseUrl = `${origin}/s3/${bucket}`;
    }
  }

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) {
    return null;
  }

  return { endpoint, accessKeyId, secretAccessKey, bucket, region, publicBaseUrl };
}

export function isS3Configured(): boolean {
  return getS3Config() !== null;
}

function createS3Client(config: S3Config): S3Client {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: true,
  });
}

export function sanitizeObjectFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() || 'upload';
  const cleaned = base
    .replace(/[^\w.\-()]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
  return cleaned || 'upload';
}

export function resolveStorageEnv(env: NodeJS.ProcessEnv = process.env): 'dev' | 'prod' {
  const appEnv = env.APP_ENV?.trim().toLowerCase();
  if (appEnv === 'prod' || appEnv === 'production') return 'prod';
  if (appEnv === 'dev' || appEnv === 'development') return 'dev';
  return env.NODE_ENV === 'production' ? 'prod' : 'dev';
}

export function mediaTypeFromContentType(contentType: string): 'image' | 'video' | 'pdf' | 'file' {
  const ct = contentType.trim().toLowerCase();
  if (ct.startsWith('image/')) return 'image';
  if (ct.startsWith('video/')) return 'video';
  if (ct === 'application/pdf') return 'pdf';
  return 'file';
}

export function buildObjectKey(
  filename: string,
  contentType: string,
  now: Date = new Date(),
  env: NodeJS.ProcessEnv = process.env,
): string {
  const storageEnv = resolveStorageEnv(env);
  const type = mediaTypeFromContentType(contentType);
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const id = crypto.randomUUID();
  const safeName = sanitizeObjectFilename(filename);
  return `${storageEnv}/${type}/${yyyy}/${mm}/${id}-${safeName}`;
}

/**
 * Browser-facing object URL. Prefer same-origin relative `/s3/<bucket>/<key>`
 * so LAN / ngrok / domain all work without rewriting stored rows.
 */
export function publicUrlForKey(key: string, config?: S3Config | null): string {
  const resolved = config ?? getS3Config();
  if (!resolved) {
    throw new Error('S3 is not configured.');
  }
  const encodedKey = key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  if (resolved.bucket) {
    return `/s3/${resolved.bucket}/${encodedKey}`;
  }

  const base = resolved.publicBaseUrl.replace(/\/$/, '');
  if (base.startsWith('/')) {
    return `${base}/${encodedKey}`;
  }
  try {
    const parsed = new URL(base);
    const path = parsed.pathname.replace(/\/$/, '') || '';
    return `${path}/${encodedKey}`;
  } catch {
    return `${base}/${encodedKey}`;
  }
}

/** Strip host from absolute same-origin /s3 URLs; leave other http(s) URLs alone. */
export function toSameOriginS3Path(urlOrPath: string): string {
  const trimmed = urlOrPath.trim();
  const match = trimmed.match(/^https?:\/\/[^/?#]+(\/s3\/[^?#]*)/i);
  return match ? match[1] : trimmed;
}

export async function createPresignedUploadUrl(input: {
  objectKey: string;
  contentType: string;
  expiresInSeconds?: number;
  /** Browser request origin (scheme://host[:port]); preferred for /s3 rewrite. */
  requestOrigin?: string | null;
}): Promise<{ uploadUrl: string; publicUrl: string }> {
  const config = getS3Config();
  if (!config) {
    throw new Error('Object storage is not configured on the API server.');
  }

  const client = createS3Client(config);
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: input.objectKey,
    ContentType: input.contentType,
  });

  const signedUploadUrl = await getSignedUrl(client, command, {
    expiresIn: input.expiresInSeconds ?? 900,
  });

  const requestOrigin = input.requestOrigin?.trim() || null;
  const publicUrl = publicUrlForKey(input.objectKey, config);

  return {
    uploadUrl: rewriteSignedUploadUrlForBrowser(signedUploadUrl, process.env, requestOrigin),
    publicUrl,
  };
}

/**
 * Sign against local MinIO (S3_ENDPOINT=http://127.0.0.1:9000) so SigV4 Host
 * matches what the reverse proxy sends after changeOrigin. Rewrite the URL the
 * browser uses to the same-origin /s3 path (request Host, else S3_BROWSER_ENDPOINT,
 * else resolvePublicOrigin()/s3).
 */
export function rewriteSignedUploadUrlForBrowser(
  signedUploadUrl: string,
  env: NodeJS.ProcessEnv = process.env,
  requestOrigin?: string | null,
): string {
  const browserEndpoint = resolveS3BrowserEndpoint(env, requestOrigin);
  if (!browserEndpoint) return signedUploadUrl;

  const signed = new URL(signedUploadUrl);
  const browser = new URL(browserEndpoint);
  const browserPath = browser.pathname.replace(/\/$/, '');
  const combinedPath = `${browserPath}${signed.pathname}` || '/';
  return `${browser.origin}${combinedPath}${signed.search}`;
}
