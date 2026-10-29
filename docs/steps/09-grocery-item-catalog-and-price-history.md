# Step 09: Grocery item catalog and price history

## Goal

Give saved receipt lines a stable grocery item identity so Basketwise can show a price history without changing what was written on the receipt.

## Domain rules

- A catalog item is created automatically when a purchase line is saved.
- Names map to one catalog identity after trimming, lowercasing, and collapsing consecutive whitespace. Matching is exact after that normalization; there is no fuzzy matching or alias guessing.
- The first cleaned name becomes the catalog display name. Each purchase line keeps its receipt-time `itemName` snapshot.
- To distinguish products with different brands or variants, include those details in the line name. Automatic merging of similar names could combine unrelated products.
- A price observation comes directly from a saved purchase line; there is no separate price record that can drift from receipt data.
- Unit price is `amountPaidCentavos / quantity`, rounded to six decimal places. Units are compared only when their normalized labels match. No physical unit conversion is performed, so `g`, `kg`, `item`, and `pack` remain separate series.
- Amounts remain PHP centavos.

## API contract

- `GET /api/grocery-items` returns the catalog alphabetically with page/pageSize pagination and an optional case-insensitive substring search.
- `GET /api/grocery-items/{groceryItemId}/price-history` returns newest-first purchase-line observations. An optional `unit` filter uses the same unit-label normalization.
- Purchase line responses include `groceryItemId`, while retaining their receipt-time `itemName`.
- Unknown grocery item IDs return `404 NOT_FOUND`; malformed IDs and invalid query values return the standard `400 VALIDATION_ERROR` response.

OpenAPI remains the interface source of truth. The Postman collection contains runnable list/history requests and examples; the purchase request saves the created item ID for the history request.

## Data migration

Migration `002_grocery_item_catalog.sql` creates catalog identities for existing purchase lines using the same name normalization, links every existing line, and requires a catalog ID on future purchase lines. The original `item_name` value is retained as a receipt snapshot.

New purchase lines resolve or create their catalog identity in the same database transaction as the receipt. The catalog list and price-history endpoints follow the existing route → controller → service → repository structure.

## Verification

- `pnpm db:migrate` and the test migration applied `002_grocery_item_catalog.sql` to local development and isolated test databases.
- `pnpm typecheck` passed for API and web.
- `pnpm test` passed: 12 tests across 3 files, including exact normalized matching, unit-filtered price history, and not-found behavior.
- `pnpm build` passed for API and web.
- OpenAPI syntax lint and Postman collection lint passed.
- Postman ran 5 requests with 10 assertions and 0 failures against the built API on port 4001 using the isolated test database.
- Vitest still reports the existing Vite CJS Node API deprecation warning.

## Next checkpoint

Add catalog browsing and price-history views to the purchase UI as documented in [Step 10](10-catalog-price-history-ui.md).
