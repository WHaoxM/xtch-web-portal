# Domain Module Layout (Single Backend, Multiple Shells)

Status: Accepted

Date: 2026-07-30

## Context

The portal is a single React + Vite app with collocated HTTP handlers under
`app/api/`. Payment, orders, catalog content, inquiries, and admin helpers have
grown as a flat `app/api/lib/` mix. The product will keep one backend for:

- Desktop web
- China Trips mobile web shell
- A future packaged APP shell that reuses the same `/api/*` contracts

Splitting into microservices would add deploy and consistency cost without
solving the main maintainability problem: unclear module boundaries.

## Decision

Adopt **one deployable backend process** with **domain modules**, plus
**presentation shells** on the frontend.

### Backend

```text
app/api/
  <route>.ts                 # Thin HTTP adapters; public paths stay stable
  admin/                     # Admin-facing adapters; call domain modules
  domains/
    booking/                 # Orders, inventory holds, checkout, providers, webhooks
    catalog/                 # Routes, destinations, departures, content queries (later)
    inquiry/                 # Lead / inquiry intake (later)
    identity/                # Traveler / admin auth helpers (later)
    media/                   # Object storage / media (later)
  platform/                  # db, email, shared HTTP utilities (no business rules)
  migrations/                # Shared migration stream; name/comment by domain
```

Phase 1 lands `domains/booking/`. Other domains follow in later phases.
Until a file moves, `app/api/lib/<name>.ts` may remain as a compatibility
re-export into `domains/booking/`.

### Phase 2.5 (2026-07-30)

- Remaining booking HTTP handlers live under `domains/booking/http/`:
  `orders`, `myOrders`, `claimOrders`, `adminOrdersHttp` (plus checkout/webhooks
  from Phase 1).
- Top-level `orders.ts`, `my-orders.ts`, `claim-orders.ts`, `admin/orders.ts`
  are thin re-exports only; public `/api/*` paths unchanged.
- `platform/email.ts` no longer imports booking modules. It defines a minimal
  `BookingConfirmationOrder` port type; callers in booking rotate access tokens
  via `buildOrderAccessUrl()` and pass `orderUrl` into
  `sendBookingConfirmationEmail`.
- Pure date normalization moved to `platform/dateFormat.ts`; booking
  `availability.ts` re-exports `formatDate` for compatibility.
- Shared `ActorType` lives in `platform/actorTypes.ts`; `auditLog` and
  `bookingSchema` import/re-export it so `platform/` does not depend on
  `domains/booking`.
- New code and non-shim API files should import `domains/*` / `platform/*`
  directly; `app/api/lib/*` remains a compatibility shim layer.

### Phase 2.6 (2026-07-30) — subfolder soft-cap

Soft guideline: **≤8 production source files per folder** (exclude
`*.test.ts`, `*.pg.integration.test.ts`, and barrel `index.ts`).

Booking internals:

```text
domains/booking/
  bookingSchema.ts, index.ts
  http/  payment/
  orders/      # orders, orderQueries, adminOrders
  inventory/   # availability, departureRefill
  checkout/    # checkoutPayload, checkoutRateLimit
  integrity/   # bookingIntegrity
  payment/     # stripe, payoneer, paymentProvider, webhook events
```

Catalog HTTP: `http/public/*` and `http/admin/*`.

Frontend catalog: `clients/`, `drafts/`, `data/`, `copy/` under
`app/src/domains/catalog/`. Compatibility shims under `app/api/lib/*` and
`app/src/lib/*` keep legacy import paths.

### Phase 2.7 (2026-07-30) — function visibility

Make capabilities findable by folder name (still **one** booking domain;
no top-level `domains/payment`):

- `booking/providers/` renamed to `booking/payment/` (Stripe/Payoneer +
  `paymentProvider` selector).
- Frontend booking aligned: `payment/`, `checkout/`, `orders/`, `policy/`.
- Identity: `admin/` + `traveler/` (+ `http/`).
- Inquiry FE: `clients/` + `copy/`; backend admin helper under `inquiry/admin/`.
- Function map lives in `docs/agent-context.md`.

### Phase 2.8 (2026-07-30) — API entry + lib noise

- `app/api/admin/` grouped into `auth|booking|catalog|inquiry|media`
  subfolders. Public URLs unchanged; `scripts/localApiRoutes.ts` maps
  `/api/admin/…` → nested files.
- Scripts and PG integration tests import `platform/*` / `domains/*`
  directly instead of `api/lib/*`.
- `app/api/lib/` remains thin shims + README; new code must not add logic
  there. Root `app/api/*.ts` stay as stable public route adapters.

### Frontend (Phase 3 landed)

```text
app/src/
  shells/desktop|china-trips-mobile|admin/
  domains/booking|catalog|inquiry|identity|media/
  shared/ui|lib|seo/
```

Phase 3 moves domain API clients from `app/src/lib/` into `domains/<domain>/`,
shared UI into `shared/ui/`, and presentation shells into `shells/*`. Public
pages remain mostly under `app/src/pages/` (except Admin → `shells/admin/`).

Compatibility shims keep legacy import paths working:

- `app/src/lib/*` → re-export from `domains/*` or `shared/lib/*`
- `app/src/lib/seo/*` → re-export from `shared/seo/*`
- `app/src/components/ui/*` → re-export from `shared/ui/*`
- `app/src/components/ChinaTripsMobile.tsx` → `shells/china-trips-mobile/`
- `app/src/pages/Admin.tsx` → `shells/admin/Admin.tsx`
- `app/src/components/{Navbar,Footer,Seo,ScrollToTop}.tsx` → `shells/desktop/components/`

Shells orchestrate UI only. Domain clients own API calls. The future APP should
wrap `shells/china-trips-mobile` (or its successor) and keep the same API base.

### Booking domain rules

These remain mandatory (see also ADR 0002):

1. Price and seat availability come from server departure records, not the browser.
2. Order confirmation comes from provider webhooks, not success-page navigation alone.
3. Stripe / Payoneer are **providers** inside booking, not a separate payment product
   database or service.
4. Do not put payment confirmation or inventory mutation logic in UI shells.

### Explicit non-goals

- No microservice split for payment or orders in this phase.
- No public URL renames as part of the move.
- No visual redesign or payment product rule changes while relocating files.

## Consequences

- Maintainers can find booking logic under one tree.
- Web, mobile web, and APP share one contract.
- Moves must keep `lib/` re-exports or update imports in the same change so
  `npm run build` / `npm run lint` stay green.
- Admin routes stay under `app/api/admin/*` but must import booking/catalog
  domain modules instead of duplicating order logic.
