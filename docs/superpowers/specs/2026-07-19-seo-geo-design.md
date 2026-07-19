# SEO + GEO Design — Syncing Travel Portal

**Status:** A → B → C approved; G1–G4 confirmed 2026-07-19 (`www.xuntingtravel.com`, About stats in AI briefs, Playwright prerender OK, GPTBot allow)  
**Stack:** Vite React SPA, today `HashRouter`, Node `deploy:serve` + Caddy  
**Sources absorbed (mechanisms only):** Ahrefs GEO / Brand Radar, Lily Ray (AI citations ↔ organic), Semrush AI Overviews, SPA crawl guidance, llms.txt community practice — rewritten for this repo.

---

## 0. Goals / Non-goals

### Goals

1. **Indexable multi-page presence** — Google/Bing can discover unique URLs for destinations, routes, guides, about, cost, contact.
2. **AI-citable entity** — ChatGPT / Perplexity / Gemini / AI Overviews can retrieve accurate brand facts and quote self-contained passages.
3. **No fake authority** — every public claim stays within `CONTEXT.md` / existing on-page facts; no invented reviews, prices, or team bios.
4. **One composition system** — SEO/GEO is a shared module + content packs, not ad-hoc meta strings per page.

### Non-goals

- Rewriting the site to Next.js / full SSR framework (unless later gated).
- Buying links, fake Reddit spam, or AI-generated keyword stuffing.
- Ranking for every China-travel keyword in year one.
- Indexing transactional shells (`/admin`, `/account`, `/auth/*`, `/orders/*`).

---

## 1. Diagnosis (evidence)

| Layer | Current state | Impact |
|---|---|---|
| Routing | `HashRouter` in `app/src/main.tsx` | Crawlers treat `#/…` as one URL (`/`) |
| Rendering | CSR only; `Seo.tsx` mutates `<head>` in `useEffect` | Many AI bots never see route meta/body |
| Domain | Brand/SEO assets = `syncingtravel.com`; Caddy = `xuntingtravel.com` | Split entity signal |
| Route slug bug | Sitemap/`Seo` use `/china-tours`; app route is `/china-trips` | Wrong meta + dead GEO links |
| Coverage | No per-page SEO for `/destinations/:slug`, `/tours/:slug`, `/travel-guide/:slug` | Thin indexation even after B |
| Sitemap | Missing featured-services, guides, tour-cost, tours | Crawl budget wasted on incomplete map |
| GEO files | `llms.txt` / `ai-summary.json` exist but hash-deep and non-spec | Weak AI brief |
| Content | Strong destination/guide/about copy already exists | Under-leveraged for citation |
| FAQ | `TourCost` + generic `RouteDetail` FAQs exist; Guide/About/Home lack FAQ | FAQPage schema mostly unused |

**Assumption (Phase A default):** public canonical origin = `https://www.xuntingtravel.com` (matches Caddy). Brand display name stays **Syncing Travel**. Email may remain `@syncingtravel.com`. If `syncingtravel.com` still receives traffic, ops must 301 → www.xuntingtravel.com (separate gate).

---

## 2. Information architecture (indexable surface)

### 2.1 Index (allow)

| Priority | Path (post-B) | Content owner | Intent |
|---|---|---|---|
| P0 | `/` | Home | Brand + private China tours |
| P0 | `/china-trips` | ChinaTours | Product hub (fix alias `/china-tours`) |
| P0 | `/destinations` | Destinations | Destination hub |
| P0 | `/destinations/{slug}` ×12 | DestinationDetail | Destination authority |
| P0 | `/tours/{slug}` | RouteDetail | Product/itinerary |
| P0 | `/custom-trip` | CustomTrip | Commercial conversion |
| P0 | `/travel-guide` | TravelGuide | Informational hub |
| P0 | `/travel-guide/{slug}` ×3 | GuideArticle | Long-tail answers |
| P0 | `/china-private-tour-cost` | TourCost | Commercial + FAQ |
| P0 | `/about` | About | Entity / E-E-A-T |
| P1 | `/featured-services` | FeaturedServices | Proof / stories |
| P1 | `/contact` | Contact | NAP + inquiry |
| P2 | `/privacy-policy` | PrivacyPolicy | Trust (low priority) |

### 2.2 Noindex (disallow indexing; may allow crawl of assets)

