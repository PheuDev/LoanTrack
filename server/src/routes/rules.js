import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import { getRules, createRule, updateRule, deactivateRule } from '../controllers/rulesController.js';

const router = Router();
router.use(authenticate);

const tierSchema = z.object({
  label: z.string().min(1).max(100),
  minAmount: z.number().int().positive(),
  maxAmount: z.number().int().positive().nullable().optional(),
  interestRateBp: z.number().int().min(0).max(10000),
  durationDays: z.number().int().positive(),
  minPriorRepaidLoans: z.number().int().min(0).optional(),
  penaltyRateBpDaily: z.number().int().min(0).optional(),
  maxActiveLoansPerClient: z.number().int().min(1).optional(),
});

const tierUpdateSchema = tierSchema.partial();

router.get('/', getRules);
router.post('/', validate(tierSchema), createRule);
router.patch('/:id', validate(tierUpdateSchema), updateRule);
router.post('/:id/deactivate', deactivateRule);

export default router;
