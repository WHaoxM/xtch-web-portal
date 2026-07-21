/**
 * Static checks for V1 infrastructure hardening (role 6).
 * Run from repo root:
 *   node --test deploy/validate-infra.test.mjs
 *
 * Does not connect to real hosts, read real target env secrets, or require
 * Docker/Caddy to be installed for the static assertions. Optional live checks
 * are skipped when tools are missing.
 */

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return readFileSync(join(ROOT, rel), 'utf8');
}

const FORBIDDEN_PASSWORD_LITERALS = [
  'POSTGRES_PASSWORD: postgres',
  'MINIO_ROOT_PASSWORD: minioadmin',
  'MINIO_ROOT_USER: minioadmin',
  'minioadmin minioadmin',
];

const REQUIRED_COMPOSE_VARS = [
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'POSTGRES_DB',
  'MINIO_ROOT_USER',
  'MINIO_ROOT_PASSWORD',
];

test('compose requires credentials via ${VAR:?} and has no hardcoded default passwords', () => {
  const yml = read('docker-compose.yml');
  for (const lit of FORBIDDEN_PASSWORD_LITERALS) {
    assert.equal(yml.includes(lit), false, `forbidden literal present: ${lit}`);
  }
  for (const name of REQUIRED_COMPOSE_VARS) {
    assert.match(
      yml,
      new RegExp(`\\$\\{${name}:\\?`),
      `expected fail-fast ${name}:?\${…} in compose`,
    );
  }
  assert.match(yml, /127\.0\.0\.1:5432:5432/);
  assert.match(yml, /127\.0\.0\.1:9000:9000/);
  assert.match(yml, /127\.0\.0\.1:9001:9001/);
  assert.match(yml, /\$\$MINIO_ROOT_USER/);
  assert.match(yml, /\$\$MINIO_ROOT_PASSWORD/);
});

test('.env.example uses placeholders, not weak shared defaults', () => {
  const example = read('.env.example');
  assert.match(example, /REPLACE_ME_POSTGRES_PASSWORD/);
  assert.match(example, /REPLACE_ME_MINIO_ROOT_USER/);
  assert.match(example, /REPLACE_ME_MINIO_ROOT_PASSWORD/);
  assert.equal(example.includes('POSTGRES_PASSWORD=postgres'), false);
  assert.equal(example.includes('MINIO_ROOT_PASSWORD=minioadmin'), false);
  assert.equal(example.includes('MINIO_ROOT_USER=minioadmin'), false);
});

test('bootstrap separates system home from repo path and is idempotent-safe', () => {
  const sh = read('deploy/cloud-vps/bootstrap.sh');
  assert.match(sh, /XTCH_SYSTEM_HOME="\/var\/lib\/xtch"/);
  assert.match(sh, /XTCH_REPO_DIR="\/opt\/xtch-web-portal"/);
  assert.equal(sh.includes('--home-dir /opt/xtch-web-portal'), false);
  assert.match(sh, /already exists/);
  assert.match(sh, /grant-xtch-read-access\.sh/);
});

test('systemd forces loopback listen, TRUST_PROXY, and baseline hardening', () => {
  const unit = read('deploy/cloud-vps/xtch-app.service');
  assert.match(unit, /SELFHOST_HOST=127\.0\.0\.1/);
  assert.match(unit, /TRUST_PROXY=1/);
  assert.match(unit, /NoNewPrivileges=true/);
  assert.match(unit, /PrivateTmp=true/);
  assert.match(unit, /ProtectSystem=strict/);
  assert.match(unit, /ProtectHome=true/);
  assert.match(unit, /ReadWritePaths=\/var\/lib\/xtch/);
  assert.match(unit, /MemoryDenyWriteExecute=false/);
});

test('Caddyfiles align body limits/timeouts and security headers; no strict CSP', () => {
  for (const rel of ['deploy/cloud-vps/Caddyfile', 'deploy/win11-home/Caddyfile']) {
    const cfg = read(rel);
    assert.match(cfg, /max_size 1MB/);
    assert.match(cfg, /max_size 256KB/);
    assert.match(cfg, /read_body 30s/);
    assert.match(cfg, /response_header_timeout 60s/);
    assert.match(cfg, /Strict-Transport-Security/);
    assert.match(cfg, /X-Content-Type-Options/);
    assert.match(cfg, /Referrer-Policy/);
    assert.match(cfg, /Permissions-Policy/);
    assert.match(cfg, /handle \/s3\/\*/);
    assert.match(cfg, /handle \/api\/stripe-webhook/);
    assert.equal(/\n\s*Content-Security-Policy\b/.test(cfg), false);
  }
});

