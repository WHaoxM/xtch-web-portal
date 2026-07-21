/**
 * Central request-body size limits for deploy:serve (and edge proxy alignment).
 * Role 6 / Caddy should use the same byte caps at the reverse-proxy layer.
 */

export const JSON_API_BODY_LIMIT_BYTES = 1_048_576; // 1 MiB
export const STRIPE_WEBHOOK_BODY_LIMIT_BYTES = 262_144; // 256 KiB

/** Suggested reverse-proxy timeouts (seconds) for role 6. */
export const SUGGESTED_PROXY_READ_TIMEOUT_SEC = 60;
export const SUGGESTED_PROXY_BODY_TIMEOUT_SEC = 30;

export type BodyLimitKind = 'json' | 'webhook';

export function bodyLimitBytesForKind(kind: BodyLimitKind): number {
  return kind === 'webhook' ? STRIPE_WEBHOOK_BODY_LIMIT_BYTES : JSON_API_BODY_LIMIT_BYTES;
}

export class PayloadTooLargeError extends Error {
  readonly statusCode = 413 as const;
  readonly limitBytes: number;

  constructor(limitBytes: number) {
    super(`Payload Too Large (limit ${limitBytes} bytes)`);
    this.name = 'PayloadTooLargeError';
    this.limitBytes = limitBytes;
  }
}

export class InvalidJsonBodyError extends Error {
  readonly statusCode = 400 as const;

  constructor() {
    super('Invalid JSON body');
    this.name = 'InvalidJsonBodyError';
  }
}

export class ClientAbortedError extends Error {
  constructor() {
    super('Client aborted request while reading body');
    this.name = 'ClientAbortedError';
  }
}

type ReadableReq = {
  headers: Record<string, string | string[] | undefined>;
  destroyed?: boolean;
  complete?: boolean;
  resume?: () => void;
  destroy?: (error?: Error) => void;
  [Symbol.asyncIterator]?: () => AsyncIterator<string | Buffer>;
};

function headerContentLength(req: ReadableReq): number | null {
  const raw = req.headers['content-length'];
  if (raw === undefined) return null;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function isAbortLike(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { name?: string; code?: string };
  return (
    err.name === 'AbortError' ||
    err.code === 'ECONNRESET' ||
    err.code === 'ABORT_ERR' ||
    err.code === 'ERR_STREAM_PREMATURE_CLOSE'
  );
}

/**
 * Stream-accumulate request body with a hard byte cap.
 * Over-limit Content-Length rejects before reading; chunked bodies stop at the cap.
 * Does not enter business handlers after limit/abort/invalid JSON.
 */
export async function readLimitedRequestBody(
  req: ReadableReq,
  options: { raw: boolean; limitBytes: number },
): Promise<Buffer | unknown> {
  const { raw, limitBytes } = options;
  const declared = headerContentLength(req);
  if (declared !== null && declared > limitBytes) {
    req.resume?.();
    req.destroy?.();
    throw new PayloadTooLargeError(limitBytes);
  }

  const chunks: Buffer[] = [];
  let size = 0;

  try {
    if (typeof req[Symbol.asyncIterator] !== 'function') {
      throw new Error('Request is not async-iterable');
    }
    for await (const chunk of req as AsyncIterable<string | Buffer>) {
      const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      size += buf.length;
      if (size > limitBytes) {
        req.destroy?.();
        throw new PayloadTooLargeError(limitBytes);
      }
      chunks.push(buf);
    }
  } catch (error) {
    if (error instanceof PayloadTooLargeError) throw error;
    if (isAbortLike(error)) {
      throw new ClientAbortedError();
    }
    throw error;
  }

  const buf = Buffer.concat(chunks);
  if (raw) return buf;

  const text = buf.toString('utf8').trim();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new InvalidJsonBodyError();
  }
}
