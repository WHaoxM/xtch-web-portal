/** Soft heuristic: empty, file-extension titles, UUID fragments, long slug-only names. */
export function looksLikeWeakMediaTitle(title: string): boolean {
  const trimmed = title.trim();
  if (!trimmed) return true;
  if (/\.(jpe?g|png|gif|webp|mp4|webm|mov|pdf)$/i.test(trimmed)) return true;
  if (/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/i.test(trimmed)) return true;
  if (!/\s/.test(trimmed) && /^[a-z0-9._-]{18,}$/i.test(trimmed)) return true;
  return false;
}

export function mediaHasAssociation(item: {
  destinationSlugs: string[];
  routeSlugs: string[];
}): boolean {
  return item.destinationSlugs.length > 0 || item.routeSlugs.length > 0;
}
