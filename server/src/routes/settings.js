import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import {
  convertAppCurrency,
  getAppSettings,
  updateAppSettings,
} from '../controllers/settingsController.js';

const router = Router();
router.use(authenticate);

// Paramètres d'affichage : le nom de l'application et la langue.
// La devise n'est pas ici : elle passe par POST /settings/currency (conversion).
const settingsSchema = z.object({
  app_name: z.string().min(1).max(100).optional(),
  default_language: z.enum(['fr', 'en']).optional(),
});

// Changement de devise : taux optionnel pour forcer une valeur (mode hors-ligne).
const currencySchema = z.object({
  currency: z.enum(['XOF', 'EUR', 'USD']),
  taux: z.union([z.string(), z.number()]).optional(),
});

router.get('/', getAppSettings);
router.patch('/', validate(settingsSchema), updateAppSettings);
router.post('/currency', validate(currencySchema), convertAppCurrency);

export default router;
