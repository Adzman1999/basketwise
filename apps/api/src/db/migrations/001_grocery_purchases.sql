CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchased_on DATE NOT NULL,
  store_name VARCHAR(120),
  currency VARCHAR(3) NOT NULL DEFAULT 'PHP' CHECK (currency = 'PHP'),
  total_paid_centavos INTEGER NOT NULL CHECK (total_paid_centavos >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT purchases_store_name_not_blank
    CHECK (store_name IS NULL OR btrim(store_name) <> '')
);

CREATE TABLE purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  position SMALLINT NOT NULL CHECK (position BETWEEN 0 AND 99),
  item_name VARCHAR(120) NOT NULL CHECK (btrim(item_name) <> ''),
  quantity NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
  unit VARCHAR(32) NOT NULL CHECK (btrim(unit) <> ''),
  amount_paid_centavos INTEGER NOT NULL CHECK (amount_paid_centavos >= 0),
  CONSTRAINT purchase_items_position_unique UNIQUE (purchase_id, position)
);

CREATE INDEX purchases_history_order_idx
  ON purchases (purchased_on DESC, created_at DESC, id DESC);
