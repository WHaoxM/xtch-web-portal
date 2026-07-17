# Content and Resource Map

This document records the agreed rules for using local and remote content while building the
Syncing Travel portal. Follow it before changing page copy, images, videos, route data, or page
structure.

## Source Priority

Use sources in this order:

1. `路线/`, `路线_新/`, and other approved raw route intake folders
   - Temporary raw intake locations for route documents, route webpages, PDFs, DOCX files, pricing
     sheets, and route-specific media.
   - These folders are not the final structured data layer. Route facts must be extracted, cleaned,
     translated or rewritten into English when needed, reviewed, and then stored as Structured Travel
     Data before being used by traveler-facing pages.
   - Use the raw files as extraction evidence for `ChinaTours`, route cards, destination detail route
     lists, and downloadable assets, but do not display raw file paths or source webpage labels to
     travelers.

2. `本站/` and `https://www.syncingtravel.com/`
   - Primary source for Syncing-owned brand content, real images, visual assets, company
     information, official channels, service positioning, contact details, and self-owned page
     content.
   - Local `本站/` files are preferred over live scraping when the same asset exists locally.
   - Remote Syncing assets may be referenced directly during the first design pass. After the page
     structure is approved, selected core images should be copied into `app/public/images/` with
     stable descriptive names.

3. `目标站/`
   - Reference source for page structure, module order, interaction patterns, information hierarchy,
     card rhythm, video placement, team/trust layout, destination guide structure, and visual pacing.
   - Do not treat TOCN brand identity, staff identity, or proprietary claims as Syncing facts.

## Page Mapping

### Home: `/`

Primary sources:
- `本站/` and `https://www.syncingtravel.com/` for real Syncing visuals, brand tone, official
  channel links, and trust messaging.
- Reviewed Structured Travel Data for featured route cards and real itinerary links. During the
  transition, `app/src/lib/siteData.ts` may continue to serve this role.

Reference sources:
- `目标站/Private Custom China Tours _ Tailor-Made Itineraries_files/` for custom-tour layout
  rhythm, image-led trust sections, and guest collage style.
- TOCN homepage screenshots and saved assets for hero scale, route card behavior, video/media
  placement, and photo stream rhythm.

Rules:
- Use Syncing-owned visuals first.
- Use TOCN only for structure and interaction reference unless the asset is a generic travel scene
  and not tied to TOCN staff identity.

### China Tours: `/china-tours`

Primary sources:
- Structured Travel Data generated from `路线/`, `路线_新/`, route PDFs, DOCX files, and local
  promotional pages.
- During the transition, `app/src/lib/siteData.ts` remains the current normalized route data layer.

Reference sources:
- TOCN tour card design and hover behavior.

Rules:
- Do not add About/team images here unless they directly support a route.
- Route facts must come from `路线/` or existing normalized route data.

### Destinations Index: `/destinations`

Primary sources:
- Destination coverage derived from reviewed Structured Travel Data and, during the transition,
  `app/src/lib/siteData.ts`.
- Syncing-owned imagery from `本站/` or curated local images.

Reference sources:
- TOCN destination grid, large image-card navigation, and destination category rhythm.

Rules:
- Only expose destinations that have real route coverage or a clear business reason to publish.

### Destination Detail: `/destinations/:slug`

Primary sources:
- Reviewed Structured Travel Data extracted from matching raw route files.
- Syncing-owned destination imagery where available.

Reference sources:
- `目标站/Beijing Private Tours & Travel Guide _ Custom Trip Planning.html`
  for the strongest destination-detail reference.
- Its structure can inform hero, popular tours, video/media section, things to do, best time,
  practical tips, FAQ, and CTA flow.

Rules:
- Beijing should be the first high-fidelity destination detail pass because a complete TOCN Beijing
  reference is available.
- Video placement may follow TOCN, but video content must be Syncing-owned or a Syncing official
  channel entry unless the user explicitly provides another approved video.

### Custom Trip: `/custom-trip`

Primary sources:
- Syncing site inquiry flow, official contact details, service positioning, and current form
  expectations.

