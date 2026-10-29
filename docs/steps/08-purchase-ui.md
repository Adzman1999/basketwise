# Step 08: Purchase entry and history UI

## Goal

Let a household record grocery receipts and review stored purchases through the API contract from Step 06.

## Added

- Receipt entry for date, optional store, PHP total, and one or more item lines.
- Per-line name, decimal quantity, unit label, and paid amount; common units are suggested and custom labels are accepted.
- PHP form values are converted to integer centavos before sending the request.
- Client-side validation, saving feedback, success/error messages, and item add/remove controls.
- Newest-first purchase history with item costs, receipt total, unallocated difference, page totals, and pagination.
- API connection indicator with a retry action.

## Verification

- `pnpm typecheck` passed for API and web packages.
- `pnpm build` passed for API and web packages.
- Local HTTP checks returned 200 for the Vite page, transformed app module, and `/api/purchases` proxy. The proxy returned the empty history from the development database.
- Visual browser inspection was unavailable in this session because no browser-control tool was available.

The local development servers remain available at `http://localhost:5173` and `http://localhost:4000` for review.

## Next checkpoint

Design a normalized grocery item catalog and price history so receipts with different names or units can be compared consistently.
