import { sql } from './db';
import { ensureInquiryTable } from './inquirySchema';

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
  /** When true, field is shown on the route-based private short form. */
  useOnRoutePrivate: boolean;
  options: CustomTripFormOption[];
};

export type CustomPreferences = Record<string, unknown>;

const MAX_TEXT_LENGTH = 500;
const MAX_TEXTAREA_LENGTH = 2000;
const MAX_OPTIONS_PER_FIELD = 40;
const MAX_LABEL_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 400;

type SeedField = {
  fieldKey: string;
  label: string;
  description: string;
  controlType: FormControlType;
  required: boolean;
  defaultValue: unknown;
  formGroup: FormGroup;
  sortOrder: number;
  keyLocked: boolean;
  useOnRoutePrivate: boolean;
  options: Array<{ optionKey: string; label: string; sortOrder: number }>;
};

const SEED_FIELDS: SeedField[] = [
  {
    fieldKey: 'hotel_level',
    label: 'Hotel star rating',
    description: 'Preferred hotel standard for your private trip.',
    controlType: 'single_select',
    required: true,
    defaultValue: '4-star',
    formGroup: 'basic',
    sortOrder: 10,
    keyLocked: true,
    useOnRoutePrivate: true,
    options: [
      { optionKey: '3-star', label: '3-star', sortOrder: 10 },
      { optionKey: '4-star', label: '4-star', sortOrder: 20 },
      { optionKey: '5-star', label: '5-star', sortOrder: 30 },
      { optionKey: 'luxury', label: 'Luxury', sortOrder: 40 },
      { optionKey: 'not-sure', label: 'Not sure yet', sortOrder: 50 },
    ],
  },
  {
    fieldKey: 'vehicle',
    label: 'Vehicle',
    description: 'Preferred ground transport between hotels and sights.',
    controlType: 'single_select',
    required: false,
    defaultValue: 'private_sedan',
    formGroup: 'more',
    sortOrder: 20,
    keyLocked: true,
    useOnRoutePrivate: false,
    options: [
      { optionKey: 'private_sedan', label: 'Private sedan', sortOrder: 10 },
      { optionKey: 'private_van', label: 'Private van', sortOrder: 20 },
      { optionKey: 'mixed', label: 'Mix as needed', sortOrder: 30 },
      { optionKey: 'not-sure', label: 'Not sure yet', sortOrder: 40 },
    ],
  },
  {
    fieldKey: 'trip_pace',
    label: 'Trip pace',
    description: 'How packed or relaxed you want each day to feel.',
    controlType: 'single_select',
    required: false,
    defaultValue: 'balanced',
    formGroup: 'more',
    sortOrder: 30,
    keyLocked: true,
    useOnRoutePrivate: false,
    options: [
      { optionKey: 'relaxed', label: 'Relaxed', sortOrder: 10 },
      { optionKey: 'balanced', label: 'Balanced', sortOrder: 20 },
      { optionKey: 'active', label: 'Active', sortOrder: 30 },
    ],
  },
  {
    fieldKey: 'guide_language',
    label: 'Guide language',
    description: 'Preferred language for your private guide.',
    controlType: 'single_select',
    required: false,
    defaultValue: 'english',
    formGroup: 'more',
    sortOrder: 40,
    keyLocked: true,
    useOnRoutePrivate: false,
    options: [
      { optionKey: 'english', label: 'English', sortOrder: 10 },
      { optionKey: 'mandarin', label: 'Mandarin', sortOrder: 20 },
      { optionKey: 'bilingual', label: 'English + Mandarin', sortOrder: 30 },
      { optionKey: 'other', label: 'Other (tell us in notes)', sortOrder: 40 },
    ],
  },
  {
    fieldKey: 'dining',
    label: 'Dining preferences',
    description: 'Food style or dietary notes we should plan around.',
    controlType: 'multi_select',
    required: false,
    defaultValue: [],
    formGroup: 'more',
    sortOrder: 50,
    keyLocked: true,
    useOnRoutePrivate: false,
    options: [
      { optionKey: 'local', label: 'Local cuisine', sortOrder: 10 },
      { optionKey: 'vegetarian', label: 'Vegetarian options', sortOrder: 20 },
      { optionKey: 'halal', label: 'Halal-friendly', sortOrder: 30 },
      { optionKey: 'no-spicy', label: 'Mild / less spicy', sortOrder: 40 },
      { optionKey: 'flexible', label: 'Flexible', sortOrder: 50 },
    ],
  },
  {
    fieldKey: 'accessibility',
    label: 'Accessibility needs',
    description: 'Any mobility or accessibility requirements.',
    controlType: 'text',
    required: false,
    defaultValue: '',
    formGroup: 'more',
    sortOrder: 60,
    keyLocked: true,
    useOnRoutePrivate: false,
    options: [],
  },
  {
    fieldKey: 'budget',
    label: 'Budget per person (USD)',
    description: 'Rough budget excluding international flights.',
    controlType: 'select',
    required: false,
    defaultValue: 'not-sure',
    formGroup: 'more',
    sortOrder: 70,
    keyLocked: true,
    useOnRoutePrivate: false,
    options: [
      { optionKey: 'under-1500', label: 'Under US$1,500', sortOrder: 10 },
      { optionKey: '1500-2500', label: 'US$1,500 - US$2,500', sortOrder: 20 },
      { optionKey: '2500-4000', label: 'US$2,500 - US$4,000', sortOrder: 30 },
      { optionKey: '4000-plus', label: 'US$4,000+', sortOrder: 40 },
      { optionKey: 'not-sure', label: 'Not sure yet', sortOrder: 50 },
    ],
  },
];

