# Step 06: First persisted feature — grocery purchase capture

## Status

Proposed domain model. No database migration or endpoint is implemented yet.

## Goal

Record grocery spending in a way that keeps the receipt total and its individual food costs available for later price history.

## Proposed v1 record

A purchase contains:

- Purchase date.
- Store name, optional.
- Currency code, required and recorded per purchase so amounts from different currencies are never silently combined.
- Total paid, recorded from the receipt.
- One or more line items. Each line has the item name as entered, quantity, unit, and amount paid for that line.

The item name is a receipt-time snapshot. There is no shared product catalog in this first feature, so matching differently named items into one price history is a later feature. The purchase total remains authoritative for grocery spending; line amounts support item-level cost history and may need a separate receipt adjustment when taxes or discounts are not allocated to lines.

## V1 boundaries

- No household budgets, pantry stock, recipes, waste tracking, or product catalog.
- No currency conversion.
- No automatic unit conversion; quantity and unit are saved as entered.
- No sign-in or multiple-household ownership in this checkpoint. The API is still a local, single-user development application.

## Decisions to settle before the migration and API contract

- Which currency should the web form select by default? Each saved purchase will still retain its currency code.
- Which quantity units should the first form offer, and should custom units be allowed?
- How should the form capture taxes, discounts, or fees that are not attached to individual receipt lines?

## Next checkpoint

Settle the three input decisions above, then write the OpenAPI contract and Postman request examples before implementing the PostgreSQL migration, repository, service, and endpoints.
