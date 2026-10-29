# Basketwise API

The API uses Express and TypeScript. Request handling is organized as routes → controllers → services → repositories. The health endpoint needs no repository because it reports process state and reads no stored data.

## Local setup

From the repository root:

```sh
pnpm install
cp apps/api/.env.example apps/api/.env
pnpm dev:api
```

The health endpoint is available at `http://localhost:4000/api/health`.

## Database

Purchase records use PostgreSQL. Copy `apps/api/.env.example` to `apps/api/.env`, replace `YOUR_LOCAL_DB_USER` with your PostgreSQL role, create the local databases, and apply migrations:

```sh
createdb basketwise_dev
createdb basketwise_test
pnpm db:migrate
```

Run `pnpm db:migrate:test` to apply migrations to the test database. Test mode requires `TEST_DATABASE_URL` to point to localhost and a database name ending in `_test`.

The ordered SQL migrations live in `src/db/migrations`. The runner records each file's SHA-256 checksum, takes a PostgreSQL advisory lock, and applies each migration in a transaction. Applied migration files must not be edited; add a new numbered SQL file for later schema changes.

## API checks

```sh
pnpm typecheck:api
pnpm db:migrate:test
pnpm test:api
pnpm build:api
```
