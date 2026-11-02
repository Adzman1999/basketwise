import type { Request, Response } from 'express';
import { budgetPeriodParamsSchema, setBudgetSchema } from '../schemas/budget';
import { deleteBudget, getBudget, saveBudget } from '../services/budgetService';

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

export async function getBudgetHandler(req: Request, res: Response) {
  const parsed = budgetPeriodParamsSchema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json(invalidRequest);

  try {
    return res.status(200).json(await getBudget(parsed.data));
  } catch (error) {
    console.error('Failed to get grocery budget:', error);
    return res.status(500).json(internalError);
  }
}

export async function saveBudgetHandler(req: Request, res: Response) {
  const parsedPeriod = budgetPeriodParamsSchema.safeParse(req.params);
  const parsedBody = setBudgetSchema.safeParse(req.body);
  if (!parsedPeriod.success || !parsedBody.success) return res.status(400).json(invalidRequest);

  try {
    return res.status(200).json(await saveBudget(parsedPeriod.data, parsedBody.data));
  } catch (error) {
    console.error('Failed to save grocery budget:', error);
    return res.status(500).json(internalError);
  }
}

export async function deleteBudgetHandler(req: Request, res: Response) {
  const parsed = budgetPeriodParamsSchema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json(invalidRequest);

  try {
    return res.status(200).json(await deleteBudget(parsed.data));
  } catch (error) {
    console.error('Failed to remove grocery budget:', error);
    return res.status(500).json(internalError);
  }
}
