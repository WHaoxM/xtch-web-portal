/**
 * Shared env resolution for all targets.
 *
 * Canonical path: env/<target>/.env
 * One-round fallback: app/.env.<target>.local (win11-home also tries .env.selfhost.local)
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TARGETS = ['local', 'tunnel', 'win11-home', 'cloud-vps'] as const;
export type Target = (typeof TARGETS)[number];

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(scriptDir, '../..');

const warnedLegacy = new Set<string>();

export function normalizeTarget(raw: string): Target {
  const value = raw.trim();
  if (value === 'dev' || value === 'development' || value === 'production') {
    return 'local';
  }
  if (value === 'selfhost') {
    return 'win11-home';
  }
  if ((TARGETS as readonly string[]).includes(value)) {
    return value as Target;
  }
  throw new Error(
    `Unknown env target "${raw}". Use ${TARGETS.join('|')} (aliases: selfhost→win11-home, dev|development|production→local).`,
  );
}

/** Canonical path: env/<target>/.env (may not exist yet). */
export function resolveTargetEnvPath(target: string): string {
  const normalized = normalizeTarget(target);
  return path.join(repoRoot, 'env', normalized, '.env');
}

export function targetEnvExampleHint(target: string): string {
  const normalized = normalizeTarget(target);
  return `Copy env/${normalized}/.env.example → env/${normalized}/.env`;
}

/**
 * Resolve which file to load: new path first, then legacy app/.env.*.local.
 * Returns null if neither exists.
 */
export function resolveTargetEnvFile(target: string): {
  path: string;
  legacy: boolean;
  target: Target;
} | null {
  const normalized = normalizeTarget(target);
  const preferred = resolveTargetEnvPath(normalized);
  if (existsSync(preferred)) {
    return { path: preferred, legacy: false, target: normalized };
  }

  const legacyCandidates: string[] = [];
  if (normalized === 'local') {
    legacyCandidates.push(path.join(repoRoot, 'app', '.env.local'));
  } else {
    legacyCandidates.push(path.join(repoRoot, 'app', `.env.${normalized}.local`));
  }
  if (normalized === 'win11-home') {
    legacyCandidates.push(path.join(repoRoot, 'app', '.env.selfhost.local'));
  }

  for (const candidate of legacyCandidates) {
    if (existsSync(candidate)) {
      return { path: candidate, legacy: true, target: normalized };
    }
  }

  return null;
}

function parseEnvLine(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const eq = trimmed.indexOf('=');
  if (eq <= 0) return null;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return { key, value };
}

export function applyEnvFileContent(
  content: string,
  { override }: { override: boolean },
): void {
  for (const line of content.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;
    if (override || !(parsed.key in process.env)) {
      process.env[parsed.key] = parsed.value;
    }
  }
}

export type LoadTargetEnvResult = {
  path: string;
  legacy: boolean;
  target: Target;
};

/**
 * Load env/<target>/.env into process.env.
 * Falls back once to legacy app/.env.*.local paths (with a single console.warn).
 */
export function loadTargetEnv(
  target: string,
  { override = true }: { override?: boolean } = {},
): LoadTargetEnvResult | null {
  const resolved = resolveTargetEnvFile(target);
  if (!resolved) return null;

  const content = readFileSync(resolved.path, 'utf8');
  applyEnvFileContent(content, { override });

  if (resolved.legacy && !warnedLegacy.has(resolved.path)) {
    warnedLegacy.add(resolved.path);
    const relLegacy = path.relative(repoRoot, resolved.path).replace(/\\/g, '/');
    const relNew = path.relative(repoRoot, resolveTargetEnvPath(resolved.target)).replace(/\\/g, '/');
    console.warn(
      `[targetEnv] Using legacy ${relLegacy}. Migrate to ${relNew} (${targetEnvExampleHint(resolved.target)}).`,
    );
  }

  return resolved;
}

/** Require a target env file or throw with a uniform copy hint. */
export function requireTargetEnv(
  target: string,
  { override = true }: { override?: boolean } = {},
): LoadTargetEnvResult {
  const loaded = loadTargetEnv(target, { override });
  if (!loaded) {
    throw new Error(
      `Missing env for target "${normalizeTarget(target)}". ${targetEnvExampleHint(target)} and fill secrets.`,
    );
  }
  return loaded;
}
