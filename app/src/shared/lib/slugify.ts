/** Aligns with `app/scripts/backfill-content.ts` and `SLUG_PATTERN` in contentQueries. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function formatYyyyMmDd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/** Prefer ASCII slug from title; fall back to `{prefix}-{yyyyMMdd}-{short}`. */
export function slugifyOrFallback(title: string, now = new Date(), prefix = 'route'): string {
  const fromTitle = slugify(title);
  if (fromTitle && SLUG_PATTERN.test(fromTitle)) {
    return fromTitle;
  }
  const safePrefix = slugify(prefix) || 'item';
  const short = Math.random().toString(36).slice(2, 6);
  return `${safePrefix}-${formatYyyyMmDd(now)}-${short}`;
}
