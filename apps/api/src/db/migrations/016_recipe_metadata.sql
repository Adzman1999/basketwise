ALTER TABLE recipes
  ADD COLUMN category VARCHAR(24),
  ADD COLUMN instructions TEXT;

ALTER TABLE recipes
  ADD CONSTRAINT recipes_category_valid
    CHECK (category IS NULL OR category IN (
      'breakfast',
      'lunch',
      'dinner',
      'snack',
      'dessert',
      'drinks',
      'other'
    )),
  ADD CONSTRAINT recipes_instructions_length_valid
    CHECK (instructions IS NULL OR length(instructions) <= 5000);

CREATE INDEX recipes_category_name_idx
  ON recipes (category, normalized_name, id);
