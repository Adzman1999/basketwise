# Step 07: Grocery purchase persistence

## Goal

Implement the Step 06 API contract with PostgreSQL while keeping receipt creation transactional and tests isolated from development data.

## Database and migration

- Added direct `pg` access and Zod validation, following Appointmo's API patterns.
- Added `purchases` and `purchase_items` tables with PHP centavo amounts, decimal quantities, saved unit labels, line order, and a purchase-history index.
- Added a numbered SQL migration runner. It records SHA-256 checksums, serializes migration runs with a PostgreSQL advisory lock, and applies each migration transactionally. Applied migration files are immutable.
- Database access is lazy, so the liveness endpoint can start without making a database call.
- Test mode requires a local PostgreSQL URL whose database name ends in `_test`.

## API behavior

- `POST /api/purchases` validates and creates a purchase and all its line items in one transaction.
- `GET /api/purchases` returns line items newest purchase date first, with stable ordering and page/pageSize pagination.
- The receipt total remains authoritative. `unallocatedAmountCentavos` is computed from the receipt total minus line amounts.
- Validation and server errors use the error response shape defined in OpenAPI.

## Local setup

Copy `apps/api/.env.example` to `apps/api/.env`, replace the PostgreSQL role placeholder, then create and migrate the local databases:

```sh
createdb basketwise_dev
createdb basketwise_test
pnpm db:migrate
```

`pnpm test` applies migrations to `TEST_DATABASE_URL` and refuses remote or non-`_test` databases. The Postman collection creates a sample purchase, so run it against the test database if you do not want sample data in development.

## Verification

- `pnpm install --frozen-lockfile` passed.
- `pnpm db:migrate` and `pnpm db:migrate:test` applied migration `001_grocery_purchases.sql` locally.
- `pnpm typecheck` passed for API and web.
- `pnpm test` passed: 10 tests across purchase behavior, validation, database URL safety, and health.
- `pnpm build` passed for API and web.
- OpenAPI syntax lint and Postman collection lint passed.
- Postman ran 3 requests with 6 assertions and 0 failures against the built API on port 4001 using the isolated test database.
- The existing Vite CJS Node API deprecation warning remains during Vitest startup.

GitHub Actions now provisions PostgreSQL 15, applies test migrations, runs the API suite, builds the API, and executes the saved Postman collection. The workflow has not run remotely because this branch has not been pushed.

## Next checkpoint

Add normalized grocery item identities and price history as documented in [Step 09](09-grocery-item-catalog-and-price-history.md).
