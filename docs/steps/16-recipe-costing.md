# Step 16: Recipe and ingredient costing

## Goal

Save household recipes with ingredient quantities and estimate recipe and per-serving costs from recorded grocery purchases.

## Current increment

- Migration `013_recipes.sql` adds recipes and ordered ingredient lines linked to the existing grocery item catalog and saved measurement units.
- The Recipes sidebar page supports creating, editing, searching, viewing, and deleting recipes.
- The API returns the latest purchase price for each exact grocery-item and unit pair. Ingredient line costs are rounded to the nearest centavo.
- Recipe total and per-serving estimates are available only when every ingredient has a matching price observation. The UI shows a partial cost and the number of unpriced ingredients otherwise.
- Each price source shows its receipt date and store. A recipe estimate can combine prices from different receipt dates and changes when new grocery purchases are recorded.
- Recipes do not change pantry quantities or grocery receipts.

## Decisions

- Recipe ingredients use saved grocery catalog items and measurement units; free-text ingredients are not accepted.
- Units must match the purchase unit exactly. No mass, volume, or item conversion is performed in this increment.
- Recipe costs are estimates based on the latest observed price, not fixed prices saved on the recipe.
- When one or more ingredients have no same-unit price, the complete total and per-serving estimate stay unset instead of presenting a misleading lower total.
- Deleting a recipe removes its ingredient list but keeps all grocery purchase and price history.

## Future increments

- Support user-defined unit conversions where the relationship is known and safe.
- Add recipe instructions, categories, and a way to scale ingredient quantities by servings.

## Verification

- API and web typechecks and production builds passed.
- The local database migration was applied.
- Postman collection lint, OpenAPI syntax lint, and `git diff --check` passed.
- API behavior tests were not run.
