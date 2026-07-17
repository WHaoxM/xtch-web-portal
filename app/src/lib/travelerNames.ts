export type TravelerNameDraft = {
  name: string;
};

export const MAX_TRAVELER_NAME_LENGTH = 200;

export function createEmptyTravelers(count: number): TravelerNameDraft[] {
  return Array.from({ length: Math.max(0, count) }, () => ({ name: '' }));
}

/** Resize traveler slots when adult quantity changes; keep existing names in order. */
export function resizeTravelers(
  current: TravelerNameDraft[] | undefined,
  nextCount: number,
  leadName = '',
): TravelerNameDraft[] {
  const safeCount = Math.max(1, nextCount);
  const base = Array.isArray(current) ? current.map((item) => ({ name: item?.name ?? '' })) : [];

  if (base.length === 0 && leadName.trim()) {
    base.push({ name: leadName });
  }

  if (base.length === safeCount) return base;
  if (base.length > safeCount) return base.slice(0, safeCount);

  return [...base, ...createEmptyTravelers(safeCount - base.length)];
}

export function syncLeadNameFromTravelers(
  travelers: TravelerNameDraft[],
  fallback = '',
): string {
  return travelers[0]?.name?.trim() ? travelers[0].name : fallback;
}

/** Up to two initials from a display name; empty name returns slot label like "1". */
export function travelerInitials(name: string, slotIndex = 0): string {
  const parts = name
    .trim()
    .split(/[\s\-_/]+/)
    .filter(Boolean);

  if (parts.length === 0) return String(slotIndex + 1);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

export function validateTravelerNames(
  travelers: TravelerNameDraft[],
  adultQuantity: number,
): { index: number; message: string } | null {
  if (travelers.length !== adultQuantity) {
    return { index: 0, message: 'Traveler names must match the number of adults.' };
  }

  for (let index = 0; index < travelers.length; index++) {
    const name = travelers[index]?.name?.trim() ?? '';
    if (!name) {
      return { index, message: `Enter traveler ${index + 1}'s full name.` };
    }
    if (name.length > MAX_TRAVELER_NAME_LENGTH) {
      return { index, message: `Traveler ${index + 1}'s name is too long.` };
    }
  }

  return null;
}
