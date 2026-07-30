import { sql } from './db';
import type { ActorType } from './actorTypes';

export type { ActorType } from './actorTypes';

export async function writeAuditLog({
  actorType,
  actorEmail,
  action,
  targetType,
  targetId,
  metadata = {},
  ipHash,
  userAgent,
}: {
  actorType: ActorType;
  actorEmail?: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
  ipHash?: string;
  userAgent?: string;
}): Promise<void> {
  await sql`
    INSERT INTO audit_logs (
      actor_type,
      actor_email,
      action,
      target_type,
      target_id,
      metadata,
      ip_hash,
      user_agent
    ) VALUES (
      ${actorType},
      ${actorEmail ?? null},
      ${action},
      ${targetType},
      ${targetId},
      ${JSON.stringify(metadata)}::jsonb,
      ${ipHash ?? null},
      ${userAgent ?? null}
    )
  `;
}
