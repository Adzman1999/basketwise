import { Router } from 'express';
import {
  listGroceryItemPriceHistoryHandler,
  listGroceryItemsHandler,
} from '../controllers/groceryItemController';

const router = Router();

router.get('/grocery-items', listGroceryItemsHandler);
router.get('/grocery-items/:groceryItemId/price-history', listGroceryItemPriceHistoryHandler);

export default router;
