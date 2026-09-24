import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import { getLoans, createLoan, getLoanById, cancelLoan } from '../controllers/loansController.js';

const router = Router();

router.use(authenticate);

// Le capital est saisi en unité majeure de la devise de référence :
// la tranche de règles applicable est déduite du montant (tierId est optionnel).
const createLoanSchema = z.object({
  clientId: z.number({ required_error: 'Le client est requis.' }).int().positive(),
  amount:   z.number({ required_error: 'Le montant est requis.' }).int().positive(),
  tierId:   z.number().int().positive().optional(),
});

router.get('/',            getLoans);
router.post('/',           validate(createLoanSchema), createLoan);
router.get('/:id',         getLoanById);
router.patch('/:id/cancel', cancelLoan);

export default router;
