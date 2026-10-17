import crypto from 'node:crypto';
import { sql } from '../../platform/db';
import { bearerToken, type ImRequest } from './httpTypes';

const ACCESS_TTL_SECONDS = 10 * 60;
export const IM_SOURCE_SCOPED_PERMISSION_CODES = [
  'im:conversation:read',
  'im:assignment:claim',
  'im:assignment:takeover',
  'im:assignment:transfer',
  'im:message:send',
  'im:conversation:close',
] as const;
const imSourceScopedPermissionSet = new Set<string>(IM_SOURCE_SCOPED_PERMISSION_CODES);

export type ImStaffPrincipal = {
  staffId: string;
  username: string;
  displayName: string;
  accountType: 'super_admin' | 'staff';
  permissions: string[];
  globalPermissions: string[];
  tenantIds: string[];
  sourceScopeEnforced: boolean;
  sourcePermissions: string[];
};

type JwtClaims = {
  iss: 'xtch';
  aud: 'im-mobile';
  sub: string;
  jti: string;
  exp: number;
  iat: number;
  permissions: string[];
  globalPermissions: string[];
  tenantIds: string[];
};

export type ExternalMvpPrincipal = {
  subject: string;
  username?: string;
  role: string;
  tenantId?: string | null;
};

export type ImIntrospectionPrincipal = {
  subject: string;
  role: 'platform_admin' | 'tenant_admin' | 'tenant_staff';
  tenantId: string | null;
  tenantIds: string[];
  scopes: string[];
  sourceScopeEnforced: boolean;
};

type StaffRow = {
  id: string;
  username: string;
  display_name: string;
  account_type: 'super_admin' | 'staff';
};

type StaffPermissionRow = {
  permission_code: string;
  scope_type: 'global' | 'tenant' | 'source';
  scope_id: string | null;
};

export function resolveStaffPermissionSets(rows: StaffPermissionRow[], sourceScopeEnforced: boolean) {
  const tokenPermissions = [...new Set(rows
    .filter((row) => row.scope_type !== 'source')
    .map((row) => row.permission_code))];
  const globalPermissions = [...new Set(rows
    .filter((row) => row.scope_type === 'global')
    .map((row) => row.permission_code))];
  const tenantIds = [...new Set(rows
    .filter((row) => row.scope_type === 'tenant' && row.permission_code === 'im:conversation:read')
    .map((row) => row.scope_id)
    .filter((scopeId): scopeId is string => Boolean(scopeId)))];
  const sourcePermissions = sourceScopeEnforced
    ? [...new Set(rows
      .filter((row) => row.scope_type === 'source' && imSourceScopedPermissionSet.has(row.permission_code))
      .map((row) => row.permission_code))]
    : [];
  const permissions = [...new Set([...tokenPermissions, ...sourcePermissions])];
  return { permissions, tokenPermissions, globalPermissions, tenantIds, sourcePermissions };
}

export function isActiveImStaffStatus(status: string | null | undefined): boolean {
  return status === 'active';
}

export async function authenticateStaffRequest(req: ImRequest): Promise<
  | { ok: true; principal: ImStaffPrincipal }
  | { ok: false; status: number; error: string }
> {
  const token = bearerToken(req);
  if (!token) return { ok: false, status: 401, error: 'IM authentication required.' };

  const claims = verifyAccessToken(token);
  if (!claims) return { ok: false, status: 401, error: 'Invalid or expired IM session.' };

  const result = await sql<StaffRow & { status: string; source_scope_enforced: boolean; source_permissions: string[] }>`
    SELECT id, username, display_name, account_type, status, source_scope_enforced,
      ARRAY(
        SELECT p.permission_code
        FROM im_staff_permissions p
        WHERE p.staff_id = im_staff_accounts.id
          AND p.scope_type = 'source' AND p.revoked_at IS NULL
      ) AS source_permissions
    FROM im_staff_accounts
    WHERE id = ${claims.sub}::uuid
  `;
  const staff = result.rows[0];
  if (!staff || !isActiveImStaffStatus(staff.status)) return { ok: false, status: 401, error: 'IM account is inactive.' };
  const sourcePermissions = staff.source_scope_enforced
    ? staff.source_permissions.filter((permission) => imSourceScopedPermissionSet.has(permission))
    : [];

  return {
    ok: true,
    principal: {
      staffId: staff.id,
      username: staff.username,
      displayName: staff.display_name,
      accountType: staff.account_type,
      // Source grants are live database data, never flattened into long-lived token permissions.
      // Otherwise a source-only permission could become a broad legacy membership grant.
      permissions: claims.permissions,
      globalPermissions: claims.globalPermissions ?? [],
      tenantIds: claims.tenantIds,
      sourceScopeEnforced: staff.source_scope_enforced,
      sourcePermissions,
    },
  };
}

export function hasPermission(principal: ImStaffPrincipal, permission: string): boolean {
  return principal.accountType === 'super_admin'
    || principal.permissions.includes(permission)
    || (principal.sourceScopeEnforced && imSourceScopedPermissionSet.has(permission) && principal.sourcePermissions.includes(permission));
}

export function hasGlobalPermission(principal: ImStaffPrincipal, permission: string): boolean {
  return principal.accountType === 'super_admin' || principal.globalPermissions.includes(permission);
}

/**
 * Resolve an independent IM access token for the Socket.IO gateway.
 * The gateway receives only short-lived xtch claims; XT_MVP secrets never leave
 * this process and are not needed by the mobile client.
 */
