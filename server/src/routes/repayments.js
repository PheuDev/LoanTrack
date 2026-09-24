import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import { getRepayments, addRepayment } from '../controllers/repaymentsController.js';

// Ce routeur est monté sous /loans/:id/repayments dans app.js
// avec l'option mergeParams pour accéder à req.params.id
const router = Router({ mergeParams: true });

router.use(authenticate);

const addRepaymentSchema = z.object({
  amount: z.number({ required_error: 'Le montant est requis.' })
    .int('Le montant doit être un entier.')
    .positive('Le montant doit être positif.'),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (YYYY-MM-DD).').optional(),
});

router.get('/',  getRepayments);
router.post('/', validate(addRepaymentSchema), addRepayment);

export default router;
