/**
 * One-shot boot migration: `#/path?x=1` → `/path?x=1`.
 * Skips Supabase token fragments (`#access_token=…`).
 */
export function migrateLegacyHashRoute(): void {
  if (typeof window === 'undefined') return;

  const hash = window.location.hash;
  if (!hash.startsWith('#/')) return;
  if (hash.includes('access_token') || hash.includes('refresh_token')) return;

  const raw = hash.slice(1);
  const qIndex = raw.indexOf('?');
  const pathPart = qIndex >= 0 ? raw.slice(0, qIndex) : raw;
  const hashSearch = qIndex >= 0 ? raw.slice(qIndex) : '';
  const normalizedPath = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
  // Prefer existing query (e.g. ?auth_next=admin) over hash query.
  const search = window.location.search || hashSearch;

  window.history.replaceState(null, '', `${normalizedPath}${search}`);
}
