# Step 29: Search the meal shopping list

## Goal

Help users find ingredients quickly when a planned week produces a long shopping list.

## Current increment

- Lists with more than eight items show an ingredient search field.
- Matching text is highlighted, and an empty result offers a clear-search action.
- When there is no exact match, up to three close item names are suggested; choosing one searches for that item.
- Search narrows only the visible rows; the Need to buy count, copied list, and purchase draft remain based on all needed unchecked items.
- Search clears when the selected week changes.

## Decisions

- Keep search separate from the Need to buy filter and purchase actions.
- Show search only for longer lists to preserve space for smaller plans.
