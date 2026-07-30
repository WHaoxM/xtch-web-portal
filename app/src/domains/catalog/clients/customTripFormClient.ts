export type FormControlType = 'single_select' | 'multi_select' | 'select' | 'text' | 'textarea';
export type FormGroup = 'basic' | 'more';

export type CustomTripFormOption = {
  id: string;
  optionKey: string;
  label: string;
  sortOrder: number;
  enabled: boolean;
};

export type CustomTripFormField = {
  id: string;
  fieldKey: string;
  label: string;
  description: string;
  controlType: FormControlType;
  required: boolean;
  defaultValue: unknown;
  formGroup: FormGroup;
  sortOrder: number;
  enabled: boolean;
  keyLocked: boolean;
  useOnRoutePrivate: boolean;
  options: CustomTripFormOption[];
};

export type CustomPreferences = Record<string, unknown>;

export type CustomTripFormConfigResponse = {
  ok: boolean;
  fields?: CustomTripFormField[];
  defaults?: CustomPreferences;
  error?: string;
};

export async function fetchCustomTripFormConfig() {
  const response = await fetch('/api/custom-trip-form');
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'Unexpected form config response.',
  }))) as CustomTripFormConfigResponse;

  if (!response.ok || !result.ok || !Array.isArray(result.fields)) {
    throw new Error(result.error || 'We could not load the trip preference form.');
  }

  return {
    fields: result.fields,
    defaults: result.defaults ?? buildDefaultPreferences(result.fields),
  };
}

export async function fetchAdminCustomTripForm(token: string) {
  const response = await fetch('/api/admin/custom-trip-form', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'Unexpected admin form response.',
  }))) as { ok: boolean; fields?: CustomTripFormField[]; error?: string };

  if (!response.ok || !result.ok || !Array.isArray(result.fields)) {
    throw new Error(result.error || 'We could not load admin form fields.');
  }

  return result.fields;
}

export async function postAdminCustomTripForm(
  token: string,
  body: Record<string, unknown>,
) {
  const response = await fetch('/api/admin/custom-trip-form', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'Unexpected admin form response.',
  }))) as {
    ok: boolean;
    field?: CustomTripFormField;
    fields?: CustomTripFormField[];
    error?: string;
  };

  if (!response.ok || !result.ok) {
    throw new Error(result.error || 'Admin request failed.');
  }

  return result;
}

export function buildDefaultPreferences(fields: CustomTripFormField[]): CustomPreferences {
  const preferences: CustomPreferences = {};
  for (const field of fields) {
    if (!field.enabled) continue;
    preferences[field.fieldKey] = cloneDefault(field.defaultValue, field.controlType);
  }
  return preferences;
}

export function preferenceFieldsByGroup(
  fields: CustomTripFormField[],
  group: FormGroup,
): CustomTripFormField[] {
  return fields
    .filter((field) => field.enabled && field.formGroup === group)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}

/** Fields shown on the route-based private short form (Admin checkbox). */
export function preferenceFieldsForRoutePrivate(
  fields: CustomTripFormField[],
): CustomTripFormField[] {
  return fields
    .filter((field) => field.enabled && field.useOnRoutePrivate)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}

/** Default badge only for single-select when current value equals configured default. */
export function showsDefaultBadge(field: CustomTripFormField, value: unknown): boolean {
  if (field.controlType !== 'single_select') return false;
  return valuesEqual(value, field.defaultValue);
}

export function valuesEqual(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) || Array.isArray(right)) {
    const a = Array.isArray(left) ? left.map(String) : [];
    const b = Array.isArray(right) ? right.map(String) : [];
    if (a.length !== b.length) return false;
    return a.every((item, index) => item === b[index]);
  }
  return String(left ?? '') === String(right ?? '');
}

export function isEmptyPreferenceValue(field: CustomTripFormField, value: unknown): boolean {
  if (field.controlType === 'multi_select') {
    return !Array.isArray(value) || value.length === 0;
  }
  if (field.controlType === 'text' || field.controlType === 'textarea') {
    return !String(value ?? '').trim();
  }
  return !String(value ?? '').trim();
}

export function validatePreferenceAnswers(
  fields: CustomTripFormField[],
  preferences: CustomPreferences,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields.filter((item) => item.enabled)) {
    const value = preferences[field.fieldKey];
    if (field.required && isEmptyPreferenceValue(field, value)) {
      errors[field.fieldKey] = `Please complete ${field.label}.`;
    }
  }
  return errors;
}

function cloneDefault(value: unknown, controlType: FormControlType): unknown {
  if (controlType === 'multi_select') {
    return Array.isArray(value) ? [...value] : [];
  }
  if (controlType === 'text' || controlType === 'textarea') {
    return typeof value === 'string' ? value : '';
  }
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}
