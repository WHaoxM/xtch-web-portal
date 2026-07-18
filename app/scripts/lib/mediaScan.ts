import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';

export const MEDIA_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.svg',
  '.mp4',
  '.webm',
  '.mov',
]);

export type SourceTag = 'source:public' | 'source:benzhan' | 'source:route_raw' | 'source:extracted';

export type ScanRoot = {
  absPath: string;
  /** Repo-relative posix path prefix for media-map sourcePath */
  relPrefix: string;
  sourceTag: SourceTag;
};

export type ScannedFile = {
  absPath: string;
  /** Repo-relative posix path */
  sourcePath: string;
  sourceTag: SourceTag;
  ext: string;
  contentType: string;
  mediaType: 'image' | 'video';
  bytes: number;
  filename: string;
};

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
};

export function toPosix(path: string): string {
  return path.split(sep).join('/');
}

export function contentTypeForExt(ext: string): string {
  return CONTENT_TYPES[ext.toLowerCase()] || 'application/octet-stream';
}

export function mediaTypeForExt(ext: string): 'image' | 'video' | null {
  const ct = contentTypeForExt(ext);
  if (ct.startsWith('image/')) return 'image';
  if (ct.startsWith('video/')) return 'video';
  return null;
}

export function defaultScanRoots(repoRoot: string): ScanRoot[] {
  const roots: ScanRoot[] = [
    {
      absPath: resolve(repoRoot, 'app/public/images'),
      relPrefix: 'app/public/images',
      sourceTag: 'source:public',
    },
    {
      absPath: resolve(repoRoot, 'app/public/videos'),
      relPrefix: 'app/public/videos',
      sourceTag: 'source:public',
    },
    {
      absPath: resolve(repoRoot, '本站'),
      relPrefix: '本站',
      sourceTag: 'source:benzhan',
    },
    {
      absPath: resolve(repoRoot, '路线_新'),
      relPrefix: '路线_新',
      sourceTag: 'source:route_raw',
    },
  ];

  const extracted = resolve(repoRoot, 'data/extracted/media');
  if (existsSync(extracted)) {
    roots.push({
      absPath: extracted,
      relPrefix: 'data/extracted/media',
      sourceTag: 'source:extracted',
    });
  }

  return roots;
}

function walkFiles(dir: string, out: string[]) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, out);
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = extname(entry.name).toLowerCase();
    if (MEDIA_EXTENSIONS.has(ext)) out.push(full);
  }
}

export function scanMediaFiles(roots: ScanRoot[]): ScannedFile[] {
  const files: ScannedFile[] = [];
  for (const root of roots) {
    if (!existsSync(root.absPath)) continue;
    const found: string[] = [];
    walkFiles(root.absPath, found);
    for (const absPath of found) {
      const ext = extname(absPath).toLowerCase();
      const mediaType = mediaTypeForExt(ext);
      if (!mediaType) continue;
      const st = statSync(absPath);
      const relInside = relative(root.absPath, absPath);
      const sourcePath = toPosix(join(root.relPrefix, relInside));
      files.push({
        absPath,
        sourcePath,
        sourceTag: root.sourceTag,
        ext,
        contentType: contentTypeForExt(ext),
        mediaType,
        bytes: st.size,
        filename: absPath.split(/[/\\]/).pop() || 'file',
      });
    }
  }
  return files;
}

export async function sha256File(absPath: string): Promise<string> {
  const hash = createHash('sha256');
  const stream = createReadStream(absPath);
  for await (const chunk of stream) {
    hash.update(chunk as Buffer);
  }
  return hash.digest('hex');
}

export function titleFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '');
  return base.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim() || filename;
}

/** Map `app/public/images/foo.jpg` → `/images/foo.jpg` (site-relative). */
export function publicLocalUrlFromSourcePath(sourcePath: string): string | null {
  const normalized = toPosix(sourcePath);
  const markers = ['app/public/images/', 'app/public/videos/'];
  for (const marker of markers) {
    const idx = normalized.indexOf(marker);
    if (idx === -1) continue;
    const rest = normalized.slice(idx + 'app/public/'.length);
    return `/${rest}`;
  }
  return null;
}

export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}
