# China Trips Mobile Design Context

This file is the working design contract for `app/src/components/ChinaTripsMobile.tsx` and `app/src/components/chinaTripsMobile.css`.

## Product Definition

- Audience: foreign travelers planning China trips in English.
- Platform feel: iOS app / mini app, not a responsive marketing webpage.
- On ≤900px `/china-trips`, do **not** show the marketing site Navbar (logo + hamburger) or Footer. Chrome is omitted in `App.tsx` and reinforced with CSS (`china-trips-miniapp-nav` / `body:has(.china-trips-mobile-page)`). In-app navigation is the bottom tab bar plus screen headers (AppHeader / back), not the website nav.
- Top-level tabs: Home, Places, Routes, Custom, Me.
- Custom private trip planning is the primary Home-screen business goal.
- Group tour reserve is a supporting path, not the primary Home-screen story and not a top-level tab. It appears on Home and can be reviewed from Me.
- Reserve flow: choose destination first, then choose an existing route, then verify email/sign in, then continue to Stripe Checkout for **full payment** on a guaranteed fixed departure (not a `$100` deposit).
- Final balance is confirmed at checkout for sellable fixed departures; do not use deposit-only language on route booking CTAs.
- Route selection is structured only. Do not allow arbitrary custom route text in the group tour reserve flow.
- Route detail booking card has two CTAs:
  - **Join a group tour**: open `groupRequest` filtered to that route’s sellable departures. If none exist, open the route-based private short form with a short explanation.
  - **Plan private trip**: open `routePrivateRequest` (“Private trip based on this route”) — core fields (dates, travelers, contact, optional change notes) + preference fields Admin marks **用于路线私人短表单** (`useOnRoutePrivate`). Submit as `type: route_private` with `requestedTour`. Do **not** send this CTA into the blank Custom tab form.
- Custom tab remains the blank **Custom Trip Request** path (from-scratch private planning).

## Reference Lessons

- Apple HIG: use familiar navigation structures so users understand where they are. A tab bar is for top-level app sections, not one-off actions. Keep hit targets comfortable and respect safe areas.
- Apple HIG / Sign in with Apple: social login buttons must be prominent and not smaller than other login methods. For this product order, use Google first, Email second, Apple third.
- Muzli iOS examples: real mobile travel and event apps use search-first discovery, confident imagery, compact category chips, and clear product cards. They avoid treating the home page like a settings page.
- Vercel Geist: use semantic color layers, restrained contrast, and reusable primitives. Background, border, active, secondary text, and primary text should be tokenized.
- components.build: modern UI components should be composable, accessible, themable, lightweight, transparent, and documented.
- Vercel Commerce: product discovery is driven by clear search, structured product data, stable image ratios, and reusable product-card/list primitives.

Reference URLs:

- https://developer.apple.com/design/human-interface-guidelines/tab-bars
- https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple
- https://developer.apple.com/design/human-interface-guidelines/sf-symbols
- https://muz.li/inspiration/ios-app-examples/
- https://www.components.build/principles
- https://www.components.build/design-tokens
- https://vercel.com/geist/colors
- https://vercel.com/geist/grid
- https://github.com/vercel/commerce

## Home Screen Rules

- Home must start with custom-trip intent: large title, search, then a clear private custom trip module.
- After custom, Home shows one group tour **module container card** (not a separate Popular section, not a single-product card). Admin controls which departures appear via existing `featured_on_home` + `featured_priority`.
- Dual states for that card:
  - **Has featured** (max 2 rows): kicker `Popular group tours`, title `Join a featured departure`, no body paragraph; each row shows thumbnail · route name · dates · price · seats left; row opens `featuredGroupDetail`; bottom CTA `Find another departure` opens `groupRequest`.
  - **No featured / empty**: kicker `Group tour`, title `Join a group tour`, keep the existing short explanation; bottom CTA `Book a group tour` opens `groupRequest`. Do not show fake Popular copy.
  - **Loading**: keep the card shell + Users icon and show `Loading featured...`; do not flash an empty Popular list.
