# Step 24: Set pantry unit conversions from the meal shopping list

## Goal

Let users resolve pantry stock that cannot be compared with a planned ingredient quantity without leaving meal planning.

## Current increment

- The pantry comparison lists unexpired stock amounts whose units have no saved or standard conversion to the shopping-list unit.
- Each unresolved unit has an inline action that opens a conversion form.
- The form records how many shopping-list units are in one pantry unit, using the existing grocery item conversion API.
- After saving, pantry stock, conversions, and recipe price observations reload so pantry coverage and shopping estimates recalculate.
- Expired pantry lots remain excluded from both the displayed unresolved amount and the shopping estimate.

## Decisions

- Save conversions in the existing purchase-unit to recipe-unit direction: one pantry stock unit equals the entered amount in the planned ingredient unit.
- Reuse the existing conversion record so later pantry comparisons and recipe costing can use the same relationship.
- Do not change pantry quantities when setting a conversion.
