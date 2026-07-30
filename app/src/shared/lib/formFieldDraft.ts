import { containsCjk } from '@/lib/routeDraft';
import type {
  CustomTripFormField,
  CustomTripFormOption,
  FormControlType,
  FormGroup,
} from '@/lib/customTripFormClient';

/** Matches `upsertCustomTripField` key rules: snake_case, starts with letter. */
export const FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;

export type FieldEditDraft = {
  id: string;
  fieldKey: string;
  label: string;
  description: string;
  controlType: FormControlType;
  formGroup: FormGroup;
  required: boolean;
  sortOrder: number;
  enabled: boolean;
  keyLocked: boolean;
  useOnRoutePrivate: boolean;
  defaultValueText: string;
  optionsText: string;
};

export function emptyFieldDraft(sortOrder = 100): FieldEditDraft {
  return {
    id: '',
    fieldKey: '',
    label: '',
    description: '',
    controlType: 'single_select',
    formGroup: 'more',
    required: false,
    sortOrder,
    enabled: true,
    keyLocked: false,
    useOnRoutePrivate: false,
    defaultValueText: '',
    optionsText: '',
  };
}

export function fieldToDraft(field: CustomTripFormField): FieldEditDraft {
  return {
    id: field.id,
    fieldKey: field.fieldKey,
    label: field.label,
    description: field.description,
    controlType: field.controlType,
    formGroup: field.formGroup,
    required: field.required,
    sortOrder: field.sortOrder,
    enabled: field.enabled,
    keyLocked: field.keyLocked,
    useOnRoutePrivate: Boolean(field.useOnRoutePrivate),
    defaultValueText: defaultValueToEditString(field),
    optionsText: optionsToTextarea(field.options),
  };
}

export function optionsToTextarea(options: CustomTripFormOption[]): string {
  return options
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
    .map((option) => `${option.optionKey}|${option.label}|${option.enabled ? 'enabled' : 'disabled'}`)
    .join('\n');
}

export function parseOptionsTextarea(text: string): CustomTripFormOption[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [optionKey = '', label = '', enabledRaw = 'enabled'] = line.split('|').map((part) => part.trim());
      const enabled = enabledRaw.toLowerCase() !== 'disabled' && enabledRaw !== '0' && enabledRaw !== 'false';
      return {
        id: '',
        optionKey,
        label: label || optionKey,
        sortOrder: index,
        enabled,
      };
    });
}

export function defaultValueToEditString(field: CustomTripFormField): string {
  if (field.controlType === 'multi_select') {
    return Array.isArray(field.defaultValue) ? field.defaultValue.map(String).join(', ') : '';
  }
  return field.defaultValue == null ? '' : String(field.defaultValue);
}

export function parseDefaultValueInput(controlType: FormControlType, raw: string): unknown {
  if (controlType === 'multi_select') {
    return raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return raw;
}

/** Label → snake_case fieldKey (not hyphen slug). */
export function fieldKeyFromLabel(label: string): string {
  const raw = label
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!raw) return '';
  if (FIELD_KEY_PATTERN.test(raw)) return raw;
  if (/^[0-9]/.test(raw)) {
    const prefixed = `f_${raw}`.slice(0, 64);
    return FIELD_KEY_PATTERN.test(prefixed) ? prefixed : '';
  }
  return '';
}

export function resolveFieldKey(draft: Pick<FieldEditDraft, 'fieldKey' | 'label'>, now = new Date()): string {
  const existing = draft.fieldKey.trim().toLowerCase();
  if (FIELD_KEY_PATTERN.test(existing)) return existing;
  const fromLabel = fieldKeyFromLabel(draft.label);
  if (fromLabel) return fromLabel;
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const short = Math.random().toString(36).slice(2, 6);
  return `field_${y}${m}${d}_${short}`;
}

export function detectFieldCopyCjk(draft: Pick<FieldEditDraft, 'label' | 'description'>): {
  label: boolean;
  description: boolean;
} {
  return {
    label: containsCjk(draft.label),
    description: containsCjk(draft.description),
  };
}

export function hasFieldCopyCjk(draft: Pick<FieldEditDraft, 'label' | 'description'>): boolean {
  const flags = detectFieldCopyCjk(draft);
  return flags.label || flags.description;
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

/** Convert edit draft into a previewable field (may be disabled / unsaved). */
export function draftToPreviewField(
  draft: FieldEditDraft,
  existing?: CustomTripFormField,
): CustomTripFormField {
  const fieldKey = resolveFieldKey(draft);
  const options = parseOptionsTextarea(draft.optionsText).map((option, index) => {
    const prior = existing?.options.find((item) => item.optionKey === option.optionKey);
    return {
      ...option,
      id: prior?.id || option.id || `preview-opt-${index}`,
    };
  });

  return {
    id: draft.id || `preview-${fieldKey}`,
    fieldKey,
    label: draft.label.trim() || fieldKey || 'Untitled field',
    description: draft.description,
    controlType: draft.controlType,
    required: draft.required,
    defaultValue: parseDefaultValueInput(draft.controlType, draft.defaultValueText),
    formGroup: draft.formGroup,
    sortOrder: draft.sortOrder,
    enabled: draft.enabled,
    keyLocked: draft.keyLocked,
    useOnRoutePrivate: draft.useOnRoutePrivate,
    options,
  };
}

/** Merge current edit draft into saved list for live traveler preview. */
export function mergeDraftIntoFields(
  saved: CustomTripFormField[],
  draft: FieldEditDraft | null,
): CustomTripFormField[] {
  if (!draft) return saved;
  const previewField = draftToPreviewField(
    draft,
    draft.id ? saved.find((field) => field.id === draft.id) : undefined,
  );
  const without = draft.id ? saved.filter((field) => field.id !== draft.id) : saved;
  return [...without, previewField].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label),
  );
}

export function isFieldDraftDirty(
  draft: FieldEditDraft,
  saved: CustomTripFormField | undefined,
): boolean {
  if (!draft.id || !saved) return true;
  const baseline = fieldToDraft(saved);
  return (
    draft.label !== baseline.label ||
    draft.description !== baseline.description ||
    draft.controlType !== baseline.controlType ||
    draft.formGroup !== baseline.formGroup ||
    draft.required !== baseline.required ||
    draft.sortOrder !== baseline.sortOrder ||
    draft.enabled !== baseline.enabled ||
    draft.useOnRoutePrivate !== baseline.useOnRoutePrivate ||
    draft.defaultValueText !== baseline.defaultValueText ||
    draft.optionsText !== baseline.optionsText ||
    draft.fieldKey !== baseline.fieldKey
  );
}

export function previewDefaultsFromFields(fields: CustomTripFormField[]): Record<string, unknown> {
  const preferences: Record<string, unknown> = {};
  for (const field of fields) {
    if (!field.enabled) continue;
    preferences[field.fieldKey] = cloneDefault(field.defaultValue, field.controlType);
  }
  return preferences;
}