`/admin`, `/account`, `/auth/*`, `/orders/*`, `/search` (utility; prefer `noindex,follow` so internal links still pass).

### 2.3 Alias policy

- Keep **one** public product hub path: `/china-trips`.
- Add redirect/alias `/china-tours` → `/china-trips` in Phase B (history mode).
- Until B ships, all static GEO files use `/#/china-trips` (not `china-tours`).

---

## 3. Shared SEO/GEO system (architecture)

New module (Phase A scaffold, B flips URL mode):

```text
app/src/lib/seo/
  siteOrigin.ts        # canonical origin from brand / build-time public URL
  routeMeta.ts         # static + dynamic meta resolvers
  faqPacks.ts          # page FAQ packs (visible copy + schema source of truth)
  jsonLd.ts            # Organization / WebSite / WebPage / FAQPage / Breadcrumb / TouristTrip builders
  robotsPolicy.ts      # helpers for robots meta per route class
app/src/components/Seo.tsx   # consumes resolvers; injects head + JSON-LD
app/public/
  robots.txt
  sitemap.xml            # Phase A: hash URLs; Phase B: path URLs (+ later build-generated)
  llms.txt
  ai-summary.json
```

**Rules**

1. Visible FAQ text and `FAQPage` JSON-LD **must share the same array** (`faqPacks.ts`). Never schema-only FAQs.
2. Dynamic meta for destination/tour/guide must use real titles/descriptions from content, truncated to ~155 chars for description.
3. Organization `sameAs` stays the verified social profiles already in `index.html`.
4. Do not invent AggregateRating / Review schema without real review data.

---

## 4. Phase A — Technical foundation (pre-routing migration)

**Goal:** fix entity consistency, crawl signals, meta coverage, and GEO briefs **without** changing router yet.

### A1. Canonical domain + brand URL single source

| File | Change |
|---|---|
| `app/src/lib/siteData.ts` | `brand.website` → `https://www.xuntingtravel.com/` |
| `app/index.html` | canonical, og:url, og:image, twitter:image, JSON-LD `url` |
| `app/public/sitemap.xml` | host + fix `/china-trips`; add missing URLs |
| `app/public/llms.txt` | host + curated structure |
| `app/public/ai-summary.json` | host + paths |
| `app/public/robots.txt` | host + AI bot policy |
| `app/api/lib/email.ts` | fallback base → www.xuntingtravel.com |

**Still hash URLs** in sitemap/llms until Phase B.

### A2. `robots.txt` (refined)

```txt
# Syncing Travel — crawl policy
User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/

# Citation / answer retrieval — allow
User-agent: OAI-SearchBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: Google-Extended
Allow: /

# Training crawl — allow for inbound tourism brand visibility (revisit if policy changes)
User-agent: GPTBot
Allow: /

Sitemap: https://www.xuntingtravel.com/sitemap.xml
LLMS: https://www.xuntingtravel.com/llms.txt
AI-Summary: https://www.xuntingtravel.com/ai-summary.json
```

Note: HashRouter means Disallow path prefixes mainly affect non-hash path requests and API; full path control arrives in B.

### A3. Sitemap inventory (Phase A hash form)

Include at least:

- `/`, `/#/china-trips`, `/#/destinations`, 12× `/#/destinations/{slug}`
- `/#/custom-trip`, `/#/travel-guide`, 3× guide articles
- `/#/china-private-tour-cost`, `/#/featured-services`, `/#/about`, `/#/contact`, `/#/privacy-policy`
- **Omit** `/#/search`, admin, account, orders
- **Optional later:** `/#/tours/{slug}` once we have a stable published slug list at build time (prefer generate in B from content API/backup)

Priorities: home 1.0, china-trips/custom-trip 0.9, destinations + cost 0.8, guides/about 0.7, privacy 0.3.

### A4. `llms.txt` (spec-shaped, curated)

Structure:

1. H1 brand name  
2. Blockquote one-sentence entity definition  
3. H2 About — legal name, China-based inbound, contact  
4. H2 Primary services  
5. H2 Destinations (links)  
6. H2 Planning guides (links)  
7. H2 Key product pages  
8. H2 Citation-ready facts (short bullets AI may quote)  
9. Link to `ai-summary.json`

