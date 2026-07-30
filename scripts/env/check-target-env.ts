/**
 * Fail-closed env check for a deploy target (no build).
 * Usage: npx tsx scripts/env/check-target-env.ts cloud-vps
 */
import { loadTargetEnv, normalizeTarget } from './targetEnv.ts';
import { assertTargetEnvValid, isProdDeployTarget } from './validateTargetEnv.ts';

const raw = process.argv[2] || process.env.DEPLOY_TARGET || '';
const target = normalizeTarget(raw || 'cloud-vps');

if (!isProdDeployTarget(target) && target !== 'tunnel' && target !== 'local') {
  console.error(`Unknown or unsupported target: ${raw || '(empty)'}`);
  process.exit(2);
}

const loaded = loadTargetEnv(target, { override: true });
assertTargetEnvValid(target, process.env, loaded?.path);
console.log(`OK: ${target} env valid (${loaded?.path ?? 'process.env only'})`);
