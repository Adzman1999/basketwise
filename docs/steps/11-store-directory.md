# Store and shop directory

The app keeps a saved directory of stores and shops, grouped by a preset category: supermarket, public market, convenience store, neighborhood grocery, online grocery, or other. Users can add a place from the Stores & shops sidebar page or directly while recording a purchase. Purchases continue to store the selected display name so purchase history and price observations remain compatible.

The API exposes `GET /api/stores` and `POST /api/stores`. Store names are unique after trimming, lowercasing, and collapsing whitespace. Existing purchase store names are backfilled into the directory as `other` by migration `003_store_directory.sql`.

The local development database was reset after applying the migration so the app starts with no purchase, grocery item, or saved store rows. The migration history remains intact.
