import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { AppError } from '../middlewares/AppError.js';

// SchÃ©ma de validation Zod pour le login â€” importÃ© depuis les routes
// Les donnÃ©es arrivent ici dÃ©jÃ  validÃ©es par le middleware validate()

/**
 * POST /auth/login
 * VÃ©rifie les identifiants et retourne un token JWT si valides.
 */
export async function login(req, res, next) {
  try {
    const { username, password } = req.body;

    // Cherche l'utilisateur par son nom d'utilisateur
    const result = await db.select().from(users).where(eq(users.username, username));

    if (result.length === 0) {
      // Message volontairement vague : on ne rÃ©vÃ¨le pas si c'est le username
      // ou le mot de passe qui est incorrect (sÃ©curitÃ©)
      return next(new AppError('Identifiants incorrects.', 'INVALID_CREDENTIALS', 401));
    }

    const user = result[0];

    // Compare le mot de passe fourni avec le hash stockÃ© en base
    const motDePasseValide = await bcrypt.compare(password, user.passwordHash);

    if (!motDePasseValide) {
      return next(new AppError('Identifiants incorrects.', 'INVALID_CREDENTIALS', 401));
    }

    // GÃ©nÃ¨re le token JWT â€” contient uniquement l'ID utilisateur
    // Ne jamais mettre de donnÃ©es sensibles dans le payload JWT (il est lisible cÃ´tÃ© client)
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    return res.status(200).json({
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /auth/logout
 * CÃ´tÃ© serveur, le logout JWT est stateless : on ne peut pas invalider un token
 * sans une liste noire (hors scope v1). Le vrai logout se fait cÃ´tÃ© client
 * en supprimant le token du localStorage.
 * Cette route existe pour que le frontend ait un endpoint propre Ã  appeler.
 */
export function logout(req, res) {
  return res.status(200).json({
    data: { message: 'DÃ©connexion effectuÃ©e.' },
  });
}

/**
 * GET /auth/me
 * Retourne le profil du gestionnaire connectÃ© (sans le hash).
 */
export async function getMe(req, res, next) {
  try {
    const result = await db.select().from(users).where(eq(users.id, req.user.id));
    if (result.length === 0) {
      return next(new AppError('Utilisateur introuvable.', 'USER_NOT_FOUND', 404));
    }
    const { passwordHash: _, ...user } = result[0];
    return res.json({ data: { user } });
  } catch (error) {
    return next(error);
  }
}

/**
 * PATCH /auth/profile
 * Modifie le profil du gestionnaire connectÃ© : username, displayName,
 * preferredCurrency, preferredLanguage. JournalisÃ© dans audit_logs.
 * AprÃ¨s un changement de username, le frontend doit rafraÃ®chir l'utilisateur
 * stockÃ© (le token reste valide car il ne contient que l'ID).
 */
export async function updateProfile(req, res, next) {
  try {
    const { username, displayName, preferredCurrency, preferredLanguage } = req.body;

    if (username && username !== req.user.username) {
      const existing = await db.select().from(users).where(eq(users.username, username));
      if (existing.length > 0) {
        return next(new AppError(
          `Le nom d'utilisateur ${username} est dÃ©jÃ  utilisÃ©.`,
          'USERNAME_ALREADY_EXISTS',
          409
        ));
      }
    }

    const updates = { updatedAt: new Date() };
    if (username !== undefined) updates.username = username;
    if (displayName !== undefined) updates.displayName = displayName || null;
    if (preferredCurrency !== undefined) updates.preferredCurrency = preferredCurrency || null;
    if (preferredLanguage !== undefined) updates.preferredLanguage = preferredLanguage || null;

    await db.update(users).set(updates).where(eq(users.id, req.user.id));

    const result = await db.select().from(users).where(eq(users.id, req.user.id));
    const { passwordHash: _, ...user } = result[0];

    await db.insert((await import('../db/schema.js')).auditLogs).values({
      userId: req.user.id,
      action: 'user.update',
      entityType: 'user',
      entityId: req.user.id,
      details: { username, displayName, preferredCurrency, preferredLanguage },
    });

    return res.json({ data: { user } });
  } catch (error) {
    return next(error);
  }
}
export async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;

    // req.user est attachÃ© par le middleware authenticate
    const result = await db.select().from(users).where(eq(users.id, req.user.id));
    const user = result[0];

    const motDePasseValide = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!motDePasseValide) {
      return next(new AppError('Mot de passe actuel incorrect.', 'INVALID_PASSWORD', 400));
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await db.update(users)
      .set({ passwordHash: newHash })
      .where(eq(users.id, req.user.id));

    return res.status(200).json({
      data: { message: 'Mot de passe modifiÃ© avec succÃ¨s.' },
    });
  } catch (error) {
    return next(error);
  }
}
