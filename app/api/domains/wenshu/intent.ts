export const WENSHU_LEAD_INTENTS = [
  'growth_plan', 'product_demo', 'custom_consultation', 'resource_request', 'offline_message',
] as const;

export type WenshuLeadIntent = (typeof WENSHU_LEAD_INTENTS)[number];

/** Old site versions sent only `source`; retain a useful classification during rollout. */
export function resolveLeadIntent(value: string, entry: string): WenshuLeadIntent {
  if (value) {
    if ((WENSHU_LEAD_INTENTS as readonly string[]).includes(value)) return value as WenshuLeadIntent;
    throw new Error('Invalid intent.');
  }
  if (entry === 'offline-message') return 'offline_message';
  if (entry === 'nav-custom') return 'custom_consultation';
  if (entry === 'rail-doc') return 'resource_request';
  if (/^(hero-demo|rail-demo|engine|agent|solution-sale|solution-consult|tech-[a-z-]+-banner)$/.test(entry)) {
    return 'product_demo';
  }
  return 'growth_plan';
}

export type WenshuBusinessSegment = 'travel_agency' | 'ground_operator' | 'boutique' | 'scenic' | 'other';

export function resolveBusinessSegment(value: string): WenshuBusinessSegment {
  const normalized = value.trim().toLowerCase();
  if (['国际旅行社', 'international travel agency', '旅行社'].includes(normalized)) return 'travel_agency';
  if (['入境游地接社', 'inbound ground operator', '地接社'].includes(normalized)) return 'ground_operator';
  if (['精品旅游公司', 'boutique travel studio'].includes(normalized)) return 'boutique';
  if (['景区 / 文旅集团', 'scenic spot / culture-tourism group'].includes(normalized)) return 'scenic';
  return 'other';
}
