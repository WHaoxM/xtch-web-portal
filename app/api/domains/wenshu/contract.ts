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
  if (!/^\+?[\d ()-]{6,40}$/.test(phone)) throw new Error('Invalid phone.');
  return { phone, name: field('name', 100), company: field('company', 200),
    companyAddress: field('company_address', 500, true), businessType: field('business_type', 100),
    pageUrl: field('page_url', 2048), entry: field('source', 100) };
}
export function validSessionToken(token: string): boolean {
  return /^ws_[a-f0-9]{64}$/.test(token);
}
export function validId(id: string): boolean {
  return /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id);
}