**Citation-ready facts** (must match on-site truth; tighten if About stats need gate):

- Syncing Travel is a China-based inbound travel brand of Sichuan Xunting Chuhai Technology Co., Ltd.
- Focus: private China tours, small-group / fixed-departure group tours, custom itinerary planning.
- Operates with a China-based team (guides, consultancy, itinerary design).
- Contact: email + WhatsApp/phone already public on site.
- Response promise: inquiry reply within 24 hours (existing product language).

About page stats (`60K+`, `50+`, `15 years`) may be echoed **only if** product owner confirms they remain accurate — otherwise omit from llms/AI summary until confirmed (**content fact gate**).

### A5. `Seo.tsx` upgrade (still client-side)

Resolvers:

| Route pattern | Title pattern | Description pattern |
|---|---|---|
| `/` | Syncing Travel \| Private China Tours & Custom Trips | existing refined |
| `/china-trips` | China Trips & Real Route Products \| Syncing Travel | browse private + group routes… |
| `/destinations` | Top China Destinations \| Syncing Travel | existing |
| `/destinations/:slug` | `{Name} Travel Guide & Tours \| Syncing Travel` | from overview first ~155 chars |
| `/tours/:slug` | `{Title} \| Syncing Travel` | from `desc` |
| `/travel-guide` | China Travel Guide \| Syncing Travel | existing |
| `/travel-guide/:slug` | `{Article.title} \| Syncing Travel` | from summary |
| `/china-private-tour-cost` | Private China Tour Cost \| Syncing Travel | quote drivers… |
| `/about`, `/contact`, `/featured-services`, `/custom-trip`, `/privacy-policy` | dedicated | dedicated |
| private routes | — | `noindex, nofollow` |

JSON-LD graph per page:

- Always: `TravelAgency` Organization + `WebSite` + `WebPage`
- When FAQs present: `FAQPage`
- Destination/tour: `BreadcrumbList`
- Tour detail: `TouristTrip` (or `Product` only if price is real — prefer TouristTrip without fake offers)
- ItemList on hubs: link to **tour detail URLs**, not `custom-trip?tour=`

### A6. Wire FAQ schema where UI already exists

| Page | Action |
|---|---|
| `TourCost` | Move FAQs → `faqPacks.tourCost`; inject FAQPage via Seo |
| `RouteDetail` | Move `routeFaqs` → `faqPacks.routeGeneric` (+ later per-route packs); inject FAQPage |

Do **not** add fake FAQ UI in A just for schema. New FAQ sections belong to Phase C with designed copy.

### A7. Bugfixes bundled with A

- `TourCost` CTA `secondaryTo="/china-tours"` → `/china-trips`
- Any remaining `/china-tours` public links → `/china-trips`
- Email fallback host alignment

### A8. Phase A verification

```text
1. View-source / curl index.html → domain + Organization url = www.xuntingtravel.com
2. robots.txt / sitemap.xml / llms.txt / ai-summary.json served from dist
3. Client navigation: /#/china-trips title ≠ home title
4. /#/destinations/beijing title includes Beijing
5. /#/china-private-tour-cost JSON-LD includes FAQPage matching visible questions
6. /#/admin robots meta = noindex
7. npm run build && npm run lint
```

---

## 5. Phase B — Crawlable URLs + HTML for bots

**Goal:** each public page has a path URL and bots receive meaningful HTML.

### B1. Router migration

1. `HashRouter` → `BrowserRouter` in `main.tsx`.
2. Introduce path helpers: `toAppPath('/china-trips')` → `/china-trips` (no `#`).
3. Update systematically:
   - `authClient.ts` (`/#/auth/callback` → `/auth/callback`; `auth_next` stays path)
   - Stripe success/cancel env examples + runtime URLs
   - Order email links
   - `orderClient` paste-link parser (support both hash legacy and path)
   - `Seo` canonicals, SearchAction, ItemList
   - Docs/gotchas/ops Redirect URL lists
4. **Legacy hash compatibility:** on boot, if `location.hash` matches `#/…`, `replace` to path equivalent so old emails/bookmarks work.
5. Alias: `/china-tours` → `/china-trips` (`Navigate` or server 301).

### B2. Server fallback (already mostly OK)

`serve-selfhost.mjs` already falls back to `index.html` for unknown GETs. After B:

