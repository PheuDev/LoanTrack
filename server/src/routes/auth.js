import { Router } from 'express';
import { z } from 'zod';
import { login, logout, changePassword, updateProfile, getMe } from '../controllers/authController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';

const router = Router();

// Schéma de validation pour la connexion
const loginSchema = z.object({
  username: z.string().min(1, 'Le nom d\'utilisateur est requis.'),
  password: z.string().min(1, 'Le mot de passe est requis.'),
});

// Schéma de validation pour le changement de mot de passe
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Le mot de passe actuel est requis.'),
  // Minimum 6 caractères — suffisant pour une v1 de portfolio
  newPassword: z.string().min(6, 'Le nouveau mot de passe doit contenir au moins 6 caractères.'),
});

// POST /auth/login — pas d'authentification requise
router.post('/login', validate(loginSchema), login);

// POST /auth/logout — authentification requise (bonne pratique même si stateless)
router.post('/logout', authenticate, logout);

// Schéma de validation pour la mise à jour du profil
const updateProfileSchema = z.object({
  username: z.string().min(3, 'Minimum 3 caractères.').max(100).optional(),
  displayName: z.string().max(100).nullable().optional(),
  preferredCurrency: z.enum(['XOF', 'EUR', 'USD']).nullable().optional(),
  preferredLanguage: z.enum(['fr', 'en']).nullable().optional(),
});

// GET /auth/me — profil du gestionnaire connecté
router.get('/me', authenticate, getMe);

// PATCH /auth/profile — authentification requise
router.patch('/profile', authenticate, validate(updateProfileSchema), updateProfile);

// PATCH /auth/password — authentification requise
router.patch('/password', authenticate, validate(changePasswordSchema), changePassword);

export default router;
