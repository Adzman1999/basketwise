# Step 14: Pantry stock

## Goal

Track the current quantity of grocery items in the household pantry and flag items that are running low.

## Decisions

- Pantry stock is a manual snapshot. Recording a grocery receipt does not increase pantry quantities, and adjusting pantry stock does not change receipt history.
- A stock record is unique for a saved grocery item and measurement unit. The household can track the same item in different units, but Basketwise does not convert between them.
- Quantity can be zero. A zero quantity is out of stock; a positive quantity at or below its optional threshold is low stock.
- Records use existing grocery catalog items and measurement units. A grocery item must first appear on a saved receipt.
- Each pantry record can opt into automatic restocking from future receipts. This is off by default; only exact saved item and unit matches are applied, with no unit conversion or retroactive additions.
- Each receipt line can increase pantry stock at most once. Purchase, receipt lines, and any matching restock movements commit in one transaction.
- This checkpoint tracks one current quantity per item and unit. Expiration dates, separate purchase lots, recipe consumption, and waste tracking are later workflows.

## Added

- Migration `007_pantry_stock.sql` stores current quantity, optional low-stock threshold, and last-updated time.
- Migration `008_pantry_auto_restock.sql` adds the per-record opt-in and a unique receipt-line movement ledger.
- `GET /api/pantry` lists filtered and paginated records and includes household-wide counts for in-stock, low-stock, and out-of-stock items.
- `POST /api/pantry` creates one record per grocery item and unit. Duplicate pairs return `409`; clients should update the existing record.
- `PUT /api/pantry/{pantryStockId}` replaces the current quantity and threshold.
- `DELETE /api/pantry/{pantryStockId}` removes pantry tracking while preserving grocery receipts.
- `POST /api/purchases` adds exact item and unit quantities to opted-in pantry records as part of saving the receipt. Its response reports each updated item and resulting on-hand quantity; repeated application of the same receipt line is ignored.
- OpenAPI and the local Postman collection describe list, add, update, and remove operations.
- The Pantry stock page supports item search, stock-status filtering, pagination, low-stock and out-of-stock summaries, quantity adjustments, record removal, and the auto-restock setting.
- Purchase creation confirms which pantry quantities were updated.

## Verification

- `pnpm --filter @basketwise/api typecheck` passed.
- `pnpm --filter @basketwise/web typecheck` passed.
- `pnpm build` passed.
- OpenAPI syntax lint and Postman collection lint passed with no issues.
- Migration `008_pantry_auto_restock.sql` was applied to the local development database.
- API behavior tests were not run; the purchase auto-restock transaction still needs a receipt-based behavior check.

## Follow-up

Consider food waste tracking next. Pantry lots and expiry dates can be added if the household workflow needs per-batch expiration rather than one current quantity per item and unit.