let tablesReady = false;
let memoryFields: CustomTripFormField[] | null = null;

export function shouldUseMemoryFormStorage() {
  return !process.env.DATABASE_URL && !process.env.POSTGRES_URL && !process.env.POSTGRES_PRISMA_URL;
}

export async function ensureCustomTripFormTables() {
  if (tablesReady || shouldUseMemoryFormStorage()) return;

  await sql`
    CREATE TABLE IF NOT EXISTS custom_trip_form_fields (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      field_key TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      control_type TEXT NOT NULL,
      required BOOLEAN NOT NULL DEFAULT false,
      default_value JSONB NOT NULL DEFAULT 'null'::jsonb,
      form_group TEXT NOT NULL DEFAULT 'more',
      sort_order INTEGER NOT NULL DEFAULT 0,
      enabled BOOLEAN NOT NULL DEFAULT true,
      key_locked BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT custom_trip_form_fields_control_type_known
        CHECK (control_type IN ('single_select', 'multi_select', 'select', 'text', 'textarea')),
      CONSTRAINT custom_trip_form_fields_group_known
        CHECK (form_group IN ('basic', 'more'))
    )
  `;

  await sql`
    ALTER TABLE custom_trip_form_fields
    ADD COLUMN IF NOT EXISTS use_on_route_private BOOLEAN NOT NULL DEFAULT false
  `;

  // Bootstrap: if no field is flagged yet, treat basic-group fields as route-private (pre-checkbox behavior).
  const flagged = await sql<{ count: string }>`
    SELECT COUNT(*)::text AS count
    FROM custom_trip_form_fields
    WHERE use_on_route_private = true
  `;
  if (Number(flagged.rows[0]?.count ?? 0) === 0) {
    await sql`
      UPDATE custom_trip_form_fields
      SET use_on_route_private = true
      WHERE form_group = 'basic'
    `;
  }

  await sql`
    CREATE TABLE IF NOT EXISTS custom_trip_form_options (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      field_id UUID NOT NULL REFERENCES custom_trip_form_fields(id) ON DELETE CASCADE,
      option_key TEXT NOT NULL,
      label TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      enabled BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (field_id, option_key)
    )
  `;

  // Fresh DBs may lack inquiries (migration 002 / POST /api/inquiries never ran).
  await ensureInquiryTable();

  await seedCustomTripFormIfEmpty();
  tablesReady = true;
}

