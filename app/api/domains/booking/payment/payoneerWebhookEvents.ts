import { sql } from '../../../platform/db';
import type { WebhookProcessingStatus } from '../bookingSchema';
import type { ParsedPayoneerNotification } from './payoneer';

export async function recordPayoneerWebhookEvent(
  event: ParsedPayoneerNotification,
  processingStatus: WebhookProcessingStatus,
  errorMessage?: string,
): Promise<void> {
  await sql`
    INSERT INTO payoneer_webhook_events (
      payoneer_event_id,
      event_type,
      livemode,
      object_id,
      processing_status,
      payload,
      error_message,
      processed_at
    ) VALUES (
      ${event.eventId},
      ${event.status},
      ${event.livemode},
      ${event.listId ?? event.transactionId},
      ${processingStatus},
      ${JSON.stringify(event.raw)}::jsonb,
      ${errorMessage ?? null},
      ${processingStatus === 'processed' || processingStatus === 'ignored' ? new Date().toISOString() : null}::timestamptz
    )
    ON CONFLICT (payoneer_event_id) DO UPDATE SET
      processing_status = EXCLUDED.processing_status,
      error_message = EXCLUDED.error_message,
      processed_at = EXCLUDED.processed_at
  `;
}

export async function isPayoneerWebhookEventProcessed(eventId: string): Promise<boolean> {
  const result = await sql<{ processing_status: WebhookProcessingStatus }>`
    SELECT processing_status
    FROM payoneer_webhook_events
    WHERE payoneer_event_id = ${eventId}
  `;
  const status = result.rows[0]?.processing_status;
  return status === 'processed' || status === 'ignored';
}
