import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { rewriteSignedUploadUrlForBrowser } from './s3';
import { matchesChatAttachmentSignature } from './imChatMediaRules';

type PrivateChatS3Config = {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  region: string;
};

export type UploadedObjectCheck = { ok: true } | { ok: false; reason: 'missing' | 'mismatch' };

export function getPrivateChatS3Config(env: NodeJS.ProcessEnv = process.env): PrivateChatS3Config | null {
  const endpoint = env.S3_ENDPOINT?.trim();
  const accessKeyId = env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY?.trim();
  const bucket = env.IM_MEDIA_S3_BUCKET?.trim();
  // Never silently fall back to S3_BUCKET: the existing content bucket is public.
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket || bucket === env.S3_BUCKET?.trim()) return null;
  return { endpoint, accessKeyId, secretAccessKey, bucket, region: env.S3_REGION?.trim() || 'us-east-1' };
}

export function isPrivateChatMediaConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return getPrivateChatS3Config(env) !== null;
}

function makeClient(config: PrivateChatS3Config): S3Client {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    forcePathStyle: true,
  });
}

export function rewritePrivateChatSignedUrlForBrowser(
  signed: string,
  requestOrigin?: string | null,
  env: NodeJS.ProcessEnv = process.env,
): string {
  // Wenshu is hosted on a separate origin from the MinIO proxy. A configured
  // S3_BROWSER_ENDPOINT is authoritative; otherwise retain the API request
  // host (the request Host/X-Forwarded-Host, not the browser Origin). This
  // avoids PUBLIC_DOMAIN accidentally rewriting a signed URL onto the visitor
  // site, which does not proxy MinIO.
  const explicitStorageEndpoint = env.S3_BROWSER_ENDPOINT?.trim();
  return rewriteSignedUploadUrlForBrowser(signed, env, explicitStorageEndpoint ? null : requestOrigin);
}

export function buildPrivateChatObjectKey(id: string): string {
  const date = new Date();
  const yyyy = String(date.getUTCFullYear());
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `im-chat/${yyyy}/${mm}/${id}`;
}

export async function createPrivateChatUploadUrl(input: {
  objectKey: string;
  contentType: string;
  byteSize: number;
  requestOrigin?: string | null;
}): Promise<string> {
  const config = getPrivateChatS3Config();
  if (!config) throw new Error('Private IM media storage is not configured.');
  const client = makeClient(config);
  const signed = await getSignedUrl(client, new PutObjectCommand({
    Bucket: config.bucket,
    Key: input.objectKey,
    ContentType: input.contentType,
    ContentLength: input.byteSize,
    IfNoneMatch: '*',
  }), { expiresIn: 300 });
  return rewritePrivateChatSignedUrlForBrowser(signed, input.requestOrigin);
}

export async function inspectPrivateChatObject(input: {
  objectKey: string;
  contentType: string;
  byteSize: number;
}): Promise<UploadedObjectCheck> {
  const config = getPrivateChatS3Config();
  if (!config) throw new Error('Private IM media storage is not configured.');
  const client = makeClient(config);
  let head;
  try {
    head = await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: input.objectKey }));
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : '';
    const statusCode = typeof error === 'object' && error !== null && '$metadata' in error
      ? Number((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode)
      : 0;
    if (code === 'NotFound' || code === 'NoSuchKey' || statusCode === 404) return { ok: false, reason: 'missing' };
    throw error;
  }
  if (Number(head.ContentLength) !== input.byteSize || head.ContentType?.split(';')[0]?.trim().toLowerCase() !== input.contentType) {
    return { ok: false, reason: 'mismatch' };
  }
  const sample = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: input.objectKey, Range: 'bytes=0-31' }));
  const bytes = sample.Body ? await sample.Body.transformToByteArray() : new Uint8Array();
  return matchesChatAttachmentSignature(input.contentType, bytes) ? { ok: true } : { ok: false, reason: 'mismatch' };
}

export async function createPrivateChatDownloadUrl(input: {
  objectKey: string;
  contentType: string;
  filename: string;
  kind: 'image' | 'file';
  requestOrigin?: string | null;
}): Promise<string> {
  const config = getPrivateChatS3Config();
  if (!config) throw new Error('Private IM media storage is not configured.');
  const client = makeClient(config);
  const disposition = input.kind === 'image' ? 'inline' : 'attachment';
  const asciiFilename = input.filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const filenameStar = encodeURIComponent(input.filename).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: input.objectKey,
    ResponseContentType: input.contentType,
    ResponseContentDisposition: `${disposition}; filename="${asciiFilename}"; filename*=UTF-8''${filenameStar}`,
    ResponseCacheControl: 'private, no-store, max-age=0',
  });
  const signed = await getSignedUrl(client, command, { expiresIn: 300 });
  return rewritePrivateChatSignedUrlForBrowser(signed, input.requestOrigin);
}
