import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { getTransactions } from '../controllers/transactionsController.js';

const router = Router();
router.use(authenticate);
router.get('/', getTransactions);

export default router;
