# Step 25: Estimate the cost of the meal shopping list

## Goal

Help users plan a grocery trip by estimating the cost of the quantities still needed for their planned meals.

## Current increment

- The shopping list shows an estimated total for unchecked quantities that are still needed after pantry stock is subtracted.
- Each needed line shows its own estimated cost when a compatible price is available.
- Estimates use the latest compatible unit prices already returned with the planned recipes.
- Items without a compatible recorded price are counted and excluded from the partial total.
- Items with pantry stock in an unresolved unit are identified because the quantity to buy may be overstated.
- The estimate is informational and does not create a purchase or change a grocery budget.

## Decisions

- Keep planned shopping estimates separate from actual receipt spending and budget records.
- Calculate costs only when a price exists in the same grocery item and measurement unit as the shopping-list quantity.
- Use the pantry-adjusted amount still needed; checked-off items are excluded.
