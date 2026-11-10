import { Router } from 'express';
import {
  createPantryStockHandler,
  deletePantryStockHandler,
  listPantryStockHandler,
  listPantryStockLotsHandler,
  updatePantryStockHandler,
  updatePantryStockLotExpiryHandler,
} from '../controllers/pantryStockController';

const router = Router();

router.get('/pantry', listPantryStockHandler);
router.get('/pantry/lots', listPantryStockLotsHandler);
router.put('/pantry/lots/:lotId', updatePantryStockLotExpiryHandler);
router.post('/pantry', createPantryStockHandler);
router.put('/pantry/:pantryStockId', updatePantryStockHandler);
router.delete('/pantry/:pantryStockId', deletePantryStockHandler);

export default router;