export async function listCustomTripFormFields(options?: {
  includeDisabled?: boolean;
}): Promise<CustomTripFormField[]> {
  if (shouldUseMemoryFormStorage()) {
    return getMemoryFields().filter((field) => options?.includeDisabled || field.enabled);
  }

  await ensureCustomTripFormTables();

  const fields = await sql<{
    id: string;
    field_key: string;
    label: string;
    description: string;
    control_type: FormControlType;
    required: boolean;
    default_value: unknown;
    form_group: FormGroup;
    sort_order: number;
    enabled: boolean;
    key_locked: boolean;
    use_on_route_private: boolean;
  }>`
    SELECT *
    FROM custom_trip_form_fields
    ORDER BY form_group ASC, sort_order ASC, label ASC
  `;

  let fieldRows = fields.rows;
  if (!fieldRows.length) {
    await seedCustomTripFormIfEmpty();
    return listCustomTripFormFields(options);
  }

  if (!options?.includeDisabled) {
    fieldRows = fieldRows.filter((field) => field.enabled);
  }

  const optionsResult = await sql<{
    id: string;
    field_id: string;
    option_key: string;
    label: string;
    sort_order: number;
    enabled: boolean;
  }>`
    SELECT *
    FROM custom_trip_form_options
    ORDER BY sort_order ASC, label ASC
  `;

  return fieldRows.map((field) => ({
    id: field.id,
    fieldKey: field.field_key,
    label: field.label,
    description: field.description || '',
    controlType: field.control_type,
    required: field.required,
    defaultValue: field.default_value,
    formGroup: field.form_group,
    sortOrder: field.sort_order,
    enabled: field.enabled,
    keyLocked: field.key_locked,
    useOnRoutePrivate: Boolean(field.use_on_route_private),
    options: optionsResult.rows
      .filter((option) => option.field_id === field.id && (options?.includeDisabled || option.enabled))
      .map((option) => ({
        id: option.id,
        optionKey: option.option_key,
        label: option.label,
        sortOrder: option.sort_order,
        enabled: option.enabled,
      })),
  }));
}

export function buildDefaultPreferences(fields: CustomTripFormField[]): CustomPreferences {
  const preferences: CustomPreferences = {};
  for (const field of fields) {
    if (!field.enabled) continue;
    preferences[field.fieldKey] = cloneDefault(field.defaultValue, field.controlType);
  }
  return preferences;
}

export function validateCustomPreferences(
  fields: CustomTripFormField[],
  raw: unknown,
): { error: string } | { preferences: CustomPreferences } {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};

  const preferences: CustomPreferences = {};
  const enabledFields = fields.filter((field) => field.enabled);

  for (const field of enabledFields) {
    const hasKey = Object.prototype.hasOwnProperty.call(input, field.fieldKey);
    const value = hasKey ? input[field.fieldKey] : cloneDefault(field.defaultValue, field.controlType);
    const validated = validateFieldValue(field, value);
    if (validated.error) return { error: validated.error };
    preferences[field.fieldKey] = validated.value;
  }

  return { preferences };
}

export function mapPreferencesToLegacyColumns(preferences: CustomPreferences, fields: CustomTripFormField[]) {
  const hotelField = fields.find((field) => field.fieldKey === 'hotel_level');
  const budgetField = fields.find((field) => field.fieldKey === 'budget');
  const hotelValue = preferences.hotel_level;
  const budgetValue = preferences.budget;

  return {
    hotelLevel: typeof hotelValue === 'string'
      ? labelForOption(hotelField, hotelValue) || hotelValue
      : '',
    budget: typeof budgetValue === 'string'
      ? labelForOption(budgetField, budgetValue) || budgetValue
      : '',
  };
}

export function formatPreferencesForEmail(
  preferences: CustomPreferences,
  fields: CustomTripFormField[],
): string[] {
  const lines: string[] = [];
  const byKey = new Map(fields.map((field) => [field.fieldKey, field]));

  for (const [key, value] of Object.entries(preferences)) {
    const field = byKey.get(key);
    const label = field?.label || key;
    lines.push(`${label}: ${formatPreferenceValue(field, value)}`);
  }

  return lines;
}

