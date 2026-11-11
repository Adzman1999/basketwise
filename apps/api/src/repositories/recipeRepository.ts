import type { PoolClient } from 'pg';
import { getPool, query } from '../db';
import type { RecipeListQuery, SaveRecipeInput } from '../schemas/recipe';

export type RecipeIngredientRecord = {
  id: string;
  recipeId: string;
  groceryItemId: string;
  itemName: string;
  unitId: string;
  unit: string;
  quantity: string | number;
  unitPriceCentavos: string | number | null;
  pricePurchasedOn: string | null;
  priceStoreName: string | null;
};

export type RecipeRow = {
  id: string;
  name: string;
  servings: number;
  createdAt: Date;
  updatedAt: Date;
};

export type RecipeRecord = RecipeRow & {
  ingredients: RecipeIngredientRecord[];
};

async function listIngredientRecords(recipeIds: string[]): Promise<RecipeIngredientRecord[]> {
  if (recipeIds.length === 0) return [];

  const result = await query<RecipeIngredientRecord>(
    `SELECT ri.id,
            ri.recipe_id AS "recipeId",
            ri.grocery_item_id AS "groceryItemId",
            gi.name AS "itemName",
            ri.unit_id AS "unitId",
            mu.name AS unit,
            ri.quantity,
            latest_price."unitPriceCentavos",
            latest_price."pricePurchasedOn",
            latest_price."priceStoreName"
     FROM recipe_ingredients ri
     JOIN grocery_items gi ON gi.id = ri.grocery_item_id
     JOIN measurement_units mu ON mu.id = ri.unit_id
     LEFT JOIN LATERAL (
       SELECT round(pi.amount_paid_centavos::numeric / pi.quantity, 6)::float8 AS "unitPriceCentavos",
              p.purchased_on::text AS "pricePurchasedOn",
              p.store_name AS "priceStoreName"
       FROM purchase_items pi
       JOIN purchases p ON p.id = pi.purchase_id
       WHERE pi.grocery_item_id = ri.grocery_item_id
         AND pi.unit_id = ri.unit_id
       ORDER BY p.purchased_on DESC, p.created_at DESC, pi.id DESC
       LIMIT 1
     ) latest_price ON TRUE
     WHERE ri.recipe_id = ANY($1::uuid[])
     ORDER BY ri.recipe_id, ri.position, ri.id`,
    [recipeIds]
  );
  return result.rows;
}

function combineRecipeRows(rows: RecipeRow[], ingredientRows: RecipeIngredientRecord[]): RecipeRecord[] {
  const ingredientsByRecipe = new Map<string, RecipeIngredientRecord[]>();
  for (const ingredient of ingredientRows) {
    const ingredients = ingredientsByRecipe.get(ingredient.recipeId) ?? [];
    ingredients.push(ingredient);
    ingredientsByRecipe.set(ingredient.recipeId, ingredients);
  }
  return rows.map((recipe) => ({
    ...recipe,
    ingredients: ingredientsByRecipe.get(recipe.id) ?? [],
  }));
}

export async function listRecipeRecords(input: RecipeListQuery): Promise<{
  items: RecipeRecord[];
  total: number;
}> {
  const offset = (input.page - 1) * input.pageSize;
  const search = input.search?.trim().replace(/\s+/g, ' ').toLowerCase() ?? null;
  const [countResult, recipeResult] = await Promise.all([
    query<{ total: number }>(
      `SELECT COUNT(*)::int AS total
       FROM recipes
       WHERE $1::text IS NULL OR position($1 in normalized_name) > 0`,
      [search]
    ),
    query<RecipeRow>(
      `SELECT id, name, servings, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM recipes
       WHERE $1::text IS NULL OR position($1 in normalized_name) > 0
       ORDER BY normalized_name, created_at DESC, id
       LIMIT $2 OFFSET $3`,
      [search, input.pageSize, offset]
    ),
  ]);
  const rows = recipeResult.rows;
  const ingredients = await listIngredientRecords(rows.map((recipe) => recipe.id));
  return {
    items: combineRecipeRows(rows, ingredients),
    total: countResult.rows[0]?.total ?? 0,
  };
}

export async function getRecipeRecord(id: string): Promise<RecipeRecord | null> {
  const result = await query<RecipeRow>(
    `SELECT id, name, servings, created_at AS "createdAt", updated_at AS "updatedAt"
     FROM recipes
     WHERE id = $1`,
    [id]
  );
  const recipe = result.rows[0];
  if (!recipe) return null;
  const ingredients = await listIngredientRecords([id]);
  return combineRecipeRows([recipe], ingredients)[0] ?? null;
}

export async function recipeReferencesExist(input: SaveRecipeInput): Promise<boolean> {
  const groceryItemIds = Array.from(new Set(input.ingredients.map((ingredient) => ingredient.groceryItemId)));
  const unitIds = Array.from(new Set(input.ingredients.map((ingredient) => ingredient.unitId)));
  const result = await query<{ valid: boolean }>(
    `SELECT (
       SELECT COUNT(DISTINCT id) FROM grocery_items WHERE id = ANY($1::uuid[])
     ) = $2
     AND (
       SELECT COUNT(DISTINCT id) FROM measurement_units WHERE id = ANY($3::uuid[])
     ) = $4 AS valid`,
    [groceryItemIds, groceryItemIds.length, unitIds, unitIds.length]
  );
  return result.rows[0]?.valid ?? false;
}

export async function saveRecipeRecord(id: string | null, input: SaveRecipeInput): Promise<RecipeRecord | null> {
  const client = await getPool().connect();
  let transactionStarted = false;
  let recipeId = id;

  try {
    await client.query('BEGIN');
    transactionStarted = true;

    if (recipeId) {
      const updated = await client.query<{ id: string }>(
        `UPDATE recipes
         SET name = $2,
             normalized_name = btrim(regexp_replace(lower(btrim($2)), '[[:space:]]+', ' ', 'g')),
             servings = $3,
             updated_at = NOW()
         WHERE id = $1
         RETURNING id`,
        [recipeId, input.name, input.servings]
      );
      if (updated.rowCount !== 1) {
        await client.query('ROLLBACK');
        transactionStarted = false;
        return null;
      }
      await client.query('DELETE FROM recipe_ingredients WHERE recipe_id = $1', [recipeId]);
    } else {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO recipes (name, normalized_name, servings)
         VALUES (
           $1,
           btrim(regexp_replace(lower(btrim($1)), '[[:space:]]+', ' ', 'g')),
           $2
         )
         RETURNING id`,
        [input.name, input.servings]
      );
      recipeId = inserted.rows[0]?.id ?? null;
      if (!recipeId) throw new Error('The recipe ID was not returned after insertion.');
    }

    for (const [position, ingredient] of input.ingredients.entries()) {
      await client.query(
        `INSERT INTO recipe_ingredients (recipe_id, grocery_item_id, unit_id, quantity, position)
         VALUES ($1, $2, $3, $4, $5)`,
        [recipeId, ingredient.groceryItemId, ingredient.unitId, ingredient.quantity, position]
      );
    }

    await client.query('COMMIT');
    transactionStarted = false;
    return getRecipeRecord(recipeId);
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Keep the original database error for the caller.
      }
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteRecipeRecord(id: string): Promise<boolean> {
  const result = await query('DELETE FROM recipes WHERE id = $1', [id]);
  return result.rowCount === 1;
}
