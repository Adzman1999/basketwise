import { Router } from 'express';
import {
  createPantryStockHandler,
  deletePantryStockHandler,
  listPantryStockHandler,
  listPantryStockLotsHandler,
  listPantryStockWasteHandler,
  recordPantryStockWasteHandler,
  updatePantryStockHandler,
  updatePantryStockLotExpiryHandler,
} from '../controllers/pantryStockController';

const router = Router();

router.get('/pantry', listPantryStockHandler);
router.get('/pantry/waste', listPantryStockWasteHandler);
router.get('/pantry/lots', listPantryStockLotsHandler);
router.put('/pantry/lots/:lotId', updatePantryStockLotExpiryHandler);
router.post('/pantry/lots/:lotId/waste', recordPantryStockWasteHandler);
router.post('/pantry', createPantryStockHandler);
router.put('/pantry/:pantryStockId', updatePantryStockHandler);
router.delete('/pantry/:pantryStockId', deletePantryStockHandler);

export default router;
