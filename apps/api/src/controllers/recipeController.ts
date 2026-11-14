import type { Request, Response } from 'express';
import { recipeIdSchema, recipeListQuerySchema, saveRecipeSchema } from '../schemas/recipe';
import {
  deleteRecipe,
  getRecipe,
  InvalidRecipeIngredientReferenceError,
  listRecipes,
  saveRecipe,
} from '../services/recipeService';

const invalidRequest = {
  error: { code: 'VALIDATION_ERROR', message: 'The request is invalid.' },
};
const internalError = {
  error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' },
};
const notFound = {
  error: { code: 'NOT_FOUND', message: 'The requested recipe was not found.' },
};

export async function listRecipesHandler(req: Request, res: Response) {
  const parsed = recipeListQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json(invalidRequest);
  try {
    return res.status(200).json(await listRecipes(parsed.data));
  } catch (error) {
    console.error('Failed to list recipes:', error);
    return res.status(500).json(internalError);
  }
}

export async function getRecipeHandler(req: Request, res: Response) {
  const idResult = recipeIdSchema.safeParse(req.params.recipeId);
  if (!idResult.success) return res.status(400).json(invalidRequest);
  try {
    const recipe = await getRecipe(idResult.data);
    if (!recipe) return res.status(404).json(notFound);
    return res.status(200).json(recipe);
  } catch (error) {
    console.error('Failed to get recipe:', error);
    return res.status(500).json(internalError);
  }
}

export async function createRecipeHandler(req: Request, res: Response) {
  const parsed = saveRecipeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(invalidRequest);
  try {
    return res.status(201).json(await saveRecipe(null, parsed.data));
  } catch (error) {
    if (error instanceof InvalidRecipeIngredientReferenceError) {
      return res.status(400).json({
        error: { code: 'INVALID_RECIPE_INGREDIENT_REFERENCE', message: error.message },
      });
    }
    console.error('Failed to create recipe:', error);
    return res.status(500).json(internalError);
  }
}

export async function updateRecipeHandler(req: Request, res: Response) {
  const idResult = recipeIdSchema.safeParse(req.params.recipeId);
  const bodyResult = saveRecipeSchema.safeParse(req.body);
  if (!idResult.success || !bodyResult.success) return res.status(400).json(invalidRequest);
  try {
    const recipe = await saveRecipe(idResult.data, bodyResult.data);
    if (!recipe) return res.status(404).json(notFound);
    return res.status(200).json(recipe);
  } catch (error) {
    if (error instanceof InvalidRecipeIngredientReferenceError) {
      return res.status(400).json({
        error: { code: 'INVALID_RECIPE_INGREDIENT_REFERENCE', message: error.message },
      });
    }
    console.error('Failed to update recipe:', error);
    return res.status(500).json(internalError);
  }
}

export async function deleteRecipeHandler(req: Request, res: Response) {
  const idResult = recipeIdSchema.safeParse(req.params.recipeId);
  if (!idResult.success) return res.status(400).json(invalidRequest);
  try {
    const deleted = await deleteRecipe(idResult.data);
    if (!deleted) return res.status(404).json(notFound);
    return res.status(204).end();
  } catch (error) {
    console.error('Failed to delete recipe:', error);
    return res.status(500).json(internalError);
  }
}
