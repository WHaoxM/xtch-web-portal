import type { Namespace } from 'socket.io';
import { sql } from '../api/platform/db';

type OutboxRow = {
  id: number;
  event_id: string;
  conversation_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
};

export function startMessagingOutbox(namespace: Namespace, options: { intervalMs?: number } = {}) {
  const intervalMs = options.intervalMs ?? 500;
  let stopped = false;
  let running = false;

  const flush = async () => {
    if (stopped || running) return;
    running = true;
    try {
      const rows = await sql.begin(async (tx) => {
        const locked = await tx<OutboxRow>`
          SELECT id, event_id, conversation_id, event_type, payload
          FROM im_outbox
          WHERE published_at IS NULL
            AND available_at <= NOW()
            AND (locked_at IS NULL OR locked_at < NOW() - INTERVAL '1 minute')
          ORDER BY id
          LIMIT 50
          FOR UPDATE SKIP LOCKED
        `;
        if (locked.rows.length > 0) {
          await tx`
            UPDATE im_outbox
            SET locked_at = NOW(), locked_by = ${process.pid.toString()}, attempts = attempts + 1
            WHERE id = ANY(${locked.rows.map((row) => row.id)}::bigint[])
          `;
        }
        return locked.rows;
      });

      for (const row of rows) {
        try {
          if (row.conversation_id) {
            namespace.to(`im:conversation:${row.conversation_id}`).emit(row.event_type, {
              event_id: row.event_id,
              ...row.payload,
            });
          }
          await sql`
            UPDATE im_outbox
            SET published_at = NOW(), locked_at = NULL, locked_by = NULL
            WHERE id = ${row.id} AND published_at IS NULL
          `;
        } catch (error) {
          await sql`
            UPDATE im_outbox
            SET available_at = NOW() + LEAST(INTERVAL '5 minutes', POWER(2, LEAST(attempts, 8)) * INTERVAL '1 second'),
                locked_at = NULL,
                locked_by = NULL,
                last_error = ${error instanceof Error ? error.message : String(error)}
            WHERE id = ${row.id} AND published_at IS NULL
          `;
        }
      }
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => {
    void flush();
  }, intervalMs);
  timer.unref?.();
  void flush();

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

