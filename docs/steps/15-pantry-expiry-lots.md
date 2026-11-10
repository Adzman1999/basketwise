# Step 15: Pantry stock lots and expiry

## Goal

Track pantry quantities as separate batches so each batch can keep its own received date and expiry date. This is the foundation for expiry-aware stock use and later food-waste tracking.

## Current increment

- Migration `010_pantry_stock_lots.sql` adds `pantry_stock_lots`, with received and remaining quantities, source, received date, and optional expiry date.
- Migration `011_purchase_item_expiry_date.sql` stores an optional expiry date on each purchase line, including when the receipt is not added to pantry right away.
- Existing positive pantry quantities are copied into one `opening_balance` lot per pantry record. Their current expiry date is retained. The received date is the migration time because the original inventory date is unknown; receipt purchase dates are not treated as pantry receipt dates.
- Purchase movement rows gain a lot reference. New receipt restocks create one lot per receipt line, linked to the purchase movement.
- Manual stock creation and quantity increases create adjustment lots. Quantity reductions update remaining lot quantities in expiry-first order, with unknown expiries last. This is a stock count adjustment; it does not yet record why stock was removed.
- Purchase lines can save an optional expiry date. When the line is added to Pantry stock, its own date is stored on its new lot; a blank date stays unknown and can be filled in later from the Expiry dates tab.
- The Pantry stock page has an Expiry dates tab that lists active lots, searches by item, highlights expired and soon-to-expire batches, and allows each lot's date to be set or cleared.
- The `pantry_stock.expires_on` field remains for compatibility and reflects the earliest dated active lot. Quantity corrections and lot expiry edits keep this aggregate value in sync.

## Remaining increments

1. Let users set missing expiry dates while reviewing older skipped receipts before they are added to pantry stock.
2. Add a waste action that records discarded quantity and reduces the selected lot without changing receipt history.

## Decisions

- Each lot belongs to an existing pantry item and unit; units are not converted.
- `quantity_received` is an immutable record of the lot's original quantity. `quantity_remaining` can only be reduced to zero or increased through a new lot.
- Expiry is optional. Unknown expiry remains `NULL`; it is not inferred from the grocery item or another lot.
- Opening stock is backfilled as one lot because earlier stock was not separated by purchase batch.
- Expired stock remains on hand until the user records that it was consumed or discarded. Expiry alone does not remove it.
- Purchase history remains unchanged when pantry quantities are adjusted or discarded.

## Verification

- Migrations `010_pantry_stock_lots.sql` and `011_purchase_item_expiry_date.sql` were applied to the local `basketwise_dev` database; all four positive pantry records received matching opening lots.
- API and web typechecks passed. Postman collection lint and OpenAPI syntax lint passed. Inline expiry entry for older skipped receipts and waste tracking remain future increments; API behavior tests were not run.
