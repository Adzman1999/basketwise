# Step 01: Project foundation

## Goal

Create a clean Basketwise repository and establish the same workspace and backend layering used by Appointmo. This step does not add product behavior or a runnable server.

## Decisions

- Use a separate Git repository at `Documents/portfolio/basketwise`; Appointmo remains unchanged.
- Use pnpm workspaces for `apps/api`, `apps/web`, and `packages/shared`.
- Use Node.js 24 LTS and pnpm 10.33.2 for the initial toolchain baseline.
- Keep secrets out of Git. `apps/api/.env.example` contains placeholders only.
- Scaffold local Postman directories and repository instructions now; author the first API contract when the health endpoint is designed. No Postman workspace is connected.
- Add CI after the API and web health-check slice has real scripts to verify. Add deployment automation after the deployment target and release steps are established.

## Added in this checkpoint

- Root package and pnpm workspace configuration.
- Node version pin and ignore rules for generated files and local secrets.
- Project README and this step record.
- API environment template for local and test database settings.
- Local Postman folders, an empty workspace binding, and generated API authoring guidance.

## Verification

- `pnpm install` completed with pnpm 10.33.2 and generated a lockfile for the empty workspace.
- `postman init --json --no-fetch` completed successfully. It created local artifacts only; workspace creation was skipped and no workspace is bound.
- `postman skills status` found the initial bundled guidance out of date; `postman skills update` refreshed the local Postman guidance and the repository instruction now points at `api-engineer`.
- Git author configuration has a name but no email. The initial commit is pending confirmation of an email linked to the user's GitHub account so later contribution attribution is preserved.
- No application tests run because the API and web packages do not exist yet.

## Next checkpoint

Add the smallest vertical slice: an Express `/health` endpoint and a React page that requests it. Then add the matching development scripts, document the behavior, and establish the first CI checks.
