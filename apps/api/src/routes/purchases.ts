import { Router } from 'express';
import {
  addPurchaseItemsToPantryHandler,
  createPurchaseHandler,
  listPurchasesHandler,
} from '../controllers/purchaseController';

const router = Router();

router.get('/purchases', listPurchasesHandler);
router.post('/purchases', createPurchaseHandler);
router.post('/purchases/:purchaseId/pantry', addPurchaseItemsToPantryHandler);

export default router;
