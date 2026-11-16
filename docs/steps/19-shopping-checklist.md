# Step 19: Shopping checklist

## Goal

Let users track which ingredients for the selected meal-plan week they have picked up.

## Current increment

- Shopping list rows can be checked and unchecked, with checked items visually marked.
- The header shows the picked-up count and offers a clear action when any items are checked.
- Checklist progress is saved in browser local storage separately for each week, so it survives refreshes in that browser.
- When planned recipes change, checked entries that no longer appear on the list are removed.
- Checking an item does not change pantry stock or grocery purchase records.

## Decisions

- Keep checklist progress local to this browser; no API or database changes are needed for this increment.
- Key checks by grocery item and unit, matching the shopping list's aggregation rules.
- Keep unit conversion and pantry deduction out of this feature.

## Verification

- Web typecheck and production build passed.
- `git diff --check` passed.
- Automated tests were not run.
