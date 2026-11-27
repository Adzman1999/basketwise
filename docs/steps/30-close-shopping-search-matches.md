# Step 30: Suggest close shopping-list search matches

## Goal

Help users find a listed ingredient when their search contains a small spelling mistake.

## Current increment

- If a search has no exact match, the empty state offers up to three close item-name suggestions.
- Suggestions use word-level matching for a single-word query and full-name matching for a multi-word query.
- Choosing a suggestion updates the search to that item's exact name.
- Close matches are not shown when the Need to buy filter hides a valid match; the user can switch back to all ingredients instead.

## Decisions

- Require at least three characters before suggesting matches to avoid noisy results for very short searches.
- Keep suggestions limited to the currently displayed list, preserving the independent Need to buy filter.
