# Step 20: Pantry-aware meal shopping list

## Goal

Show how much of the weekly recipe shopping list is already covered by pantry stock and how much remains to buy.

## Current increment

- The weekly shopping list compares each ingredient with stock for the same saved grocery item.
- It converts exact units, saved item-specific conversions, and the existing g/kg and ml/l metric pairs.
- Only unexpired pantry lot quantities count as on hand. Expired stock is excluded from the estimate.
- When pantry quantities exist in an unrecognized unit, the list shows an upper estimate of the amount to buy and asks the user to add a saved conversion.
- The comparison is read-only. Checking an item or viewing its estimate does not deduct or otherwise change pantry stock.

## Decisions

- Reuse the unit conversion rules already used for recipe price comparisons; do not infer package yields or convert unrelated units.
- Treat units without a known conversion as incomparable; the remaining amount is an upper estimate because unconverted stock may cover part or all of the requirement.
- Keep pantry stock and meal-plan APIs unchanged in this increment.

## Verification

- Four Web Vitest cases passed for expiry handling, exact units, saved conversions, metric conversions, and unknown units.
- Web typecheck and production build passed.
- `git diff --check` passed.
- The API Vitest/Supertest suite was not run; this change does not modify API code.
