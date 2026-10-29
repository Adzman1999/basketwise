CREATE TABLE grocery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL CHECK (btrim(name) <> ''),
  normalized_name VARCHAR(120) NOT NULL UNIQUE CHECK (normalized_name <> ''),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

WITH normalized_purchase_items AS (
  SELECT
    pi.item_name,
    btrim(regexp_replace(lower(btrim(pi.item_name)), '[[:space:]]+', ' ', 'g')) AS normalized_name,
    p.purchased_on,
    p.created_at,
    pi.position,
    pi.id
  FROM purchase_items pi
  JOIN purchases p ON p.id = pi.purchase_id
), first_seen_names AS (
  SELECT DISTINCT ON (normalized_name)
    btrim(regexp_replace(item_name, '[[:space:]]+', ' ', 'g')) AS name,
    normalized_name
  FROM normalized_purchase_items
  ORDER BY normalized_name, purchased_on, created_at, position, id
)
INSERT INTO grocery_items (name, normalized_name)
SELECT name, normalized_name
FROM first_seen_names;

ALTER TABLE purchase_items
  ADD COLUMN grocery_item_id UUID REFERENCES grocery_items(id);

UPDATE purchase_items pi
SET grocery_item_id = gi.id
FROM grocery_items gi
WHERE gi.normalized_name = btrim(
  regexp_replace(lower(btrim(pi.item_name)), '[[:space:]]+', ' ', 'g')
);

ALTER TABLE purchase_items
  ALTER COLUMN grocery_item_id SET NOT NULL;

CREATE INDEX purchase_items_grocery_history_idx
  ON purchase_items (grocery_item_id, purchase_id);
