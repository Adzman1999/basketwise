import { Router } from 'express';
import {
  deleteMonthlyBudgetHandler,
  getMonthlyBudgetHandler,
  saveMonthlyBudgetHandler,
} from '../controllers/budgetController';

const router = Router();

router.get('/budgets/:month', getMonthlyBudgetHandler);
router.put('/budgets/:month', saveMonthlyBudgetHandler);
router.delete('/budgets/:month', deleteMonthlyBudgetHandler);

export default router;
