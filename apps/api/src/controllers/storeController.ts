import type { Request, Response } from 'express';
import { createStoreSchema } from '../schemas/store';
import { createStore, DuplicateStoreError, listStores } from '../services/storeService';

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

export async function listStoresHandler(_req: Request, res: Response) {
  try {
    return res.status(200).json(await listStores());
  } catch (error) {
    console.error('Failed to list stores and shops:', error);
    return res.status(500).json(internalError);
  }
}

export async function createStoreHandler(req: Request, res: Response) {
  const parsed = createStoreSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(invalidRequest);

  try {
    return res.status(201).json(await createStore(parsed.data));
  } catch (error) {
    if (error instanceof DuplicateStoreError) {
      return res.status(409).json({
        error: {
          code: 'DUPLICATE_STORE',
          message: error.message,
        },
      });
    }
    console.error('Failed to create store or shop:', error);
    return res.status(500).json(internalError);
  }
}
