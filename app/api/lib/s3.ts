import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export type S3Config = {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  region: string;
  publicBaseUrl: string;
};

export function getS3Config(): S3Config | null {
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.S3_BUCKET?.trim();
  const region = process.env.S3_REGION?.trim() || 'us-east-1';
  const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL?.trim().replace(/\/$/, '');

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

export function publicUrlForKey(key: string, config?: S3Config | null): string {
  const resolved = config ?? getS3Config();
  if (!resolved) {
    throw new Error('S3 is not configured.');
  }
  const encodedKey = key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${resolved.publicBaseUrl}/${encodedKey}`;
}

export async function createPresignedUploadUrl(input: {
  objectKey: string;
  contentType: string;
  expiresInSeconds?: number;
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

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: input.expiresInSeconds ?? 900,
  });

  return {
    uploadUrl,
    publicUrl: publicUrlForKey(input.objectKey, config),
  };
}
