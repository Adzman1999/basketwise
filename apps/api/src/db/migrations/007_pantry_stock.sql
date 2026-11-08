CREATE TABLE pantry_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grocery_item_id UUID NOT NULL REFERENCES grocery_items(id) ON DELETE RESTRICT,
  unit_id UUID NOT NULL REFERENCES measurement_units(id) ON DELETE RESTRICT,
  quantity NUMERIC(12, 3) NOT NULL CHECK (quantity >= 0),
  low_stock_threshold NUMERIC(12, 3) CHECK (
    low_stock_threshold IS NULL OR low_stock_threshold >= 0
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pantry_stock_item_unit_unique UNIQUE (grocery_item_id, unit_id)
);
