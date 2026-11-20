# Step 23: Refresh meal-plan coverage after a pantry restock

## Goal

Keep the meal-plan shopping list current after a purchase is added to pantry stock.

## Current increment

- Saving a purchase that adds items to pantry stock signals the meal planner to reload pantry quantities and lots.
- The “Need to buy” count and per-item quantities recalculate from the updated pantry.
- Adding items to pantry from purchase history also emits the same refresh signal.
- Purchases saved without adding to pantry do not change the pantry comparison.

## Decisions

- Reuse the purchase API response to detect a restock; no new endpoint or database field is needed.
- Refresh only after pantry quantities actually change.
- Keep purchase checklist state independent: pantry coverage updates automatically, while picked-up marks remain user-controlled.

## Verification

- Web Vitest cases passed.
- Web typecheck and production build passed.
- `git diff --check` passed.
