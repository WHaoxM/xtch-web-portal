# Fixed Departure Online Booking Implementation Plan

Source ADR: `docs/adr/0002-fixed-departure-small-group-online-booking.md`

Status: draft for review

## Purpose

This plan turns the accepted fixed-departure small-group booking ADR into
independently implementable issues and a first-pass database model.

The plan deliberately avoids inventing transaction facts. A departure can only
be exposed for checkout when operations has supplied route name, dates, meeting
city, guaranteed status, fixed adult USD price, capacity, inclusions,
exclusions, cancellation policy, notes, and confirmation rule.

## Evidence Used

- Local project context: `AGENTS.md`, `docs/agent-context.md`,
  `docs/agent-workflows.md`, `CONTEXT.md`
- Booking decision: `docs/adr/0002-fixed-departure-small-group-online-booking.md`
- Current implementation: `app/api/checkout-session.ts`,
  `app/api/inquiries.ts`, `app/src/components/ChinaTripsMobile.tsx`,
  `app/src/lib/checkoutClient.ts`
- Stripe official docs:
  - Checkout Session create API supports one-time `payment` mode, line items,
    inline `price_data`, `metadata`, `expires_at`, and `locale`.
  - Webhooks require an endpoint that receives POST events and verifies the raw
    request body with the endpoint signing secret.
  - Event types include `checkout.session.completed`,
    `checkout.session.expired`, `refund.updated`, `charge.refunded`, and
    `charge.refund.updated`.

## Current Gap Summary

The current code is still a deposit/request flow:

- `app/api/checkout-session.ts` trusts browser-submitted route, date,
  availability, traveler, and display fields.
- The API creates a fixed `$100` Stripe Checkout Session and records only Stripe
  metadata.
- `ChinaTripsMobile` forces checkout through sign-in/email magic link.
- The UI says deposit, TBC, reserve request, and automatic refund if
  unavailable.
- There is no durable order table, inventory hold, webhook event ledger,
  customer order lookup, or admin surface.

## Verification Target

```text
1. Create sellable departure data -> Verify: API rejects missing price/capacity/policy and accepts complete records.
2. Start guest checkout -> Verify: order pending_payment + active hold exist before Stripe redirect.
3. Oversell protection -> Verify: requested adults cannot exceed capacity - confirmed - active holds.
4. Stripe completed webhook -> Verify: duplicate event does not duplicate confirmation, email, or inventory changes.
5. Stripe expired webhook -> Verify: pending order becomes expired and hold is released.
6. Refund webhook -> Verify: order refund state updates; seat release follows 14-day/manual-review rule.
7. Success page -> Verify: refresh and email-token reopen read backend order state, not localStorage.
8. Admin action -> Verify: allowlisted admin action creates an audit log.
```

## Issue Breakdown

These are tracer-bullet slices. Each slice should be demoable on its own.

### 1. Booking Schema and Read-Only Departure Catalog

- Type: AFK
- Blocked by: None
- User stories covered: operations can define online-sellable fixed departures;
  checkout can read backend source of truth.

What to build:

Create the booking database schema and a minimal read API for sellable
departures. The API must expose only transaction-grade departures and include
computed available seats.

Acceptance criteria:

- [ ] Tables exist for `departures`, `orders`, `inventory_holds`,
  `stripe_webhook_events`, and `audit_logs`.
- [ ] Departure status supports `draft`, `sellable`, `locked`, `closed`,
  `sold_out`, and `cancelled`.
- [ ] A departure is online-sellable only when all ADR-required transaction
  fields are present.
- [ ] Available seats are computed from capacity, confirmed orders, and active
  unexpired holds.
- [ ] No mutable `sold_seats` counter is introduced in v1.

### 2. Guest Checkout Creates Pending Order and Inventory Hold

- Type: AFK
- Blocked by: Issue 1
- User stories covered: traveler buys seats without account creation; backend
  enforces price and inventory.

What to build:

Replace browser-trusted checkout payloads with a backend lookup. The browser
sends departure ID, adult quantity, lead name, email, phone, and notes only.
The backend validates departure sellability, creates `orders.pending_payment`,
creates an active hold, snapshots price/policy/product facts, then creates a
Stripe Checkout Session.

Acceptance criteria:

- [ ] API rejects non-POST, invalid email, invalid adult quantity, missing lead
  name, missing departure, incomplete departure, closed/locked/cancelled
  departure, and insufficient seats.
- [ ] Stripe amount equals `adult_quantity * adult_unit_price_cents` from the
  departure record.
- [ ] Stripe session uses USD, English locale, Syncing Travel product naming,
  order number metadata, and success URL with order number plus secure token.
- [ ] Hold expiry aligns with Checkout Session expiry where practical.
- [ ] Checkout response returns only redirect URL, session ID, order number, and
  hold expiry.