export async function introspectImAccessToken(token: string): Promise<ImIntrospectionPrincipal | null> {
  const claims = verifyAccessToken(token);
  if (!claims) return null;
  const result = await sql<{ account_type: 'super_admin' | 'staff'; source_scope_enforced: boolean }>`
    SELECT account_type, source_scope_enforced
    FROM im_staff_accounts
    WHERE id = ${claims.sub}::uuid AND status = 'active'
  `;
  const staff = result.rows[0];
  if (!staff) return null;
  return {
    subject: claims.sub,
    role: staff.account_type === 'super_admin' ? 'platform_admin' : 'tenant_staff',
    tenantId: claims.tenantIds[0] ?? null,
    tenantIds: claims.tenantIds,
    scopes: claims.permissions,
    sourceScopeEnforced: staff.source_scope_enforced,
  };
}

export async function issueStaffTokens(
  staff: Pick<StaffRow, 'id' | 'account_type'>,
  options: { ipHash?: string; userAgentHash?: string; externalRole?: string; tokenFamily?: string } = {},
) {
  const permissionsResult = await sql<{
    permission_code: string | null;
    scope_type: 'global' | 'tenant' | 'source' | null;
    scope_id: string | null;
    source_scope_enforced: boolean;
  }>`
    SELECT p.permission_code, p.scope_type, p.scope_id, a.source_scope_enforced
    FROM im_staff_accounts a
    LEFT JOIN im_staff_permissions p ON p.staff_id = a.id AND p.revoked_at IS NULL
    WHERE a.id = ${staff.id}::uuid
  `;
  const activeRows = permissionsResult.rows.filter((row): row is typeof row & { permission_code: string; scope_type: 'global' | 'tenant' | 'source' } =>
    Boolean(row.permission_code && row.scope_type),
  );
  const sourceScopeEnforced = permissionsResult.rows[0]?.source_scope_enforced ?? false;
  const permissionSets = resolveStaffPermissionSets(activeRows, sourceScopeEnforced);
  if (staff.account_type !== 'super_admin' && !permissionSets.permissions.includes('im:conversation:read')) {
    throw new ImAccessDeniedError();
  }
  const now = Math.floor(Date.now() / 1000);
  const claims: JwtClaims = {
    iss: 'xtch',
    aud: 'im-mobile',
    sub: staff.id,
    jti: crypto.randomUUID(),
    iat: now,
    exp: now + ACCESS_TTL_SECONDS,
    permissions: permissionSets.tokenPermissions,
    globalPermissions: permissionSets.globalPermissions,
    tenantIds: permissionSets.tenantIds,
  };
  const accessToken = signAccessToken(claims);
  const refreshToken = randomToken();
  const sessionResult = await sql<{ id: string }>`
    INSERT INTO im_staff_sessions (
      staff_id, token_family, refresh_token_hash, expires_at, created_ip_hash, user_agent_hash
    ) VALUES (
      ${staff.id}::uuid,
      ${(options.tokenFamily ?? crypto.randomUUID())}::uuid,
      ${hashToken(refreshToken)},
      NOW() + INTERVAL '30 days',
      ${options.ipHash ?? null},
      ${options.userAgentHash ?? null}
    )
    RETURNING id
  `;
  await sql`
    UPDATE im_staff_accounts
    SET last_login_at = NOW(), updated_at = NOW(), external_role = COALESCE(${options.externalRole ?? null}, external_role)
    WHERE id = ${staff.id}::uuid
  `;

  return {
    accessToken,
    refreshToken,
    sessionId: sessionResult.rows[0]?.id ?? null,
    expiresIn: ACCESS_TTL_SECONDS,
    permissions: permissionSets.permissions,
    tenantIds: permissionSets.tenantIds,
  };
}

export class ImAccessDeniedError extends Error {
  constructor() {
    super('IM access is not enabled for this account.');
    this.name = 'ImAccessDeniedError';
  }
}

export async function introspectXtMvpToken(token: string): Promise<ExternalMvpPrincipal | null> {
  const baseUrl = process.env.XT_MVP_API_BASE_URL?.trim().replace(/\/+$/, '');
  if (!baseUrl) throw new Error('XT_MVP_API_BASE_URL is not configured.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3_000);
  try {
    const response = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { accept: 'application/json', authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as unknown;
    const data = isRecord(payload) && isRecord(payload.data) ? payload.data : payload;
    if (!isRecord(data)) return null;
    const subject = stringValue(data.id) || stringValue(data.sub);
    const role = stringValue(data.role);
    if (!subject || !role) return null;
    return {
      subject,
      username: stringValue(data.username) || undefined,
      role,
      tenantId: stringValue(data.tenant_id) || stringValue(data.tenantId) || null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function hashToken(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function randomToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('base64url');
  const digest = crypto.scryptSync(password, salt, 64).toString('base64url');
  return `scrypt$${salt}$${digest}`;
}

export function verifyPassword(password: string, encoded: string): boolean {
  const [, salt, digest] = encoded.split('$');
  if (!salt || !digest) return false;
  try {
    const actual = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(digest, 'base64url');
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function signAccessToken(claims: JwtClaims): string {
  const header = encodeJson({ alg: 'HS256', typ: 'JWT' });
  const body = encodeJson(claims);
  const signature = hmac(`${header}.${body}`);
  return `${header}.${body}.${signature}`;
}

function verifyAccessToken(token: string): JwtClaims | null {
  const secret = process.env.XTCH_IM_JWT_SECRET;
  if (!secret) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const expected = hmac(`${parts[0]}.${parts[1]}`);
  if (!safeEqual(parts[2]!, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8')) as JwtClaims;
    if (claims.iss !== 'xtch' || claims.aud !== 'im-mobile') return null;
    if (!claims.sub || !claims.jti || !Number.isFinite(claims.exp) || claims.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}

function hmac(value: string): string {
  const secret = process.env.XTCH_IM_JWT_SECRET;
  if (!secret) throw new Error('XTCH_IM_JWT_SECRET is not configured.');
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
