# Category Filter Default All Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On China Trips Destinations / Routes tabs, default the category filter to **All** (with an explicit All chip) so creating Admin categories no longer hides untagged content.

**Architecture:** Sentinel `ALL_FILTER_KEY = '__all__'` (invalid as a category slug) drives unfiltered list mode. Remove auto-select of `result[0].key` after `fetchCategories`. Prepend `{ key: ALL_FILTER_KEY, label: 'All' }` to FilterRail options when categories exist. No API, Admin, or schema changes.

**Tech Stack:** React + TypeScript in `ChinaTripsMobile.tsx`; existing `FilterRail` and `fetchCategories`.

## Global Constraints

- Touch only `app/src/components/ChinaTripsMobile.tsx` (`DestinationsTab` / `RoutesTab`).
- Sentinel must be `__all__` (not `'all'` or `''`) so it cannot collide with `SLUG_PATTERN` category keys.
- Public UI label is English **All**.
- No new automated tests (spec non-goal); verify with manual checklist + `npm run build` / `npm run lint` in `app/`.
- Do not change Admin prompts, publish gating, Popular places, or `FilterRail` props API.

---

## File map

| File | Responsibility |
|------|----------------|
| `app/src/components/ChinaTripsMobile.tsx` | Add `ALL_FILTER_KEY`; fix DestinationsTab + RoutesTab default, options, and filter gating |

No new files.

---

### Task 1: DestinationsTab — default All + All chip

**Files:**
- Modify: `app/src/components/ChinaTripsMobile.tsx` (constant near `PlaceFilterKey` / `RouteFilterKey` ~176–177; `DestinationsTab` ~1100–1163)

**Interfaces:**
- Consumes: `fetchCategories('destination')`, `FilterRail`, `destinationMeta`, `Category`
- Produces: `ALL_FILTER_KEY` constant for Task 2 to reuse

- [ ] **Step 1: Add sentinel constant**

Near `type PlaceFilterKey = string;` / `type RouteFilterKey = string;`, add:

```ts
/** Sentinel for unfiltered Destinations/Routes lists; invalid as categories.key (SLUG_PATTERN). */
const ALL_FILTER_KEY = '__all__';
```

- [ ] **Step 2: Update DestinationsTab state, effect, filter, and rail**

Replace the body of `DestinationsTab` so it matches:

```tsx
function DestinationsTab({ onOpenPlace }: { onOpenPlace: (slug: string) => void }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeFilter, setActiveFilter] = useState<PlaceFilterKey>(ALL_FILTER_KEY);

  useEffect(() => {
    let cancelled = false;
    fetchCategories('destination')
      .then((result) => {
        if (cancelled) return;
        setCategories(result);
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedFilter = categories.find((filter) => filter.key === activeFilter);
  const destinations =
    activeFilter !== ALL_FILTER_KEY && selectedFilter
      ? destinationMeta.filter((destination) => destination.travelStyles.includes(activeFilter))
      : destinationMeta;

  const filterOptions = [
    { key: ALL_FILTER_KEY, label: 'All' },
    ...categories.map((category) => ({ key: category.key, label: category.label })),
  ];

  return (
    <motion.div variants={tabPanelVariants} initial="initial" animate="animate" exit="exit">
      <motion.div variants={fadeUpItem}>
        <AppHeader title="Destinations" subtitle="Explore China" />
      </motion.div>
      {categories.length > 0 && (
        <motion.div variants={fadeUpItem}>
          <FilterRail options={filterOptions} value={activeFilter} onChange={setActiveFilter} />
        </motion.div>
      )}
      <motion.p className="iosapp-filter-summary" variants={fadeUpItem}>
        {destinations.length} place{destinations.length === 1 ? '' : 's'}
        {selectedFilter ? ` in ${selectedFilter.label}` : ''}
      </motion.p>
      <motion.div
        key={activeFilter}
        className="iosapp-card-list"
        variants={staggerListVariants}
        initial="initial"
        animate="animate"
      >
        {destinations.map((destination) => (
          <motion.div key={destination.slug} variants={listRowVariants} whileTap={tapScale}>
            <MobileDestinationListRow
              image={destination.image}
              name={destination.name}
              description={destination.description}
              onClick={() => onOpenPlace(destination.slug)}
            />
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}
```

Critical differences from current code:
- Initial state is `ALL_FILTER_KEY`, not `''`.
- Effect only calls `setCategories(result)` — **no** `setActiveFilter(... result[0]?.key ...)`.
- Filter applies only when `activeFilter !== ALL_FILTER_KEY && selectedFilter`.
- Rail options prepend All when categories exist.

- [ ] **Step 3: Smoke Destinations in browser**

Run (reuse healthy server on port 3000 if already up; otherwise from `app/`): `npm run dev`  
Open: `http://127.0.0.1:3000/#/china-trips` → Destinations tab.

