# Step 22: Start a purchase from the meal-plan shopping list

## Goal

Reduce re-entry when users buy ingredients planned for the selected week.

## Current increment

- The shopping list can open the existing purchase form with only unchecked quantities still estimated as needed.
- Item names and units are prefilled; unit prices and expiry dates remain blank for entry from the actual receipt.
- The purchase form still requires a spending period and store, calculates the total from item quantities and unit prices, and asks whether to add the saved receipt to pantry stock.
- Lines whose pantry comparison included an unconverted unit are marked for quantity review. Their prefilled amount is an upper estimate, not a confirmed purchase quantity.
- The draft is not saved until the user completes and submits the receipt form.

## Decisions

- Reuse the current purchase form and persistence flow instead of creating a second purchase path.
- Do not use the meal plan's estimated recipe costs as actual receipt prices.
- Keep pantry inventory unchanged while the form is being drafted.

## Verification

- Web Vitest cases passed.
- Web typecheck and production build passed.
- `git diff --check` passed.
