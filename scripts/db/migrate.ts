import { readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sql, type SqlClient } from '../../app/api/lib/db';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');
const migrationsDir = path.join(repoRoot, 'app', 'api', 'migrations');

function parseArgs(argv: string[]) {
  let envName = 'local';
  let command = 'up';

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--env') {
      const value = argv[i + 1];
      if (!value || value.startsWith('-')) {
        throw new Error('Missing value for --env (expected local|tunnel)');
      }
      envName = value;
      i += 1;
      continue;
    }
    if (arg.startsWith('--env=')) {
      envName = arg.slice('--env='.length);
      continue;
    }
    if (!arg.startsWith('-') && command === 'up') {
      command = arg;
    }
  }

  return { envName, command };
}

function resolveEnvFile(envName: string) {
  if (envName === 'local' || envName === 'dev') {
    return path.join(repoRoot, 'app', '.env.local');
  }
  if (envName === 'tunnel') {
    return path.join(repoRoot, 'app', '.env.tunnel.local');
  }
  throw new Error(`Unknown --env ${envName}. Use local or tunnel.`);
}

function loadEnvFile(filePath: string, { override }: { override: boolean }) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (override || !(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // File may not exist; POSTGRES_URL can still come from the shell.
  }
}

export type Migration = {
  name: string;
  up: (tx: SqlClient) => Promise<void>;
};

async function ensureMigrationsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS migrations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS migrations_name_idx ON migrations (name)`;
}

async function listPendingMigrations(): Promise<Migration[]> {
  let entries: string[];
  try {
    entries = await readdir(migrationsDir);
  } catch {
    console.error(`Migrations directory not found: ${migrationsDir}`);
    return [];
  }

  const files = entries
    .filter((entry) => /^\d+_.*\.(ts|mjs|js)$/.test(entry))
    .sort((a, b) => a.localeCompare(b, 'en'));

  const result: Migration[] = [];
  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const fileUrl = pathToFileURL(filePath).href;
    const module = (await import(fileUrl)) as { name?: string; up?: (tx: SqlClient) => Promise<void> };
    const name = module.name ?? file;
    if (typeof module.up !== 'function') {
      console.warn(`Migration ${file} does not export an up function; skipping.`);
      continue;
    }
    result.push({ name, up: module.up });
  }
  return result;
}

async function getAppliedMigrationNames(): Promise<Set<string>> {
  const result = await sql<{ name: string }>`SELECT name FROM migrations`;
  return new Set(result.rows.map((row) => row.name));
}

async function main() {
  const { envName, command } = parseArgs(process.argv.slice(2));
  const envFile = resolveEnvFile(envName);
  // Tunnel mode must win over any shell leftovers so we never migrate the daily `xtch` DB by accident.
  loadEnvFile(envFile, { override: envName === 'tunnel' });

  if (command !== 'up') {
    console.error(`Unknown command: ${command}. Only 'up' is supported.`);
    process.exit(1);
  }

  if (!process.env.POSTGRES_URL) {
    throw new Error(
      `POSTGRES_URL is missing. Set it in ${path.relative(repoRoot, envFile)} (or export it in the shell).`,
    );
  }

  console.log(`Using env file: ${path.relative(repoRoot, envFile)}`);
  console.log(`Target: ${process.env.POSTGRES_URL.replace(/:[^:@/]+@/, ':***@')}`);

  await ensureMigrationsTable();
  const pending = await listPendingMigrations();
  const applied = await getAppliedMigrationNames();

  const toRun = pending.filter((migration) => !applied.has(migration.name));

  if (toRun.length === 0) {
    console.log('No pending migrations.');
    return;
  }

  console.log(`Running ${toRun.length} migration(s)...`);

  for (const migration of toRun) {
    await sql.begin(async (tx) => {
      console.log(`  Applying: ${migration.name}`);
      await migration.up(tx);
      await tx`INSERT INTO migrations (name) VALUES (${migration.name})`;
    });
  }

  console.log('Migrations complete.');
}

main()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end().catch(() => undefined);
  });
