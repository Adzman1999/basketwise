# Step 15: Pantry stock lots and expiry

## Goal

Track pantry quantities as separate batches so each batch can keep its own received date and expiry date. This is the foundation for expiry-aware stock use and later food-waste tracking.

## Current increment

- Migration `010_pantry_stock_lots.sql` adds `pantry_stock_lots`, with received and remaining quantities, source, received date, and optional expiry date.
- Existing positive pantry quantities are copied into one `opening_balance` lot per pantry record. Their current expiry date is retained. The received date is the migration time because the original inventory date is unknown; receipt purchase dates are not treated as pantry receipt dates.
- Purchase movement rows gain a lot reference. New receipt restocks create one lot per receipt line, linked to the purchase movement.
- Manual stock creation and quantity increases create adjustment lots. Quantity reductions update remaining lot quantities in expiry-first order, with unknown expiries last. This is a stock count adjustment; it does not yet record why stock was removed.
- Newly restocked purchase lots have unknown expiry until per-lot expiry entry is added. They are stored with `expires_on = NULL`; an older aggregate expiry is not copied to a new batch.
- The existing pantry API and screen still use the aggregate pantry record in this increment. The `pantry_stock.expires_on` field remains for compatibility; lot expiry is not yet visible or editable in the UI.

## Remaining increments

1. Let users review and set expiry dates per lot, including a suitable entry point when a purchase is added to pantry. Show expired and soon-to-expire quantities in Pantry.
2. Add a waste action that records discarded quantity and reduces the selected lot without changing receipt history.

## Decisions

- Each lot belongs to an existing pantry item and unit; units are not converted.
- `quantity_received` is an immutable record of the lot's original quantity. `quantity_remaining` can only be reduced to zero or increased through a new lot.
- Expiry is optional. Unknown expiry remains `NULL`; it is not inferred from the grocery item or another lot.
- Opening stock is backfilled as one lot because earlier stock was not separated by purchase batch.
- Expired stock remains on hand until the user records that it was consumed or discarded. Expiry alone does not remove it.
- Purchase history remains unchanged when pantry quantities are adjusted or discarded.

## Verification

- API quantity writes now synchronize with lots while preserving the existing response shape.
- The API typecheck is the relevant code check for this increment. The migration has not been applied to a local database, and database behavior has not been tested.
