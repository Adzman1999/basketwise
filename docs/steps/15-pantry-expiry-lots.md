# Step 15: Pantry stock lots and expiry

## Goal

Track pantry quantities as separate batches so each batch can keep its own received date and expiry date, and record discarded quantities without changing grocery receipts.

## Current increment

- Migration `010_pantry_stock_lots.sql` adds `pantry_stock_lots`, with received and remaining quantities, source, received date, and optional expiry date.
- Migration `011_purchase_item_expiry_date.sql` stores an optional expiry date on each purchase line, including when the receipt is not added to pantry right away.
- Existing positive pantry quantities are copied into one `opening_balance` lot per pantry record. Their current expiry date is retained. The received date is the migration time because the original inventory date is unknown; receipt purchase dates are not treated as pantry receipt dates.
- Purchase movement rows gain a lot reference. New receipt restocks create one lot per receipt line, linked to the purchase movement.
- Manual stock creation and quantity increases create adjustment lots. Stock count corrections consume lots in expiry-first order, with unknown expiries last. Discarded quantities are recorded separately in the waste ledger.
- Purchase lines can save an optional expiry date. When the line is added to Pantry stock, its own date is stored on its new lot; a blank date stays unknown and can be filled in later from the Expiry dates tab.
- Purchases to review lets users set or clear expiry dates for each pending line before adding selected receipts to pantry stock.
- The Pantry stock page has an Expiry dates tab that lists active lots, searches by item, highlights expired and soon-to-expire batches, and allows each lot's date to be set or cleared.
- The `pantry_stock.expires_on` field remains for compatibility and reflects the earliest dated active lot. Quantity corrections and lot expiry edits keep this aggregate value in sync.
- Pantry stock supports recording discarded quantities against a selected batch. Each waste event and the matching stock reduction commit together; receipt history is unchanged. Waste history stays available in Pantry stock and retains item and batch details if pantry tracking is removed.

## Remaining increments

The expiry and waste-tracking increments in this step are complete.

## Decisions

- Each lot belongs to an existing pantry item and unit; units are not converted.
- `quantity_received` is an immutable record of the lot's original quantity. `quantity_remaining` can only be reduced to zero or increased through a new lot.
- Expiry is optional. Unknown expiry remains `NULL`; it is not inferred from the grocery item or another lot.
- Opening stock is backfilled as one lot because earlier stock was not separated by purchase batch.
- Expired stock remains on hand until the user adjusts its quantity or records it as waste. Expiry alone does not remove it.
- Purchase history remains unchanged when pantry quantities are adjusted or discarded.

## Verification

- Migrations `010_pantry_stock_lots.sql`, `011_purchase_item_expiry_date.sql`, and `012_pantry_stock_waste.sql` were applied to the local `basketwise_dev` database; the earlier lot migration backfilled the existing positive pantry records.
- API and web typechecks passed. Pantry stock Postman collection lint, OpenAPI syntax lint, and `git diff --check` passed. API behavior tests were not run.
