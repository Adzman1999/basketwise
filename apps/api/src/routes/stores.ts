import { Router } from 'express';
import { createStoreHandler, listStoresHandler } from '../controllers/storeController';

const router = Router();

router.get('/stores', listStoresHandler);
router.post('/stores', createStoreHandler);

export default router;
