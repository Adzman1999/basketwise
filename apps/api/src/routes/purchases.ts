import { Router } from 'express';
import { createPurchaseHandler, listPurchasesHandler } from '../controllers/purchaseController';

const router = Router();

router.get('/purchases', listPurchasesHandler);
router.post('/purchases', createPurchaseHandler);

export default router;
