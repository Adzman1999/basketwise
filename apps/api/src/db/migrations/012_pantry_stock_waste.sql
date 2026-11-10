CREATE TABLE pantry_stock_waste_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pantry_stock_lot_id UUID REFERENCES pantry_stock_lots(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  quantity_wasted NUMERIC(12, 3) NOT NULL CHECK (quantity_wasted > 0),
  quantity_remaining_after NUMERIC(12, 3) NOT NULL CHECK (quantity_remaining_after >= 0),
  expires_on DATE,
  received_at TIMESTAMPTZ NOT NULL,
  purchase_date DATE,
  store_name TEXT,
  discarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX pantry_stock_waste_events_discarded_at_idx
  ON pantry_stock_waste_events (discarded_at DESC, id DESC);

CREATE INDEX pantry_stock_waste_events_lot_idx
  ON pantry_stock_waste_events (pantry_stock_lot_id, discarded_at DESC);
