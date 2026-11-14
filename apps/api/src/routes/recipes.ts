import { Router } from 'express';
import {
  createRecipeHandler,
  deleteRecipeHandler,
  getRecipeHandler,
  listRecipesHandler,
  updateRecipeHandler,
} from '../controllers/recipeController';

const router = Router();

router.get('/recipes', listRecipesHandler);
router.post('/recipes', createRecipeHandler);
router.get('/recipes/:recipeId', getRecipeHandler);
router.put('/recipes/:recipeId', updateRecipeHandler);
router.delete('/recipes/:recipeId', deleteRecipeHandler);

export default router;
