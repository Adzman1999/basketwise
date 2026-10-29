# Basketwise

Basketwise is a home food cost system for tracking grocery spending, food prices, household budgets, pantry stock, and waste.

## Project status

The first checkpoint sets up the repository and workspace. The API and web app will be added in the next checkpoint as a small, working health-check flow.

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
```

The API environment template is at `apps/api/.env.example`. Copy it to `apps/api/.env` when the API checkpoint is added, then set the local database connection and a private development secret. No server or database commands are available in this foundation checkpoint yet.

## Development checkpoints

Each checkpoint is documented under [`docs/steps`](docs/steps/). The API, UI, migrations, test setup, CI, and deployment pipeline will be added incrementally and recorded as they are built.
