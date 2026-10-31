import type { Request, Response } from 'express';
import { monthlyBudgetParamsSchema, setMonthlyBudgetSchema } from '../schemas/budget';
import { deleteMonthlyBudget, getMonthlyBudget, saveMonthlyBudget } from '../services/budgetService';

const invalidRequest = {
  error: {
    code: 'VALIDATION_ERROR',
    message: 'The request is invalid.',
  },
};

const internalError = {
  error: {
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred.',
  },
};

export async function getMonthlyBudgetHandler(req: Request, res: Response) {
  const parsed = monthlyBudgetParamsSchema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json(invalidRequest);

  try {
    return res.status(200).json(await getMonthlyBudget(parsed.data.month));
  } catch (error) {
    console.error('Failed to get monthly grocery budget:', error);
    return res.status(500).json(internalError);
  }
}

export async function saveMonthlyBudgetHandler(req: Request, res: Response) {
  const parsedParams = monthlyBudgetParamsSchema.safeParse(req.params);
  const parsedBody = setMonthlyBudgetSchema.safeParse(req.body);
  if (!parsedParams.success || !parsedBody.success) return res.status(400).json(invalidRequest);

  try {
    return res.status(200).json(await saveMonthlyBudget(parsedParams.data.month, parsedBody.data));
  } catch (error) {
    console.error('Failed to save monthly grocery budget:', error);
    return res.status(500).json(internalError);
  }
}

export async function deleteMonthlyBudgetHandler(req: Request, res: Response) {
  const parsed = monthlyBudgetParamsSchema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json(invalidRequest);

  try {
    return res.status(200).json(await deleteMonthlyBudget(parsed.data.month));
  } catch (error) {
    console.error('Failed to remove monthly grocery budget:', error);
    return res.status(500).json(internalError);
  }
}
