import { AppError } from './AppError.js';

// Middleware de gestion d'erreurs global.
// Doit être le DERNIER middleware monté dans app.js (Express le reconnaît à ses 4 paramètres).
// Toutes les erreurs propagées via next(error) arrivent ici.
//
// Deux cas :
// - AppError : erreur métier connue → on renvoie son message et son code
// - Autre    : erreur inattendue → on logue et on renvoie un message générique

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // Erreur métier connue (ex: client suspendu, prêt introuvable)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        message: err.message,
        code: err.code,
      },
    });
  }

  // Erreur inattendue : on logue pour le débogage mais on ne renvoie pas
  // les détails techniques au client (risque de sécurité).
  console.error('[Erreur serveur]', err);

  return res.status(500).json({
    error: {
      message: 'Une erreur interne est survenue.',
      code: 'INTERNAL_ERROR',
    },
  });
}
