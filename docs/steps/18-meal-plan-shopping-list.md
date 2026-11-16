# Step 18: Shopping list from meal plans

## Goal

Show the ingredient quantities needed for recipes planned during the selected week.

## Current increment

- The weekly meal planner has a Shopping list tab that updates with the selected week.
- Ingredient quantities scale by planned servings divided by the saved recipe yield.
- Quantities combine only when both the saved grocery item and measurement unit match. Different units remain separate.
- The list is derived from the saved meal plan and current recipe ingredients. Pantry stock is not subtracted and no inventory records change.

## Decisions

- Keep this first increment derived and read-only; edits to planned meals immediately recalculate its quantities.
- Use the saved recipe ingredient units as entered. Do not guess conversions or merge different units.
- Include ingredient quantities regardless of whether a current grocery price is available; the list represents recipe requirements, not a price estimate.

## Verification

- Web typecheck and production build passed.
- `git diff --check` passed.
- Automated tests were not run.