### 3. Stripe Webhook Payment State Machine

- Type: AFK
- Blocked by: Issue 2
- User stories covered: payment source of truth comes from Stripe; duplicate
  webhooks are harmless.

What to build:

Add a Stripe webhook endpoint that verifies signatures, stores Stripe event IDs,
and processes session completed, session expired, and refund-related events.

Acceptance criteria:

- [ ] Webhook verifies the raw body with `STRIPE_WEBHOOK_SECRET` in production.
- [ ] `stripe_webhook_events.stripe_event_id` is unique and prevents duplicate
  processing.
- [ ] `checkout.session.completed` confirms only the matching pending order and
  consumes the matching active hold.
- [ ] `checkout.session.expired` expires the pending order and releases the hold.
- [ ] Refund-related events update order refund/payment state idempotently.
- [ ] Confirmation email enqueue/send happens after trusted completed webhook,
  not from the success URL.

### 4. Confirmation Email and Resend Workflow

- Type: AFK
- Blocked by: Issue 3
- User stories covered: traveler receives Syncing confirmation separate from
  Stripe receipt; operations can retry failed emails.

What to build:

Create a booking confirmation email sender using the existing Resend/console
email pattern. Store email status separately from order status.

Acceptance criteria:

- [ ] Email includes order number, paid/confirmed status, route, dates, adults,
  unit price, total price, traveler-details deadline, secure order link,
  contact options, and cancellation summary.
- [ ] Email excludes sensitive traveler details.
- [ ] Failed email leaves order `confirmed` and sets
  `confirmation_email_failed` or `confirmation_email_retrying`.
- [ ] Admin resend updates email status and audit log.

### 5. Durable Order Success Page

- Type: AFK
- Blocked by: Issue 3
- User stories covered: traveler can refresh after payment and reopen order
  from email.

What to build:

Add a customer order lookup API and success page. The success page must use
order number plus secure token and show backend status, not localStorage.

Acceptance criteria:

- [ ] Route supports reopening via `#/orders/:orderNumber?token=...`.
- [ ] Page shows `Paid / Confirmed` only when backend order is confirmed.
- [ ] Page can show pending state while webhook has not arrived yet.
- [ ] Page supports refresh without losing state.
- [ ] Invalid or expired token returns a safe not-found/expired message.

### 6. Frontend Small Group Guest Checkout Flow

- Type: AFK
- Blocked by: Issues 1 and 2
- User stories covered: traveler sees fixed full-payment booking language and
  starts checkout without magic-link login.

What to build:

Replace deposit/reserve/TBC language in `ChinaTripsMobile` with fixed adult
price, full payment, and confirmed booking language. Remove pre-payment magic
link from the small-group checkout path. Keep account sign-in only for account
management or future traveler-detail editing.

Acceptance criteria:

- [ ] Small-group entry says fixed departure, full payment, confirmed booking.
- [ ] Checkout form collects lead name, email, WhatsApp/phone, adult quantity,
  and notes.
- [ ] No sign-in or email magic-link step blocks payment.
- [ ] Browser no longer sends price, capacity, spots-left, route title, or
  departure status as trusted checkout inputs.
- [ ] Payment button states card payment is securely processed by Stripe and
  Syncing Travel does not store card details.

### 7. Minimal Admin Surface with Audit Log

- Type: HITL
- Blocked by: Issues 1, 3, and 4
- User stories covered: operations can inspect and manage orders safely.

Why HITL:

Admin authentication is a product/security decision. The repo currently has
Supabase Auth for customer sign-in experiments, but no confirmed admin auth
model. A temporary shared admin token is faster but weaker; Supabase allowlist is
closer to the ADR.

What to build:

Add minimal admin order/departure APIs and an admin UI for allowlisted users.

Acceptance criteria:

- [ ] Admin access is authenticated and checked against an allowlist.
- [ ] Admin can list/filter orders and open order detail.
- [ ] Admin can resend confirmation email.
- [ ] Admin can record cancellation/date-change requests and internal notes.
- [ ] Admin can lock, close, or cancel a departure.
- [ ] Critical actions and sensitive traveler-detail views create audit logs.

### 8. Cancellation, Refund, and Seat Release Guardrails

- Type: AFK
- Blocked by: Issues 3 and 7
- User stories covered: refund state follows policy and does not reopen seats
  incorrectly.

What to build:

Implement request-only cancellation and manual date-change handling. Webhook
refund updates should calculate whether automatic seat release is allowed.

Acceptance criteria:

- [ ] Traveler/admin can record cancellation request time.
- [ ] Suggested refund uses the policy snapshot stored on the order.
- [ ] Refund webhook sets `refunded` only when payment is fully refunded.
- [ ] Seats auto-release only when departure is at least 14 days away and still
  sellable.
