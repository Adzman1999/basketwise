import { Router } from 'express';
import {
  deleteGroceryItemUnitConversionHandler,
  listGroceryItemUnitConversionsHandler,
  listGroceryItemPriceHistoryHandler,
  listGroceryItemsHandler,
  saveGroceryItemUnitConversionHandler,
} from '../controllers/groceryItemController';

const router = Router();

router.get('/grocery-items', listGroceryItemsHandler);
router.get('/grocery-items/:groceryItemId/price-history', listGroceryItemPriceHistoryHandler);
router.get('/grocery-items/:groceryItemId/unit-conversions', listGroceryItemUnitConversionsHandler);
router.put('/grocery-items/:groceryItemId/unit-conversions', saveGroceryItemUnitConversionHandler);
router.delete('/grocery-items/:groceryItemId/unit-conversions/:conversionId', deleteGroceryItemUnitConversionHandler);

export default router;
