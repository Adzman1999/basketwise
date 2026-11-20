# Step 21: Filter the shopping list to items still needed

## Goal

Make the weekly shopping list easier to use in the store by hiding ingredients already covered by unexpired pantry stock.

## Current increment

- A “Need to buy” filter shows only ingredients with a remaining quantity to buy.
- The count reflects the current pantry comparison, including saved and standard metric conversions.
- Items already checked as picked up are hidden in this view and excluded from a new purchase draft.
- The all-items view remains available, and switching views does not change checked-item progress.
- When every ingredient is covered, the filtered view explains that and offers a way back to the full list.

## Decisions

- Keep the filter session-only; checklist progress remains saved separately per week.
- Treat items with an unconverted pantry unit as needing review and keep them in the “Need to buy” view when a positive upper estimate remains.
- Do not modify pantry stock or purchase records from the filter.

## Verification

- Web Vitest cases, typecheck, and production build passed.
- `git diff --check` passed.
