# Step 04: Web page connected to the API

## Goal

Add the first React page and connect it to the health endpoint through Vite's local `/api` proxy.

## UI behavior

- Show checking, connected, and unavailable states from the actual API response.
- Let the user retry after an error or manually refresh the check.
- Keep the endpoint and the limit of the liveness check visible for this development checkpoint.
- Use the OpenAPI response shape as the frontend TypeScript type.

## Added in this checkpoint

- React, TypeScript, Vite, and Tailwind workspace package.
- Responsive Basketwise introduction and API status card.
- API fetch helper and Vite proxy from `/api` to the Express server.
- Root scripts for running and checking both packages.

## Verification

- `pnpm typecheck` passed for API and web packages.
- `pnpm test` passed: the API health test passed.
- `pnpm build` passed for API and web packages.
- Local HTTP checks confirmed the Vite page/module load and the `/api/health` proxy response.
- Visual browser inspection could not run because this session had no available browser. The dev servers are left running for local review.

## Next checkpoint

Add initial CI checks for workspace typecheck, API tests, and production builds.
