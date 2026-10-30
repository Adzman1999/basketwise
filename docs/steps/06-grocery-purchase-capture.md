# Step 06: Grocery purchase API contract

## Status

Domain rules and API contract are defined. The database migration and endpoint implementation are the next checkpoint.

## Goal

Record grocery spending in a way that keeps the receipt total and its individual food costs available for later price history.

## V1 record

A purchase contains:

- Purchase date.
- Store name, optional.
- Currency is PHP for v1. Amounts cross the API as integer centavos; responses identify the currency as `PHP`.
- Total paid, recorded from the receipt.
- One or more line items. Each line has the item name as entered, quantity, unit, and amount paid for that line.

The item name is a receipt-time snapshot. There is no shared product catalog in this first feature, so matching differently named items into one price history is a later feature. Suggested units are `g`, `kg`, `ml`, `l`, `item`, and `pack`; custom unit labels are accepted, and quantities are not converted. The receipt total is calculated as the sum of line amounts. The API derives and stores this total from the submitted items so the receipt cannot disagree with its lines.

## V1 boundaries

- No household budgets, pantry stock, recipes, waste tracking, or product catalog.
- PHP only; no currency conversion or per-purchase currency selection.
- No automatic unit conversion; quantity and unit are saved as entered.
- No sign-in or multiple-household ownership in this checkpoint. The API is still a local, single-user development application.

## API contract

The OpenAPI source of truth defines `POST /api/purchases` for receipt entry and `GET /api/purchases` for a newest-first paginated history. The Postman collection carries request definitions, response examples, and assertions to run once the endpoints are implemented. Purchase create input requires a date, total receipt amount, and at least one line item.

## Implementation

The database-backed API implementation is documented in [Step 07](07-purchase-persistence.md).

## Next checkpoint

The purchase entry form and paginated history are implemented in [Step 08](08-purchase-ui.md).
