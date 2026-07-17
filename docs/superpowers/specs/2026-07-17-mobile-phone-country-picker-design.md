# Mobile phone country picker (Mini-App)

Date: 2026-07-17  
Status: draft for user review  
Related: `PhoneCountryField` in `ChinaTripsMobile.tsx`, `PHONE_COUNTRIES` in `phoneCountries.ts`, existing `iosapp-sheet-*`

## Problem

The Mini-App WhatsApp / phone field uses a native `<select>` for ~20 source markets. When open, the OS list sits on white form cards with no sheet chrome (no clear surface, heavy highlight). The closed state also shows long labels like `Australia (+61)`, which crowds the row.

## Goal

Replace the native country `<select>` with a compact trigger + bottom sheet picker that matches Mini-App form language. Keep phone validation and E.164 assembly unchanged.

## Non-goals

- Search / filter in the picker
- Expanding to a full world dial list or adding `libphonenumber`
- Changing required/optional phone rules or WhatsApp copy
- Desktop marketing-site forms outside `ChinaTripsMobile`
- Changing default country (`US`) or the `PHONE_COUNTRIES` set (order stays name A–Z)

## Approach

**Compact trigger + bottom sheet** (chosen over native-select polish and over a searchable sheet).

### Closed state (inline)

```
WhatsApp / phone
[ flag  +dial  ▾ ] [ Local number ............ ]
```

- Trigger shows flag + `+{dial}` + chevron only (no country name in the visible label).
- Short fixed-ish left column; national number input fills remaining width.
- Min touch height 44px.
- Accessible name includes country name for screen readers, e.g. `Phone country or region, +1 United States`.
- Invalid state continues to apply to the whole phone field block (existing `is-invalid` treatment).

### Open state (sheet)

Reuse the existing `iosapp-sheet-root` / backdrop / panel / header / body pattern (same family as departure details).

- Title: `Country / region`
- Close control + backdrop dismiss
- Scrollable list rows: flag · country name · `+dial`
- Selected row shows a clear selected affordance (check or highlight)
- On choose: set `countryCode`, close sheet, move focus to the national number input
- List data: existing `PHONE_COUNTRIES` (already sorted by name)

### Data / API surface

No change to:

- `onCountryChange(code)` / `onNationalChange(value)`
- `buildInternationalPhone` / `validateOptionalPhoneInput`
- Draft fields `phoneCountry`, `phoneNational`, `phone`

Internal UI state only: `pickerOpen: boolean` inside `PhoneCountryField` (or a tiny child).

## Call sites

One component (`PhoneCountryField`) used in:

- Small-group checkout / group request contact
- Custom trip contact

Both inherit the new UI automatically.

## Success criteria

1. Closed state never shows long `Name (+dial)` strings in the trigger.
2. Open state is not a native OS `<select>` menu.
3. Usable at 320 / 375 / 390 widths (one row: trigger + number).
4. Selecting a country still produces the same international phone string as today for the same inputs.
5. Escape / backdrop / Close all dismiss the sheet without changing the country.

## Verification

- Visual: open/close sheet on Home → Custom and on Small Group contact steps.
- Functional: pick China (`+86`), enter national digits, confirm draft `phone` is `+86…`.
- A11y smoke: trigger announces country; list items are buttons or option-like controls with names.
- `npm run build` and `npm run lint` in `app/`.

## Out of scope follow-ups (optional later)

- Search when the country list grows
- Detect default country from locale / IP (product decision)