- Keep SPA fallback for app routes.
- Ensure real files (`/sitemap.xml`, `/llms.txt`, assets) still win.
- Return true 404 HTML status for unknown paths if feasible (soft-404 reduction) — stretch goal; minimum is client NotFound page + `noindex`.

### B3. Prerender strategy (refined, not “empty shells”)

**Chosen approach (minimal new architecture):** build-time prerender of **public marketing routes** into static HTML snapshots under `dist/<target>/`, while app remains CSR for users.

Recommended implementation path:

1. After `vite build`, run a Node prerender script (Playwright or Puppeteer — **new dependency → gate**).
2. Script visits each URL in `prerenderRoutes.json` (generated from static lists + optional content API).
3. Waits for `document.title` + main content selector (e.g. `[data-seo-ready]`).
4. Writes `destinations/beijing/index.html` style output **or** flat files with server rewrite map.
5. `Seo` sets `data-seo-ready` when meta+content hydrated.

**Prerender route set (minimum):**

- All P0 paths in §2.1 except dynamic `/tours/{slug}` until slug list is generated from DB/backup at build.
- Destination 12 slugs (static keys in `DestinationDetail`).
- Guide 3 slugs (from `guideArticles`).

**Alternative if dependency gate rejected:** hand-authored static HTML “AI briefs” only for `/`, `/about`, `/travel-guide` (weaker; not preferred).

### B4. Sitemap / llms flip to path URLs

Regenerate without `#`. Prefer build script that emits `sitemap.xml` from the same route list as prerender.

### B5. Supabase / Stripe ops checklist

- Redirect URLs: `https://www.xuntingtravel.com/auth/callback`, wildcards as needed
- Site URL: origin root (unchanged principle)
- Stripe success/cancel: path URLs
- Rebuild + restart `deploy:serve`

### B6. Phase B verification

