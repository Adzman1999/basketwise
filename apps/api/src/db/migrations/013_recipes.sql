CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL CHECK (btrim(name) <> ''),
  normalized_name VARCHAR(120) NOT NULL CHECK (normalized_name <> ''),
  servings SMALLINT NOT NULL CHECK (servings BETWEEN 1 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX recipes_normalized_name_idx
  ON recipes (normalized_name, id);

CREATE TABLE recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  grocery_item_id UUID NOT NULL REFERENCES grocery_items(id) ON DELETE RESTRICT,
  unit_id UUID NOT NULL REFERENCES measurement_units(id) ON DELETE RESTRICT,
  quantity NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
  position SMALLINT NOT NULL CHECK (position BETWEEN 0 AND 99),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT recipe_ingredients_position_unique UNIQUE (recipe_id, position),
  CONSTRAINT recipe_ingredients_item_unit_unique UNIQUE (recipe_id, grocery_item_id, unit_id)
);

CREATE INDEX recipe_ingredients_recipe_idx
  ON recipe_ingredients (recipe_id, position, id);

CREATE INDEX recipe_ingredients_item_unit_idx
  ON recipe_ingredients (grocery_item_id, unit_id);
