# Basketwise

Basketwise is a home food cost system for tracking grocery spending, food prices, household budgets, pantry stock, and waste.

## Project status

The repository foundation, API health endpoint, and first API-connected web page are ready. Initial CI checks are the next checkpoint.

## Planned stack

- pnpm workspaces with `apps/api`, `apps/web`, and `packages/shared`
- Web: React, TypeScript, Vite, and Tailwind CSS
- API: Node.js, Express, TypeScript, and Zod
- Database: PostgreSQL, with migrations and seeds
- Backend flow: HTTP routes → controllers → services → repositories → database

## Local setup

Requirements for the current API and web checkpoint: Node.js 24 or newer and pnpm 10.33.2. PostgreSQL 15 or newer will be needed when database integration is added.

```sh
pnpm install
pnpm dev
```

The API starts at `http://localhost:4000`, and the web app starts at `http://localhost:5173`. The page checks `GET /api/health` through the Vite development proxy. The template at `apps/api/.env.example` can be copied to `apps/api/.env` to override local settings; its database and JWT values are reserved for later checkpoints.

Check the workspace with `pnpm typecheck`, `pnpm test`, and `pnpm build`.

## Development checkpoints

Each checkpoint is documented under [`docs/steps`](docs/steps/). The API, UI, migrations, test setup, CI, and deployment pipeline will be added incrementally and recorded as they are built.
