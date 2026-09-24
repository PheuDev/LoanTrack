import { AppError } from './AppError.js';

// Middleware de validation Zod.
// Utilisation dans une route :
//   router.post('/loans', authenticate, validate(createLoanSchema), loansController.createLoan);
//
// Si les données sont invalides, répond 400 avec le détail des erreurs Zod.
// Si elles sont valides, les données parsées (et transformées par Zod) remplacent req.body.

/**
 * @param {import('zod').ZodSchema} schema - Schéma Zod à utiliser pour valider req.body
 */
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      // Zod retourne un tableau d'erreurs — on les formate en messages lisibles
      const messages = result.error.errors.map((e) => {
        const champ = e.path.join('.');
        return champ ? `${champ} : ${e.message}` : e.message;
      });

      return next(new AppError(messages.join(', '), 'VALIDATION_ERROR', 400));
    }

    // On remplace req.body par les données validées et transformées par Zod.
    // Cela garantit que le contrôleur travaille toujours avec des données propres.
    req.body = result.data;
    return next();
  };
}
