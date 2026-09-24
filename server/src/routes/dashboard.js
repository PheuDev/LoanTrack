import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { getDashboard } from '../controllers/dashboardController.js';

const router = Router();
router.use(authenticate);
router.get('/', getDashboard);

export default router;
