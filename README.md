# Basketwise

Basketwise is a home food cost system for tracking grocery spending, food prices, household budgets, pantry stock, and waste.

## Project status

The repository foundation, CI checks, database-backed grocery purchase API, purchase entry/history UI, normalized grocery item catalog, and price-history API are ready. The next checkpoint is catalog browsing and price-history views in the UI.

## Planned stack

- pnpm workspaces with `apps/api`, `apps/web`, and `packages/shared`
- Web: React, TypeScript, Vite, and Tailwind CSS
- API: Node.js, Express, TypeScript, and Zod
- Database: PostgreSQL, with migrations and seeds
- Backend flow: HTTP routes → controllers → services → repositories → database

## Local setup

Requirements: Node.js 24 or newer, pnpm 10.33.2, and PostgreSQL 15 or newer.

```sh
pnpm install
cp apps/api/.env.example apps/api/.env
createdb basketwise_dev
createdb basketwise_test
pnpm db:migrate
pnpm dev
```

Replace `YOUR_LOCAL_DB_USER` in `apps/api/.env` with your local PostgreSQL role. `pnpm test` uses `TEST_DATABASE_URL` and only accepts a local database whose name ends in `_test`.

The API starts at `http://localhost:4000`, and the web app starts at `http://localhost:5173`. The page checks `GET /api/health` through the Vite development proxy. Database URLs in `apps/api/.env.example` configure local development and test databases; the JWT value is reserved for a later authentication checkpoint.

Check the workspace with `pnpm typecheck`, `pnpm test`, and `pnpm build`. `pnpm db:migrate` applies schema changes to the development database; tests apply them to the separate test database.

## Development checkpoints

Each checkpoint is documented under [`docs/steps`](docs/steps/). The API, UI, migrations, test setup, CI, and deployment pipeline are added incrementally and recorded as they are built.
