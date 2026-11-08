import type { Request, Response } from 'express';
import {
  createPantryStockSchema,
  pantryStockIdSchema,
  pantryStockListQuerySchema,
  updatePantryStockSchema,
} from '../schemas/pantryStock';
import {
  createPantryStock,
  deletePantryStock,
  DuplicatePantryStockError,
  InvalidPantryReferenceError,
  listPantryStock,
  updatePantryStock,
} from '../services/pantryStockService';

const invalidRequest = {
  error: { code: 'VALIDATION_ERROR', message: 'The request is invalid.' },
};
const internalError = {
  error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' },
};
const notFound = {
  error: { code: 'NOT_FOUND', message: 'The requested resource was not found.' },
};

export async function listPantryStockHandler(req: Request, res: Response) {
  const parsed = pantryStockListQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json(invalidRequest);
  try {
    return res.status(200).json(await listPantryStock(parsed.data));
  } catch (error) {
    console.error('Failed to list pantry stock:', error);
    return res.status(500).json(internalError);
  }
}

export async function createPantryStockHandler(req: Request, res: Response) {
  const parsed = createPantryStockSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(invalidRequest);
  try {
    return res.status(201).json(await createPantryStock(parsed.data));
  } catch (error) {
    if (error instanceof DuplicatePantryStockError) {
      return res.status(409).json({
        error: { code: 'DUPLICATE_PANTRY_STOCK', message: error.message },
      });
    }
    if (error instanceof InvalidPantryReferenceError) {
      return res.status(400).json({
        error: { code: 'INVALID_PANTRY_REFERENCE', message: error.message },
      });
    }
    console.error('Failed to create pantry stock:', error);
    return res.status(500).json(internalError);
  }
}

export async function updatePantryStockHandler(req: Request, res: Response) {
  const idResult = pantryStockIdSchema.safeParse(req.params.pantryStockId);
  const bodyResult = updatePantryStockSchema.safeParse(req.body);
  if (!idResult.success || !bodyResult.success) return res.status(400).json(invalidRequest);
  try {
    const stock = await updatePantryStock(idResult.data, bodyResult.data);
    if (!stock) return res.status(404).json(notFound);
    return res.status(200).json(stock);
  } catch (error) {
    console.error('Failed to update pantry stock:', error);
    return res.status(500).json(internalError);
  }
}

export async function deletePantryStockHandler(req: Request, res: Response) {
  const idResult = pantryStockIdSchema.safeParse(req.params.pantryStockId);
  if (!idResult.success) return res.status(400).json(invalidRequest);
  try {
    const deleted = await deletePantryStock(idResult.data);
    if (!deleted) return res.status(404).json(notFound);
    return res.status(204).end();
  } catch (error) {
    console.error('Failed to delete pantry stock:', error);
    return res.status(500).json(internalError);
  }
}
