import type { Request, Response } from 'express';
import { createUnitSchema } from '../schemas/unit';
import { createUnit, DuplicateUnitError, listUnits } from '../services/unitService';

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

export async function listUnitsHandler(_req: Request, res: Response) {
  try {
    return res.status(200).json(await listUnits());
  } catch (error) {
    console.error('Failed to list measurement units:', error);
    return res.status(500).json(internalError);
  }
}

export async function createUnitHandler(req: Request, res: Response) {
  const parsed = createUnitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(invalidRequest);

  try {
    return res.status(201).json(await createUnit(parsed.data));
  } catch (error) {
    if (error instanceof DuplicateUnitError) {
      return res.status(409).json({
        error: {
          code: 'DUPLICATE_UNIT',
          message: error.message,
        },
      });
    }
    console.error('Failed to create measurement unit:', error);
    return res.status(500).json(internalError);
  }
}