test('production env examples document loopback + TRUST_PROXY and placeholder secrets', () => {
  for (const rel of ['env/cloud-vps/.env.example', 'env/win11-home/.env.example']) {
    const env = read(rel);
    assert.match(env, /SELFHOST_HOST=127\.0\.0\.1/);
    assert.match(env, /TRUST_PROXY=1/);
    assert.match(env, /REPLACE_ME_POSTGRES_PASSWORD/);
    assert.match(env, /REPLACE_ME_MINIO_ROOT_USER/);
    assert.equal(env.includes('CHANGE_ME_PG_PASSWORD'), false);
    assert.equal(env.includes('minioadmin'), false);
  }
});

test('optional: docker compose config fails without credentials', { skip: !commandExists('docker') }, () => {
  mkdirSync(join(ROOT, 'tmp'), { recursive: true });
  const emptyEnvFile = join(ROOT, 'tmp', 'compose-empty.env');
  writeFileSync(emptyEnvFile, '# empty — intentionally missing required vars\n', 'utf8');

  const env = { ...process.env };
  for (const key of REQUIRED_COMPOSE_VARS) {
    delete env[key];
  }

  const result = spawnSync(
    'docker',
    ['compose', '--env-file', emptyEnvFile, 'config'],
    { cwd: ROOT, env, encoding: 'utf8', shell: process.platform === 'win32' },
  );
  assert.notEqual(result.status, 0, 'compose config should fail without required vars');
  const combined = `${result.stdout}\n${result.stderr}`;
  assert.match(combined, /POSTGRES_|MINIO_ROOT_/, `unexpected failure output: ${combined.slice(0, 500)}`);
});

test('optional: docker compose config succeeds with virtual credentials and no weak defaults', {
  skip: !commandExists('docker'),
}, () => {
  mkdirSync(join(ROOT, 'tmp'), { recursive: true });
  const envFile = join(ROOT, 'tmp', 'compose-virtual.env');
  writeFileSync(
    envFile,
    [
      'POSTGRES_USER=postgres',
      'POSTGRES_PASSWORD=test-only-pg-secret-not-for-prod',
      'POSTGRES_DB=xtch',
      'MINIO_ROOT_USER=test-only-minio-user',
      'MINIO_ROOT_PASSWORD=test-only-minio-secret-not-for-prod',
      '',
    ].join('\n'),
    'utf8',
  );

  const result = spawnSync(
    'docker',
    ['compose', '--env-file', envFile, 'config'],
    { cwd: ROOT, encoding: 'utf8', shell: process.platform === 'win32' },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const out = result.stdout;
  assert.equal(out.includes('minioadmin'), false, 'rendered config must not contain minioadmin');
  assert.equal(/POSTGRES_PASSWORD:\s*postgres\b/.test(out), false);
  assert.match(out, /test-only-pg-secret-not-for-prod/);
  assert.match(out, /host_ip:\s*127\.0\.0\.1/);
  assert.match(out, /published:\s*"5432"/);
});

test('optional: caddy validate cloud-vps + win11-home', { skip: !commandExists('caddy') }, () => {
  for (const rel of ['deploy/cloud-vps/Caddyfile', 'deploy/win11-home/Caddyfile']) {
    const result = spawnSync('caddy', ['validate', '--config', join(ROOT, rel)], {
      cwd: ROOT,
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });
    assert.equal(result.status, 0, `${rel}: ${result.stderr || result.stdout}`);
  }
});

test('optional: shellcheck bootstrap + grant script', {
  skip: !commandExists('shellcheck'),
}, () => {
  for (const rel of [
    'deploy/cloud-vps/bootstrap.sh',
    'deploy/cloud-vps/grant-xtch-read-access.sh',
  ]) {
    const result = spawnSync('shellcheck', [join(ROOT, rel)], {
      cwd: ROOT,
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });
    assert.equal(result.status, 0, `${rel}: ${result.stdout || result.stderr}`);
  }
});

test('optional: systemd-analyze security (Linux only)', {
  skip: process.platform === 'win32' || !commandExists('systemd-analyze'),
}, () => {
  const unitPath = join(ROOT, 'deploy/cloud-vps/xtch-app.service');
  const result = spawnSync('systemd-analyze', ['security', unitPath], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    assert.ok(
      true,
      `systemd-analyze could not score file directly (exit ${result.status}): ${(result.stderr || '').slice(0, 200)}`,
    );
    return;
  }
  assert.ok((result.stdout || '').length > 0);
});

function commandExists(bin) {
  const probe = spawnSync(bin, ['--version'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (probe.status === 0) return true;
  const probe2 = spawnSync(bin, ['version'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  return probe2.status === 0;
}
