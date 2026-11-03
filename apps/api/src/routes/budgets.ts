import { Router } from 'express';
import {
  deleteBudgetHandler,
  getBudgetHandler,
  getBudgetCalendarHandler,
  saveBudgetHandler,
} from '../controllers/budgetController';

const router = Router();

router.get('/budgets/calendar/:month', getBudgetCalendarHandler);
router.get('/budgets/:periodType/:startsOn/:endsOn', getBudgetHandler);
router.put('/budgets/:periodType/:startsOn/:endsOn', saveBudgetHandler);
router.delete('/budgets/:periodType/:startsOn/:endsOn', deleteBudgetHandler);

export default router;
