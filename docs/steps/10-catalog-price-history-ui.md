# Step 10: Catalog and price history UI

## Goal

Let a household find a normalized grocery item and review the prices recorded on its receipts.

## Added

- A case-insensitive, literal substring search on `GET /api/grocery-items`, with the existing page/pageSize behavior.
- A paginated catalog browser with item selection and debounced search.
- Purchase entry suggests existing catalog names as the user types. Selecting a saved name reuses its normalized identity; new names remain accepted.
- Paginated, newest-first price observations that show the receipt date, store, quantity, line amount, and unit price.
- The receipt unit is shown with every unit price. The UI does not compare or convert different unit labels.
- Catalog and selected-item history refresh after a purchase is saved; list and history errors have retry actions.
- Responsive layout and section navigation for purchase history and item prices.
- shadcn/ui components throughout the dashboard, purchase form, history, catalog, and price observations, using shared light/dark theme tokens.
- App-style section menu using shadcn/ui Sidebar: it collapses to icons on desktop and opens as a mobile drawer. Basketwise's green palette is preserved in both themes.
- A persistent theme toggle follows the operating system preference on first visit and remembers the user's selection.
- Removed the redundant PHP explainer while keeping the peso symbol beside amount fields.

## Verification

- `pnpm typecheck` passed for API and web.
- `pnpm test` passed against the isolated local test database, including item search and price history.
- `pnpm build` passed for API and web.
- OpenAPI syntax lint and Postman collection lint passed.
- The local Vite page and API proxy return HTTP 200. The local dev database has no saved purchases, so the UI's empty-catalog state is served there.
- Browser-based visual inspection was unavailable in this session.

The shadcn UI refresh was checked with `pnpm typecheck:web` and `pnpm build:web`.

## Follow-up

Review the catalog and price history in the browser, then choose the next household workflow to build.
