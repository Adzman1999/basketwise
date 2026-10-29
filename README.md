# Basketwise

Basketwise is a home food cost system for tracking grocery spending, food prices, household budgets, pantry stock, and waste.

## Project status

The repository foundation and first API endpoint are ready. The web app and initial CI checks are the next checkpoints.

## Planned stack

- pnpm workspaces with `apps/api`, `apps/web`, and `packages/shared`
- Web: React, TypeScript, Vite, and Tailwind CSS
- API: Node.js, Express, TypeScript, and Zod
- Database: PostgreSQL, with migrations and seeds
- Backend flow: HTTP routes → controllers → services → repositories → database

## Local setup

Requirements for the current API checkpoint: Node.js 24 or newer and pnpm 10.33.2. PostgreSQL 15 or newer will be needed when database integration is added.

```sh
pnpm install
pnpm dev:api
```

The API starts at `http://localhost:4000`; check `http://localhost:4000/api/health`. The template at `apps/api/.env.example` can be copied to `apps/api/.env` to override local settings. Its database and JWT values are reserved for later checkpoints.

Check the API package with `pnpm typecheck:api`, `pnpm test:api`, and `pnpm build:api`.

## Development checkpoints

Each checkpoint is documented under [`docs/steps`](docs/steps/). The API, UI, migrations, test setup, CI, and deployment pipeline will be added incrementally and recorded as they are built.
