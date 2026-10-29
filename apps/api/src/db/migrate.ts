import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { closePool, getPool } from './index';

type MigrationFile = {
  version: string;
  filePath: string;
};

const migrationDirectory = path.join(__dirname, 'migrations');
const migrationLockKey = 'basketwise:schema-migrations';

async function listMigrations(): Promise<MigrationFile[]> {
  const fileNames = await readdir(migrationDirectory);

  return fileNames
    .filter((fileName) => /^\d{3}_[a-z0-9_]+\.sql$/i.test(fileName))
    .sort((left, right) => left.localeCompare(right))
    .map((fileName) => ({
      version: fileName,
      filePath: path.join(migrationDirectory, fileName),
    }));
}

export async function runMigrations(): Promise<void> {
  const client = await getPool().connect();
  let lockAcquired = false;

  try {
    await client.query('SELECT pg_advisory_lock(hashtext($1))', [migrationLockKey]);
    lockAcquired = true;

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        checksum CHAR(64) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const appliedResult = await client.query<{ version: string; checksum: string }>(
      'SELECT version, checksum FROM schema_migrations'
    );
    const appliedMigrations = new Map(
      appliedResult.rows.map((migration) => [migration.version, migration.checksum])
    );
    const migrations = await listMigrations();
    const availableVersions = new Set(migrations.map((migration) => migration.version));

    for (const appliedVersion of appliedMigrations.keys()) {
      if (!availableVersions.has(appliedVersion)) {
        throw new Error(`Applied migration ${appliedVersion} is missing from the migration directory.`);
      }
    }

    for (const migration of migrations) {
      const sql = await readFile(migration.filePath, 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const appliedChecksum = appliedMigrations.get(migration.version);

      if (appliedChecksum) {
        if (appliedChecksum !== checksum) {
          throw new Error(
            `Applied migration ${migration.version} has changed. Add a new migration instead of editing it.`
          );
        }
        continue;
      }

      console.log(`Applying database migration ${migration.version}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)',
          [migration.version, checksum]
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    console.log('Database migrations are up to date.');
  } finally {
    try {
      if (lockAcquired) {
        await client.query('SELECT pg_advisory_unlock(hashtext($1))', [migrationLockKey]);
      }
    } finally {
      client.release();
    }
  }
}

if (require.main === module) {
  runMigrations()
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown migration error.';
      console.error(`Database migration failed: ${message}`);
      process.exitCode = 1;
    })
    .finally(() => closePool());
}