Expected:
- With enabled destination categories and untagged places: **All** selected leftmost; list non-empty.
- Click a category: list shrinks to tagged only (or 0 if none tagged).
- Click **All**: full list returns.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/ChinaTripsMobile.tsx
git commit -m "fix: default Destinations filter to All when categories exist"
```

---

### Task 2: RoutesTab — mirror Destinations behavior

**Files:**
- Modify: `app/src/components/ChinaTripsMobile.tsx` (`RoutesTab` ~1165–1228)

**Interfaces:**
- Consumes: `ALL_FILTER_KEY` from Task 1, `fetchCategories('route')`, `routeTours`
- Produces: Routes tab matching Destinations filter UX

- [ ] **Step 1: Update RoutesTab**

Replace `RoutesTab` with:

```tsx
function RoutesTab({ onOpenRoute }: { onOpenRoute: (slug: string) => void }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeFilter, setActiveFilter] = useState<RouteFilterKey>(ALL_FILTER_KEY);

  useEffect(() => {
    let cancelled = false;
    fetchCategories('route')
      .then((result) => {
        if (cancelled) return;
        setCategories(result);
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedFilter = categories.find((filter) => filter.key === activeFilter);
  const filteredRoutes =
    activeFilter !== ALL_FILTER_KEY && selectedFilter
      ? routeTours.filter((tour) => tour.themes.includes(activeFilter))
      : routeTours;

  const filterOptions = [
    { key: ALL_FILTER_KEY, label: 'All' },
    ...categories.map((category) => ({ key: category.key, label: category.label })),
  ];

  return (
    <motion.div variants={tabPanelVariants} initial="initial" animate="animate" exit="exit">
      <motion.div variants={fadeUpItem}>
        <AppHeader title="Routes" subtitle="Existing route library" />
      </motion.div>
      {categories.length > 0 && (
        <motion.div variants={fadeUpItem}>
          <FilterRail options={filterOptions} value={activeFilter} onChange={setActiveFilter} />
        </motion.div>
      )}
      <motion.p className="iosapp-filter-summary" variants={fadeUpItem}>
        {filteredRoutes.length} route{filteredRoutes.length === 1 ? '' : 's'}
        {selectedFilter ? ` in ${selectedFilter.label}` : ''}
      </motion.p>
      <motion.div
        key={activeFilter}
        className="iosapp-card-list"
        variants={staggerListVariants}
        initial="initial"
        animate="animate"
      >
        {filteredRoutes.map((tour) => (
          <motion.div key={tour.slug} variants={listRowVariants} whileTap={tapScale}>
            <MobileRouteListCard
              image={tour.image}
              title={tour.title}
              meta={`${tour.category} · ${tour.duration} · ${tour.groupSize}`}
              onClick={() => onOpenRoute(tour.slug)}
            />
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}
```

Same critical rules as Destinations: no auto-select first category; All chip first; never pass `__all__` into `themes.includes`.

- [ ] **Step 2: Smoke Routes + edge case**

In the same browser session:
1. Routes tab: same All → category → All cycle as Destinations.
2. If you can temporarily have zero enabled route categories (or use a env without them): no rail; full route list still shows.

- [ ] **Step 3: build + lint**

```bash
cd app
npm run build
npm run lint
```

Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/ChinaTripsMobile.tsx
git commit -m "fix: default Routes filter to All when categories exist"
```

---

### Task 3: Plan + progress handoff (docs only)

**Files:**
- Already created: this plan file
- Modify: `docs/agent-progress.md` (brief note that implementation is ready / done when tasks complete)

- [ ] **Step 1: After Tasks 1–2 pass, update progress**

Record in `docs/agent-progress.md`: goal met, files changed, verification done (build/lint + browser All cycle), next = none / optional deploy.

- [ ] **Step 2: Commit docs if progress was updated**

```bash
git add docs/agent-progress.md docs/superpowers/plans/2026-07-18-category-filter-all-default.md
git commit -m "docs: category filter All default plan and progress"
```

(Skip committing the plan if it was already committed earlier; only add untracked/changed files.)

---

## Spec coverage self-check

| Spec requirement | Task |
|------------------|------|
| Default All when categories exist | Task 1, 2 |
| All chip leftmost | Task 1, 2 (`filterOptions`) |
| Select category filters by travelStyles/themes | Task 1, 2 |
| Select All restores full list | Task 1, 2 |
| No categories → no rail, full list | Task 1, 2 (unchanged gate `categories.length > 0`) |
| Sentinel `__all__` | Task 1 Step 1 |
| No auto-select `result[0]` | Task 1, 2 effects |
| Only ChinaTripsMobile | File map |
| build + lint | Task 2 Step 3 |
| Manual verification | Task 1 Step 3, Task 2 Step 2 |
| Non-goals (Admin, API, tests, Popular places) | Global Constraints — not implemented |
