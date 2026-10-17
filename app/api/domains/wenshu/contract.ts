import { resolveLeadIntent } from './intent';

export const WENSHU_ORIGIN = 'https://wenshuzhilv.kaifa2-xtch2026.chatgpt.site';
export function allowedOrigin(origin: string | undefined): boolean {
  const allowed = (process.env.WENSHU_ALLOWED_ORIGINS || WENSHU_ORIGIN).split(',').map(s => s.trim());
  return Boolean(origin && allowed.includes(origin));
}
export function readLead(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid form.');
  const raw = value as Record<string, unknown>;
  function field(key: string, max: number, required = false) {
    const value = raw[key];
    if (value !== undefined && typeof value !== 'string') throw new Error(`Invalid ${key}.`);
    const text = typeof value === 'string' ? value.trim() : '';
    if (text.length > max || (required && !text)) throw new Error(`Invalid ${key}.`);
    return text;
  }
  const phone = field('phone', 40, true);
  if (!/^\+?[\d ()-]{6,40}$/.test(phone) || phone.replace(/\D/g, '').length < 6) throw new Error('Invalid phone.');
  const email = field('email', 320);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid email.');
  const entry = field('source', 100);
  const explicitIntent = field('intent', 40);
  const intent = resolveLeadIntent(explicitIntent, entry);
  const businessType = field('business_type', 100);
  if (explicitIntent && (!email || !businessType)) {
    throw new Error('Email and business type are required for follow-up.');
  }
  return { phone, name: field('name', 100), company: field('company', 200),
    companyAddress: field('company_address', 500, true), businessType,
    pageUrl: field('page_url', 2048), entry, intent,
    customerConfirmationEnabled: Boolean(explicitIntent),
    message: field('message', 8000), email };
}
export function validSessionToken(token: string): boolean {
  return /^ws_[a-f0-9]{64}$/.test(token);
}
export function validId(id: string): boolean {
  return /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id);
}
