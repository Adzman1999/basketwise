import { describe, expect, it } from 'vitest';
import { validateTestDatabaseUrl } from '../src/db';

describe('test database URL safety', () => {
  it('accepts a local PostgreSQL database ending in _test', () => {
    expect(() => validateTestDatabaseUrl(
      'postgresql://test_user:local_only@localhost:5432/basketwise_test'
    )).not.toThrow();
  });

  it('rejects a remote database even when its name ends in _test', () => {
    expect(() => validateTestDatabaseUrl(
      'postgresql://test_user:local_only@db.example.com:5432/basketwise_test'
    )).toThrow('Tests require a local PostgreSQL database whose name ends in _test.');
  });

  it('rejects a local database without the _test suffix', () => {
    expect(() => validateTestDatabaseUrl(
      'postgresql://test_user:local_only@localhost:5432/basketwise_dev'
    )).toThrow('Tests require a local PostgreSQL database whose name ends in _test.');
  });

  it('rejects a malformed database URL', () => {
    expect(() => validateTestDatabaseUrl('not-a-database-url'))
      .toThrow('TEST_DATABASE_URL must be a valid PostgreSQL connection URL.');
  });
});
