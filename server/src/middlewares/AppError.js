// Classe d'erreur métier.
// Utilisée pour distinguer les erreurs attendues (ex: client non trouvé, prêt déjà soldé)
// des erreurs inattendues (bug, crash base de données).
//
// Le errorHandler.js l'utilise pour choisir le bon statut HTTP et le bon message.

export class AppError extends Error {
  /**
   * @param {string} message - Message lisible par l'humain
   * @param {string} code    - Code machine pour le frontend (ex: 'LOAN_NOT_FOUND')
   * @param {number} statusCode - Code HTTP à renvoyer (400, 403, 404, 409...)
   */
  constructor(message, code, statusCode = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    // Permet à instanceof AppError de fonctionner correctement avec les classes ES6
    this.name = 'AppError';
  }
}
