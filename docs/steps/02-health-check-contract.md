# Step 02: Health API contract

## Goal

Agree on the first API interface before implementing it. This contract defines one liveness check for the API process.

## Contract decisions

- `GET /api/health` follows Appointmo's existing health route convention.
- A successful response contains `status`, `app`, and an ISO 8601 UTC `timestamp`.
- This endpoint reports process liveness only; database readiness will be checked separately after the database connection exists.
- The response omits deployment environment details because callers do not need them to tell whether the API is running.

## Added in this checkpoint

- `postman/specs/basketwise.openapi.yaml` is the source of truth for the endpoint.
- A generated Postman collection provides a reusable request and assertions for the implementation step.

## Verification

The OpenAPI spec passes Postman syntax lint. Governance lint requires a Postman login and is not enabled. The generated collection passes structural lint; its assertions have not run because the API is not implemented yet.

## Next checkpoint

Implement the health endpoint to match the contract, add a focused API test, then connect a minimal React page to it.
