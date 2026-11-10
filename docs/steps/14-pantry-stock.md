# Step 14: Pantry stock

## Goal

Track the current quantity of grocery items in the household pantry and flag items that are running low.

## Decisions

- Pantry stock tracks one current quantity per saved grocery item and measurement unit. Receipt lines increase it when the user chooses to add the purchase or when that record is opted into auto-restock; manual adjustments do not change receipt history.
- A stock record is unique for a saved grocery item and measurement unit. The household can track the same item in different units, but Basketwise does not convert between them.
- Quantity can be zero. A zero quantity is out of stock; a positive quantity at or below its optional threshold is low stock.
- Records use existing grocery catalog items and measurement units. A grocery item must first appear on a saved receipt.
- Each pantry record can opt into automatic restocking from future receipts. This is off by default; only exact saved item and unit matches are applied, with no unit conversion or retroactive additions.
- The purchase form also asks whether to add the current receipt to pantry stock. Choosing yes adds every exact item and unit pair, creating missing records or increasing existing quantities; choosing no still honors any prior auto-restock opt-ins.
- In the web flow, new pantry records originate from saved receipt items. Pantry stock lists receipt items that have not yet been added and lets the user select receipts whose items are still on hand; the standalone Add stock action is removed. Existing stock can still be adjusted or removed.
- A receipt's purchase date stays in purchase history. When the user adds an older receipt to pantry stock, the current quantity is updated now; the old purchase date is never used as an inventory date.
- Each receipt line can increase pantry stock at most once. Purchase, receipt lines, and any matching restock movements commit in one transaction.
- Each pantry record keeps an aggregate expiry field for compatibility; it reflects the earliest dated lot still on hand. Individual batches retain their own optional expiry dates.
- Quantities are split into lots for expiry tracking. Recipe consumption and waste tracking remain later workflows.

## Added

- Migration `007_pantry_stock.sql` stores current quantity, optional low-stock threshold, and last-updated time.
- Migration `008_pantry_auto_restock.sql` adds the per-record opt-in and a unique receipt-line movement ledger.
- Migration `009_pantry_expiry_date.sql` adds an optional date-only expiry field and an index for non-null dates.
- `GET /api/pantry` lists filtered and paginated records and includes household-wide counts for in-stock, low-stock, and out-of-stock items.
- `POST /api/pantry` creates one record per grocery item and unit. Duplicate pairs return `409`; clients should update the existing record.
- `PUT /api/pantry/{pantryStockId}` replaces the current quantity, threshold, and auto-restock setting; its expiry date is derived from the earliest dated active lot.
- `GET /api/pantry/lots` lists active batches and `PUT /api/pantry/lots/{lotId}` updates or clears one batch's expiry date.
- `DELETE /api/pantry/{pantryStockId}` removes pantry tracking while preserving grocery receipts.
- `GET /api/purchases` supports `pantryStatus=pending` to return receipts that contain at least one line not yet applied to pantry stock.
- `POST /api/purchases` updates opted-in pantry records as part of saving the receipt. With `addToPantry: true`, it creates or updates records for every receipt item and unit. Its response reports each changed record and resulting on-hand quantity; a receipt line is applied at most once.
- `POST /api/purchases/{purchaseId}/pantry` adds receipt lines that were previously skipped. It is idempotent, leaves the receipt date unchanged, updates current stock at request time, and purchase records report `pantryAdded` for each line.
- OpenAPI and the local Postman collection describe pantry operations and purchase-to-pantry updates.
- The Pantry stock page supports item search, stock-status filtering, pagination, low-stock and out-of-stock summaries, quantity adjustments, record removal, and the auto-restock setting. It directs users to Grocery spending when no stock records exist.
- Pantry stock includes an Expiry dates tab to review active batches, highlight expired and soon-to-expire lots, and update each lot's date.
- Purchase creation asks whether to add the receipt to pantry stock and confirms which pantry quantities were updated.
- Pantry stock lets users review and select skipped receipts. Its reminder explains that old purchases should only be selected when their items are still on hand and that adding them updates current stock without backdating inventory.

## Verification

- `pnpm --filter @basketwise/api typecheck` passed.
- `pnpm --filter @basketwise/web typecheck` passed.
- `pnpm build` passed.
- OpenAPI syntax lint and Postman collection lint passed with no issues.
- Migration `008_pantry_auto_restock.sql` was applied to the local development database.
- Migration `009_pantry_expiry_date.sql` was applied to the local development database.
- API behavior tests were not run; explicit pantry synchronization and auto-restock still need a receipt-based behavior check.

## Follow-up

Step 15 evolves aggregate pantry quantities into separate stock lots so separately received batches can retain their own expiry dates. Food waste tracking can then reduce a specific lot without changing purchase history.