Reference sources:
- TOCN custom-trip planning page for persuasion flow, planning prompts, and pre-form trust content.

Rules:
- Form fields should reflect practical travel planning needs: travel month/date, group size,
  destinations, hotel level, pace, interests, contact method, and special requests.

### About: `/about`

Primary sources:
- Syncing company information from `本站/`, `https://www.syncingtravel.com/`, and local brand data.
- Real Syncing visuals and travel-scene images.

Reference sources:
- `目标站/About Tocntravel _ Private China Travel Experts_files/` for team/trust structure,
  operations roles, founder/planner/support layout, and real-travel-experience sections.

Rules:
- Do not use TOCN staff headshots as Syncing staff portraits unless the user explicitly confirms
  those people/images are also valid Syncing assets.
- If Syncing staff portraits are unavailable, use role-based team cards plus real travel/operations
  imagery instead of inventing team members.

### Travel Guide: `/travel-guide`

Primary sources:
- Syncing-owned guide content from `本站/` and route-specific practical knowledge from `路线/`.

Reference sources:
- TOCN destination FAQs and practical planning tips, especially the Beijing guide structure.

Rules:
- Use TOCN content as structural inspiration. Do not copy destination-specific claims unless they
  are verified or already represented in Syncing/route materials.

### Contact: `/contact`

Primary sources:
- Syncing official contact details from `本站/`, live Syncing site, and `app/src/lib/siteData.ts`.

Reference sources:
- TOCN contact/trust flow only for layout inspiration.

Rules:
- Contact details must match Syncing official information.

## TOCN Asset Boundaries

### Allowed

- Page structure and module order.
- Visual rhythm, grid proportions, video placement, card interaction ideas, typography scale,
  section spacing, and CTA patterns.
- Generic destination/travel-scene imagery when it does not imply TOCN staff identity or proprietary
  customer claims.

### Not Allowed Without Explicit Confirmation

- TOCN logo as Syncing identity.
- TOCN employee portraits as Syncing team members.
- TOCN staff names, job titles, founder story, or operational claims as Syncing facts.
- TOCN video embedded as Syncing-owned video.

## Video Strategy

- Prefer Syncing-owned videos or Syncing official YouTube channel links.
- If a specific Syncing video URL is unavailable, use a poster-style video entry that links to the
  official Syncing YouTube channel.
- TOCN video modules may be used as placement and interaction references only.
- Do not embed TOCN videos as Syncing content unless explicitly approved.

## Image Strategy

Initial design pass:
- Remote Syncing/Wix image URLs may be used directly to move quickly.
- Use `本站/` local assets where already available and easy to identify.

Finalization pass:
- Select the core 10-20 images used across the portal.
- Copy them into `app/public/images/`.
- Rename them descriptively, for example:
  - `syncing-real-trip-01.jpg`
  - `syncing-photo-moment-01.jpg`
  - `syncing-team-operations-01.jpg`
  - `syncing-beijing-hero-01.jpg`

Do not bulk-copy every asset. Only keep images that are used by the current portal.

## Implementation Order

1. Home `/`
   - Align hero, real media, route cards, official video/channel entry, and trust flow.

2. Beijing destination detail `/destinations/beijing`
   - Use the TOCN Beijing page as the strongest structural reference.
   - Replace content with Syncing and route-derived facts.

3. About `/about`
   - Build trust using Syncing company facts, real visuals, and role-based team/operations content.

4. Custom Trip `/custom-trip`
   - Align the planning and inquiry flow to Syncing needs.

5. China Tours, Destinations, and Travel Guide
   - Normalize visual language and fill out route/destination guide consistency.

## Working Rules

- Before changing a page, identify its primary source and reference source from this document.
- Do not mix resources just because they are available.
- Keep factual content tied to the highest-priority source.
- Keep TOCN as a design/reference system unless a specific asset is explicitly approved for content
  use.
- Prefer real images over decorative illustrations.
- Do not create fake statistics, fake reviews, fake staff, or fake customer claims.