export async function upsertCustomTripField(input: {
  id?: string;
  fieldKey: string;
  label: string;
  description?: string;
  controlType: FormControlType;
  required: boolean;
  defaultValue: unknown;
  formGroup: FormGroup;
  sortOrder: number;
  enabled: boolean;
  useOnRoutePrivate?: boolean;
  options?: Array<{ id?: string; optionKey: string; label: string; sortOrder: number; enabled: boolean }>;
}): Promise<{ error?: string; field?: CustomTripFormField }> {
  if (shouldUseMemoryFormStorage()) {
    return upsertMemoryField(input);
  }

  await ensureCustomTripFormTables();

  const label = input.label.trim();
  const fieldKey = input.fieldKey.trim().toLowerCase();
  const description = (input.description || '').trim();

  if (!/^[a-z][a-z0-9_]{1,63}$/.test(fieldKey)) {
    return { error: 'Field key must be snake_case (letters, numbers, underscore).' };
  }
  if (!label || label.length > MAX_LABEL_LENGTH) {
    return { error: 'Please enter a valid field label.' };
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return { error: 'Description is too long.' };
  }
  if (!isControlType(input.controlType) || !isFormGroup(input.formGroup)) {
    return { error: 'Invalid control type or form group.' };
  }

  const options = (input.options || []).map((option, index) => ({
    id: option.id,
    optionKey: option.optionKey.trim(),
    label: option.label.trim(),
    sortOrder: Number.isFinite(option.sortOrder) ? option.sortOrder : (index + 1) * 10,
    enabled: Boolean(option.enabled),
  }));

  if (options.length > MAX_OPTIONS_PER_FIELD) {
    return { error: `A field can have at most ${MAX_OPTIONS_PER_FIELD} options.` };
  }

  if (['single_select', 'multi_select', 'select'].includes(input.controlType) && options.filter((o) => o.enabled).length === 0) {
    return { error: 'Choice fields need at least one enabled option.' };
  }

  const optionKeys = new Set<string>();
  for (const option of options) {
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(option.optionKey)) {
      return { error: `Invalid option key: ${option.optionKey || '(empty)'}` };
    }
    if (!option.label || option.label.length > MAX_LABEL_LENGTH) {
      return { error: 'Each option needs a valid label.' };
    }
    if (optionKeys.has(option.optionKey)) {
      return { error: `Duplicate option key: ${option.optionKey}` };
    }
    optionKeys.add(option.optionKey);
  }

  const defaultCheck = validateDefaultAgainstOptions(input.controlType, input.defaultValue, options.filter((o) => o.enabled));
  if (defaultCheck.error) return { error: defaultCheck.error };

  const useOnRoutePrivate = Boolean(input.useOnRoutePrivate);

  try {
    const field = await sql.begin(async (tx) => {
      if (input.id) {
        const existing = await tx<{ id: string; field_key: string; key_locked: boolean }>`
          SELECT id, field_key, key_locked FROM custom_trip_form_fields WHERE id = ${input.id}
        `;
        const row = existing.rows[0];
        if (!row) throw new Error('Field not found.');
        if (row.key_locked && row.field_key !== fieldKey) {
          throw new Error('This field key is locked and cannot be renamed.');
        }

        await tx`
          UPDATE custom_trip_form_fields
          SET field_key = ${fieldKey},
              label = ${label},
              description = ${description},
              control_type = ${input.controlType},
              required = ${input.required},
              default_value = ${JSON.stringify(defaultCheck.value)}::jsonb,
              form_group = ${input.formGroup},
              sort_order = ${input.sortOrder},
              enabled = ${input.enabled},
              use_on_route_private = ${useOnRoutePrivate},
              updated_at = NOW()
          WHERE id = ${input.id}
        `;

        await syncOptions(tx, input.id, options);
        return input.id;
      }

      const inserted = await tx<{ id: string }>`
        INSERT INTO custom_trip_form_fields (
          field_key, label, description, control_type, required, default_value,
          form_group, sort_order, enabled, key_locked, use_on_route_private
        ) VALUES (
          ${fieldKey}, ${label}, ${description}, ${input.controlType}, ${input.required},
          ${JSON.stringify(defaultCheck.value)}::jsonb, ${input.formGroup}, ${input.sortOrder},
          ${input.enabled}, false, ${useOnRoutePrivate}
        )
        RETURNING id
      `;
      const id = inserted.rows[0].id;
      await syncOptions(tx, id, options);
      return id;
    });

    const all = await listCustomTripFormFields({ includeDisabled: true });
    return { field: all.find((item) => item.id === field) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save field.';
    if (message.includes('duplicate') || message.includes('unique')) {
      return { error: 'Field key already exists.' };
    }
    return { error: message };
  }
}

