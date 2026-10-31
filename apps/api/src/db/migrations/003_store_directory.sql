CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL CHECK (btrim(name) <> ''),
  normalized_name VARCHAR(120) NOT NULL UNIQUE CHECK (normalized_name <> ''),
  category VARCHAR(32) NOT NULL CHECK (category IN (
    'supermarket',
    'public_market',
    'convenience_store',
    'neighborhood_grocery',
    'online_grocery',
    'other'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

WITH normalized_stores AS (
  SELECT
    btrim(regexp_replace(store_name, '[[:space:]]+', ' ', 'g')) AS name,
    btrim(regexp_replace(lower(btrim(store_name)), '[[:space:]]+', ' ', 'g')) AS normalized_name
  FROM purchases
  WHERE store_name IS NOT NULL AND btrim(store_name) <> ''
), distinct_stores AS (
  SELECT DISTINCT ON (normalized_name) name, normalized_name
  FROM normalized_stores
  ORDER BY normalized_name, lower(name), name
)
INSERT INTO stores (name, normalized_name, category)
SELECT name, normalized_name, 'other'
FROM distinct_stores;
