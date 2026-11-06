ALTER TABLE pantry_stock
  ADD COLUMN expires_on DATE;

CREATE INDEX pantry_stock_expiry_date_idx
  ON pantry_stock (expires_on)
  WHERE expires_on IS NOT NULL;
