# Step 27: Surface pantry expiry dates in the meal shopping list

## Goal

Help users notice pantry ingredients that expire during the selected meal-planning week.

## Current increment

- The shopping list shows a compact “Use by” note for unexpired pantry stock with an expiry date through the end of the selected week.
- Quantities use the shopping-list unit when a saved or standard conversion is available; otherwise, the pantry stock unit is shown.
- Lots already expired today remain excluded and continue to use the existing expired-stock notice.

## Decisions

- Keep expiry reminders informational; do not change pantry quantities or the shopping estimate.
- Group quantities that share an expiry date and display unit to keep the list concise.
