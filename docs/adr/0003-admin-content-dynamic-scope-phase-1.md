# Admin and Database Dynamic Content Scope (Phase 1)

Status: Accepted

Date: 2026-07-15

## Context

The portal already has a working database-backed admin surface for **Orders**,
**Departures** (including home-featured small groups), and **Custom trip form
config**. Everything else that a visitor sees as "content" — destinations,
routes/tours, route detail pages, guide articles, and home/about content
blocks — is still hardcoded in frontend source files and can only be changed
by editing code and redeploying.

A review of the current code found that route content is actually split
across three separate places, none of which is in the database:

1. `app/src/lib/siteData.ts` — card-level route fields (title, summary,
   duration, group size, category, `featured`, destination links, PDF link).
2. `app/src/lib/routePdfDetails.ts` — day-by-day itinerary content
   (`tourCode`, `experience`, `moments`, `days`, `included`, `notes`) that was
   already extracted and reviewed from the original route PDFs, keyed by
   numeric route id.
3. `app/src/pages/RouteDetail.tsx` — sitewide generic blocks (`includedItems`,
   `notIncludedItems`, `wayCards`, `routeFaqs`) that are shared by every route
   detail page rather than being per-route data.

Separately, migration `001_initial_content_schema.ts`
(`app/api/migrations/001_initial_content_schema.ts`) already defines
`destinations`, `routes`, `route_destinations`, `route_itinerary_days`,
`route_inclusions`, `media_assets`, and `guide_articles` tables, but no API
route or admin UI reads or writes them, and `Admin.tsx` still imports
`routeTours` directly from `siteData.ts`. There is also no confirmed way this
migration has ever run against a real database: `package.json` references
`db:migrate` → `scripts/db/migrate.ts`, `db:seed` → `scripts/db/seed-routes.ts`,
and `db:sync` → `scripts/db/sync-normalized-to-db.ts`, but none of these three
files exist in `app/scripts/`.

Business context confirmed with the product owner:

- Destinations and routes will be edited by **non-technical operations
  staff** through the admin UI, not by developers editing code.
- Route content changes **frequently** (new routes, price/status changes,
  itinerary tweaks are routine operational activity), which justifies the
  cost of building admin CRUD now rather than deferring it.
- Media storage backend (object storage, or a future shared resource API from
  the sibling XT_MVP project) is an open, later decision and must not block
  this phase.

## Decision

Phase 1 of dynamic content management covers:

1. **Destinations admin CRUD**, backed by the existing `destinations` table:
   `name`, `slug`, `image` (URL string), `description`, display order,
   status.
2. **Route card-level fields admin CRUD**, backed by the existing `routes` +
   `route_destinations` tables: title, subtitle/summary, duration, group size
   display, category, themes, `featured`, price mode/display fields, primary
   and available route product types, destination links, hero image (URL
   string), and PDF link (URL string).
3. **Media metadata admin CRUD (URL-only)**, backed by the existing
   `media_assets` table: operations pastes a `public_url` for an
   already-hosted image or PDF, and manages title, tags, status, and which
   routes/destinations it is linked to. No file upload pipeline and no
   object-storage integration is introduced in this phase.

Explicitly deferred, not part of Phase 1:

- Day-by-day itinerary content (`route_itinerary_days` /
  `routePdfDetails.ts`). Itinerary editing stays in code for now; the admin
  route form only manages the fields listed above.
- `route_inclusions` and the sitewide generic `RouteDetail.tsx` blocks
  (`includedItems`, `notIncludedItems`, `wayCards`, `routeFaqs`) stay shared
  across all routes, not editable per route.
- `guide_articles` (Travel Guide content).
- Home/About hardcoded content blocks (Real Moments, Traveler Notes, Why
  Choose Us, team content) — not yet audited for this decision.
- Any real media storage/upload backend (Vercel Blob, S3-compatible object
  storage, or a future XT_MVP shared resource API). `media_assets.public_url`
  is storage-agnostic, so this can be added later without changing the Phase
  1 admin form shape.

## Consequences

Positive:

- Operations can create/edit destinations and routes without a code
  deploy, which matches how frequently this content actually changes.
- Scope stays small: no new external dependency or service is introduced in
  Phase 1 (media stays URL-paste only).
- The storage-agnostic `media_assets.public_url` design means Phase 1 does
  not need to be reworked when a real upload backend is chosen later.

Costs / risks:

- Before building any Phase 1 API/admin work, the schema state of the real
  database must be verified — migration `001_initial_content_schema.ts` has
  no confirmed run history, and the `db:migrate` script it depends on does
  not exist yet.
- Route content will temporarily be split across two systems: card fields in
  the database (dynamic), itinerary days still in
  `app/src/lib/routePdfDetails.ts` (static). Frontend route detail pages need
  to keep reading itinerary from code while reading card fields from the new
  API.
- `Admin.tsx` currently imports `routeTours` from `siteData.ts` directly;
  this import path needs to be replaced with an API-backed data source as
  part of this work, not left as a leftover dependency on static data.

## Implementation Notes

Files most directly affected later:

- `app/api/migrations/001_initial_content_schema.ts` (verify/apply against
  real DB first)
- New API surfaces needed: destinations CRUD, routes CRUD (admin +
  public read), media metadata CRUD (admin)
- `app/src/pages/Admin.tsx` (new Destinations / Routes / Media tabs; remove
  the direct `siteData.ts` `routeTours` import)
- `app/src/lib/siteData.ts` (destination/route card data moves out of here;
  `brand` and other non-content constants can stay)
- `app/src/pages/RouteDetail.tsx`, `app/src/pages/ChinaTours.tsx`,
  `app/src/pages/Destinations.tsx`, `app/src/pages/DestinationDetail.tsx`
  (switch from static imports to API-backed data for card-level fields only)

Validation before shipping:

- Confirm `destinations`/`routes`/`route_destinations`/`media_assets` exist
  and match the intended shape on the real database before wiring APIs to
  them.
- Admin CRUD for destinations and routes round-trips correctly and reflects
  on the public pages that currently read from `siteData.ts`.
- `npm run build` and `npm run lint` pass.
- Public route/destination pages still render correctly with itinerary
  content still sourced from `routePdfDetails.ts`.
