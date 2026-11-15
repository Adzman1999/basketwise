import type { Request, Response } from 'express';
import { mealPlanIdSchema, mealPlanListQuerySchema, saveMealPlanSchema } from '../schemas/mealPlan';
import {
  deleteMealPlan,
  listMealPlans,
  MealPlanRecipeNotFoundError,
  MealPlanSlotConflictError,
  saveMealPlan,
} from '../services/mealPlanService';

const invalidRequest = { error: { code: 'VALIDATION_ERROR', message: 'The request is invalid.' } };
const internalError = { error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' } };
const notFound = { error: { code: 'NOT_FOUND', message: 'The requested meal plan was not found.' } };

function sendSaveError(res: Response, error: unknown, operation: string) {
  if (error instanceof MealPlanRecipeNotFoundError) {
    return res.status(404).json({ error: { code: 'RECIPE_NOT_FOUND', message: error.message } });
  }
  if (error instanceof MealPlanSlotConflictError) {
    return res.status(409).json({ error: { code: 'MEAL_SLOT_ALREADY_PLANNED', message: error.message } });
  }
  console.error(`${operation}:`, error);
  return res.status(500).json(internalError);
}

export async function listMealPlansHandler(req: Request, res: Response) {
  const parsed = mealPlanListQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json(invalidRequest);
  try {
    return res.status(200).json(await listMealPlans(parsed.data));
  } catch (error) {
    console.error('Failed to list meal plans:', error);
    return res.status(500).json(internalError);
  }
}

export async function createMealPlanHandler(req: Request, res: Response) {
  const parsed = saveMealPlanSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(invalidRequest);
  try {
    const plan = await saveMealPlan(null, parsed.data);
    return res.status(201).json(plan);
  } catch (error) {
    return sendSaveError(res, error, 'Failed to create meal plan');
  }
}

export async function updateMealPlanHandler(req: Request, res: Response) {
  const idResult = mealPlanIdSchema.safeParse(req.params.mealPlanId);
  const bodyResult = saveMealPlanSchema.safeParse(req.body);
  if (!idResult.success || !bodyResult.success) return res.status(400).json(invalidRequest);
  try {
    const plan = await saveMealPlan(idResult.data, bodyResult.data);
    if (!plan) return res.status(404).json(notFound);
    return res.status(200).json(plan);
  } catch (error) {
    return sendSaveError(res, error, 'Failed to update meal plan');
  }
}

export async function deleteMealPlanHandler(req: Request, res: Response) {
  const idResult = mealPlanIdSchema.safeParse(req.params.mealPlanId);
  if (!idResult.success) return res.status(400).json(invalidRequest);
  try {
    if (!await deleteMealPlan(idResult.data)) return res.status(404).json(notFound);
    return res.status(204).end();
  } catch (error) {
    console.error('Failed to delete meal plan:', error);
    return res.status(500).json(internalError);
  }
}
