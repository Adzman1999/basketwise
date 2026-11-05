import { Router } from 'express';
import {
  createPantryStockHandler,
  deletePantryStockHandler,
  listPantryStockHandler,
  updatePantryStockHandler,
} from '../controllers/pantryStockController';

const router = Router();

router.get('/pantry', listPantryStockHandler);
router.post('/pantry', createPantryStockHandler);
router.put('/pantry/:pantryStockId', updatePantryStockHandler);
router.delete('/pantry/:pantryStockId', deletePantryStockHandler);

export default router;