export async function setCustomTripFieldEnabled(id: string, enabled: boolean) {
  if (shouldUseMemoryFormStorage()) {
    const fields = getMemoryFields();
    const field = fields.find((item) => item.id === id);
    if (!field) return { error: 'Field not found.' };
    field.enabled = enabled;
    return { field };
  }

  await ensureCustomTripFormTables();
  const result = await sql`
    UPDATE custom_trip_form_fields
    SET enabled = ${enabled}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING id
  `;
  if (!result.rows.length) return { error: 'Field not found.' };
  const all = await listCustomTripFormFields({ includeDisabled: true });
  return { field: all.find((item) => item.id === id) };
}

export async function reorderCustomTripFields(orderedIds: string[]) {
  if (shouldUseMemoryFormStorage()) {
    const fields = getMemoryFields();
    orderedIds.forEach((id, index) => {
      const field = fields.find((item) => item.id === id);
      if (field) field.sortOrder = (index + 1) * 10;
    });
    return { ok: true as const };
  }

  await ensureCustomTripFormTables();
  await sql.begin(async (tx) => {
    for (let index = 0; index < orderedIds.length; index++) {
      await tx`
        UPDATE custom_trip_form_fields
        SET sort_order = ${(index + 1) * 10}, updated_at = NOW()
        WHERE id = ${orderedIds[index]}
      `;
    }
  });
  return { ok: true as const };
}

async function seedCustomTripFormIfEmpty() {
  const existing = await sql<{ count: string }>`
    SELECT COUNT(*)::text AS count FROM custom_trip_form_fields
  `;
  if (Number(existing.rows[0]?.count ?? 0) > 0) return;

  for (const seed of SEED_FIELDS) {
    const inserted = await sql<{ id: string }>`
      INSERT INTO custom_trip_form_fields (
        field_key, label, description, control_type, required, default_value,
        form_group, sort_order, enabled, key_locked, use_on_route_private
      ) VALUES (
        ${seed.fieldKey}, ${seed.label}, ${seed.description}, ${seed.controlType}, ${seed.required},
        ${JSON.stringify(seed.defaultValue)}::jsonb, ${seed.formGroup}, ${seed.sortOrder}, true, ${seed.keyLocked},
        ${seed.useOnRoutePrivate}
      )
      ON CONFLICT (field_key) DO NOTHING
      RETURNING id
    `;

    const fieldId = inserted.rows[0]?.id;
    if (!fieldId) continue;

    for (const option of seed.options) {
      await sql`
        INSERT INTO custom_trip_form_options (
          field_id, option_key, label, sort_order, enabled
        ) VALUES (
          ${fieldId}, ${option.optionKey}, ${option.label}, ${option.sortOrder}, true
        )
        ON CONFLICT (field_id, option_key) DO NOTHING
      `;
    }
  }
}

