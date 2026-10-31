# Step 13: Monthly grocery budget

## Goal

Let the household set a grocery spending target for each calendar month and compare it with saved receipts.

## Decisions

- This MVP has one household-wide budget target per month, consistent with the current single-household data model. It is not scoped to users or household IDs until authentication and household membership are designed.
- Monthly spending sums each saved receipt's `total_paid_centavos`, grouped by `purchased_on` in the selected month. Receipt items and store names do not affect budget totals.
- Budget targets are stored in PHP centavos, must be positive, and can be updated or removed independently for each month.
- The budget summary remains available when a month has no target; its `budgetCentavos` and `remainingCentavos` are `null` while receipt spending is still reported.

## Added

- Migration `005_monthly_budgets.sql` stores one target per month.
- `GET /api/budgets/{month}` returns the target and month-to-date receipt spending.
- `PUT /api/budgets/{month}` creates or replaces the target.
- `DELETE /api/budgets/{month}` removes only the target and retains receipts.
- OpenAPI and local Postman collection entries describe the monthly budget operations and response examples.
- A Monthly budget sidebar page lets the user choose a month, set or edit a target, remove it, and see spending progress and remaining/over-budget amount.
- README status and this checkpoint describe the implemented workflow and the single-household scope.

## Verification

- `pnpm typecheck` passed for the API and web app.
- `pnpm build` passed for the API and web app.
- `postman collection lint 'postman/collections/Basketwise API'` passed with no issues.
- OpenAPI syntax lint passed with `postman spec lint --issueType=syntax postman/specs/basketwise.openapi.yaml`.
- Migration `005_monthly_budgets.sql` was applied to the local `basketwise_dev` database; it only adds the monthly budget table.
- API behavior tests were not run in this session.

## Follow-up

Review the monthly budget flow, then choose between pantry stock tracking and food waste tracking for the next household workflow.
