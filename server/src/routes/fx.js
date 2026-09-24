// Routeur FX séparé : /settings contient déjà GET / et PATCH /,
// on ne peut pas y ajouter /fx/* sans conflit conceptuel.
// Ce routeur est monté sous /fx dans app.js.
import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import { getFxRates, refreshFxRates, setManualRate } from '../controllers/settingsController.js';

const router = Router();
router.use(authenticate);

const fxManualSchema = z.object({
  pair: z.string().regex(/^[A-Za-z]{3}_[A-Za-z]{3}$/),
  rate: z.union([z.string(), z.number()]),
});

const fxRefreshSchema = z.object({
  base: z.enum(['XOF', 'EUR', 'USD']).optional(),
});

router.get('/rates', getFxRates);
router.post('/refresh', validate(fxRefreshSchema), refreshFxRates);
router.post('/manual', validate(fxManualSchema), setManualRate);

export default router;
