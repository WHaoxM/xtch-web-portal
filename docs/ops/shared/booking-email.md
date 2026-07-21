# Booking confirmation email

Paid checkout confirmation sends two separate messages:

- the existing traveler confirmation, with `Reply-To` set to operations;
- a minimal internal copy containing order number, traveler email, amount, and route.

Set `BOOKING_OPERATIONS_EMAIL` to the monitored operations inbox. For compatibility,
`INQUIRY_TO_EMAIL` is used only when the booking-specific value is empty. Production
validation refuses `BOOKING_EMAIL_MODE=resend` when neither recipient is configured.

`BOOKING_EMAIL_OVERRIDE_TO` remains local/tunnel test support for the traveler message
only. It does not redirect the internal operations copy. Keep production override unset.

Webhook and dev-bypass retries persist a traveler-sent stage before sending the internal
copy. A retry then sends only the missing internal copy. Admin “resend confirmation”
repairs missing stages for pending/failed delivery; once both messages are recorded as
sent, an explicit resend sends only a fresh traveler confirmation and does not duplicate
the operations notification.

Run the target database migration before deploying this code; migration
`011_booking_email_delivery_stage` adds the intermediate status accepted by the orders
constraint.

The operations-copy request uses a per-order Resend idempotency key. The traveler message
keeps the existing rotated access-token link, so it is deduplicated by the webhook event
record plus the persisted traveler-sent stage rather than by reusing a key with changing
content. Do not send real messages from tests; inject the mail sender and assert payloads
instead.