async function syncOptions(
  // Transaction client from postgres.js begin(); typed loosely to match project inserts.
  tx: {
    <T>(strings: TemplateStringsArray, ...values: unknown[]): Promise<{ rows: T[] }>;
  },
  fieldId: string,
  options: Array<{ id?: string; optionKey: string; label: string; sortOrder: number; enabled: boolean }>,
) {
  const existing = await tx<{ id: string; option_key: string }>`
    SELECT id, option_key FROM custom_trip_form_options WHERE field_id = ${fieldId}
  `;
  const keepIds = new Set(options.map((option) => option.id).filter(Boolean) as string[]);

  for (const row of existing.rows) {
    if (!keepIds.has(row.id) && !options.some((option) => option.optionKey === row.option_key)) {
      await tx`DELETE FROM custom_trip_form_options WHERE id = ${row.id}`;
    }
  }

  for (const option of options) {
    if (option.id) {
      await tx`
        UPDATE custom_trip_form_options
        SET option_key = ${option.optionKey},
            label = ${option.label},
            sort_order = ${option.sortOrder},
            enabled = ${option.enabled},
            updated_at = NOW()
        WHERE id = ${option.id} AND field_id = ${fieldId}
      `;
      continue;
    }

    await tx`
      INSERT INTO custom_trip_form_options (field_id, option_key, label, sort_order, enabled)
      VALUES (${fieldId}, ${option.optionKey}, ${option.label}, ${option.sortOrder}, ${option.enabled})
      ON CONFLICT (field_id, option_key) DO UPDATE
      SET label = EXCLUDED.label,
          sort_order = EXCLUDED.sort_order,
          enabled = EXCLUDED.enabled,
          updated_at = NOW()
    `;
  }
}

function getMemoryFields(): CustomTripFormField[] {
  if (!memoryFields) {
    memoryFields = SEED_FIELDS.map((seed, index) => ({
      id: `memory-field-${index + 1}`,
      fieldKey: seed.fieldKey,
      label: seed.label,
      description: seed.description,
      controlType: seed.controlType,
      required: seed.required,
      defaultValue: cloneDefault(seed.defaultValue, seed.controlType),
      formGroup: seed.formGroup,
      sortOrder: seed.sortOrder,
      enabled: true,
      keyLocked: seed.keyLocked,
      useOnRoutePrivate: seed.useOnRoutePrivate,
      options: seed.options.map((option, optionIndex) => ({
        id: `memory-option-${index + 1}-${optionIndex + 1}`,
        optionKey: option.optionKey,
        label: option.label,
        sortOrder: option.sortOrder,
        enabled: true,
      })),
    }));
  }
  return memoryFields;
}

function upsertMemoryField(input: Parameters<typeof upsertCustomTripField>[0]) {
  const fields = getMemoryFields();
  const options = (input.options || []).map((option, index) => ({
    id: option.id || `memory-option-new-${Date.now()}-${index}`,
    optionKey: option.optionKey.trim(),
    label: option.label.trim(),
    sortOrder: option.sortOrder,
    enabled: option.enabled,
  }));
  const defaultCheck = validateDefaultAgainstOptions(input.controlType, input.defaultValue, options.filter((o) => o.enabled));
  if (defaultCheck.error) return { error: defaultCheck.error };

  if (input.id) {
    const field = fields.find((item) => item.id === input.id);
    if (!field) return { error: 'Field not found.' };
    if (field.keyLocked && field.fieldKey !== input.fieldKey.trim().toLowerCase()) {
      return { error: 'This field key is locked and cannot be renamed.' };
    }
    Object.assign(field, {
      fieldKey: input.fieldKey.trim().toLowerCase(),
      label: input.label.trim(),
      description: (input.description || '').trim(),
      controlType: input.controlType,
      required: input.required,
      defaultValue: defaultCheck.value,
      formGroup: input.formGroup,
      sortOrder: input.sortOrder,
      enabled: input.enabled,
      useOnRoutePrivate: Boolean(input.useOnRoutePrivate),
      options,
    });
    return { field };
  }

  const created: CustomTripFormField = {
    id: `memory-field-${Date.now()}`,
    fieldKey: input.fieldKey.trim().toLowerCase(),
    label: input.label.trim(),
    description: (input.description || '').trim(),
    controlType: input.controlType,
    required: input.required,
    defaultValue: defaultCheck.value,
    formGroup: input.formGroup,
    sortOrder: input.sortOrder,
    enabled: input.enabled,
    keyLocked: false,
    useOnRoutePrivate: Boolean(input.useOnRoutePrivate),
    options,
  };
  fields.push(created);
  return { field: created };
}

