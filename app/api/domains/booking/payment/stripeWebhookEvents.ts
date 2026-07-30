import { sql } from '../../../platform/db';
import type Stripe from 'stripe';
import type { WebhookProcessingStatus } from '../bookingSchema';

export async function recordWebhookEvent(
  event: Stripe.Event,
  processingStatus: WebhookProcessingStatus,
  errorMessage?: string,
): Promise<void> {
  await sql`
    INSERT INTO stripe_webhook_events (
      stripe_event_id,
      event_type,
      livemode,
      object_id,
      object_type,
      processing_status,
      payload,
      error_message,
      processed_at
    ) VALUES (
      ${event.id},
      ${event.type},
      ${event.livemode},
      ${getObjectId(event)},
      ${getObjectType(event)},
      ${processingStatus},
      ${JSON.stringify(event)}::jsonb,
      ${errorMessage ?? null},
      ${processingStatus === 'processed' || processingStatus === 'ignored' ? new Date().toISOString() : null}::timestamptz
    )
    ON CONFLICT (stripe_event_id) DO UPDATE SET
      processing_status = EXCLUDED.processing_status,
      error_message = EXCLUDED.error_message,
      processed_at = EXCLUDED.processed_at
  `;
}

export async function isWebhookEventProcessed(stripeEventId: string): Promise<boolean> {
  const result = await sql<{ processing_status: WebhookProcessingStatus }>`
    SELECT processing_status
    FROM stripe_webhook_events
    WHERE stripe_event_id = ${stripeEventId}
  `;
  const status = result.rows[0]?.processing_status;
  return status === 'processed' || status === 'ignored';
}

function getObjectId(event: Stripe.Event): string | null {
  const data = event.data?.object as { id?: string } | undefined;
  return data?.id ?? null;
}

function getObjectType(event: Stripe.Event): string | null {
  const data = event.data?.object as { object?: string } | undefined;
  return data?.object ?? null;
}
