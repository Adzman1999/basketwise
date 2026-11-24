# Step 28: Copy the meal shopping list

## Goal

Make the remaining meal ingredients easy to take into the store or share with someone shopping for the household.

## Current increment

- A Copy list action copies only unchecked items that are still needed after pantry stock is accounted for.
- Each line includes its quantity and estimated line cost when a compatible recorded price exists.
- The copied text includes the selected week, a partial priced total when available, and notes for unresolved units or missing prices.
- Copying does not create a purchase, mark items picked up, or change pantry stock.

## Decisions

- Use the browser clipboard API and show a clear success or permission-error message.
- Keep the action beside Start purchase so users can choose between preparing a receipt and taking a plain-text list.
