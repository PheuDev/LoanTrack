import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import {
  getClients,
  createClient,
  getClientById,
  updateClient,
} from '../controllers/clientsController.js';

const router = Router();

// Toutes les routes clients nécessitent d'être authentifié
router.use(authenticate);

// Schéma de création d'un client
const createClientSchema = z.object({
  firstName: z.string().min(1, 'Le prénom est requis.').max(100),
  lastName:  z.string().min(1, 'Le nom est requis.').max(100),
  phone:     z.string().min(1, 'Le téléphone est requis.').max(20),
  address:   z.string().max(500).optional(),
  notes:     z.string().max(1000).optional(),
});

// Schéma de modification (tous les champs sont optionnels)
const updateClientSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName:  z.string().min(1).max(100).optional(),
  phone:     z.string().min(1).max(20).optional(),
  address:   z.string().max(500).optional().nullable(),
  notes:     z.string().max(1000).optional().nullable(),
});

router.get('/',     getClients);
router.post('/',    validate(createClientSchema), createClient);
router.get('/:id',  getClientById);
router.patch('/:id', validate(updateClientSchema), updateClient);

export default router;
