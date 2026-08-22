import { sql } from '../api/platform/db';

/**
 * 保留临时会话的消息事实，但在关闭超过期限后解除访客身份，避免
 * 匿名 cookie 永久持有历史。只要会话绑定过已验证门户用户，就永不自动清理。
 */
export function startMessagingRetention(options: { intervalMs?: number; retentionDays?: number } = {}) {
  const intervalMs = options.intervalMs ?? 60 * 60 * 1000;
  const retentionDays = options.retentionDays ?? positiveInteger(process.env.IM_ANONYMOUS_RETENTION_DAYS, 30);
  let stopped = false;
  let running = false;

  const clean = async () => {
    if (stopped || running) return;
    running = true;
    try {
      await sql.begin(async (tx) => {
        const expired = await tx<{ id: string; visitor_id: string | null }>`
          SELECT c.id, c.visitor_id
          FROM im_conversations c
          WHERE c.status = 'closed'
            AND c.closed_at IS NOT NULL
            AND c.closed_at < NOW() - (${retentionDays}::text || ' days')::interval
            AND NOT EXISTS (
              SELECT 1 FROM im_conversation_identities i
              WHERE i.conversation_id = c.id
                AND i.identity_type IN ('supabase_user', 'xt_mvp_subject')
                AND i.revoked_at IS NULL
            )
          ORDER BY c.closed_at
          LIMIT 100
          FOR UPDATE OF c SKIP LOCKED
        `;
        for (const conversation of expired.rows) {
          await tx`
            UPDATE im_conversation_identities
            SET revoked_at = COALESCE(revoked_at, NOW()), is_primary = false
            WHERE conversation_id = ${conversation.id}::uuid AND revoked_at IS NULL
          `;
          await tx`
            UPDATE im_visitor_sessions
            SET revoked_at = COALESCE(revoked_at, NOW())
            WHERE visitor_id = ${conversation.visitor_id}::uuid AND revoked_at IS NULL
          `;
          await tx`
            UPDATE im_conversations SET visitor_id = NULL, updated_at = NOW(), version = version + 1
            WHERE id = ${conversation.id}::uuid
          `;
          await tx`
            INSERT INTO im_audit_events (
              actor_type, action, conversation_id, target_type, target_id, after_state
            ) VALUES (
              'system', 'conversation.anonymize', ${conversation.id}::uuid, 'conversation', ${conversation.id},
              ${JSON.stringify({ retentionDays, messagesPreserved: true })}::jsonb
            )
          `;
        }
      });
    } catch (error) {
      console.error('IM retention cleanup failed:', error instanceof Error ? error.message : error);
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => void clean(), intervalMs);
  timer.unref?.();
  void clean();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
