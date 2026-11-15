import { Router } from 'express';
import {
  createMealPlanHandler,
  deleteMealPlanHandler,
  listMealPlansHandler,
  updateMealPlanHandler,
} from '../controllers/mealPlanController';

const router = Router();

router.get('/meal-plans', listMealPlansHandler);
router.post('/meal-plans', createMealPlanHandler);
router.put('/meal-plans/:mealPlanId', updateMealPlanHandler);
router.delete('/meal-plans/:mealPlanId', deleteMealPlanHandler);

export default router;
