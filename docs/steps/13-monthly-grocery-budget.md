# Step 13: Grocery budgets and spending periods

## Goal

Let the household review grocery receipt spending by day, week, month, year, or a custom date range, and optionally set a target for that exact period.

## Decisions

- This MVP has one household-wide target for each exact period, consistent with the current single-household data model. Targets are not scoped to user or household IDs until authentication and household membership are designed.
- Weekly periods run Monday through Sunday. Day, month, and year use calendar boundaries. Custom date ranges include both their start and end dates.
- Each period has its own optional target. Weekly and daily targets are not prorated from a monthly target.
- Targets can only be created or updated for periods ending today or later in Asia/Manila; past periods remain available for spending review.
- Spending sums saved receipt totals by purchase date and includes a receipt count. It does not calculate recipe or ingredient food cost; recipe costing is a separate future workflow.
- Existing monthly targets are preserved and migrated into the generalized period table.

## Added

- Migration `005_monthly_budgets.sql` created the first monthly target table; migration `006_budget_periods.sql` generalizes it while preserving any saved monthly targets.
- `GET /api/budgets/{periodType}/{startsOn}/{endsOn}` returns spending, receipt count, and the optional target for an inclusive period.
- `GET /api/budgets/calendar/{month}` returns each day’s optional target, receipt spending, count, remaining amount, and status for calendar markers.
- `PUT /api/budgets/{periodType}/{startsOn}/{endsOn}` creates or replaces that period's positive target.
- `DELETE /api/budgets/{periodType}/{startsOn}/{endsOn}` removes a target while retaining receipts.
- API validation and database constraints enforce canonical day, week, month, and year bounds. Custom ranges accept any valid inclusive date range.
- OpenAPI and the local Postman collection describe the budget operations and their response examples.
- The Budget & spending page provides period selection, a daily target calendar with budget status markers, receipt totals, receipt counts, optional targets, and remaining or over-target progress.
- Purchase creation requires choosing a spending period first; its receipt date determines which period includes its total, and custom ranges constrain the receipt date to that range.
- Receipt spending is separate from future recipe and ingredient costing.

## Verification

- `pnpm typecheck` passed for the API and web app.
- `pnpm build` passed for the API and web app.
- `postman collection lint 'postman/collections/Basketwise API'` passed with no issues.
- OpenAPI syntax lint passed with `postman spec lint --issueType=syntax postman/specs/basketwise.openapi.yaml`.
- Migration `006_budget_periods.sql` was applied to the local `basketwise_dev` database after implementation.
- The daily calendar endpoint and UI passed `pnpm build`; the Postman collection and OpenAPI syntax lints passed after adding the calendar response.
- API behavior tests were not run in this session.

## Follow-up

Review period totals in the app, then choose the next household workflow, such as pantry stock or food waste tracking. Recipe and ingredient food costing remains a separate future feature.
