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

## API checks

```sh
pnpm typecheck:api
pnpm test:api
pnpm build:api
```
