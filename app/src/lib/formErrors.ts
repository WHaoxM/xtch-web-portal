export type FieldErrors = Record<string, string>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string | undefined | null): boolean {
  return Boolean(value && EMAIL_PATTERN.test(value.trim()));
}

export function fieldErrorId(field: string): string {
  return `${field}-error`;
}

export function firstErrorKey(fieldOrder: string[], errors: FieldErrors): string | undefined {
  return fieldOrder.find((key) => Boolean(errors[key]));
}

/**
 * Scroll the first invalid field into view and focus it when possible.
 * For non-focusable anchors (e.g. Turnstile), only scroll — do not fake focus.
 */
export function focusFirstFieldError(
  fieldOrder: string[],
  errors: FieldErrors,
  root?: ParentNode | null,
): void {
  const key = firstErrorKey(fieldOrder, errors);
  if (!key) return;

  const scope = root ?? document;
  const anchor = scope.querySelector<HTMLElement>(`[data-field-error="${key}"]`);
  if (!anchor) return;

  anchor.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const focusTarget = resolveFocusTarget(anchor);
  if (focusTarget) {
    focusTarget.focus({ preventScroll: true });
  }
}

function resolveFocusTarget(anchor: HTMLElement): HTMLElement | null {
  if (isFocusable(anchor)) return anchor;

  const nested = anchor.querySelector<HTMLElement>(
    'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
  );

  return nested && isFocusable(nested) ? nested : null;
}

function isFocusable(element: HTMLElement): boolean {
  if (element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true') {
    return false;
  }

  const tag = element.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'BUTTON') {
    return true;
  }

  const tabIndex = element.getAttribute('tabindex');
  return tabIndex !== null && tabIndex !== '-1';
}
