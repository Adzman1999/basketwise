ALTER TABLE pantry_stock
  ADD COLUMN auto_restock BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE pantry_stock_purchase_movements (
  purchase_item_id UUID PRIMARY KEY REFERENCES purchase_items(id) ON DELETE RESTRICT,
  pantry_stock_id UUID REFERENCES pantry_stock(id) ON DELETE SET NULL,
  quantity_added NUMERIC(12, 3) NOT NULL CHECK (quantity_added > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX pantry_stock_purchase_movements_stock_idx
  ON pantry_stock_purchase_movements (pantry_stock_id);
