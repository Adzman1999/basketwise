# Step 03: Express health endpoint

## Goal

Implement the committed `GET /api/health` contract with the smallest runnable Express API package.

## Backend flow

The request moves through `routes/health.ts` → `controllers/healthController.ts` → `services/healthService.ts`. There is no repository or database call because liveness is process metadata, not persisted domain data.

`app.ts` exports `createApp()` without starting a listener. `server.ts` is the executable entry point. This keeps HTTP tests isolated from port management.

## Added in this checkpoint

- API package scripts and dependencies matching Appointmo's Express/TypeScript conventions.
- Health route, controller, service, and server entry point.
- Vitest/Supertest coverage for status, content type, exact response fields, and UTC timestamp shape.

## Verification

- `pnpm typecheck:api` passed.
- `pnpm test:api` passed: 1 Vitest/Supertest test covering HTTP status, content type, fields, and timestamp.
- `pnpm build:api` passed.
- The local Postman collection run passed: 1 request, 2 assertions, 0 failures.
- The development server was stopped after the live check. No database or remote workspace was involved.

## Next checkpoint

Add a small React page that fetches the health endpoint, then introduce the first CI workflow for the now-runnable workspace.
