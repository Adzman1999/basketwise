import { Pool, type QueryResult, type QueryResultRow } from 'pg';
import { config } from '../config';

let pool: Pool | undefined;

export function validateTestDatabaseUrl(databaseUrl: string): void {
  let parsed: URL;

  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('TEST_DATABASE_URL must be a valid PostgreSQL connection URL.');
  }

  const localHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));

  if (
    !['postgres:', 'postgresql:'].includes(parsed.protocol) ||
    !localHosts.has(parsed.hostname) ||
    !databaseName.endsWith('_test')
  ) {
    throw new Error('Tests require a local PostgreSQL database whose name ends in _test.');
  }
}

export function getDatabaseUrl(): string {
  if (config.env === 'test') {
    if (!config.testDatabaseUrl) {
      throw new Error('TEST_DATABASE_URL is required when NODE_ENV=test.');
    }

    validateTestDatabaseUrl(config.testDatabaseUrl);
    return config.testDatabaseUrl;
  }

  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required to use the Basketwise database.');
  }

  return config.databaseUrl;
}

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseUrl(),
      ssl: config.isProduction ? { rejectUnauthorized: false } : false,
      max: config.isProduction ? 5 : 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }

  return pool;
}

export async function query<Row extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = []
): Promise<QueryResult<Row>> {
  return getPool().query<Row>(text, values as never[]);
}

export async function closePool(): Promise<void> {
  if (!pool) return;

  const activePool = pool;
  pool = undefined;
  await activePool.end();
}
