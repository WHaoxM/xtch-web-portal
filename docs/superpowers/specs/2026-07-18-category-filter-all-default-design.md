# Category filter default All (Destinations / Routes)

Status: Approved for planning  
Date: 2026-07-18

## Problem

After operators create enabled categories in Admin, the traveler China Trips **Destinations** and **Routes** tabs show empty lists (0 places / 0 routes), even though destinations and routes still exist.

## Root cause

In `ChinaTripsMobile.tsx`, `DestinationsTab` and `RoutesTab`:

1. On mount, `fetchCategories(scope)` succeeds and then runs  
   `setActiveFilter((current) => current || result[0]?.key || '')`.
2. That auto-selects the **first** enabled category.
3. The list filters with `travelStyles.includes(activeFilter)` / `themes.includes(activeFilter)`.
4. Content that has not been tagged with that category key is excluded → empty list.
5. The filter rail has **no All** option, so travelers cannot return to the unfiltered list after selecting a category.

When no categories exist, `activeFilter` stays empty and the full list is shown — which is why the bug only appears **after** categories are set up.

Related ADR: `docs/adr/0004-dynamic-categories-and-home-featured-destinations.md` (soft references; tagging is optional). Auto-selecting the first category contradicts “untagged content remains visible until filtered.”

## Goals

- Default view after categories exist: show **all** destinations / routes.
- Filter rail leftmost chip: **All**; selecting a category filters; selecting All clears the filter.
- Minimal change: traveler UI only.

## Non-goals

- Admin soft warnings for untagged content.
- Require at least one category tag before publish.
- API / schema / ADR changes.
- Home “Popular places” featured logic.
- New empty-state copy beyond the existing `0 places/routes in {label}` summary.
- Automated tests for these tabs (no existing unit baseline).

## Behavior

| State | Behavior |
|-------|----------|
| No enabled categories | No filter rail; show full list (unchanged). |
| Enabled categories exist | Filter rail: **All** first, then categories in `sort_order`. |
| Enter Destinations / Routes tab | Default selected: **All**; show full loaded list. |
| Select a category | Show only items whose `travelStyles` / `themes` include that `key`. |
| Select **All** | Clear category filter; show full list. |
| Category has zero matches | Empty list + summary `0 places/routes in {label}` (existing pattern). |

## Implementation

**File:** `app/src/components/ChinaTripsMobile.tsx` only (`DestinationsTab`, `RoutesTab`).  
`FilterRail` needs no API change.

1. Introduce sentinel `ALL_FILTER_KEY = '__all__'`.  
   Must **not** be a valid category key under `SLUG_PATTERN` (`^[a-z0-9]+(?:-[a-z0-9]+)*$`), so it cannot collide with an operator-created key named `all`. Do not use `'all'` or `''` as the value (empty string is a weak React `key` in `FilterRail`).
2. Initial `activeFilter` = `ALL_FILTER_KEY`.
3. On category fetch success: `setCategories(result)` only — **do not** auto-select `result[0].key`.
4. When `categories.length > 0`, build options as:  
   `[{ key: ALL_FILTER_KEY, label: 'All' }, ...categories.map(...)]`.  
   Label **All** is English (matches public China Trips UI).
5. Filter logic:
   - If `activeFilter === ALL_FILTER_KEY` (or no categories): show full `destinationMeta` / `routeTours`.
   - Else: existing `includes(activeFilter)` filter. Never pass `ALL_FILTER_KEY` into `includes`.
6. Summary: under All, omit `in {label}`; under a category, keep `in {label}`.

## Verification

1. Enabled categories exist, content untagged → Destinations / Routes open on **All** with non-empty lists.
2. Select a category → only tagged items; untagged hidden.
3. Select **All** again → full list restored.
4. No enabled categories → no rail; full list still shown.
5. In `app/`: `npm run build` and `npm run lint` pass; spot-check ~375px that the rail scrolls horizontally and **All** is leftmost.

## Decision record

- Symptom surface: traveler Destinations / Routes (not Admin lists).
- Default: All (not first category).
- Return path: explicit **All** chip (not toggle-deselect).
- Approach: minimal frontend fix only (not Admin prompts, not publish gating).
