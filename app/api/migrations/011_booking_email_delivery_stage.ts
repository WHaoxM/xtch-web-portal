import type { SqlClient } from '../lib/db';

export const name = '011_booking_email_delivery_stage';

export async function up(tx: SqlClient) {
  await tx`
    ALTER TABLE orders
    DROP CONSTRAINT IF EXISTS orders_email_status_known
  `;

  await tx`
    ALTER TABLE orders
    ADD CONSTRAINT orders_email_status_known
    CHECK (confirmation_email_status IN (
      'confirmation_email_pending',
      'confirmation_email_sent',
      'confirmation_email_failed',
      'confirmation_email_retrying',
      'confirmation_email_traveler_sent'
    ))
  `;
}
