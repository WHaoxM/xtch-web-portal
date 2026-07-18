import { sql } from './db';
import {
  ensureContentTables,
  type CategoryScope,
  type ContentStatus,
  type ItineraryDayRow,
  type MediaAssetRow,
  type RoutePrimaryType,
  type RoutePriceMode,
} from './contentSchema';

export type Destination = {
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

export type Category = {
  id: string;
  key: string;
  label: string;
  scope: CategoryScope;
  sortOrder: number;
  enabled: boolean;
};

export type ItineraryDay = {
  dayNumber: number;
  title: string;
  city: string;
  summary: string;
  attractions: string[];
  meals: string;
  accommodation: string;
  transport: string;
  notes: string[];
};

export type RouteRecord = {
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

export type MediaAsset = {
  id: string;
  status: MediaAssetRow['status'];
  type: MediaAssetRow['type'];
  publicUrl: string;
  title: string;
  altText: string;
  destinationSlugs: string[];
  routeSlugs: string[];
  tags: string[];
};

const KNOWN_STATUSES: ContentStatus[] = ['published', 'draft', 'archived'];
const KNOWN_CATEGORY_SCOPES: CategoryScope[] = ['destination', 'route'];
const KNOWN_PRICE_MODES: RoutePriceMode[] = [
  'on-request',
  'fixed-from',
  'seasonal-table',
  'per-person-range',
  'unavailable',
];
const KNOWN_ROUTE_TYPES: RoutePrimaryType[] = ['private', 'group-tour', 'customizable', 'fixed-departure'];
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function mapDestinationRow(row: Record<string, unknown>): Destination {
  return {
    slug: String(row.slug),
    name: String(row.name),
    description: String(row.description ?? ''),
    image: String(row.image ?? ''),
    displayOrder: Number(row.display_order ?? 0),
    status: (row.status as ContentStatus) ?? 'published',
    travelStyles: Array.isArray(row.travel_styles) ? (row.travel_styles as string[]) : [],
    featuredOnHome: Boolean(row.featured_on_home),
    featuredPriority: Number(row.featured_priority ?? 0),
  };
}

function mapCategoryRow(row: Record<string, unknown>): Category {
  return {
    id: String(row.id),
    key: String(row.key),
    label: String(row.label),
    scope: (row.scope as CategoryScope) ?? 'destination',
    sortOrder: Number(row.sort_order ?? 0),
    enabled: Boolean(row.enabled),
  };
}

function mapRouteRow(row: Record<string, unknown>, itineraryDays: ItineraryDay[] = []): RouteRecord {
  const themes = Array.isArray(row.themes) ? (row.themes as string[]) : [];
  return {
    slug: String(row.slug),
    legacyNumericId: row.legacy_numeric_id == null ? null : Number(row.legacy_numeric_id),
    title: String(row.title),
    subtitle: String(row.subtitle ?? ''),
    summary: String(row.summary ?? ''),
    durationDays: Number(row.duration_days ?? 0),
    groupSizeDisplay: String(row.group_size_display ?? ''),
    category: String(row.category ?? ''),
    themes,
    status: (row.status as ContentStatus) ?? 'published',
    featured: Boolean(row.featured),
    heroImage: String(row.hero_image ?? ''),
    pdfUrl: String(row.pdf_url ?? ''),
    priceMode: (row.price_mode as RoutePriceMode) ?? 'on-request',
    priceDisplay: String(row.price_display ?? 'On request'),
    primaryType: (row.primary_type as RoutePrimaryType) ?? 'customizable',
    availableTypes: Array.isArray(row.available_types) ? (row.available_types as RoutePrimaryType[]) : [],
    destinationSlugs: Array.isArray(row.destination_slugs) ? (row.destination_slugs as string[]) : [],
    experience: Array.isArray(row.experience) ? (row.experience as string[]) : [],
    moments: Array.isArray(row.moments) ? (row.moments as string[]) : [],
    includedSupport: Array.isArray(row.included_support) ? (row.included_support as string[]) : [],
    itineraryDays,
  };
}

/** Display/storage label must come from themes[0] → categories.label (never orphan free text). */
export function alignRouteCategory(
  themes: string[],
  labelByKey: Map<string, string>,
): string {
  const first = themes[0];
  if (!first) return '';
  return labelByKey.get(first) ?? first;
}

async function loadRouteCategoryLabelMap(): Promise<Map<string, string>> {
  await ensureContentTables();
  const result = await sql`
    SELECT key, label FROM categories
    WHERE scope = 'route'
    ORDER BY enabled DESC, sort_order ASC, label ASC
  `;
  const map = new Map<string, string>();
  for (const row of result.rows as Record<string, unknown>[]) {
    const key = String(row.key ?? '');
    if (!key || map.has(key)) continue;
    map.set(key, String(row.label ?? key));
  }
  return map;
}

function applyAlignedCategories(
  routes: RouteRecord[],
  labelByKey: Map<string, string>,
): RouteRecord[] {
  return routes.map((route) => ({
    ...route,
    category: alignRouteCategory(route.themes, labelByKey),
  }));
}

function mapItineraryDayRow(row: Record<string, unknown>): ItineraryDay {
  return {
    dayNumber: Number(row.day_number ?? 0),
    title: String(row.title ?? ''),
    city: String(row.city ?? ''),
    summary: String(row.summary ?? ''),
    attractions: Array.isArray(row.attractions) ? (row.attractions as string[]) : [],
    meals: String(row.meals ?? ''),
    accommodation: String(row.accommodation ?? ''),
    transport: String(row.transport ?? ''),
    notes: Array.isArray(row.notes) ? (row.notes as string[]) : [],
  };
}

async function listItineraryDaysByRouteSlugs(routeSlugs: string[]): Promise<Map<string, ItineraryDay[]>> {
  const byRoute = new Map<string, ItineraryDay[]>();
  if (routeSlugs.length === 0) return byRoute;

  const result = await sql`
    SELECT * FROM route_itinerary_days
    WHERE route_slug = ANY(${routeSlugs})
    ORDER BY route_slug ASC, day_number ASC
  `;
  for (const row of result.rows as unknown as (ItineraryDayRow & Record<string, unknown>)[]) {
    const routeSlug = String(row.route_slug);
    const day = mapItineraryDayRow(row as Record<string, unknown>);
    const existing = byRoute.get(routeSlug);
    if (existing) {
      existing.push(day);
    } else {
      byRoute.set(routeSlug, [day]);
    }
  }
  return byRoute;
}

function mapMediaRow(row: Record<string, unknown>): MediaAsset {
  return {
    id: String(row.id),
    status: (row.status as MediaAssetRow['status']) ?? 'review',
    type: (row.type as MediaAssetRow['type']) ?? 'image',
    publicUrl: String(row.public_url ?? ''),
    title: String(row.title ?? ''),
    altText: String(row.alt_text ?? ''),
    destinationSlugs: Array.isArray(row.destination_slugs) ? (row.destination_slugs as string[]) : [],
    routeSlugs: Array.isArray(row.route_slugs) ? (row.route_slugs as string[]) : [],
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
  };
}

export async function listPublicDestinations(): Promise<Destination[]> {
  await ensureContentTables();
  const result = await sql`
    SELECT * FROM destinations
    WHERE status = 'published'
    ORDER BY display_order ASC, name ASC
  `;
  return result.rows.map((row) => mapDestinationRow(row as Record<string, unknown>));
}

export async function listAdminDestinations(): Promise<Destination[]> {
  await ensureContentTables();
  const result = await sql`
    SELECT * FROM destinations
    ORDER BY display_order ASC, name ASC
  `;
  return result.rows.map((row) => mapDestinationRow(row as Record<string, unknown>));
}

export type DestinationInput = {
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

export function parseDestinationInput(body: Record<string, unknown>): { data: DestinationInput } | { error: string } {
  const slug = String(body.slug || '').trim().toLowerCase();
  const name = String(body.name || '').trim();
  const status = String(body.status || 'published').trim() as ContentStatus;
  const displayOrder = Number(body.displayOrder ?? body.display_order ?? 0);
  const featuredPriority = Number(body.featuredPriority ?? body.featured_priority ?? 0);

  if (!slug || !SLUG_PATTERN.test(slug)) {
    return { error: 'A valid slug (lowercase letters, numbers, hyphens) is required.' };
  }
  if (!name) return { error: 'Destination name is required.' };
  if (!KNOWN_STATUSES.includes(status)) return { error: 'Status is not valid.' };
  if (!Number.isFinite(displayOrder)) return { error: 'Display order must be a number.' };
  if (!Number.isFinite(featuredPriority) || featuredPriority < 0 || featuredPriority > 9999) {
    return { error: 'Featured priority must be between 0 and 9999.' };
  }

  return {
    data: {
      slug,
      name,
      description: String(body.description || '').trim(),
      image: String(body.image || '').trim(),
      displayOrder: Math.floor(displayOrder),
      status,
      travelStyles: asStringArray(body.travelStyles ?? body.travel_styles),
      featuredOnHome: Boolean(body.featuredOnHome ?? body.featured_on_home),
      featuredPriority: Math.floor(featuredPriority),
    },
  };
}

export async function upsertDestination(
  input: DestinationInput,
): Promise<{ slug: string } | { error: string; status: number }> {
  await ensureContentTables();
  await sql`
    INSERT INTO destinations (
      slug, name, description, image, display_order, status,
      travel_styles, featured_on_home, featured_priority
    )
    VALUES (
      ${input.slug}, ${input.name}, ${input.description}, ${input.image}, ${input.displayOrder}, ${input.status},
      ${input.travelStyles}, ${input.featuredOnHome}, ${input.featuredPriority}
    )
    ON CONFLICT (slug) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      image = EXCLUDED.image,
      display_order = EXCLUDED.display_order,
      status = EXCLUDED.status,
      travel_styles = EXCLUDED.travel_styles,
      featured_on_home = EXCLUDED.featured_on_home,
      featured_priority = EXCLUDED.featured_priority,
      updated_at = NOW()
  `;
  return { slug: input.slug };
}

export async function archiveDestination(slug: string): Promise<boolean> {
  await ensureContentTables();
  const result = await sql`
    UPDATE destinations SET status = 'archived', updated_at = NOW()
    WHERE slug = ${slug}
    RETURNING slug
  `;
  return result.rows.length > 0;
}

export async function listPublicRoutes(options?: { destinationSlug?: string }): Promise<RouteRecord[]> {
  await ensureContentTables();
  const destinationSlug = options?.destinationSlug;
  const result = destinationSlug
    ? await sql`
        SELECT
          r.*,
          COALESCE(
            array_agg(rd2.destination_slug) FILTER (WHERE rd2.destination_slug IS NOT NULL),
            '{}'
          ) AS destination_slugs
        FROM routes r
        JOIN route_destinations rd ON rd.route_slug = r.slug AND rd.destination_slug = ${destinationSlug}
        LEFT JOIN route_destinations rd2 ON rd2.route_slug = r.slug
        WHERE r.status = 'published'
        GROUP BY r.slug
        ORDER BY r.title ASC
      `
    : await sql`
        SELECT
          r.*,
          COALESCE(
            array_agg(rd.destination_slug) FILTER (WHERE rd.destination_slug IS NOT NULL),
            '{}'
          ) AS destination_slugs
        FROM routes r
        LEFT JOIN route_destinations rd ON rd.route_slug = r.slug
        WHERE r.status = 'published'
        GROUP BY r.slug
        ORDER BY r.title ASC
      `;
  const rows = result.rows as Record<string, unknown>[];
  const itineraryByRoute = await listItineraryDaysByRouteSlugs(rows.map((row) => String(row.slug)));
  const mapped = rows.map((row) => mapRouteRow(row, itineraryByRoute.get(String(row.slug)) ?? []));
  return applyAlignedCategories(mapped, await loadRouteCategoryLabelMap());
}

export async function listAdminRoutes(options?: {
  status?: string;
  search?: string;
}): Promise<RouteRecord[]> {
  await ensureContentTables();
  const status = options?.status?.trim() || undefined;
  const search = options?.search?.trim() || undefined;
  const result = await sql`
    SELECT
      r.*,
      COALESCE(
        array_agg(rd.destination_slug) FILTER (WHERE rd.destination_slug IS NOT NULL),
        '{}'
      ) AS destination_slugs
    FROM routes r
    LEFT JOIN route_destinations rd ON rd.route_slug = r.slug
    WHERE (${status}::text IS NULL OR r.status = ${status})
      AND (
        ${search}::text IS NULL
        OR r.slug ILIKE '%' || ${search} || '%'
        OR r.title ILIKE '%' || ${search} || '%'
      )
    GROUP BY r.slug
    ORDER BY r.title ASC
  `;
  const rows = result.rows as Record<string, unknown>[];
  const itineraryByRoute = await listItineraryDaysByRouteSlugs(rows.map((row) => String(row.slug)));
  const mapped = rows.map((row) => mapRouteRow(row, itineraryByRoute.get(String(row.slug)) ?? []));
  return applyAlignedCategories(mapped, await loadRouteCategoryLabelMap());
}

export type RouteInput = {
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

export function parseRouteInput(body: Record<string, unknown>): { data: RouteInput } | { error: string } {
  const slug = String(body.slug || '').trim().toLowerCase();
  const title = String(body.title || '').trim();
  const summary = String(body.summary || body.desc || '').trim();
  const durationDays = Number(body.durationDays ?? body.duration_days);
  const status = String(body.status || 'published').trim() as ContentStatus;
  const priceMode = String(body.priceMode || body.price_mode || 'on-request').trim() as RoutePriceMode;
  const primaryType = String(body.primaryType || body.primary_type || 'customizable').trim() as RoutePrimaryType;
  const legacyNumericIdRaw = body.legacyNumericId ?? body.legacy_numeric_id;
  const legacyNumericId =
    legacyNumericIdRaw === '' || legacyNumericIdRaw == null ? null : Number(legacyNumericIdRaw);

  if (!slug || !SLUG_PATTERN.test(slug)) {
    return { error: 'A valid slug (lowercase letters, numbers, hyphens) is required.' };
  }
  if (!title) return { error: 'Route title is required.' };
  if (!summary) return { error: 'Route summary is required.' };
  if (!Number.isFinite(durationDays) || durationDays <= 0 || durationDays > 90) {
    return { error: 'Duration (days) must be a positive number.' };
  }
  if (!KNOWN_STATUSES.includes(status)) return { error: 'Status is not valid.' };
  if (!KNOWN_PRICE_MODES.includes(priceMode)) return { error: 'Price mode is not valid.' };
  if (!KNOWN_ROUTE_TYPES.includes(primaryType)) return { error: 'Primary product type is not valid.' };
  if (legacyNumericId != null && (!Number.isFinite(legacyNumericId) || legacyNumericId < 0)) {
    return { error: 'Legacy numeric ID must be a positive number when provided.' };
  }

  const availableTypes = asStringArray(body.availableTypes ?? body.available_types).filter((value) =>
    KNOWN_ROUTE_TYPES.includes(value as RoutePrimaryType),
  ) as RoutePrimaryType[];
  const destinationSlugs = asStringArray(body.destinationSlugs ?? body.destination_slugs).map((value) =>
    value.toLowerCase(),
  );

  const itineraryDaysParsed = parseItineraryDaysInput(body.itineraryDays ?? body.itinerary_days);
  if ('error' in itineraryDaysParsed) return itineraryDaysParsed;

  return {
    data: {
      slug,
      legacyNumericId,
      title,
      subtitle: String(body.subtitle || '').trim(),
      summary,
      durationDays: Math.floor(durationDays),
      groupSizeDisplay: String(body.groupSizeDisplay || body.group_size_display || '').trim(),
      category: String(body.category || '').trim(),
      themes: asStringArray(body.themes),
      status,
      featured: Boolean(body.featured),
      heroImage: String(body.heroImage || body.hero_image || '').trim(),
      pdfUrl: String(body.pdfUrl || body.pdf_url || '').trim(),
      priceMode,
      priceDisplay: String(body.priceDisplay || body.price_display || 'On request').trim() || 'On request',
      primaryType,
      availableTypes: availableTypes.length ? availableTypes : [primaryType],
      destinationSlugs,
      experience: asStringArray(body.experience),
      moments: asStringArray(body.moments),
      includedSupport: asStringArray(body.includedSupport ?? body.included_support),
      itineraryDays: itineraryDaysParsed.data,
    },
  };
}

function parseItineraryDaysInput(value: unknown): { data: ItineraryDay[] } | { error: string } {
  if (value === undefined || value === null) return { data: [] };
  if (!Array.isArray(value)) return { error: 'Itinerary days must be a list.' };

  const days: ItineraryDay[] = [];
  const seenDayNumbers = new Set<number>();

  for (const [index, entry] of value.entries()) {
    if (typeof entry !== 'object' || entry === null) {
      return { error: `Itinerary day ${index + 1} is not valid.` };
    }
    const raw = entry as Record<string, unknown>;
    const dayNumber = Number(raw.dayNumber ?? raw.day_number ?? index + 1);
    if (!Number.isFinite(dayNumber) || dayNumber <= 0) {
      return { error: `Itinerary day ${index + 1} must have a positive day number.` };
    }
    const normalizedDayNumber = Math.floor(dayNumber);
    if (seenDayNumbers.has(normalizedDayNumber)) {
      return { error: `Itinerary day number ${normalizedDayNumber} is used more than once.` };
    }
    seenDayNumbers.add(normalizedDayNumber);

    days.push({
      dayNumber: normalizedDayNumber,
      title: String(raw.title || '').trim(),
      city: String(raw.city || '').trim(),
      summary: String(raw.summary || '').trim(),
      attractions: asStringArray(raw.attractions),
      meals: String(raw.meals || '').trim(),
      accommodation: String(raw.accommodation || '').trim(),
      transport: String(raw.transport || '').trim(),
      notes: asStringArray(raw.notes),
    });
  }

  days.sort((a, b) => a.dayNumber - b.dayNumber);
  return { data: days };
}

export async function upsertRoute(
  input: RouteInput,
): Promise<{ slug: string } | { error: string; status: number }> {
  await ensureContentTables();
  const labelByKey = await loadRouteCategoryLabelMap();
  const category = alignRouteCategory(input.themes, labelByKey);
  try {
    await sql.begin(async (tx) => {
      await tx`
        INSERT INTO routes (
          slug, legacy_numeric_id, title, subtitle, summary, duration_days,
          group_size_display, category, themes, status, featured, hero_image,
          pdf_url, price_mode, price_display, primary_type, available_types,
          experience, moments, included_support
        ) VALUES (
          ${input.slug}, ${input.legacyNumericId}, ${input.title}, ${input.subtitle}, ${input.summary},
          ${input.durationDays}, ${input.groupSizeDisplay}, ${category},
          ${input.themes}, ${input.status}, ${input.featured}, ${input.heroImage},
          ${input.pdfUrl}, ${input.priceMode}, ${input.priceDisplay}, ${input.primaryType},
          ${input.availableTypes}, ${input.experience}, ${input.moments}, ${input.includedSupport}
        )
        ON CONFLICT (slug) DO UPDATE SET
          legacy_numeric_id = EXCLUDED.legacy_numeric_id,
          title = EXCLUDED.title,
          subtitle = EXCLUDED.subtitle,
          summary = EXCLUDED.summary,
          duration_days = EXCLUDED.duration_days,
          group_size_display = EXCLUDED.group_size_display,
          category = EXCLUDED.category,
          themes = EXCLUDED.themes,
          status = EXCLUDED.status,
          featured = EXCLUDED.featured,
          hero_image = EXCLUDED.hero_image,
          pdf_url = EXCLUDED.pdf_url,
          price_mode = EXCLUDED.price_mode,
          price_display = EXCLUDED.price_display,
          primary_type = EXCLUDED.primary_type,
          available_types = EXCLUDED.available_types,
          experience = EXCLUDED.experience,
          moments = EXCLUDED.moments,
          included_support = EXCLUDED.included_support,
          updated_at = NOW()
      `;

      await tx`DELETE FROM route_destinations WHERE route_slug = ${input.slug}`;
      for (const destinationSlug of input.destinationSlugs) {
        await tx`
          INSERT INTO route_destinations (route_slug, destination_slug)
          VALUES (${input.slug}, ${destinationSlug})
          ON CONFLICT DO NOTHING
        `;
      }

      await tx`DELETE FROM route_itinerary_days WHERE route_slug = ${input.slug}`;
      for (const day of input.itineraryDays) {
        await tx`
          INSERT INTO route_itinerary_days (
            route_slug, day_number, title, city, summary, attractions, meals, accommodation, transport, notes
          ) VALUES (
            ${input.slug}, ${day.dayNumber}, ${day.title}, ${day.city}, ${day.summary},
            ${day.attractions}, ${day.meals}, ${day.accommodation}, ${day.transport}, ${day.notes}
          )
        `;
      }
    });
    return { slug: input.slug };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.toLowerCase().includes('unique') || message.includes('23505')) {
      return { error: 'Legacy numeric ID already exists on another route.', status: 409 };
    }
    if (message.toLowerCase().includes('foreign key') || message.includes('23503')) {
      return { error: 'One of the destination slugs does not exist.', status: 400 };
    }
    throw error;
  }
}

export async function archiveRoute(slug: string): Promise<boolean> {
  await ensureContentTables();
  const result = await sql`
    UPDATE routes SET status = 'archived', updated_at = NOW()
    WHERE slug = ${slug}
    RETURNING slug
  `;
  return result.rows.length > 0;
}

export async function listAdminMedia(options?: {
  routeSlug?: string;
  destinationSlug?: string;
  status?: string;
  search?: string;
}): Promise<MediaAsset[]> {
  await ensureContentTables();
  const routeSlug = options?.routeSlug?.trim() || undefined;
  const destinationSlug = options?.destinationSlug?.trim() || undefined;
  const status = options?.status?.trim() || undefined;
  const search = options?.search?.trim() || undefined;

  const result = await sql`
    SELECT *
    FROM media_assets
    WHERE (${status}::text IS NULL OR status = ${status})
      AND (
        ${search}::text IS NULL
        OR title ILIKE '%' || ${search} || '%'
        OR public_url ILIKE '%' || ${search} || '%'
      )
      AND (${routeSlug}::text IS NULL OR ${routeSlug} = ANY(route_slugs))
      AND (${destinationSlug}::text IS NULL OR ${destinationSlug} = ANY(destination_slugs))
    ORDER BY created_at DESC
  `;

  return result.rows.map((row) => mapMediaRow(row as Record<string, unknown>));
}

export type MediaInput = {
  id: string | null;
  type: MediaAssetRow['type'];
  publicUrl: string;
  title: string;
  altText: string;
  destinationSlugs: string[];
  routeSlugs: string[];
  tags: string[];
  status: MediaAssetRow['status'];
};

const KNOWN_MEDIA_TYPES: MediaAssetRow['type'][] = ['image', 'video'];
const KNOWN_MEDIA_STATUSES: MediaAssetRow['status'][] = ['review', 'published', 'rejected', 'archived'];

export function parseMediaInput(body: Record<string, unknown>): { data: MediaInput } | { error: string } {
  const publicUrl = String(body.publicUrl || body.public_url || '').trim();
  const title = String(body.title || '').trim();
  const type = String(body.type || 'image').trim() as MediaAssetRow['type'];
  const status = String(body.status || 'published').trim() as MediaAssetRow['status'];
  const idRaw = String(body.id || '').trim();

  if (!publicUrl || !/^https?:\/\//i.test(publicUrl)) {
    return { error: 'A valid http(s) URL is required.' };
  }
  if (!title) return { error: 'Media title is required.' };
  if (!KNOWN_MEDIA_TYPES.includes(type)) return { error: 'Media type is not valid.' };
  if (!KNOWN_MEDIA_STATUSES.includes(status)) return { error: 'Media status is not valid.' };

  return {
    data: {
      id: idRaw || null,
      type,
      publicUrl,
      title,
      altText: String(body.altText || body.alt_text || '').trim(),
      destinationSlugs: asStringArray(body.destinationSlugs ?? body.destination_slugs).map((v) => v.toLowerCase()),
      routeSlugs: asStringArray(body.routeSlugs ?? body.route_slugs),
      tags: asStringArray(body.tags),
      status,
    },
  };
}

export async function upsertMedia(input: MediaInput): Promise<{ id: string }> {
  await ensureContentTables();
  const id = input.id || `media-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  await sql`
    INSERT INTO media_assets (
      id, status, type, public_url, title, alt_text, destination_slugs, route_slugs, tags
    ) VALUES (
      ${id}, ${input.status}, ${input.type}, ${input.publicUrl}, ${input.title}, ${input.altText},
      ${input.destinationSlugs}, ${input.routeSlugs}, ${input.tags}
    )
    ON CONFLICT (id) DO UPDATE SET
      status = EXCLUDED.status,
      type = EXCLUDED.type,
      public_url = EXCLUDED.public_url,
      title = EXCLUDED.title,
      alt_text = EXCLUDED.alt_text,
      destination_slugs = EXCLUDED.destination_slugs,
      route_slugs = EXCLUDED.route_slugs,
      tags = EXCLUDED.tags,
      updated_at = NOW()
  `;
  return { id };
}

export async function archiveMedia(id: string): Promise<boolean> {
  await ensureContentTables();
  const result = await sql`
    UPDATE media_assets SET status = 'archived', updated_at = NOW()
    WHERE id = ${id}
    RETURNING id
  `;
  return result.rows.length > 0;
}

export async function listPublicCategories(scope: CategoryScope): Promise<Category[]> {
  await ensureContentTables();
  const result = await sql`
    SELECT * FROM categories
    WHERE scope = ${scope} AND enabled = true
    ORDER BY sort_order ASC, label ASC
  `;
  return result.rows.map((row) => mapCategoryRow(row as Record<string, unknown>));
}

export async function listAdminCategories(): Promise<Category[]> {
  await ensureContentTables();
  const result = await sql`
    SELECT * FROM categories
    ORDER BY scope ASC, sort_order ASC, label ASC
  `;
  return result.rows.map((row) => mapCategoryRow(row as Record<string, unknown>));
}

export type CategoryInput = {
  id: string | null;
  key: string;
  label: string;
  scope: CategoryScope;
  sortOrder: number;
  enabled: boolean;
};

export function parseCategoryInput(body: Record<string, unknown>): { data: CategoryInput } | { error: string } {
  const idRaw = String(body.id || '').trim();
  const key = String(body.key || '').trim().toLowerCase();
  const label = String(body.label || '').trim();
  const scope = String(body.scope || '').trim() as CategoryScope;
  const sortOrder = Number(body.sortOrder ?? body.sort_order ?? 0);

  if (!key || !SLUG_PATTERN.test(key)) {
    return { error: 'A valid category key (lowercase letters, numbers, hyphens) is required.' };
  }
  if (!label) return { error: 'Category label is required.' };
  if (!KNOWN_CATEGORY_SCOPES.includes(scope)) {
    return { error: 'Scope must be destination or route.' };
  }
  if (!Number.isFinite(sortOrder)) return { error: 'Sort order must be a number.' };

  return {
    data: {
      id: idRaw || null,
      key,
      label,
      scope,
      sortOrder: Math.floor(sortOrder),
      enabled: body.enabled === undefined ? true : Boolean(body.enabled),
    },
  };
}

export async function upsertCategory(
  input: CategoryInput,
): Promise<{ id: string } | { error: string; status: number }> {
  await ensureContentTables();
  try {
    if (!input.id) {
      const result = await sql`
        INSERT INTO categories (key, label, scope, sort_order, enabled)
        VALUES (${input.key}, ${input.label}, ${input.scope}, ${input.sortOrder}, ${input.enabled})
        RETURNING id
      `;
      return { id: String(result.rows[0].id) };
    }

    const result = await sql`
      UPDATE categories SET
        label = ${input.label},
        sort_order = ${input.sortOrder},
        enabled = ${input.enabled},
        updated_at = NOW()
      WHERE id = ${input.id}
      RETURNING id
    `;
    if (!result.rows.length) {
      return { error: 'Category not found.', status: 404 };
    }
    return { id: String(result.rows[0].id) };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.toLowerCase().includes('unique') || message.includes('23505')) {
      return { error: 'A category with this key already exists for this scope.', status: 409 };
    }
    throw error;
  }
}

export async function archiveCategory(id: string): Promise<boolean> {
  await ensureContentTables();
  const result = await sql`
    UPDATE categories SET enabled = false, updated_at = NOW()
    WHERE id = ${id}
    RETURNING id
  `;
  return result.rows.length > 0;
}

export async function reorderCategories(scope: CategoryScope, orderedIds: string[]): Promise<void> {
  await ensureContentTables();
  await sql.begin(async (tx) => {
    for (let index = 0; index < orderedIds.length; index += 1) {
      await tx`
        UPDATE categories SET sort_order = ${index}, updated_at = NOW()
        WHERE id = ${orderedIds[index]} AND scope = ${scope}
      `;
    }
  });
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? '').trim()).filter(Boolean);
}
