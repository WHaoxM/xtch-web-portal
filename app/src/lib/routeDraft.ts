import { slugifyOrFallback, SLUG_PATTERN } from '@/lib/slugify';
import {
  toRouteTour,
  type ContentStatus,
  type ItineraryDay,
  type RoutePriceMode,
  type RoutePrimaryType,
  type RouteRecord,
  type RouteTour,
} from '@/lib/routesClient';

export type ItineraryDayDraft = {
  title: string;
  city: string;
  summary: string;
  attractionsText: string;
  meals: string;
  accommodation: string;
  transport: string;
  notesText: string;
};

export type RouteEditDraft = {
  slug: string;
  legacyNumericId: string;
  title: string;
  subtitle: string;
  summary: string;
  durationDays: string;
  groupSizeDisplay: string;
  category: string;
  /** When true, category is not auto-derived from themes. */
  categoryManual: boolean;
  themes: string[];
  status: ContentStatus;
  featured: boolean;
  heroImage: string;
  pdfUrl: string;
  priceMode: RoutePriceMode;
  priceDisplay: string;
  primaryType: RoutePrimaryType;
  destinationSlugs: string[];
  experienceText: string;
  momentsText: string;
  includedSupportText: string;
  itineraryDays: ItineraryDayDraft[];
};

export const ROUTE_PRIMARY_TYPES: RoutePrimaryType[] = [
  'private',
  'group-tour',
  'customizable',
  'fixed-departure',
];

export const ROUTE_PRIMARY_TYPE_LABELS: Record<RoutePrimaryType, string> = {
  private: '私人定制',
  'group-tour': '拼团',
  customizable: '可定制',
  'fixed-departure': '固定班期',
};

export const ROUTE_PRICE_MODES: RoutePriceMode[] = [
  'on-request',
  'fixed-from',
  'seasonal-table',
  'per-person-range',
  'unavailable',
];

export const ROUTE_PRICE_MODE_LABELS: Record<RoutePriceMode, string> = {
  'on-request': '询价',
  'fixed-from': '固定起价',
  'seasonal-table': '季节价表',
  'per-person-range': '人均区间',
  unavailable: '暂不可订',
};

export const CONTENT_STATUSES: ContentStatus[] = ['published', 'draft', 'archived'];

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  published: '已发布',
  draft: '草稿',
  archived: '已归档',
};

export const DEFAULT_GROUP_SIZE_BY_TYPE: Record<RoutePrimaryType, string> = {
  private: 'Private journey',
  'group-tour': 'Small group',
  customizable: 'Private / Group tour',
  'fixed-departure': 'Fixed departure',
};

const CJK_RE = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/;

export function containsCjk(value: string): boolean {
  return CJK_RE.test(value);
}

export function emptyItineraryDayDraft(): ItineraryDayDraft {
  return {
    title: '',
    city: '',
    summary: '',
    attractionsText: '',
    meals: '',
    accommodation: '',
    transport: '',
    notesText: '',
  };
}

export function emptyRouteDraft(): RouteEditDraft {
  return {
    slug: '',
    legacyNumericId: '',
    title: '',
    subtitle: '',
    summary: '',
    durationDays: '1',
    groupSizeDisplay: DEFAULT_GROUP_SIZE_BY_TYPE.customizable,
    category: '',
    categoryManual: false,
    themes: [],
    status: 'draft',
    featured: false,
    heroImage: '',
    pdfUrl: '',
    priceMode: 'on-request',
    priceDisplay: 'On request',
    primaryType: 'customizable',
    destinationSlugs: [],
    experienceText: '',
    momentsText: '',
    includedSupportText: '',
    itineraryDays: [],
  };
}

