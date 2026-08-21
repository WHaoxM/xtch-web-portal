import { createClient, sql as vercelSql } from '@vercel/postgres';
import pg from 'pg';

const { Pool } = pg;

function getConnectionString(): string {
  return process.env.POSTGRES_URL || '';
}

function isVercelPostgresUrl(url: string): boolean {
  return url.includes('-pooler.') || url.includes('neon.tech') || url.includes('vercel-postgres');
}

let pgPool: pg.Pool | null = null;

function getPgPool(): pg.Pool {
  if (!pgPool) {
    const connectionString = getConnectionString();
    if (!connectionString) {
      throw new Error('POSTGRES_URL is not configured.');
    }
    pgPool = new Pool({ connectionString });
  }
  return pgPool;
}

export type SqlResult<T = Record<string, unknown>> = {
  rows: T[];
  rowCount: number | null;
  command: string | null;
};

export type SqlClient = {
  <T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]): Promise<SqlResult<T>>;
};

async function runPgQuery<T>(client: pg.PoolClient, strings: TemplateStringsArray, values: unknown[]): Promise<SqlResult<T>> {
  const query = strings.reduce((acc, str, i) => {
    return acc + str + (i < values.length ? `$${i + 1}` : '');
  }, '');

  const result = await client.query(query, values);
  return {
    rows: result.rows as T[],
    rowCount: result.rowCount ?? null,
    command: result.command ?? null,
  };
}

export async function sql<T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<SqlResult<T>> {
  const url = getConnectionString();

  if (isVercelPostgresUrl(url)) {
    return vercelSql(strings, ...(values as never[])) as unknown as Promise<SqlResult<T>>;
  }

  if (!url) {
    throw new Error('POSTGRES_URL is not configured.');
  }

  const client = await getPgPool().connect();
  try {
    return await runPgQuery<T>(client, strings, values);
  } finally {
    client.release();
  }
}

sql.begin = async function begin<T>(callback: (tx: SqlClient) => Promise<T>): Promise<T> {
  const url = getConnectionString();

  if (isVercelPostgresUrl(url)) {
    const client = createClient();
    await client.connect();
    try {
      await client.sql`BEGIN`;

      const tx: SqlClient = <R = Record<string, unknown>>(
        strings: TemplateStringsArray,
        ...innerValues: unknown[]
      ) => client.sql(strings, ...(innerValues as never[])) as unknown as Promise<SqlResult<R>>;

      const result = await callback(tx);
      await client.sql`COMMIT`;
      return result;
    } catch (error) {
      try {
        await client.sql`ROLLBACK`;
      } catch {
        // Ignore rollback errors
      }
      throw error;
    } finally {
      await client.end();
    }
  }

  if (!url) {
    throw new Error('POSTGRES_URL is not configured.');
  }

  const client = await getPgPool().connect();
  try {
    await client.query('BEGIN');

    const tx: SqlClient = <R = Record<string, unknown>>(
      strings: TemplateStringsArray,
      ...innerValues: unknown[]
    ) => runPgQuery<R>(client, strings, innerValues);

    const result = await callback(tx);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback errors
    }
    throw error;
  } finally {
    client.release();
  }
};

sql.end = async () => {
  const url = getConnectionString();
  if (isVercelPostgresUrl(url)) {
    return vercelSql.end();
  }
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
};