function validateFieldValue(field: CustomTripFormField, value: unknown): { error?: string; value?: unknown } {
  const enabledOptions = field.options.filter((option) => option.enabled).map((option) => option.optionKey);

  if (field.controlType === 'multi_select') {
    const list = Array.isArray(value) ? value.map(String) : [];
    if (field.required && list.length === 0) {
      return { error: `Please choose at least one option for ${field.label}.` };
    }
    if (list.some((item) => !enabledOptions.includes(item))) {
      return { error: `Invalid option submitted for ${field.label}.` };
    }
    return { value: list };
  }

  if (field.controlType === 'single_select' || field.controlType === 'select') {
    const selected = typeof value === 'string' ? value.trim() : '';
    if (field.required && !selected) {
      return { error: `Please choose ${field.label}.` };
    }
    if (selected && !enabledOptions.includes(selected)) {
      return { error: `Invalid option submitted for ${field.label}.` };
    }
    return { value: selected };
  }

  const text = typeof value === 'string' ? value.trim() : '';
  const max = field.controlType === 'textarea' ? MAX_TEXTAREA_LENGTH : MAX_TEXT_LENGTH;
  if (field.required && !text) {
    return { error: `Please complete ${field.label}.` };
  }
  if (text.length > max) {
    return { error: `${field.label} is too long.` };
  }
  return { value: text };
}

function validateDefaultAgainstOptions(
  controlType: FormControlType,
  defaultValue: unknown,
  enabledOptions: Array<{ optionKey: string }>,
) {
  const keys = enabledOptions.map((option) => option.optionKey);

  if (controlType === 'multi_select') {
    const list = Array.isArray(defaultValue) ? defaultValue.map(String) : [];
    if (list.some((item) => !keys.includes(item))) {
      return { error: 'Default multi-select values must use enabled options.' };
    }
    return { value: list };
  }

  if (controlType === 'single_select' || controlType === 'select') {
    const selected = typeof defaultValue === 'string' ? defaultValue : '';
    if (selected && !keys.includes(selected)) {
      return { error: 'Default choice must use an enabled option.' };
    }
    return { value: selected };
  }

  const text = typeof defaultValue === 'string' ? defaultValue : '';
  const max = controlType === 'textarea' ? MAX_TEXTAREA_LENGTH : MAX_TEXT_LENGTH;
  if (text.length > max) return { error: 'Default text is too long.' };
  return { value: text };
}

function cloneDefault(value: unknown, controlType: FormControlType) {
  if (controlType === 'multi_select') {
    return Array.isArray(value) ? [...value.map(String)] : [];
  }
  if (controlType === 'single_select' || controlType === 'select') {
    return typeof value === 'string' ? value : '';
  }
  return typeof value === 'string' ? value : '';
}

function labelForOption(field: CustomTripFormField | undefined, optionKey: string) {
  return field?.options.find((option) => option.optionKey === optionKey)?.label || '';
}

function formatPreferenceValue(field: CustomTripFormField | undefined, value: unknown) {
  if (!field) return Array.isArray(value) ? value.join(', ') : String(value ?? '');
  if (field.controlType === 'multi_select') {
    const list = Array.isArray(value) ? value.map(String) : [];
    if (!list.length) return 'Not provided';
    return list.map((key) => labelForOption(field, key) || key).join(', ');
  }
  if (field.controlType === 'single_select' || field.controlType === 'select') {
    if (!value) return 'Not provided';
    return labelForOption(field, String(value)) || String(value);
  }
  return String(value || 'Not provided');
}

function isControlType(value: string): value is FormControlType {
  return ['single_select', 'multi_select', 'select', 'text', 'textarea'].includes(value);
}

function isFormGroup(value: string): value is FormGroup {
  return value === 'basic' || value === 'more';
}