export function routeToDraft(route: RouteRecord): RouteEditDraft {
  return {
    slug: route.slug,
    legacyNumericId: route.legacyNumericId == null ? '' : String(route.legacyNumericId),
    title: route.title,
    subtitle: route.subtitle,
    summary: route.summary,
    durationDays: String(route.durationDays),
    groupSizeDisplay: route.groupSizeDisplay,
    category: route.category,
    categoryManual: true,
    themes: route.themes,
    status: route.status,
    featured: route.featured,
    heroImage: route.heroImage,
    pdfUrl: route.pdfUrl,
    priceMode: route.priceMode,
    priceDisplay: route.priceDisplay,
    primaryType: route.primaryType,
    destinationSlugs: [...route.destinationSlugs],
    experienceText: route.experience.join('\n'),
    momentsText: route.moments.join('\n'),
    includedSupportText: route.includedSupport.join('\n'),
    itineraryDays: route.itineraryDays.map((day) => ({
      title: day.title,
      city: day.city,
      summary: day.summary,
      attractionsText: day.attractions.join('\n'),
      meals: day.meals,
      accommodation: day.accommodation,
      transport: day.transport,
      notesText: day.notes.join('\n'),
    })),
  };
}

function linesToList(value: string): string[] {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function deriveCategoryFromThemes(
  themes: string[],
  categories: { key: string; label: string }[],
): string {
  const first = themes[0];
  if (!first) return '';
  return categories.find((item) => item.key === first)?.label ?? first;
}

export function applyPrimaryTypeDefaults(
  draft: RouteEditDraft,
  primaryType: RoutePrimaryType,
): RouteEditDraft {
  const previousDefault = DEFAULT_GROUP_SIZE_BY_TYPE[draft.primaryType];
  const nextDefault = DEFAULT_GROUP_SIZE_BY_TYPE[primaryType];
  const groupSizeDisplay =
    !draft.groupSizeDisplay.trim() || draft.groupSizeDisplay === previousDefault
      ? nextDefault
      : draft.groupSizeDisplay;
  return { ...draft, primaryType, groupSizeDisplay };
}

export type GuestCopyFields = {
  title: boolean;
  subtitle: boolean;
  summary: boolean;
};

export function detectGuestCopyCjk(draft: RouteEditDraft): GuestCopyFields {
  return {
    title: containsCjk(draft.title),
    subtitle: containsCjk(draft.subtitle),
    summary: containsCjk(draft.summary),
  };
}

export function hasGuestCopyCjk(draft: RouteEditDraft): boolean {
  const flags = detectGuestCopyCjk(draft);
  return flags.title || flags.subtitle || flags.summary;
}

export type QuickFieldErrors = {
  title?: string;
  summary?: string;
  durationDays?: string;
  heroImage?: string;
  priceDisplay?: string;
  destinationSlugs?: string;
  slug?: string;
};

export function validateQuickFields(
  draft: RouteEditDraft,
  options: { forPublish: boolean; isCreate: boolean },
): QuickFieldErrors {
  const errors: QuickFieldErrors = {};
  if (!draft.title.trim()) errors.title = '请填写标题。';
  const durationDays = Number(draft.durationDays);
  if (!Number.isFinite(durationDays) || durationDays <= 0) {
    errors.durationDays = '行程天数须为正数。';
  }
  if (options.forPublish) {
    if (!draft.summary.trim()) errors.summary = '请填写摘要。';
    if (!draft.heroImage.trim()) errors.heroImage = '请选择主图。';
    if (!draft.priceDisplay.trim()) errors.priceDisplay = '请填写价格展示文案。';
    if (draft.destinationSlugs.length === 0) {
      errors.destinationSlugs = '上架前请至少关联一个目的地。';
    }
  }
  if (options.isCreate) {
    const slug = draft.slug.trim() || slugifyOrFallback(draft.title);
    if (!SLUG_PATTERN.test(slug)) {
      errors.slug = '标识（slug）格式无效。';
    }
  }
  return errors;
}

export function draftToItineraryDays(draft: RouteEditDraft): ItineraryDay[] {
  return draft.itineraryDays.map((day, index) => ({
    dayNumber: index + 1,
    title: day.title.trim(),
    city: day.city.trim(),
    summary: day.summary.trim(),
    attractions: linesToList(day.attractionsText),
    meals: day.meals.trim(),
    accommodation: day.accommodation.trim(),
    transport: day.transport.trim(),
    notes: linesToList(day.notesText),
  }));
}

/** Build a RouteRecord-shaped object for preview (not persisted). */
export function draftToRouteRecord(
  draft: RouteEditDraft,
  categories: { key: string; label: string }[] = [],
): RouteRecord {
  const durationDays = Number(draft.durationDays);
  const safeDays = Number.isFinite(durationDays) && durationDays > 0 ? durationDays : 1;
  const category =
    draft.categoryManual && draft.category.trim()
      ? draft.category.trim()
      : deriveCategoryFromThemes(draft.themes, categories) || draft.category.trim();
  const slug = draft.slug.trim() || slugifyOrFallback(draft.title || 'untitled');

  return {
    slug,
    legacyNumericId: draft.legacyNumericId ? Number(draft.legacyNumericId) : null,
    title: draft.title.trim() || 'Untitled route',
    subtitle: draft.subtitle.trim(),
    summary: draft.summary.trim(),
    durationDays: safeDays,
    groupSizeDisplay: draft.groupSizeDisplay.trim() || DEFAULT_GROUP_SIZE_BY_TYPE[draft.primaryType],
    category: category || 'Route',
    themes: draft.themes,
    status: draft.status,
    featured: draft.featured,
    heroImage: draft.heroImage.trim() || '/images/route-beijing-forbidden-01.png',
    pdfUrl: draft.pdfUrl.trim(),
    priceMode: draft.priceMode,
    priceDisplay: draft.priceDisplay.trim() || 'On request',
    primaryType: draft.primaryType,
    availableTypes: [draft.primaryType],
    destinationSlugs: draft.destinationSlugs,
    experience: linesToList(draft.experienceText),
    moments: linesToList(draft.momentsText),
    includedSupport: linesToList(draft.includedSupportText),
    itineraryDays: draftToItineraryDays(draft),
  };
}

export function draftToRouteTour(
  draft: RouteEditDraft,
  categories: { key: string; label: string }[] = [],
): RouteTour {
  const record = draftToRouteRecord(draft, categories);
  const tour = toRouteTour(record);
  // Admin preview: surface experience/moments/included even before day-by-day exists.
  // Public toRouteTour still requires itineraryDays for structuredItinerary.
  if (
    !tour.structuredItinerary &&
    (record.experience.length > 0 ||
      record.moments.length > 0 ||
      record.includedSupport.length > 0)
  ) {
    return {
      ...tour,
      structuredItinerary: {
        experience: record.experience,
        moments: record.moments,
        days: [],
        includedSupport: record.includedSupport,
      },
    };
  }
  return tour;
}

export type RouteSavePayload = {
  action: 'create' | 'update';
  slug: string;
  legacyNumericId: number | null;
  title: string;
  subtitle: string;
  summary: string;
  durationDays: number;
  groupSizeDisplay: string;
  category: string;
  themes: string[];
  status: ContentStatus;
  featured: boolean;
  heroImage: string;
  pdfUrl: string;
  priceMode: RoutePriceMode;
  priceDisplay: string;
  primaryType: RoutePrimaryType;
  availableTypes: RoutePrimaryType[];
  destinationSlugs: string[];
  experience: string[];
  moments: string[];
  includedSupport: string[];
  itineraryDays: ItineraryDay[];
};

export function buildRouteSavePayload(
  draft: RouteEditDraft,
  options: {
    isCreate: boolean;
    status: ContentStatus;
    categories: { key: string; label: string }[];
  },
): RouteSavePayload {
  const record = draftToRouteRecord(draft, options.categories);
  const slug =
    options.isCreate
      ? draft.slug.trim() || slugifyOrFallback(draft.title)
      : draft.slug.trim();

  return {
    action: options.isCreate ? 'create' : 'update',
    slug,
    legacyNumericId: record.legacyNumericId,
    title: draft.title.trim(),
    subtitle: draft.subtitle.trim(),
    summary: draft.summary.trim(),
    durationDays: record.durationDays,
    groupSizeDisplay: record.groupSizeDisplay,
    category: record.category === 'Route' && !draft.category.trim() && draft.themes.length === 0
      ? ''
      : record.category,
    themes: draft.themes,
    status: options.status,
    featured: draft.featured,
    heroImage: draft.heroImage.trim(),
    pdfUrl: draft.pdfUrl.trim(),
    priceMode: draft.priceMode,
    priceDisplay: draft.priceDisplay.trim(),
    primaryType: draft.primaryType,
    availableTypes: [draft.primaryType],
    destinationSlugs: draft.destinationSlugs,
    experience: record.experience,
    moments: record.moments,
    includedSupport: record.includedSupport,
    itineraryDays: record.itineraryDays,
  };
}
