import type { Request, Response } from 'express';
import {
  createPurchaseSchema,
  purchaseIdSchema,
  purchaseListQuerySchema,
} from '../schemas/purchase';
import { addPurchaseItemsToPantry, createPurchase, listPurchases } from '../services/purchaseService';

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

export async function createPurchaseHandler(req: Request, res: Response) {
  const parsed = createPurchaseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(invalidRequest);

  try {
    const purchase = await createPurchase(parsed.data);
    return res.status(201).json(purchase);
  } catch (error) {
    console.error('Failed to create grocery purchase:', error);
    return res.status(500).json(internalError);
  }
}

export async function listPurchasesHandler(req: Request, res: Response) {
  const parsed = purchaseListQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json(invalidRequest);

  try {
    const purchases = await listPurchases(parsed.data);
    return res.status(200).json(purchases);
  } catch (error) {
    console.error('Failed to list grocery purchases:', error);
    return res.status(500).json(internalError);
  }
}

export async function addPurchaseItemsToPantryHandler(req: Request, res: Response) {
  const idResult = purchaseIdSchema.safeParse(req.params.purchaseId);
  if (!idResult.success) return res.status(400).json(invalidRequest);

  try {
    const pantryRestockedItems = await addPurchaseItemsToPantry(idResult.data);
    if (pantryRestockedItems === null) return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'The requested purchase was not found.' },
    });
    return res.status(200).json({ pantryRestockedItems });
  } catch (error) {
    console.error('Failed to add purchase items to pantry:', error);
    return res.status(500).json(internalError);
  }
}
