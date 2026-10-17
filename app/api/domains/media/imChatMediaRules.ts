export const MAX_CHAT_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_CHAT_FILE_BYTES = 15 * 1024 * 1024;

export type ChatAttachmentKind = 'image' | 'file';
export type ChatAttachmentInput = {
  filename: string;
  contentType: string;
  byteSize: number;
  kind: ChatAttachmentKind;
};

const MIME_BY_EXTENSION: Record<string, { contentType: string; kind: ChatAttachmentKind }> = {
  jpg: { contentType: 'image/jpeg', kind: 'image' },
  jpeg: { contentType: 'image/jpeg', kind: 'image' },
  png: { contentType: 'image/png', kind: 'image' },
  webp: { contentType: 'image/webp', kind: 'image' },
  gif: { contentType: 'image/gif', kind: 'image' },
  pdf: { contentType: 'application/pdf', kind: 'file' },
  txt: { contentType: 'text/plain', kind: 'file' },
  csv: { contentType: 'text/csv', kind: 'file' },
  docx: { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', kind: 'file' },
  xlsx: { contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', kind: 'file' },
  pptx: { contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', kind: 'file' },
};

export function readChatAttachmentInput(value: unknown): ChatAttachmentInput {
  if (!isRecord(value)) throw new Error('Invalid attachment.');
  const filename = sanitizeChatFilename(typeof value.filename === 'string' ? value.filename : '');
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  const allowed = MIME_BY_EXTENSION[extension];
  const contentType = typeof value.contentType === 'string' ? value.contentType.trim().toLowerCase() : '';
  const byteSize = Number(value.byteSize);
  const kind = value.kind === 'image' || value.kind === 'file' ? value.kind : null;
  if (!allowed || !filename || !Number.isSafeInteger(byteSize) || byteSize < 1 || !kind) {
    throw new Error('Unsupported attachment.');
  }
  if (allowed.contentType !== contentType || allowed.kind !== kind) {
    throw new Error('Attachment type does not match its file name.');
  }
  const max = kind === 'image' ? MAX_CHAT_IMAGE_BYTES : MAX_CHAT_FILE_BYTES;
  if (byteSize > max) throw new Error(`Attachment exceeds the ${Math.floor(max / 1024 / 1024)} MB limit.`);
  return { filename, contentType, byteSize, kind };
}

export function sanitizeChatFilename(filename: string): string {
  const leaf = filename.split(/[\\/]/).pop() || '';
  // Control characters must not reach Content-Disposition or object metadata.
  const cleaned = leaf
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[<>:"|?*]/g, '-')
    .trim()
    .slice(0, 160);
  return cleaned && cleaned !== '.' && cleaned !== '..' ? cleaned : '';
}

/** Sniff the uploaded bytes instead of trusting the caller-supplied MIME header. */
export function matchesChatAttachmentSignature(contentType: string, bytes: Uint8Array): boolean {
  const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  switch (contentType) {
    case 'image/jpeg': return starts(0xff, 0xd8, 0xff);
    case 'image/png': return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case 'image/gif': return ascii(bytes.slice(0, 6)) === 'GIF87a' || ascii(bytes.slice(0, 6)) === 'GIF89a';
    case 'image/webp': return ascii(bytes.slice(0, 4)) === 'RIFF' && ascii(bytes.slice(8, 12)) === 'WEBP';
    case 'application/pdf': return ascii(bytes.slice(0, 5)) === '%PDF-';
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      return starts(0x50, 0x4b, 0x03, 0x04);
    case 'text/plain':
    case 'text/csv':
      return bytes.length > 0 && !bytes.includes(0);
    default: return false;
  }
}

function ascii(bytes: Uint8Array): string {
  return String.fromCharCode(...bytes);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
