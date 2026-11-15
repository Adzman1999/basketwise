# Step 17: Weekly meal planning

## Goal

Schedule saved recipes by date and meal, choose planned servings, and review estimated meal costs using current recipe price observations.

## Current increment

- The Meal planning sidebar page shows a navigable seven-day week with breakfast, lunch, dinner, and snack slots.
- A date and meal slot can hold one saved recipe. Users can add, edit, or remove its planned recipe and serving count.
- Each meal estimate uses the recipe's current complete cost per serving multiplied by planned servings. Incomplete price data is shown as unavailable and excluded from the week estimate.
- The weekly estimate is informational. It does not deduct grocery budget, pantry stock, or inventory lots.
- Deleting a recipe also removes its meal plan entries; the recipe deletion dialog explains this.
- API requests list at most 42 days of plans and validate recipe, date, meal type, servings, and duplicate meal slots.
- Migration `018_meal_plans.sql` adds saved plan entries and enforces one recipe per date and meal slot.

## Decisions

- The first planner increment is a weekly agenda rather than a full drag-and-drop calendar, keeping it usable on narrow screens and straightforward to edit.
- Supported meal slots are breakfast, lunch, dinner, and snack. More than one planned recipe per slot can be considered after the single-slot workflow is used.
- A plan entry stores its recipe, date, meal slot, and planned servings. It does not snapshot ingredient prices or pantry quantities; estimates follow the recipe's latest compatible purchase prices.
- Past dates are allowed for meal planning because the planner can also record what the household ate.
- Removing a recipe cascades its plan entries so no meal points to a recipe that no longer exists.

## Verification

- API and web typechecks passed; the production build passed.
- OpenAPI syntax lint, Meal planning Postman collection lint, and `git diff --check` passed.
- Migration `018_meal_plans.sql` was applied to the local `basketwise_dev` database.
- Automated API and UI tests were not run.
