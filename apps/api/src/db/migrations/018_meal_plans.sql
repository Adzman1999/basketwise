CREATE TABLE meal_plan_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  planned_on DATE NOT NULL,
  meal_type VARCHAR(16) NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  servings SMALLINT NOT NULL CHECK (servings BETWEEN 1 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT meal_plan_entries_day_meal_unique UNIQUE (planned_on, meal_type)
);

CREATE INDEX meal_plan_entries_planned_on_idx
  ON meal_plan_entries (planned_on, meal_type);