- Destinations and existing routes form the middle discovery layer after those two booking choices.
- Recommended routes must not be horizontally clipped. If a card extends off-screen, it must be an intentional carousel with visible snap behavior; otherwise use full-width stacked cards.
- Destination cards need stable image aspect ratios and readable overlays.
- Home bottom (after Browse routes) is **Real Moments**: a single horizontal snap carousel of real Syncing traveler/place photos (same asset family as desktop Home Real Moments: `public/images/syncing-real-*`). Cards are **full content-width** (one complete photo per snap — no right-edge peek strip). Cards open a fullscreen lightbox (title + place, close returns to Home; optional prev/next). Do **not** navigate to destinations, routes, or external links from Moments. No marquee and no long traveler-story cards. Do not use placeholders or invent photos.
- Home search stays inside the Mini-App: submit opens an in-app `searchResults` view (destinations + routes matching title/slug/keywords). Do **not** navigate to desktop `/search`. Opening a result goes to place/route detail and back returns to the results view.
- Do not use generic placeholder illustrations, decorative blobs, or synthetic icon art.

## Bottom Tab Bar Rules

- Tabs are only for Home, Places, Routes, Custom, Me.
- Do not put reserve request, payment, WhatsApp, or any primary CTA in the tab bar.
- Use existing icon resources: `lucide-react` in this web app, SF Symbols only as conceptual iOS reference.
- Tab bar must be fixed, light, translucent, safe-area aware, and at least 44px touch height per item.
- Active state should use one clear accent, not a large floating pill.
- Verify labels fit at 320px, 375px, and 390px widths.

## Auth Rules

- Sign-in screen is a full-screen auth gate before payment.
- Provider order: Google, Email, Apple.
- Do not hand-draw provider logos. Use existing logo assets or library icons.
- Email input must support `type="email"`, `inputMode="email"`, and `autoComplete="email"`.
- Auth copy must explain why sign-in is needed: verification before deposit and future request/receipt access.
- Real auth is handled through Supabase Auth. Google and Apple use OAuth redirects; Email uses a magic link.
- Required env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and optional `VITE_AUTH_REDIRECT_URL`.
- Do not simulate sign-in by setting local UI state only. If Supabase is not configured, show a visible auth error.

## Checkout Rules

- Use a full-screen iOS grouped form visual language: **one** confirmation sheet (`iosapp-checkout-review`), not stacked marketing cards with nested white blocks.
- Hero anchors the trip: destination kicker + route title + date range; availability/spots as compact meta under the hero — not as key-value rows.
- Below the hero: Travelers rows, then Payment rows. Emphasize **Total due today** (larger type / tabular nums). Cancellation/refund copy is a footnote under total, never a right-column value that wraps against a short label.
- Stripe trust is one compact row inside the same sheet, not a separate card.
- Do not collect card fields locally. The app should communicate that card details are entered on Stripe Checkout.
- Primary CTA text: `Pay full amount` (guaranteed fixed departure = full payment, not deposit-only language).
- On the group tour booking form, every adult must provide a full name and self-report exactly `male` or `female`; never infer gender from a name. These values travel in the checkout payload and are stored only in the private order traveler snapshot. Checkout cancel/auth draft recovery must preserve both fields and keep the existing indexed error focus/ARIA behavior.
- The public joined roster is aggregate-only: expose counts for `male`, `female`, `unknown`, and `total`, never traveler names, emails, order numbers, or a per-traveler array. Count only orders in `confirmed` or `cancellation_requested`; exclude pending-payment orders and active inventory holds. Historical traveler snapshots without gender contribute to `unknown` and must never be backfilled or guessed.
- Roster `total` means confirmed travelers and is intentionally different from `capacity - available_seats`, because availability also subtracts unexpired checkout holds. Keep the remaining-seat label and explain this distinction in UI copy.
- Anonymous roster avatars use one stable color per reported gender and gray for `unknown`. Color is never the only signal: include a visible text legend with counts and an aggregate `aria-label`. Show this roster **only** for `group-tour` or `fixed-departure`, not private/customizable-only routes or route-private inquiry.

