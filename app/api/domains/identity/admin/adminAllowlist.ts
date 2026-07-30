export type AdminRole = 'ops' | 'tech';

/** Example-file placeholders — never treat as a real production allowlist entry. */
const PLACEHOLDER_EMAILS = new Set(['you@example.com']);

export type AdminAllowlistStatus = {
  /** At least one email configured across ops/tech/legacy lists. */
  configured: boolean;
  /** New lists empty; only deprecated ADMIN_EMAIL_ALLOWLIST is set. */
  usingDeprecatedOnly: boolean;
  /** Configured, but every entry is a known placeholder. */
  onlyPlaceholders: boolean;
  /** At least one non-placeholder email exists (G1 pass). */
  hasUsableEmails: boolean;
};

let deprecatedWarnLogged = false;

function parseEmailList(raw: string | undefined): string[] {
  return (raw || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function isPlaceholderEmail(email: string): boolean {
  return PLACEHOLDER_EMAILS.has(email.toLowerCase());
}

function readLists() {
  const tech = parseEmailList(process.env.ADMIN_TECH_EMAIL_ALLOWLIST);
  const ops = parseEmailList(process.env.ADMIN_OPS_EMAIL_ALLOWLIST);
  const legacy = parseEmailList(process.env.ADMIN_EMAIL_ALLOWLIST);
  return { tech, ops, legacy };
}

/**
 * Server-side role resolution (single source of truth).
 * tech wins over ops when an email appears in both lists.
 * Legacy ADMIN_EMAIL_ALLOWLIST (when new lists are empty) maps entirely to tech (C1).
 */
export function resolveAdminRole(email: string): AdminRole | null {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const { tech, ops, legacy } = readLists();
  const usingDeprecatedOnly = tech.length === 0 && ops.length === 0 && legacy.length > 0;

  if (usingDeprecatedOnly) {
    if (!deprecatedWarnLogged) {
      deprecatedWarnLogged = true;
      console.warn(
        '[adminAllowlist] ADMIN_EMAIL_ALLOWLIST is deprecated; treat all entries as tech. Prefer ADMIN_TECH_EMAIL_ALLOWLIST / ADMIN_OPS_EMAIL_ALLOWLIST.',
      );
    }
    return legacy.includes(normalized) ? 'tech' : null;
  }

  const inTech = tech.includes(normalized);
  const inOps = ops.includes(normalized);
  if (inTech) return 'tech';
  if (inOps) return 'ops';
  return null;
}

export function getAdminAllowlistStatus(): AdminAllowlistStatus {
  const { tech, ops, legacy } = readLists();
  const all = [...tech, ...ops, ...legacy];
  const configured = all.length > 0;
  const usingDeprecatedOnly = tech.length === 0 && ops.length === 0 && legacy.length > 0;
  const usable = all.filter((email) => !isPlaceholderEmail(email));
  const hasUsableEmails = usable.length > 0;
  return {
    configured,
    usingDeprecatedOnly,
    onlyPlaceholders: configured && !hasUsableEmails,
    hasUsableEmails,
  };
}

/** Test helper — resets the one-shot deprecated warn flag. */
export function resetAdminAllowlistWarnForTests(): void {
  deprecatedWarnLogged = false;
}
