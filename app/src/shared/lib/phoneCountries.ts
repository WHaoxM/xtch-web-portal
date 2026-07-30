export type PhoneCountry = {
  code: string;
  name: string;
  dial: string;
  flagSrc: string;
};

/** Common source markets for Syncing Travel; no phone-lib dependency. */
export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: 'US', name: 'United States', dial: '1', flagSrc: 'https://flagcdn.com/24x18/us.png' },
  { code: 'CA', name: 'Canada', dial: '1', flagSrc: 'https://flagcdn.com/24x18/ca.png' },
  { code: 'GB', name: 'United Kingdom', dial: '44', flagSrc: 'https://flagcdn.com/24x18/gb.png' },
  { code: 'AU', name: 'Australia', dial: '61', flagSrc: 'https://flagcdn.com/24x18/au.png' },
  { code: 'NZ', name: 'New Zealand', dial: '64', flagSrc: 'https://flagcdn.com/24x18/nz.png' },
  { code: 'DE', name: 'Germany', dial: '49', flagSrc: 'https://flagcdn.com/24x18/de.png' },
  { code: 'FR', name: 'France', dial: '33', flagSrc: 'https://flagcdn.com/24x18/fr.png' },
  { code: 'NL', name: 'Netherlands', dial: '31', flagSrc: 'https://flagcdn.com/24x18/nl.png' },
  { code: 'SG', name: 'Singapore', dial: '65', flagSrc: 'https://flagcdn.com/24x18/sg.png' },
  { code: 'HK', name: 'Hong Kong', dial: '852', flagSrc: 'https://flagcdn.com/24x18/hk.png' },
  { code: 'JP', name: 'Japan', dial: '81', flagSrc: 'https://flagcdn.com/24x18/jp.png' },
  { code: 'KR', name: 'South Korea', dial: '82', flagSrc: 'https://flagcdn.com/24x18/kr.png' },
  { code: 'CN', name: 'China', dial: '86', flagSrc: 'https://flagcdn.com/24x18/cn.png' },
  { code: 'TW', name: 'Taiwan', dial: '886', flagSrc: 'https://flagcdn.com/24x18/tw.png' },
  { code: 'MY', name: 'Malaysia', dial: '60', flagSrc: 'https://flagcdn.com/24x18/my.png' },
  { code: 'TH', name: 'Thailand', dial: '66', flagSrc: 'https://flagcdn.com/24x18/th.png' },
  { code: 'IN', name: 'India', dial: '91', flagSrc: 'https://flagcdn.com/24x18/in.png' },
  { code: 'AE', name: 'United Arab Emirates', dial: '971', flagSrc: 'https://flagcdn.com/24x18/ae.png' },
  { code: 'CH', name: 'Switzerland', dial: '41', flagSrc: 'https://flagcdn.com/24x18/ch.png' },
  { code: 'SE', name: 'Sweden', dial: '46', flagSrc: 'https://flagcdn.com/24x18/se.png' },
].sort((a, b) => a.name.localeCompare(b.name));

export const DEFAULT_PHONE_COUNTRY_CODE = 'US';

export function getPhoneCountry(code: string): PhoneCountry {
  return PHONE_COUNTRIES.find((country) => country.code === code) ?? PHONE_COUNTRIES.find((c) => c.code === DEFAULT_PHONE_COUNTRY_CODE)!;
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Build E.164-ish international number. Empty national input returns ''.
 * Light validation only — not a full carrier-grade parse.
 */
export function buildInternationalPhone(countryCode: string, nationalNumber: string): string {
  const country = getPhoneCountry(countryCode);
  const national = digitsOnly(nationalNumber);
  if (!national) return '';
  return `+${country.dial}${national.replace(/^0+/, '')}`;
}

export function isPlausibleInternationalPhone(value: string): boolean {
  if (!value) return true;
  return /^\+[1-9]\d{6,14}$/.test(value);
}

export function validateOptionalPhoneInput(
  countryCode: string,
  nationalNumber: string,
): string {
  const trimmed = nationalNumber.trim();
  if (!trimmed) return '';

  const national = digitsOnly(trimmed);
  if (national.length < 6 || national.length > 15) {
    return 'Enter a valid phone number, or leave it blank.';
  }

  const international = buildInternationalPhone(countryCode, trimmed);
  if (!isPlausibleInternationalPhone(international)) {
    return 'Enter a valid phone number, or leave it blank.';
  }

  if (international.length > 50) {
    return 'Please enter a shorter phone number.';
  }

  return '';
}
