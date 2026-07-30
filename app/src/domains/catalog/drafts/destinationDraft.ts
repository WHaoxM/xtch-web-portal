import { containsCjk } from '@/lib/routeDraft';
import type { ContentStatus, Destination } from '@/lib/destinationsClient';
import { SLUG_PATTERN, slugifyOrFallback } from '@/lib/slugify';

export type DestinationEditDraft = {
  slug: string;
  name: string;
  description: string;
  image: string;
  displayOrder: string;
  status: ContentStatus;
  travelStyles: string[];
  featuredOnHome: boolean;
  featuredPriority: string;
};

export type DestinationGuestCopyFlags = {
  name: boolean;
  description: boolean;
};

export type DestinationFieldErrors = {
  name?: string;
  description?: string;
  image?: string;
  slug?: string;
};

export function emptyDestinationDraft(): DestinationEditDraft {
  return {
    slug: '',
    name: '',
    description: '',
    image: '',
    displayOrder: '0',
    status: 'draft',
    travelStyles: [],
    featuredOnHome: false,
    featuredPriority: '0',
  };
}

export function destinationToDraft(destination: Destination): DestinationEditDraft {
  return {
    slug: destination.slug,
    name: destination.name,
    description: destination.description,
    image: destination.image,
    displayOrder: String(destination.displayOrder),
    status: destination.status,
    travelStyles: [...destination.travelStyles],
    featuredOnHome: destination.featuredOnHome,
    featuredPriority: String(destination.featuredPriority ?? 0),
  };
}

export function detectDestinationGuestCopyCjk(draft: DestinationEditDraft): DestinationGuestCopyFlags {
  return {
    name: containsCjk(draft.name),
    description: containsCjk(draft.description),
  };
}

export function hasDestinationGuestCopyCjk(draft: DestinationEditDraft): boolean {
  const flags = detectDestinationGuestCopyCjk(draft);
  return flags.name || flags.description;
}

export function validateDestinationQuickFields(
  draft: DestinationEditDraft,
  options: { forPublish: boolean; isCreate: boolean },
): DestinationFieldErrors {
  const errors: DestinationFieldErrors = {};
  if (!draft.name.trim()) errors.name = '请填写名称。';
  if (options.forPublish) {
    if (!draft.description.trim()) errors.description = '请填写简介。';
    if (!draft.image.trim()) errors.image = '请选择主图。';
  }
  if (options.isCreate) {
    const slug = draft.slug.trim() || slugifyOrFallback(draft.name, new Date(), 'dest');
    if (!SLUG_PATTERN.test(slug)) {
      errors.slug = '标识（slug）格式无效。';
    }
  }
  return errors;
}

export type DestinationSavePayload = {
  action: 'create' | 'update';
  slug: string;
  name: string;
  description: string;
  image: string;
  displayOrder: number;
  status: ContentStatus;
  travelStyles: string[];
  featuredOnHome: boolean;
  featuredPriority: number;
};

export function buildDestinationSavePayload(
  draft: DestinationEditDraft,
  options: { isCreate: boolean; status: ContentStatus },
): DestinationSavePayload {
  const slug = options.isCreate
    ? draft.slug.trim() || slugifyOrFallback(draft.name, new Date(), 'dest')
    : draft.slug.trim();

  return {
    action: options.isCreate ? 'create' : 'update',
    slug,
    name: draft.name.trim(),
    description: draft.description.trim(),
    image: draft.image.trim(),
    displayOrder: Number(draft.displayOrder) || 0,
    status: options.status,
    travelStyles: draft.travelStyles,
    featuredOnHome: draft.featuredOnHome,
    featuredPriority: Number(draft.featuredPriority) || 0,
  };
}
