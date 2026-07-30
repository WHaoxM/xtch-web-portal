/**
 * Normalize DB Date / ISO / date strings to calendar `YYYY-MM-DD`.
 * Shared by platform email formatting and booking availability snapshots.
 */
export function formatDate(value: unknown): string {
  if (value instanceof Date) {
    const iso = value.toISOString();
    // DATE mapped at UTC midnight (common on UTC servers)
    if (/T00:00:00(\.\d+)?Z$/.test(iso)) return iso.slice(0, 10);
    // DATE mapped at local midnight (e.g. UTC+8 → …T16:00:00.000Z)
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const str = String(value ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) return formatDate(new Date(str));
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  return str;
}
