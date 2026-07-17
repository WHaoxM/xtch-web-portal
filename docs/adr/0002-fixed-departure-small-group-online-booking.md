# Fixed Departure Small Group Online Booking

Status: Accepted

Date: 2026-06-25

## Context

The current mobile China Trips implementation can create a Stripe Checkout
session for a small group deposit, but the tested flow exposed product and
system mismatches:

- The page presents a deposit and several "to be confirmed" messages, while
  the intended product is a complete online purchase.
- Email magic-link sign-in interrupts checkout and caused a callback mismatch
  during testing.
- Stripe Checkout completed payment successfully, but returned to the home page
  instead of a durable order success page.
- There is no order table, inventory table, inventory hold, Stripe webhook, or
  order confirmation email flow in the current API surface.

This decision supersedes the earlier current-phase guidance that limited the
mobile China Trips small group flow to payment intent or invoice preview.

## Decision

Syncing Travel will sell first-version online small group products as fixed
departure seats:

- Guaranteed departure only.
- Fixed adult price only.
- Adult quantity multiplied by fixed adult unit price.
- Full payment by hosted Stripe Checkout.
- Payment success immediately confirms the booking.
- Backend inventory enforcement prevents selling more seats than available.
- Guest checkout is the default. Account creation is not a pre-payment
  requirement.

Small group products that do not meet the required transaction data standard
must not expose full-payment checkout.

## Product Rules

### Online-Sellable Departure

A departure is online-sellable only when all core transaction information is
present:

- Route name.
- Start date and end date.
- Departure city or approximate meeting city.
- Guaranteed departure status.
- Adult unit price in USD.
- Capacity and available seats.
- Included core items.
- Not included core items.
- Cancellation policy.
- Important notes, including equivalent-value itinerary substitutions.
- Confirmation rule: booking is confirmed after successful payment.

Operational details can be supplied after booking:

- Exact meeting point.
- Daily meeting times.
- Guide contact.
- Hotel names.
- Restaurant details.
- Pre-trip reminders.
- Full traveler details.

### Not In Version 1

Version 1 does not support:

- Children pricing.
- Single room supplement checkout.
- Hotel upgrades.
- Airport transfer add-ons.
- Automatic self-service date changes.
- Automatic self-service instant refunds.
- Multi-currency checkout.
- Mandatory account creation before payment.

Special cases should route to inquiry or manual support.

## Checkout Flow

1. Traveler selects an online-sellable fixed departure.
2. Traveler selects adult quantity, capped by available seats.
3. Traveler provides lead traveler name, email, and WhatsApp or phone.
4. Backend validates departure, price, status, and available seats.
5. Backend creates an order in `pending_payment`.
6. Backend creates an inventory hold with an expiry.
7. Backend creates a Stripe Checkout Session from the order price snapshot.
8. Traveler pays through Stripe Checkout.
9. Stripe webhook confirms payment.
10. Backend moves the order to `confirmed`.
11. Backend sends a Syncing Travel booking confirmation email.
12. Success page reads local order state and displays the durable order page.

The checkout must not trust price, capacity, or availability values sent from
the browser.

## Inventory Rules

Available seats are calculated from source records:

```text
availableSeats = departure.capacity - confirmedSeats - activeHeldSeats
```

Where:

- `confirmedSeats` is the sum of traveler counts for confirmed orders.
- `activeHeldSeats` is the sum of unexpired active inventory holds.

The first version should avoid a separate mutable `soldSeats` counter unless a
future performance need justifies it.

Inventory hold behavior:

- Create a hold when creating a Checkout Session.
- Align hold expiry with the Checkout Session expiry where practical.
- Release holds on `checkout.session.expired`.
- Run a scheduled cleanup for expired holds as a fallback.
- Lock price and policy snapshots while the Checkout Session is valid.

Cancellation and refund inventory behavior:

- Refunds are manually reviewed in version 1.
- After refund success, seats can be automatically released only when the
  departure is at least 14 days away and the departure is still sellable.
- Inside 14 days, or when the departure is locked, closed, sold out, cancelled,
  or special-handled, seat release requires manual review.

## Order State

Order status:

- `pending_payment`
- `confirmed`
- `cancellation_requested`
- `cancelled`
- `refunded`
- `failed`
- `expired`

Traveler details status:

- `traveler_details_pending`
- `traveler_details_submitted`
- `needs_manual_follow_up`

Confirmation email status:

- `confirmation_email_pending`
- `confirmation_email_sent`
- `confirmation_email_failed`
- `confirmation_email_retrying`

These states are separate. A confirmed booking remains confirmed even when the
confirmation email fails or traveler details are missing.

## Order Identity and Access

Customer-facing order numbers use this format:

```text
ST-YYMMDD-XXXX
```

Example:

```text
ST-260625-8F3K
```

Rules:

- Order numbers must be unique.
- Stripe metadata must include the order number.
- Do not expose database IDs as customer-facing order identifiers.
- Email order links use a secure random token in addition to the order number.
- Order summary can be viewed from the email token link without full login.
- Editing traveler details requires email one-time verification or magic link.

## Traveler Details

Before payment, collect only:

- Lead traveler full name.
- Email.
- WhatsApp or phone.
- Adult traveler quantity.

After payment, collect detailed traveler information:

- Traveler names.
- Passport or identity information, only if operationally required.
- Dietary needs, allergies, accessibility needs, hotel or transfer details, and
  emergency contact, where relevant.

Traveler detail deadlines:

- If departure is at least 14 days away, details are due 14 days before
  departure.
- If departure is less than 14 days away, details are due within 24 hours after
  payment.
- Missed deadlines do not automatically cancel the order. They move the order
  into manual follow-up.

Sensitive traveler details must not be included in ordinary email bodies.

## Payment and Stripe Rules

Stripe Checkout requirements:

- Use hosted Stripe Checkout.
- Use USD only in version 1.
- Force English locale for the first version.
- Use Syncing Travel customer-facing merchant and product naming.
- The total charged by Stripe must match the checkout summary.
- Do not add checkout payment processing fees on top of the displayed package
  price.
- Payment button area must state that card payment is securely processed by
  Stripe and Syncing Travel does not store card details.

Stripe webhook requirements:

- Use Stripe webhook events as the payment source of truth.
- Process webhook events idempotently by storing Stripe event IDs.
- Do not confirm orders from the frontend success URL alone.
- Do not duplicate inventory deduction or confirmation emails on repeated
  webhook delivery.

The success page reads local order state. Stripe `session_id` is auxiliary, not
the primary order system.

## Refund and Cancellation Rules

Default cancellation policy for version 1:

- 30 or more days before departure: full refund, except payment processing fees
  if applicable.
- 14 to 29 days before departure: 50 percent refund.
- Less than 14 days before departure: non-refundable.
- If Syncing Travel cancels the departure: full refund.
- Refunds return to the original payment method, normally within 5 to 10
  business days.

Policy snapshots:

- Orders use the cancellation policy accepted at payment time.
- Later policy changes do not apply retroactively.
- Store `policy_snapshot` and `policy_version` on the order.

User-initiated cancellation:

- Version 1 provides `Request cancellation`, not instant self-service refund.
- The system records request time and computes a suggested refund amount.
- Operations reviews and executes refunds in Stripe.
- Refund webhooks update order state.

Operator cancellation:

- If Syncing Travel cancels a departure, the customer receives a full refund.
- Alternative dates or routes can be offered, but cannot be forced.

Date changes:

- Version 1 supports manual date change requests only.
- Operations checks target inventory and price differences.
- Price differences are handled manually with payment links or refunds.

## Confirmation and Email

Stripe receipt and Syncing Travel booking confirmation are different artifacts:

- Stripe receipt proves payment.
- Syncing confirmation proves travel booking details.

The Syncing confirmation email is sent only after trusted webhook confirmation.
It includes:

- Order number.
- Paid and confirmed status.
- Route and departure dates.
- Adult quantity.
- Unit price and total price in USD.
- Traveler details deadline.
- Secure order link.
- Contact options.
- Cancellation policy summary.

If the confirmation email fails, the order remains confirmed and the email
status moves to retry or failed state.

## Admin and Operations

Version 1 needs a minimal admin surface, not a full CRM.

Minimum admin capabilities:

- Order list and order detail.
- Status filters.
- Confirmation email resend.
- Email status inspection.
- Traveler details status inspection.
- Cancellation request handling.
- Date change request handling.
- Internal notes.
- Departure lock, close, and cancellation controls.
- Stripe payment and refund status inspection.

Admin access requirements:

- Admin allowlist.
- Authenticated access only.
- Audit log for critical actions.
- Audit log when viewing sensitive traveler details.

## Consequences

Positive:

- The product promise becomes clear: fixed departure, full payment, confirmed
  booking.
- Guest checkout removes the current email magic-link interruption.
- Backend inventory and webhook processing make no-oversell enforcement
  possible.
- Success pages and emails become durable customer proof after payment.

Costs:

- Requires database-backed departures, orders, holds, webhook events, and audit
  logs.
- Requires a minimal admin surface.
- Requires hosted payment and email flows to be treated as production systems,
  not page-only UI.
- Requires route product data to include transaction-grade fields before a
  payment button is shown.

Risks:

- Guaranteed departure means Syncing Travel owns fulfillment risk even if few
  people book.
- Automatic seat release after refund must respect the 14-day sellability rule.
- Poorly maintained departure data can block checkout or create support load.

## Implementation Notes

The existing files most directly affected later are:

- `app/src/components/ChinaTripsMobile.tsx`
- `app/src/lib/checkoutClient.ts`
- `app/api/checkout-session.ts`
- `CONTEXT.md`

New backend/API surfaces will be needed for:

- Departures.
- Orders.
- Inventory holds.
- Stripe webhooks.
- Order lookup.
- Traveler details submission.
- Admin order operations.

Validation before shipping:

- Checkout cannot exceed available seats.
- Checkout cannot start for incomplete core transaction data.
- Stripe Checkout uses English locale and Syncing Travel naming.
- Payment success confirms an order through webhook.
- Confirmation email sends after webhook.
- Success page survives refresh and email reopening.
- Session expiry releases hold.
- Duplicate webhooks do not duplicate state changes.