## Payment Return Rules

- Stripe success returns **inside** the Mini-App, not to the desktop order page. Default `success_url` (and dev bypass `checkoutUrl`) is `/#/china-trips?checkout=success&order={orderNumber}&session_id={CHECKOUT_SESSION_ID}` (`app/api/checkout-session.ts`).
- On mount, `ChinaTripsMobile` reads `checkout=success` + `order` + `session_id`, switches to the `bookingConfirmed` view, then strips those query params (`replaceState`) so a refresh does not re-open the success layer.
- The success view resolves the order via `fetchOrderSummary(orderNumber, undefined, sessionId)` and polls (5s, up to 12 attempts) until `status === 'confirmed'`, showing a "Payment processing" state while the webhook is pending.
- Dates on both this view and `OrderSuccess` use the shared `formatOrderDateRange` (`app/src/lib/orderClient.ts`); never render raw ISO `start_date` / `end_date`.
- Success view CTAs: **primary** `Add traveler details` is disabled (`Coming soon — we'll email you a secure link`); **secondary** `Back to China Trips` returns to the Home tab. Do not build a half-finished traveler-details form here (ADR 0002 second version).
- Email confirmation links still open the durable `/#/orders/{orderNumber}?token=...` page (`OrderSuccess`); keep its copy aligned with the Mini-App Coming soon wording.
- Confirmation email footnote uses `confirmation_email_status`: `sent` → "has been sent"; `pending`/`retrying` → "on its way"; `failed` → do not claim it was sent. Local `INQUIRY_EMAIL_MODE=console` / `BOOKING_EMAIL_MODE=console` still marks status `sent` but only prints a terminal preview — empty inbox is expected (see `app/.env.local.example`).

## Me / Orders Rules

- Me → **My Orders** stays inside the Mini-App (`myOrders` view). Do **not** `navigate('/account')` or open the desktop Account page from China Trips.
- Me and tab headers expose a light exit to the portal homepage: AppHeader brand **Syncing Travel** and Me **Back to website** both link to `/`. Booking flows stay in-app; this is not a primary CTA.
- Homepage Curated “View Itinerary” on mobile opens `/#/china-trips?route={slug}` which clears the query and opens that route detail. Desktop Curated links go to `/tours/{slug}`.
- List loads via `fetchMyOrders` (`/api/my-orders` + Bearer token). Empty state CTA **Explore trips** returns to the Home tab.
- Opening a list row shows order details in-app (`bookingConfirmed` with `mode: 'detail'`); Back returns to `myOrders`, not Home.
- Desktop `/#/account` remains for non–Mini-App entry points (bookmarks, future desktop nav); do not delete it as part of this rule.

## Agent Self-Review Before Editing

Before modifying this mobile UI, answer these questions in your own analysis:

1. Is this screen acting like the correct iOS pattern: discovery, list, form, auth gate, checkout, or settings?
2. Did I accidentally turn a travel product page into a settings page or landing page?
3. Does every row/card have a stable grid where title, metadata, image, and chevron cannot squeeze each other?
4. Are the tab bar items true top-level sections, and is the selected state subtle?
5. Can a foreign traveler understand the next action without reading Chinese or internal business terms?

## Required Verification

- Use the in-app Browser automation for local visual QA when available.
- Verify `http://127.0.0.1:3000/#/china-trips` at 320px, 375px, and 390px mobile widths.
- Check `document.documentElement.scrollWidth <= document.documentElement.clientWidth`.
- Measure key cards and rows: no title, subtitle, CTA, or chevron may occupy an unintended 18px/24px column.
- Capture or inspect Home, Me signed out, Sign in, Reserve request, and Deposit screens before declaring the UI done.
