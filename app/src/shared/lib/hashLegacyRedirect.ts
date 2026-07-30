/**
 * One-shot boot migration: `#/path?x=1` → `/path?x=1`.
 * Skips Supabase token fragments (`#access_token=…`).
 */

export function resolveLegacyHashNavigation(
  hash: string,
  existingSearch: string,
): { path: string; search: string } | null {
  if (!hash.startsWith('#/')) return null;
  if (hash.includes('access_token') || hash.includes('refresh_token')) return null;

  const raw = hash.slice(1);
  const qIndex = raw.indexOf('?');
  const pathPart = qIndex >= 0 ? raw.slice(0, qIndex) : raw;
  const hashSearch = qIndex >= 0 ? raw.slice(qIndex) : '';
  const normalizedPath = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
  // Prefer existing query (e.g. ?auth_next=admin) over hash query.
  const search = existingSearch || hashSearch;

  return { path: normalizedPath, search };
}

export function migrateLegacyHashRoute(): void {
  if (typeof window === 'undefined') return;

  const resolved = resolveLegacyHashNavigation(window.location.hash, window.location.search);
  if (!resolved) return;

  window.history.replaceState(null, '', `${resolved.path}${resolved.search}`);
}
