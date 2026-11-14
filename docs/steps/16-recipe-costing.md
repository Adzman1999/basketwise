# Step 16: Recipe and ingredient costing

## Goal

Save household recipes with ingredient quantities and estimate recipe and per-serving costs from recorded grocery purchases.

## Current increment

- Migration `013_recipes.sql` adds recipes and ordered ingredient lines linked to the existing grocery item catalog and saved measurement units.
- The Recipes sidebar page supports creating, editing, searching, viewing, and deleting recipes.
- The API returns the latest compatible purchase price for each grocery item. Ingredient line costs are rounded to the nearest centavo.
- Recipe total and per-serving estimates are available only when every ingredient has a matching price observation. The UI shows a partial cost and the number of unpriced ingredients otherwise.
- Grams and kilograms, and milliliters and liters, convert automatically. Catalog & price history lets the user define reusable item-specific yields such as 1 can = 400 ml.
- Recipe details show the receipt unit and conversion used for each estimate.
- Recipe details can scale ingredient quantities and cost estimates for 1–1,000 servings without changing the saved recipe.
- Recipes can save optional cooking instructions and a meal category (breakfast, lunch, dinner, snack, dessert, drinks, or other). Category filtering works independently of recipe-name search.
- Each price source shows its receipt date and store. A recipe estimate can combine prices from different receipt dates and changes when new grocery purchases are recorded.
- Recipes do not change pantry quantities or grocery receipts.

## Decisions

- Recipe ingredients use saved grocery catalog items and measurement units; free-text ingredients are not accepted.
- Ingredient quantities and units follow the stock-item recipe pattern used in BacchusSQL, while Basketwise recipes remain household meals and do not require commercial menu-item or size records.
- Cooking instructions are optional plain text, and categories use a small built-in meal list to keep filtering consistent.
- Custom yields are saved per grocery item because package sizes differ by item. A saved relationship works in either direction.
- Only g/kg and ml/l convert automatically. Other units require an explicit item-specific yield; mass, volume, and item units are never guessed to be equivalent.
- Recipe costs are estimates based on the latest observed price, not fixed prices saved on the recipe.
- When one or more ingredients have no compatible price, the complete total and per-serving estimate stay unset instead of presenting a misleading lower total.
- Deleting a recipe removes its ingredient list but keeps all grocery purchase and price history.

## Future increments

- Consider recipe photos or richer step-by-step instructions after the basic cost and meal-planning workflow is in use.

## Verification

- API and web typechecks and production builds passed.
- Local migration `016_recipe_metadata.sql` was applied. Earlier migrations `014_grocery_item_unit_conversions.sql` and `015_grocery_item_unit_conversion_lookup.sql` were already applied.
- Postman collection lint, OpenAPI syntax lint, and `git diff --check` passed. Full OpenAPI governance lint requires a Postman sign-in and was not run. The installed Postman CLI (1.76.0) does not recognize `postman status`.
- Automated API and UI tests were not run.
