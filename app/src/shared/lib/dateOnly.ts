/** Calendar date helpers — always `YYYY-MM-DD`, never raw Date/ISO in UI math. */

export function normalizeDateOnly(value: string | null | undefined): string {
  const str = String(value ?? '').trim();
  if (!str) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
    const date = new Date(str);
    if (Number.isNaN(date.getTime())) return str.slice(0, 10);
    const iso = date.toISOString();
    if (/T00:00:00(\.\d+)?Z$/.test(iso)) return iso.slice(0, 10);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  return str;
}

/** Add calendar days to a `YYYY-MM-DD` (UTC date math to avoid DST shifts). */
export function addDaysIso(yyyyMmDd: string, days: number): string {
  const base = normalizeDateOnly(yyyyMmDd);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(base)) return '';
  const date = new Date(`${base}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Inclusive trip end: start + (durationDays - 1). */
export function endDateFromDuration(start: string, durationDays: number): string {
  if (!Number.isFinite(durationDays) || durationDays < 1) return '';
  return addDaysIso(start, durationDays - 1);
}

/** Inclusive day count between two `YYYY-MM-DD` values. */
export function inclusiveDayCount(start: string, end: string): number | null {
  const startOnly = normalizeDateOnly(start);
  const endOnly = normalizeDateOnly(end);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startOnly) || !/^\d{4}-\d{2}-\d{2}$/.test(endOnly)) {
    return null;
  }
  const startDate = new Date(`${startOnly}T00:00:00Z`);
  const endDate = new Date(`${endOnly}T00:00:00Z`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  return Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
}
