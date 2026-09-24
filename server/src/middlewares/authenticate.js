import jwt from 'jsonwebtoken';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { AppError } from './AppError.js';

// Middleware d'authentification JWT.
// À placer sur toutes les routes qui nécessitent d'être connecté.
//
// Ce qu'il fait :
// 1. Lit le token dans l'en-tête Authorization: Bearer <token>
// 2. Vérifie la signature et l'expiration du token
// 3. Charge l'utilisateur correspondant depuis la base
// 4. L'attache à req.user pour que le contrôleur puisse l'utiliser
//
// En cas d'échec : répond 401 (non authentifié)

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    // L'en-tête doit être de la forme "Bearer eyJhbGciOi..."
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError('Token manquant. Veuillez vous connecter.', 'UNAUTHORIZED', 401));
    }

    const token = authHeader.slice(7); // Retire "Bearer "

    // Vérifie la signature et l'expiration — lève une erreur si invalide
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      // TokenExpiredError ou JsonWebTokenError
      const message = jwtError.name === 'TokenExpiredError'
        ? 'Session expirée. Veuillez vous reconnecter.'
        : 'Token invalide. Veuillez vous reconnecter.';
      return next(new AppError(message, 'UNAUTHORIZED', 401));
    }

    // Charge l'utilisateur depuis la base pour s'assurer qu'il existe toujours
    const result = await db.select().from(users).where(eq(users.id, payload.userId));

    if (result.length === 0) {
      return next(new AppError('Utilisateur introuvable.', 'UNAUTHORIZED', 401));
    }

    // Attache l'utilisateur à la requête sans exposer le mot de passe hashé
    const { passwordHash: _, ...userSansMotDePasse } = result[0];
    req.user = userSansMotDePasse;

    return next();
  } catch (error) {
    return next(error);
  }
}
