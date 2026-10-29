import type { Request, Response } from 'express';
import { groceryItemIdSchema, groceryItemListQuerySchema, priceHistoryQuerySchema } from '../schemas/groceryItem';
import { listGroceryItemPriceHistory, listGroceryItems } from '../services/groceryItemService';

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

const notFound = {
  error: {
    code: 'NOT_FOUND',
    message: 'The requested resource was not found.',
  },
};

export async function listGroceryItemsHandler(req: Request, res: Response) {
  const parsed = groceryItemListQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json(invalidRequest);

  try {
    return res.status(200).json(await listGroceryItems(parsed.data));
  } catch (error) {
    console.error('Failed to list grocery items:', error);
    return res.status(500).json(internalError);
  }
}

export async function listGroceryItemPriceHistoryHandler(req: Request, res: Response) {
  const idResult = groceryItemIdSchema.safeParse(req.params.groceryItemId);
  const queryResult = priceHistoryQuerySchema.safeParse(req.query);
  if (!idResult.success || !queryResult.success) return res.status(400).json(invalidRequest);

  try {
    const history = await listGroceryItemPriceHistory(idResult.data, queryResult.data);
    if (!history) return res.status(404).json(notFound);
    return res.status(200).json(history);
  } catch (error) {
    console.error('Failed to list grocery item price history:', error);
    return res.status(500).json(internalError);
  }
}
