CREATE INDEX grocery_item_unit_conversions_lookup_idx
  ON grocery_item_unit_conversions (grocery_item_id, purchase_unit_id, recipe_unit_id);
