# Dynamic Categories for Places/Routes Filters + Destinations Home-Featured Flag

Status: Accepted

Date: 2026-07-16

## Context

`app/src/components/ChinaTripsMobile.tsx` drove the Places and Routes filter
tabs from two hardcoded, developer-only lists:

- `placeFilters`: `{ key, label, slugs: string[] }` — a fixed whitelist of
  destination slugs per filter (e.g. `firstTrip: ['beijing', 'shanghai', ...]`).
- `routeFilters` + `routeMatchesFilter`: kept a fixed filter key list and
  matched routes into a filter by running keyword checks against
  `tour.title/desc/category/groupSize/duration` — no database field backed
  this at all.

Content created through the Phase 1 Admin CRUD (destinations/routes, see
`docs/adr/0003-admin-content-dynamic-scope-phase-1.md`) never appeared in any
filter tab unless a developer also edited these hardcoded arrays and
redeployed. This defeated the purpose of giving operations a CRUD admin.

Separately, the mobile home "Popular places" section used
`destinationMeta.slice(0, 6)` (i.e. the first 6 by `display_order`) with no
independent "feature this on home" concept, unlike `departures`, which
already has `featured_on_home` / `featured_priority` for the small-group
home rail.

Decisions below were confirmed with the product owner via a grill-me session
(2026-07-16).

## Decision

1. **Categories become a first-class, database-backed, operator-managed
   entity** (`categories` table: `key`, `label`, `scope`
   ('destination' | 'route'), `sort_order`, `enabled`). Operations can create
   and edit categories freely from Admin — this is not a fixed set of keys
   that operations merely toggles. Mobile Places/Routes filter tabs render
   whatever enabled categories exist for their scope, in `sort_order`.
2. `destinations.travel_styles TEXT[]` and the pre-existing `routes.themes
   TEXT[]` store `categories.key` values as a **soft reference** — no foreign
   key constraint. This is intentional: archiving (disabling) a category must
   never cascade into an unexpected destination/route data change, and the
   read path simply drops keys that no longer resolve to an enabled category.
3. Enabled category count per scope only gets a **soft limit warning** in
   Admin (`ENABLED_CATEGORY_SOFT_LIMIT = 6` in `Admin.tsx`) if operations
   enables more than ~6 at once, since a crowded horizontal filter row
   degrades mobile UX. This is not enforced/blocked — operations can exceed
   it if they accept the UX tradeoff.
4. `destinations` gets its own `featured_on_home BOOLEAN` +
   `featured_priority INTEGER`, mirroring the existing `departures` pattern,
   instead of overloading `display_order` (which continues to control the
   default list ordering on the Destinations tab, unrelated to home
   placement).
5. Mobile "Popular places" home section: destinations with
   `featured_on_home = true` sorted by `featured_priority` ascending, capped
   at 6. If fewer than 6 are marked featured, the remaining slots are
   backfilled with the next destinations by `display_order` (not featured)
   so the home section never looks sparse just because operations hasn't
   curated a full set of 6 yet.

Explicitly not done:

- No hard cap on enabled category count (see point 3).
- No foreign key from `travel_styles`/`themes` to `categories.key` (see
  point 2).
- No day-by-day itinerary changes (out of scope; see the separate
  structured-route-itinerary plan).

## Consequences

Positive:

- Operations can add a new Places/Routes filter (e.g. a seasonal "Winter
  travel" category) and tag content into it without a code change or
  redeploy.
- Categories and the home-featured flag both follow the same self-healing
  schema / admin-CRUD-with-audit-log / public-read-API pattern already
  established in Phase 1, keeping the codebase consistent.
- Disabling a category is non-destructive (soft archive via `enabled =
  false`), so accidental clicks don't lose tagging data.

Costs / risks:

- Soft references mean a destination/route can carry a `travel_styles`/
  `themes` key that points at a disabled or deleted-in-spirit category; all
  read paths (`listPublicCategories`, the mobile filter render, the Admin
  checkboxes) must treat unknown/disabled keys as simply not shown rather
  than erroring, which is the current implementation but must be kept in
  mind by anyone changing this code later.
- Because there is no hard cap, an operator can still crowd the mobile
  filter row past the point the soft-limit warning suggests avoiding; this
  is an accepted, reversible UX risk, not a bug.

## Implementation Notes

Files affected:

- `app/api/lib/contentSchema.ts` — `categories` table +
  `destinations.travel_styles` / `featured_on_home` / `featured_priority`
  columns, self-healing (same pattern as `ensureContentTables()`, not part of
  `001_initial_content_schema.ts`).
- `app/api/lib/contentQueries.ts` — category list/CRUD/reorder/archive
  helpers; `Destination`/`DestinationInput` extended with the three new
  fields.
- `app/api/categories.ts` (public read), `app/api/admin/categories.ts`
  (admin CRUD + audit log, mirrors `app/api/admin/departures.ts`).
- `app/api/admin/destinations.ts`, `app/api/destinations.ts` — read/write the
  three new destination fields.
- `app/src/lib/categoriesClient.ts` (new), `app/src/lib/destinationsClient.ts`
  (`Destination` type extended).
- `app/src/pages/Admin.tsx` — `CategoriesPanel` (list + create/edit/reorder/
  archive + soft-limit banner), `DestinationsPanel` (travel-style checkboxes
  + featured-on-home toggle/priority), `RoutesPanel` (theme checkboxes).
- `app/src/components/ChinaTripsMobile.tsx` — removed `placeFilters`/
  `routeFilters`/`routeMatchesFilter`; `PlacesTab`/`RoutesTab` now fetch
  categories by scope and render `FilterRail` dynamically; `getPopularPlaces()`
  implements the featured-then-backfill ordering from point 5.

Validation before shipping:

- `npm run build` and `npm run lint` pass.
- Admin can create categories, tag destinations/routes with them, and the
  mobile Places/Routes tabs reflect exactly those categories (not any
  previously hardcoded set).
- Toggling `featured_on_home` + `featured_priority` on 2-3 destinations
  changes the mobile home "Popular places" order as expected, with backfill
  behavior verified when fewer than 6 destinations are featured.
- Mobile layout checked at 320px/375px/390px widths — the filter row scrolls
  horizontally rather than wrapping or overflowing.
