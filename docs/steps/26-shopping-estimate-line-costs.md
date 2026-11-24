# Step 26: Show estimated cost per shopping-list item

## Goal

Make the meal shopping estimate easier to understand by showing the estimated cost beside each quantity still needed.

## Current increment

- Each unchecked item with a compatible price shows an estimated line cost next to its pantry-adjusted quantity.
- Checked items read as picked up and do not show a line estimate.
- Pantry-covered quantities remain labeled as covered and are not costed as a purchase.

## Decisions

- Use the same latest compatible price and centavo rounding as the overall shopping estimate.
- Keep the source store and purchase date available as a short hover hint without adding another row to the compact list.
