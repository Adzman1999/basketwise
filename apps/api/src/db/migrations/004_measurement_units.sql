CREATE TABLE measurement_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(32) NOT NULL CHECK (btrim(name) <> ''),
  normalized_name VARCHAR(64) NOT NULL UNIQUE CHECK (normalized_name <> ''),
  is_preset BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO measurement_units (name, normalized_name, is_preset)
VALUES
  ('g', 'g', TRUE),
  ('kg', 'kg', TRUE),
  ('ml', 'ml', TRUE),
  ('l', 'l', TRUE),
  ('item', 'item', TRUE),
  ('pack', 'pack', TRUE);

WITH normalized_units AS (
  SELECT DISTINCT ON (normalized_name)
    btrim(regexp_replace(unit, '[[:space:]]+', ' ', 'g')) AS name,
    btrim(regexp_replace(lower(btrim(unit)), '[[:space:]]+', ' ', 'g')) AS normalized_name
  FROM purchase_items
  ORDER BY normalized_name, lower(unit), unit
)
INSERT INTO measurement_units (name, normalized_name, is_preset)
SELECT name, normalized_name, FALSE
FROM normalized_units
ON CONFLICT (normalized_name) DO NOTHING;

ALTER TABLE purchase_items
  ADD COLUMN unit_id UUID REFERENCES measurement_units(id);

UPDATE purchase_items pi
SET unit_id = mu.id
FROM measurement_units mu
WHERE mu.normalized_name = btrim(regexp_replace(lower(btrim(pi.unit)), '[[:space:]]+', ' ', 'g'));

ALTER TABLE purchase_items
  ALTER COLUMN unit_id SET NOT NULL;

CREATE INDEX purchase_items_unit_history_idx
  ON purchase_items (unit_id, purchase_id);
