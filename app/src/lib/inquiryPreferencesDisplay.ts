import type { CustomTripFormField } from '@/lib/customTripFormClient';

export type PreferenceDisplayRow = {
  key: string;
  label: string;
  value: string;
};

function isEmptyPreferenceValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0 || value.every((item) => String(item).trim() === '');
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  return false;
}

function humanizeKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
}

function resolveOptionLabel(field: CustomTripFormField | undefined, raw: string): string {
  if (!field) return raw;
  const match = field.options.find(
    (option) => option.optionKey === raw || option.label === raw,
  );
  return match?.label ?? raw;
}

function formatPreferenceValue(value: unknown, field: CustomTripFormField | undefined): string {
  if (Array.isArray(value)) {
    return value
      .map((item) => resolveOptionLabel(field, String(item)))
      .filter((item) => item.trim())
      .join('、');
  }
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (typeof value === 'object' && value != null) {
    return JSON.stringify(value);
  }
  return resolveOptionLabel(field, String(value));
}

/**
 * Map custom_preferences to labeled rows using Admin form config.
 * Empty values are skipped; unknown keys fall back to a readable key.
 */
export function formatInquiryPreferences(
  preferences: unknown,
  fields: CustomTripFormField[],
): PreferenceDisplayRow[] {
  if (preferences == null || typeof preferences !== 'object' || Array.isArray(preferences)) {
    return [];
  }

  const prefs = preferences as Record<string, unknown>;
  const fieldByKey = new Map(fields.map((field) => [field.fieldKey, field]));
  const sortedFields = [...fields].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label),
  );

  const rows: PreferenceDisplayRow[] = [];
  const seen = new Set<string>();

  for (const field of sortedFields) {
    if (!(field.fieldKey in prefs)) continue;
    const value = prefs[field.fieldKey];
    if (isEmptyPreferenceValue(value)) continue;
    seen.add(field.fieldKey);
    rows.push({
      key: field.fieldKey,
      label: field.label || humanizeKey(field.fieldKey),
      value: formatPreferenceValue(value, field),
    });
  }

  for (const key of Object.keys(prefs)) {
    if (seen.has(key)) continue;
    const value = prefs[key];
    if (isEmptyPreferenceValue(value)) continue;
    const field = fieldByKey.get(key);
    rows.push({
      key,
      label: field?.label || humanizeKey(key),
      value: formatPreferenceValue(value, field),
    });
  }

  return rows;
}

export function formatInquiryScalar(value: unknown): string | null {
  if (isEmptyPreferenceValue(value)) return null;
  if (Array.isArray(value)) {
    const parts = value.map((item) => String(item).trim()).filter(Boolean);
    return parts.length ? parts.join('、') : null;
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return null;
    }
  }
  const text = String(value).trim();
  return text || null;
}
