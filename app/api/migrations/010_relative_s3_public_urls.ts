import type { SqlClient } from '../lib/db';

export const name = '010_relative_s3_public_urls';

/**
 * Rewrite absolute same-origin MinIO URLs to relative /s3/... paths so
 * browsers resolve against the current Host (LAN, ngrok, domain).
 *
 * Example:
 *   http://127.0.0.1:3000/s3/xtch-prod/prod/image/...jpg
 * → /s3/xtch-prod/prod/image/...jpg
 *
 * Leaves non-/s3 http(s) URLs untouched.
 */
export async function up(tx: SqlClient) {
  await tx`
    UPDATE routes
    SET
      hero_image = regexp_replace(hero_image, '^https?://[^/?#]+(/s3/[^?#]*)', '\\1', 'i'),
      updated_at = NOW()
    WHERE hero_image ~* '^https?://[^/?#]+/s3/'
  `;

  await tx`
    UPDATE destinations
    SET
      image = regexp_replace(image, '^https?://[^/?#]+(/s3/[^?#]*)', '\\1', 'i'),
      updated_at = NOW()
    WHERE image ~* '^https?://[^/?#]+/s3/'
  `;

  await tx`
    UPDATE media_assets
    SET
      public_url = regexp_replace(public_url, '^https?://[^/?#]+(/s3/[^?#]*)', '\\1', 'i'),
      updated_at = NOW()
    WHERE public_url ~* '^https?://[^/?#]+/s3/'
  `;
}
