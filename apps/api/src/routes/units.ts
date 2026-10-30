import { Router } from 'express';
import { createUnitHandler, listUnitsHandler } from '../controllers/unitController';

const router = Router();

router.get('/units', listUnitsHandler);
router.post('/units', createUnitHandler);

export default router;
