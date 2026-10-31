# Reusable measurement units

The purchase form loads reusable measurement units from `GET /api/units`. Built-in units are `g`, `kg`, `ml`, `l`, `item`, and `pack`. A user can add a custom unit from the unit picker; it is stored once and can then be selected on later receipt lines.

Migration `004_measurement_units.sql` creates the unit directory, seeds the built-in units, imports any distinct unit labels already used by purchases, and links each purchase item to its reusable unit while retaining the original unit label for historical display.

The API also creates a directory entry when a purchase is submitted with a unit that is not already saved. Unit names are unique after trimming, lowercasing, and collapsing whitespace.
