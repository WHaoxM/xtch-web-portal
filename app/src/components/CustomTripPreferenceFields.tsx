import { Input } from '@/components/ui/input';
import {
  showsDefaultBadge,
  type CustomPreferences,
  type CustomTripFormField,
  type CustomTripFormOption,
} from '@/lib/customTripFormClient';
import { cn } from '@/lib/utils';
import { fieldErrorId } from '@/lib/formErrors';

function enabledOptions(field: CustomTripFormField): CustomTripFormOption[] {
  return field.options
    .filter((option) => option.enabled)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}

function DefaultBadge() {
  return (
    <span className="rounded bg-[#eef1f4] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#88929C]">
      Default
    </span>
  );
}

export function PreferenceFieldControl({
  field,
  value,
  error,
  variant,
  onChange,
}: {
  field: CustomTripFormField;
  value: unknown;
  error?: string;
  variant: 'desktop' | 'mobile';
  onChange: (next: unknown) => void;
}) {
  const options = enabledOptions(field);
  const invalid = Boolean(error);
  const describedBy = invalid ? fieldErrorId(field.fieldKey) : undefined;

  if (variant === 'mobile') {
    return (
      <div
        className={cn('iosapp-pref-field', invalid && 'is-invalid')}
        data-field-error={field.fieldKey}
        aria-invalid={invalid}
        aria-describedby={describedBy}
      >
        <div className="iosapp-pref-label-row">
          <span>
            {field.label}
            {field.required ? ' *' : ''}
          </span>
          {showsDefaultBadge(field, value) && <DefaultBadge />}
        </div>
        {field.description && <p className="iosapp-pref-hint">{field.description}</p>}
        <MobileControl
          field={field}
          value={value}
          options={options}
          invalid={invalid}
          describedBy={describedBy}
          onChange={onChange}
        />
        {error && (
          <p id={fieldErrorId(field.fieldKey)} className="iosapp-field-error" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn('space-y-3', invalid && 'rounded-[6px] border border-red-400 bg-red-50/40 p-4')}
      data-field-error={field.fieldKey}
      aria-invalid={invalid}
      aria-describedby={describedBy}
    >
      <div className="flex flex-wrap items-center gap-2">
        <legend className={cn('text-[17px] font-bold text-[#122332]', invalid && 'text-red-700')}>
          {field.label}
          {field.required ? ' *' : ''}
        </legend>
        {showsDefaultBadge(field, value) && <DefaultBadge />}
      </div>
      {field.description && (
        <p className="text-[14px] leading-6 text-[#6c747b]">{field.description}</p>
      )}
      <DesktopControl
        field={field}
        value={value}
        options={options}
        invalid={invalid}
        describedBy={describedBy}
        onChange={onChange}
      />
      {error && (
        <p id={fieldErrorId(field.fieldKey)} className="text-[14px] text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function DesktopControl({
  field,
  value,
  options,
  invalid,
  describedBy,
  onChange,
}: {
  field: CustomTripFormField;
  value: unknown;
  options: CustomTripFormOption[];
  invalid: boolean;
  describedBy?: string;
  onChange: (next: unknown) => void;
}) {
  if (field.controlType === 'single_select') {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {options.map((option) => {
          const selected = String(value ?? '') === option.optionKey;
          return (
            <label
              key={option.id || option.optionKey}
              className={cn(
                'flex min-h-[54px] cursor-pointer items-center gap-4 rounded-[6px] border px-4 text-[16px] font-semibold',
                selected
                  ? 'border-[#294f5b] bg-[#eef5f7] text-[#122332]'
                  : 'border-[#dce5ee] bg-[#f8fafc] text-[#394a5a]',
              )}
            >
              <input
                type="radio"
                name={field.fieldKey}
                value={option.optionKey}
                checked={selected}
                onChange={() => onChange(option.optionKey)}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                className="h-[18px] w-[18px] accent-[#294f5b]"
              />
              <span className="flex items-center gap-2">
                {option.label}
                {selected && showsDefaultBadge(field, value) ? <DefaultBadge /> : null}
              </span>
            </label>
          );
        })}
      </div>
    );
  }

  if (field.controlType === 'multi_select') {
    const selected = Array.isArray(value) ? value.map(String) : [];
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {options.map((option) => {
          const checked = selected.includes(option.optionKey);
          return (
            <label
              key={option.id || option.optionKey}
              className={cn(
                'flex min-h-[54px] cursor-pointer items-center gap-4 rounded-[6px] border px-4 text-[16px] font-semibold',
                checked
                  ? 'border-[#294f5b] bg-[#eef5f7] text-[#122332]'
                  : 'border-[#dce5ee] bg-[#f8fafc] text-[#394a5a]',
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                onChange={() => {
                  onChange(
                    checked
                      ? selected.filter((item) => item !== option.optionKey)
                      : [...selected, option.optionKey],
                  );
                }}
                className="h-[18px] w-[18px] accent-[#294f5b]"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    );
  }

  if (field.controlType === 'select') {
    return (
      <select
        value={String(value ?? '')}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          'min-h-[58px] w-full rounded-[6px] border border-[#dce5ee] bg-[#f8fafc] px-5 text-[16px] text-[#394a5a] outline-none focus:border-[#294f5b]',
          invalid && 'border-red-500',
        )}
      >
        <option value="" disabled>
          --- Select ---
        </option>
        {options.map((option) => (
          <option key={option.id || option.optionKey} value={option.optionKey}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.controlType === 'textarea') {
    return (
      <textarea
        rows={5}
        value={String(value ?? '')}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          'w-full resize-none rounded-[6px] border border-[#dce5ee] bg-[#f8fafc] px-5 py-4 text-[16px] text-[#122332] outline-none focus:border-[#294f5b]',
          invalid && 'border-red-500',
        )}
      />
    );
  }

  return (
    <input
      type="text"
      value={String(value ?? '')}
      aria-invalid={invalid}
      aria-describedby={describedBy}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        'min-h-[58px] w-full rounded-[6px] border border-[#dce5ee] bg-[#f8fafc] px-5 text-[16px] text-[#122332] outline-none focus:border-[#294f5b]',
        invalid && 'border-red-500',
      )}
    />
  );
}

function MobileControl({
  field,
  value,
  options,
  invalid,
  describedBy,
  onChange,
}: {
  field: CustomTripFormField;
  value: unknown;
  options: CustomTripFormOption[];
  invalid: boolean;
  describedBy?: string;
  onChange: (next: unknown) => void;
}) {
  if (field.controlType === 'single_select' || field.controlType === 'multi_select') {
    const selected = Array.isArray(value) ? value.map(String) : [];
    const current = String(value ?? '');
    return (
      <div className={cn('iosapp-choice-grid', field.controlType === 'single_select' && 'is-two')}>
        {options.map((option) => {
          const isSelected =
            field.controlType === 'multi_select'
              ? selected.includes(option.optionKey)
              : current === option.optionKey;
          return (
            <label
              key={option.id || option.optionKey}
              className={cn('iosapp-choice-chip', isSelected && 'is-selected')}
            >
              <input
                type={field.controlType === 'multi_select' ? 'checkbox' : 'radio'}
                name={field.fieldKey}
                checked={isSelected}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                onChange={() => {
                  if (field.controlType === 'multi_select') {
                    onChange(
                      isSelected
                        ? selected.filter((item) => item !== option.optionKey)
                        : [...selected, option.optionKey],
                    );
                  } else {
                    onChange(option.optionKey);
                  }
                }}
              />
              <b>{option.label}</b>
            </label>
          );
        })}
      </div>
    );
  }

  if (field.controlType === 'select') {
    return (
      <label className={cn('iosapp-select-row', invalid && 'is-invalid')}>
        <span>Choice</span>
        <select
          value={String(value ?? '')}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Select</option>
          {options.map((option) => (
            <option key={option.id || option.optionKey} value={option.optionKey}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.controlType === 'textarea') {
    return (
      <label className={cn('iosapp-input-row iosapp-textarea-row', invalid && 'is-invalid')}>
        <span>Details</span>
        <textarea
          value={String(value ?? '')}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    );
  }

  return (
    <label className={cn('iosapp-input-row', invalid && 'is-invalid')}>
      <span>Details</span>
      <Input
        value={String(value ?? '')}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function CustomTripPreferenceSections({
  basicFields,
  moreFields,
  values,
  errors,
  moreOpen,
  onMoreOpenChange,
  variant,
  onChange,
}: {
  basicFields: CustomTripFormField[];
  moreFields: CustomTripFormField[];
  values: CustomPreferences;
  errors: Record<string, string>;
  moreOpen: boolean;
  onMoreOpenChange: (open: boolean) => void;
  variant: 'desktop' | 'mobile';
  onChange: (fieldKey: string, value: unknown) => void;
}) {
  return (
    <div className={variant === 'mobile' ? 'iosapp-pref-sections' : 'space-y-7'}>
      {basicFields.map((field) => (
        <PreferenceFieldControl
          key={field.id || field.fieldKey}
          field={field}
          value={values[field.fieldKey]}
          error={errors[field.fieldKey]}
          variant={variant}
          onChange={(next) => onChange(field.fieldKey, next)}
        />
      ))}

      {moreFields.length > 0 && (
        <div className={variant === 'mobile' ? 'iosapp-more-prefs' : 'space-y-4'}>
          <button
            type="button"
            className={
              variant === 'mobile'
                ? 'iosapp-more-prefs-toggle'
                : 'inline-flex min-h-[48px] w-full items-center justify-between rounded-[6px] border border-[#dce5ee] bg-[#f8fafc] px-5 text-left text-[16px] font-bold text-[#122332]'
            }
            aria-expanded={moreOpen}
            onClick={() => onMoreOpenChange(!moreOpen)}
          >
            <span>More preferences</span>
            <span aria-hidden="true">{moreOpen ? '−' : '+'}</span>
          </button>
          {moreOpen && (
            <div className={variant === 'mobile' ? 'iosapp-more-prefs-panel' : 'space-y-7'}>
              {moreFields.map((field) => (
                <PreferenceFieldControl
                  key={field.id || field.fieldKey}
                  field={field}
                  value={values[field.fieldKey]}
                  error={errors[field.fieldKey]}
                  variant={variant}
                  onChange={(next) => onChange(field.fieldKey, next)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