- [ ] Inside 14 days or for locked/closed/cancelled/special-handled departures,
  the order is flagged for manual review instead of auto-releasing seats.

## Proposed Database Model

The following model assumes PostgreSQL through the existing `@vercel/postgres`
dependency.

### `departures`

Purpose: source of truth for online-sellable fixed departure seats.

Key fields:

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `public_id TEXT UNIQUE NOT NULL`
- `route_slug TEXT NOT NULL`
- `route_title TEXT NOT NULL`
- `destination_slug TEXT`
- `departure_city TEXT NOT NULL`
- `start_date DATE NOT NULL`
- `end_date DATE NOT NULL`
- `status TEXT NOT NULL`
- `guaranteed BOOLEAN NOT NULL DEFAULT false`
- `adult_unit_price_cents INTEGER NOT NULL`
- `currency TEXT NOT NULL DEFAULT 'usd'`
- `capacity INTEGER NOT NULL`
- `included_core_items JSONB NOT NULL DEFAULT '[]'::jsonb`
- `excluded_core_items JSONB NOT NULL DEFAULT '[]'::jsonb`
- `important_notes JSONB NOT NULL DEFAULT '[]'::jsonb`
- `cancellation_policy_snapshot JSONB NOT NULL`
- `policy_version TEXT NOT NULL`
- `confirmation_rule TEXT NOT NULL`
- `locked_at TIMESTAMPTZ`
- `closed_at TIMESTAMPTZ`
- `cancelled_at TIMESTAMPTZ`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Status values:

- `draft`: not checkoutable.
- `sellable`: complete and checkoutable.
- `locked`: no new checkout; operations may still manage existing orders.
- `closed`: no checkout because operations closed sales.
- `sold_out`: no checkout because computed availability is zero.
- `cancelled`: departure cancelled by operations.

Important constraints:

- `adult_unit_price_cents > 0`
- `capacity > 0`
- `end_date >= start_date`
- `currency = 'usd'` for v1
- `status` check constraint for known values

### `orders`

Purpose: durable customer booking and payment state.

Key fields:

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `order_number TEXT UNIQUE NOT NULL`
- `access_token_hash TEXT NOT NULL`
- `departure_id UUID NOT NULL REFERENCES departures(id)`
- `status TEXT NOT NULL`
- `payment_status TEXT NOT NULL`
- `refund_status TEXT NOT NULL DEFAULT 'none'`
- `traveler_details_status TEXT NOT NULL`
- `confirmation_email_status TEXT NOT NULL`
- `lead_traveler_name TEXT NOT NULL`
- `lead_email TEXT NOT NULL`
- `lead_phone TEXT`
- `adult_quantity INTEGER NOT NULL`
- `currency TEXT NOT NULL DEFAULT 'usd'`
- `adult_unit_price_cents INTEGER NOT NULL`
- `total_price_cents INTEGER NOT NULL`
- `route_snapshot JSONB NOT NULL`
- `price_snapshot JSONB NOT NULL`
- `policy_snapshot JSONB NOT NULL`
- `policy_version TEXT NOT NULL`
- `traveler_details_due_at TIMESTAMPTZ`
- `stripe_checkout_session_id TEXT UNIQUE`
- `stripe_payment_intent_id TEXT`
- `stripe_charge_id TEXT`
- `stripe_refund_id TEXT`
- `paid_at TIMESTAMPTZ`
- `confirmed_at TIMESTAMPTZ`
- `expired_at TIMESTAMPTZ`
- `cancelled_at TIMESTAMPTZ`
- `refunded_at TIMESTAMPTZ`
- `cancellation_requested_at TIMESTAMPTZ`
- `date_change_requested_at TIMESTAMPTZ`
- `internal_notes TEXT`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Order status values:

- `pending_payment`
- `confirmed`
- `cancellation_requested`
- `cancelled`
- `refunded`
- `failed`
- `expired`

Payment status values:

- `unpaid`
- `paid`
- `partially_refunded`
- `refunded`
- `failed`

Traveler details status values:

- `traveler_details_pending`
- `traveler_details_submitted`
- `needs_manual_follow_up`

Confirmation email status values:

- `confirmation_email_pending`
- `confirmation_email_sent`
- `confirmation_email_failed`
- `confirmation_email_retrying`

### `inventory_holds`

Purpose: temporary seat hold while a Stripe Checkout Session is open.

Key fields:

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `departure_id UUID NOT NULL REFERENCES departures(id)`
- `order_id UUID NOT NULL REFERENCES orders(id)`
- `adult_quantity INTEGER NOT NULL`
- `status TEXT NOT NULL`
- `expires_at TIMESTAMPTZ NOT NULL`
- `stripe_checkout_session_id TEXT UNIQUE`
- `released_at TIMESTAMPTZ`
- `consumed_at TIMESTAMPTZ`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Hold status values:

- `active`
- `consumed`
- `released`
- `expired`

Availability query:

```sql
SELECT
  d.capacity
  - COALESCE(confirmed.adults, 0)
  - COALESCE(held.adults, 0) AS available_seats
FROM departures d
LEFT JOIN (
  SELECT departure_id, SUM(adult_quantity) AS adults
  FROM orders
  WHERE status IN ('confirmed', 'cancellation_requested')
  GROUP BY departure_id
) confirmed ON confirmed.departure_id = d.id
LEFT JOIN (
  SELECT departure_id, SUM(adult_quantity) AS adults
  FROM inventory_holds
  WHERE status = 'active' AND expires_at > NOW()
  GROUP BY departure_id
) held ON held.departure_id = d.id;
```

Concurrency rule:

Checkout creation must use one transaction and lock the departure row with
`SELECT ... FOR UPDATE` before calculating availability and inserting the hold.

### `stripe_webhook_events`

Purpose: idempotency ledger for Stripe event delivery.

Key fields:

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `stripe_event_id TEXT UNIQUE NOT NULL`
- `event_type TEXT NOT NULL`
- `livemode BOOLEAN NOT NULL DEFAULT false`
- `object_id TEXT`
- `object_type TEXT`
- `processing_status TEXT NOT NULL`
- `payload JSONB NOT NULL`
- `error_message TEXT`
- `processed_at TIMESTAMPTZ`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Processing status values:

- `processing`
- `processed`
- `ignored`
- `failed`

### `audit_logs`

Purpose: durable record of admin and system-critical actions.

Key fields:

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `actor_type TEXT NOT NULL`
- `actor_email TEXT`
- `action TEXT NOT NULL`
- `target_type TEXT NOT NULL`
- `target_id TEXT NOT NULL`
- `metadata JSONB NOT NULL DEFAULT '{}'::jsonb`
- `ip_hash TEXT`
- `user_agent TEXT`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Actor types:

- `system`
- `admin`
- `stripe_webhook`

Critical actions to audit:

- Admin order view with sensitive details
- Email resend
- Cancellation/date-change request handling
- Internal note update
- Departure lock/close/cancel
- Refund state/manual review changes

## API Surface

### Customer-facing

- `GET /api/departures`
  - Returns only sellable fixed departures with computed available seats.
- `POST /api/checkout-session`
  - Input: `departureId`, `adultQuantity`, `name`, `email`, `phone`, `notes`.
  - Output: `checkoutUrl`, `sessionId`, `orderNumber`, `expiresAt`.
- `POST /api/stripe-webhook`
  - Stripe only. Verifies signature and updates order state.
- `GET /api/orders/:orderNumber?token=...`
  - Returns safe order summary for success page and email reopen.
- `POST /api/orders/:orderNumber/cancellation-request`
  - Records customer cancellation request.
- `POST /api/orders/:orderNumber/date-change-request`
  - Records customer date-change request.

### Admin

- `GET /api/admin/orders`
- `GET /api/admin/orders/:orderNumber`
- `POST /api/admin/orders/:orderNumber/resend-confirmation`
- `POST /api/admin/orders/:orderNumber/internal-notes`
- `POST /api/admin/orders/:orderNumber/cancellation-review`
- `POST /api/admin/departures/:publicId/lock`
- `POST /api/admin/departures/:publicId/close`
- `POST /api/admin/departures/:publicId/cancel`

## Manual Gates Before Production Code Merge

These decisions should be confirmed before shipping the implementation:

1. Admin auth model:
   - Option A: Supabase Auth + admin email allowlist.
   - Option B: temporary `ADMIN_ACCESS_TOKEN` + allowlist metadata.
   - Recommendation: Option A for production; Option B only for local/internal
     prototype.
2. First real online-sellable departure records:
   - Need fixed adult price, inclusions, exclusions, cancellation policy,
     notes, capacity, and guaranteed status.
3. Email sender identity:
   - Need verified `BOOKING_FROM_EMAIL` domain before sending real customer
     confirmations.
4. Stripe webhook registration:
   - Need production HTTPS endpoint and `STRIPE_WEBHOOK_SECRET`.
5. Refund operations:
   - Confirm whether v1 admin only records external Stripe refund state, or also
     creates refunds through the Stripe API.

## Recommended Implementation Order

1. Issue 1: schema + departure read API.
2. Issue 2: guest checkout order + hold + Stripe session.
3. Issue 3: webhook idempotency and payment state.
4. Issue 5: durable success page.
5. Issue 6: frontend guest checkout copy and payload cleanup.
6. Issue 4: confirmation email and resend.
7. Issue 7: admin surface.
8. Issue 8: refund/cancellation guardrails.

This order gets the payment correctness path working before expanding admin and
refund operations.
