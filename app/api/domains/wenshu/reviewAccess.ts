import crypto from 'node:crypto';
import type { SqlClient } from '../../platform/db';

export function validReviewToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function reviewTokenHash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/** Only the hash is stored; the opaque link secret exists solely in the staff notification. */
export async function issueReviewToken(sql: SqlClient, leadId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url');
  await sql`INSERT INTO wenshu_lead_review_links (lead_id, token_hash)
    VALUES (${leadId}::uuid, ${reviewTokenHash(token)})`;
  return token;
}
