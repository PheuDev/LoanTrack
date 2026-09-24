import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import { getPenalties, applyPenalty } from '../controllers/penaltiesController.js';

const router = Router({ mergeParams: true });

router.use(authenticate);

const applyPenaltySchema = z.object({
  // Nombre de jours optionnel — si absent, on utilise les jours réels de retard
  joursRetard: z.number().int().positive().optional(),
  appliedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (YYYY-MM-DD).').optional(),
});

router.get('/',  getPenalties);
router.post('/', validate(applyPenaltySchema), applyPenalty);

export default router;
