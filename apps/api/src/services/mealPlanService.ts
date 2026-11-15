import {
  deleteMealPlanRecord,
  listMealPlanRecords,
  mealPlanRecipeExists,
  saveMealPlanRecord,
} from '../repositories/mealPlanRepository';
import type { MealPlanListQuery, SaveMealPlanInput } from '../schemas/mealPlan';

export class MealPlanRecipeNotFoundError extends Error {
  constructor() {
    super('Choose a saved recipe for this meal plan.');
    this.name = 'MealPlanRecipeNotFoundError';
  }
}

export class MealPlanSlotConflictError extends Error {
  constructor() {
    super('A meal is already planned for this date and meal. Edit or remove it first.');
    this.name = 'MealPlanSlotConflictError';
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23503';
}

export async function listMealPlans(range: MealPlanListQuery) {
  const items = await listMealPlanRecords(range);
  return { from: range.from, to: range.to, items };
}

export async function saveMealPlan(id: string | null, input: SaveMealPlanInput) {
  if (!await mealPlanRecipeExists(input.recipeId)) throw new MealPlanRecipeNotFoundError();

  try {
    return await saveMealPlanRecord(id, input);
  } catch (error) {
    if (isUniqueViolation(error)) throw new MealPlanSlotConflictError();
    if (isForeignKeyViolation(error)) throw new MealPlanRecipeNotFoundError();
    throw error;
  }
}

export async function deleteMealPlan(id: string) {
  return deleteMealPlanRecord(id);
}
