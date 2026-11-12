CREATE TABLE grocery_item_unit_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grocery_item_id UUID NOT NULL REFERENCES grocery_items(id) ON DELETE CASCADE,
  purchase_unit_id UUID NOT NULL REFERENCES measurement_units(id) ON DELETE RESTRICT,
  recipe_unit_id UUID NOT NULL REFERENCES measurement_units(id) ON DELETE RESTRICT,
  recipe_units_per_purchase_unit NUMERIC(18, 9) NOT NULL
    CHECK (recipe_units_per_purchase_unit > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT grocery_item_unit_conversion_units_differ
    CHECK (purchase_unit_id <> recipe_unit_id)
);

CREATE UNIQUE INDEX grocery_item_unit_conversions_pair_idx
  ON grocery_item_unit_conversions (
    grocery_item_id,
    LEAST(purchase_unit_id, recipe_unit_id),
    GREATEST(purchase_unit_id, recipe_unit_id)
  );

CREATE INDEX grocery_item_unit_conversions_item_idx
  ON grocery_item_unit_conversions (grocery_item_id, updated_at DESC);