```text
1. curl -I https://www…/destinations/beijing → 200, HTML contains “Beijing” in body (prerender)
2. curl https://www…/sitemap.xml → no `#`
3. Old link /#/custom-trip → redirects to /custom-trip
4. Auth magic link / OTP still lands correctly
5. Stripe return still restores Mini-App state
6. Google Rich Results Test on /china-private-tour-cost and /about
7. build + lint
```

---

## 6. Phase C — Citation-grade content (refined packs)

**Principle:** answer-first blocks, question H2s, FAQ packs shared with schema, no fluff stats without confirmation.

### C1. Page content packs

#### C1.1 Home — entity TL;DR (above fold below hero brand message)

Add a compact **“What Syncing Travel does”** block (not a second hero):

- 40–60 word definition (inbound, China-based, private + group + custom).
- 3 bullets: plan with local team / real route products / on-trip support.
- Soft CTA to `/china-trips` and `/custom-trip`.

Do **not** stuff stats into hero. Stats stay in About unless confirmed for home.

#### C1.2 Travel Guide hub — topic → FAQ + answer leads

Convert 7 topic cards from orphan blurbs into:

1. Keep cards as navigation.
2. Add section **“Common China travel questions”** with FAQ pack below (6–8 Qs).
3. Each planning article gets answer-first lead paragraph (rewrite openings in `guideArticles`).

**Guide hub FAQ pack (draft — grounded in existing topic copy):**

| Question | Answer (≤70 words) |
|---|---|
| Do I need a visa to visit China? | Most travelers need a Chinese visa or an eligible visa-free/transit policy. Rules depend on nationality, passport validity, arrival city, and stay length. Confirm entry type before locking flights; start with our visa & entry guide. |
| Is China cashless for visitors? | Large cities are highly mobile-payment oriented. Prepare Alipay or WeChat Pay when possible, keep a backup card, and carry some cash for small shops or remote areas. |
| What is the best way to travel between cities? | China’s high-speed rail is often the most practical backbone for classic routes. Pair trains with private transfers or DiDi in cities; long scenic regions may need flights or private vehicles. |
| Can I use Google and WhatsApp in China? | Many Western apps are unreliable without advance connectivity planning. Arrange a local SIM/eSIM and connectivity approach before arrival if you need WhatsApp, Google, or familiar maps. |
| When is the best time to visit China? | April–June and September–November are the safest defaults for classic cities. Northwest, plateau, and western Sichuan routes need tighter seasonal matching. |
| Is China safe for first-time visitors? | China is generally very safe for travelers. Bring prescription medicines you need and consider travel insurance; private local support helps with tickets, language, and day-of changes. |
| Should I plan a private tour or a group departure? | Choose a guaranteed fixed-departure group seat when dates and route are fixed online; choose private/custom when you need flexible pacing, hotels, or a tailored route. |
| How fast do you reply to inquiries? | Syncing Travel reviews trip inquiries and aims to reply within 24 hours with practical next steps. |

#### C1.3 Guide articles — answer-first rewrite pattern

For each of the 3 articles, restructure to:

```text
H1 title
Lead answer (40–80 words) — direct answer to the article question
H2 section (keep 3) — each starts with 1–2 sentence claim, then detail
Closing CTA → /custom-trip or /china-trips
Optional 3 FAQ mini-pack unique to article
```

**Article-specific FAQ examples:**

`china-visa-entry-basics`

- What should I confirm before buying flights?
- Which cities work well as arrival gateways?
- Why must passport names match bookings?

`mobile-payments-in-china`

- Should I set up Alipay before I fly?
- Will my foreign card work everywhere?
- What backup should I carry?

`best-time-to-visit-china`

- Are spring and autumn always best?
- When should I avoid major holidays?
- How do western routes differ seasonally?

#### C1.4 About — entity page for GEO

Add after mission (or before Why Choose Us):

1. **Direct entity paragraph** (who / where / for whom / what).
2. **FAQ pack (5):**

| Question | Answer |
|---|---|
| What is Syncing Travel? | Syncing Travel is the inbound travel brand of Sichuan Xunting Chuhai Technology Co., Ltd., creating private and group-tour China journeys for international travelers with a China-based team. |
| Are you based in China? | Yes. The operating team is China-based, with tour guides, travel consultants, and itinerary designers supporting planning and on-trip coordination. |
| Do you only sell group tours? | No. Travelers can browse real route products, join selected fixed departures where offered, or request a fully private custom itinerary. |
| Who is Syncing Travel for? | International travelers who want clearer pacing, local coordination, and China routes that balance iconic sights with practical day-by-day support. |
| How do I start? | Browse China Trips for route products, or send dates, group size, and destinations through the custom trip request form. |

3. Stats block: keep UI, but **llms/AI summary only include stats after user confirmation**.

#### C1.5 Destination detail — citation template

For each slug, keep existing overview/why/top/best/tips; add:

1. **Lead answer** under H1: “{Name} is best for … / travelers should plan …”（derived from overview+whyVisit, 40–70 words）.
2. **FAQ pack (4)** generated from content fields (template, not generic fluff):

| Question template | Answer source |
|---|---|
| Why visit {Name}? | `whyVisit` |
| What are the top things to do in {Name}? | join `topThings` |
| When is the best time to visit {Name}? | `bestTime` |
| How should I plan {Name} in a China itinerary? | synthesize `tips` + overview (editor-reviewed) |

Implement via `buildDestinationFaq(slug, content)` so schema === UI.

#### C1.6 Route detail — replace generic FAQ with route-aware pack

Keep 4 slots but bind answers to route fields:

1. Who is this route for? → themes / primaryType / duration  
2. Private vs group on this route? → availableTypes / departures language  
3. Can it be customized? → always yes for private inquiry path  
4. How to book / inquire? → fixed departure checkout vs custom-trip

Fallback to current generic copy only when fields missing.

#### C1.7 Custom Trip + Contact — short trust FAQs (3 each)

Custom: what to prepare / response time / private vs group.  
Contact: channels / what happens after submit / WhatsApp vs form.

### C2. Internal linking graph

| From | To |
|---|---|
| Guide topics / FAQs | matching guide articles, custom-trip, china-trips |
| Destination FAQs | related `/tours/{slug}`, custom-trip |
| Tour FAQs | destination pages, cost page, custom-trip |
| Cost page | china-trips + custom-trip |
| About FAQs | china-trips + custom-trip + contact |

Use descriptive anchors (“Beijing private tour routes”), not “click here”.

### C3. Off-site GEO playbook (ops, not code)

Weekly cadence (owner: marketing/ops):

1. **X (Twitter):** 3–5 helpful China-travel posts/week using brand name naturally; link 1 pillar URL max. Grok reads X heavily.
2. **YouTube / TikTok / Instagram:** already in `sameAs` — add video descriptions with entity sentence + path URL (post-B).
3. **Reddit:** answer real questions in r/travel, r/China, r/solotravel etc.; no dump links; earn mentions.
4. **Prompt monitoring:** monthly check 10 buyer prompts in ChatGPT/Perplexity/Gemini (e.g. “private China tour company based in China”, “Syncing Travel reviews”, destination+private tour). Log Share-of-Model manually in a sheet.
5. **Google Search Console** on www.xuntingtravel.com after B; submit sitemap.

### C4. Phase C verification

```text
1. Each P0 page has visible FAQ or answer-first lead where specified
2. Rich Results Test: FAQPage valid on Guide hub, About, Cost, sample Destination, sample Tour
3. llms.txt facts ⊆ on-page visible text
4. No new unverifiable stats
5. Mobile 320/375/390: new FAQ blocks don’t overflow
6. build + lint
```

---

## 7. Prompt set for GEO measurement (manual)

Use the same 12 prompts monthly:

1. Best private China tour company for first-time visitors  
2. China-based inbound travel agency for custom itinerary  
3. Syncing Travel China tours  
4. Private Beijing and Great Wall tour planner  
5. Yunnan Lijiang Dali Shangri-La private tour  
6. Xinjiang northern loop tour with local team  
7. Do foreigners need Alipay in China  
8. Best time to visit western Sichuan  
9. China private tour cost what affects price  
10. Fixed departure group tours in China vs private  
11. Sichuan Xunting Chuhai Technology travel brand  
12. Custom China trip planning WhatsApp English-speaking team  

Record: mentioned? / cited URL? / accurate?

---

## 8. Decision gates (must confirm before / during)

| # | Gate | Default if silent | Blocks |
|---|---|---|---|
| G1 | Canonical domain = `www.xuntingtravel.com`? | **Confirmed yes** | A1 |
| G2 | Publish About stats (60K / 50+ / 15y) into llms + AI answers? | **Confirmed yes** | A4 / C1.4 |
| G3 | Prerender via Playwright/Puppeteer (new dependency)? | **Confirmed allow** | B3 |
| G4 | Allow GPTBot training crawl? | **Confirmed allow** | A2 |
| G5 | 301 syncingtravel.com → xuntingtravel.com? | Ops outside repo | entity consolidation |

---

## 9. Delivery sequence

| Phase | Deliverables | Est. risk |
|---|---|---|
| **A** | Design (this doc) + domain/SEO module + robots/sitemap/llms + Seo dynamic meta + FAQ schema on existing FAQ UIs + china-trips fixes | Low–med |
| **B** | BrowserRouter + hash legacy redirect + URL rewrites + prerender + path sitemap + auth/stripe/email updates | High (auth/checkout) |
| **C** | Content packs + destination/guide/about/home FAQs + internal links + off-site playbook | Med (content quality) |

---

## 10. File ownership (for task board)

**Owns (SEO/GEO agent):**

- `docs/superpowers/specs/2026-07-19-seo-geo-design.md`
- `app/src/lib/seo/**`
- `app/src/components/Seo.tsx`
- `app/public/robots.txt`, `sitemap.xml`, `llms.txt`, `ai-summary.json`
- `app/index.html` (meta/JSON-LD only)
- Content touch in Phase C: `TravelGuide.tsx`, `GuideArticle.tsx`, `About.tsx`, `DestinationDetail.tsx`, `RouteDetail.tsx`, `TourCost.tsx`, `Home.tsx` (SEO blocks only), `siteData.ts` (guide leads + brand.website)

**May touch:** `authClient.ts`, email/checkout URL builders, `serve-selfhost.mjs`, env examples, gotchas/ops docs, `main.tsx`, `App.tsx` (alias routes)

**Must not touch:** payment/refund logic, Admin panels, production DB content inventing, aesthetic redesign of marketing pages beyond FAQ/answer blocks

---

## 11. Open questions for user (short)

1. Confirm **G1** canonical host.  
2. Confirm **G2** About stats for AI briefs.  
3. Confirm **G3** Playwright prerender dependency for Phase B.  
4. Any destination/route pages that must stay **noindex** (thin/draft)?
