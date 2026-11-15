import { query } from '../db';
import type { MealPlanListQuery, SaveMealPlanInput } from '../schemas/mealPlan';

export type MealPlanRecord = {
  id: string;
  recipeId: string;
  plannedOn: string;
  mealType: SaveMealPlanInput['mealType'];
  servings: number;
  createdAt: Date;
  updatedAt: Date;
};

export async function listMealPlanRecords(range: MealPlanListQuery): Promise<MealPlanRecord[]> {
  const result = await query<MealPlanRecord>(
    `SELECT id,
            recipe_id AS "recipeId",
            planned_on::text AS "plannedOn",
            meal_type AS "mealType",
            servings,
            created_at AS "createdAt",
            updated_at AS "updatedAt"
     FROM meal_plan_entries
     WHERE planned_on >= $1::date AND planned_on <= $2::date
     ORDER BY planned_on, CASE meal_type
       WHEN 'breakfast' THEN 0
       WHEN 'lunch' THEN 1
       WHEN 'dinner' THEN 2
       ELSE 3
     END`,
    [range.from, range.to]
  );
  return result.rows;
}

export async function mealPlanRecipeExists(recipeId: string): Promise<boolean> {
  const result = await query<{ recipeExists: boolean }>(
    'SELECT EXISTS (SELECT 1 FROM recipes WHERE id = $1) AS "recipeExists"',
    [recipeId]
  );
  return result.rows[0]?.recipeExists ?? false;
}

export async function saveMealPlanRecord(id: string | null, input: SaveMealPlanInput): Promise<MealPlanRecord | null> {
  const result = id
    ? await query<MealPlanRecord>(
      `UPDATE meal_plan_entries
       SET recipe_id = $2,
           planned_on = $3::date,
           meal_type = $4,
           servings = $5,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id,
                 recipe_id AS "recipeId",
                 planned_on::text AS "plannedOn",
                 meal_type AS "mealType",
                 servings,
                 created_at AS "createdAt",
                 updated_at AS "updatedAt"`,
      [id, input.recipeId, input.plannedOn, input.mealType, input.servings]
    )
    : await query<MealPlanRecord>(
      `INSERT INTO meal_plan_entries (recipe_id, planned_on, meal_type, servings)
       VALUES ($1, $2::date, $3, $4)
       RETURNING id,
                 recipe_id AS "recipeId",
                 planned_on::text AS "plannedOn",
                 meal_type AS "mealType",
                 servings,
                 created_at AS "createdAt",
                 updated_at AS "updatedAt"`,
      [input.recipeId, input.plannedOn, input.mealType, input.servings]
    );

  return result.rows[0] ?? null;
}

export async function deleteMealPlanRecord(id: string): Promise<boolean> {
  const result = await query('DELETE FROM meal_plan_entries WHERE id = $1', [id]);
  return result.rowCount === 1;
}
