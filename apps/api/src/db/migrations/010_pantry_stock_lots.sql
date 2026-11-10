CREATE TABLE pantry_stock_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pantry_stock_id UUID NOT NULL REFERENCES pantry_stock(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (
    source_type IN ('opening_balance', 'purchase', 'manual_adjustment')
  ),
  source_purchase_item_id UUID REFERENCES purchase_items(id) ON DELETE SET NULL,
  quantity_received NUMERIC(12, 3) NOT NULL CHECK (quantity_received > 0),
  quantity_remaining NUMERIC(12, 3) NOT NULL CHECK (
    quantity_remaining >= 0 AND quantity_remaining <= quantity_received
  ),
  expires_on DATE,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX pantry_stock_lots_purchase_item_idx
  ON pantry_stock_lots (source_purchase_item_id)
  WHERE source_purchase_item_id IS NOT NULL;

CREATE INDEX pantry_stock_lots_stock_received_idx
  ON pantry_stock_lots (pantry_stock_id, received_at, id);

CREATE INDEX pantry_stock_lots_active_expiry_idx
  ON pantry_stock_lots (expires_on, pantry_stock_id)
  WHERE quantity_remaining > 0 AND expires_on IS NOT NULL;

ALTER TABLE pantry_stock_purchase_movements
  ADD COLUMN pantry_stock_lot_id UUID
  REFERENCES pantry_stock_lots(id) ON DELETE SET NULL;

CREATE INDEX pantry_stock_purchase_movements_lot_idx
  ON pantry_stock_purchase_movements (pantry_stock_lot_id)
  WHERE pantry_stock_lot_id IS NOT NULL;

INSERT INTO pantry_stock_lots (
  pantry_stock_id,
  source_type,
  quantity_received,
  quantity_remaining,
  expires_on,
  received_at
)
SELECT
  id,
  'opening_balance',
  quantity,
  quantity,
  expires_on,
  NOW()
FROM pantry_stock
WHERE quantity > 0;
