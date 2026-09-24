import { eq } from 'drizzle-orm';
import { db, insertAndFetch } from '../db/index.js';
import { loans, loanTiers, penaltyLogs, repayments, auditLogs } from '../db/schema.js';
import { AppError } from '../middlewares/AppError.js';
import {
  calculerPenalite,
  calculerJoursRetard,
  calculerSoldeRestant,
  STATUTS_PRET,
} from '../services/loanService.js';
import { TAUX_PENALITE_DEFAUT_BP } from '../services/rulesService.js';

/**
 * GET /loans/:id/penalties
 * Retourne l'historique des pénalités appliquées sur un prêt.
 */
export async function getPenalties(req, res, next) {
  try {
    const loanId = parseInt(req.params.id, 10);
    if (!Number.isInteger(loanId)) {
      return next(new AppError('Prêt introuvable.', 'LOAN_NOT_FOUND', 404));
    }

    const loanResult = await db.select().from(loans).where(eq(loans.id, loanId));
    if (loanResult.length === 0) {
      return next(new AppError('Prêt introuvable.', 'LOAN_NOT_FOUND', 404));
    }

    const result = await db.select().from(penaltyLogs)
      .where(eq(penaltyLogs.loanId, loanId))
      .orderBy(penaltyLogs.appliedDate);

    return res.json({ data: result });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /loans/:id/penalties
 * Applique une pénalité sur un prêt en retard.
 * Le gestionnaire peut fournir un nombre de jours personnalisé,
 * sinon on utilise le nombre de jours réels de retard.
 */
export async function applyPenalty(req, res, next) {
  try {
    const loanId = parseInt(req.params.id, 10);
    if (!Number.isInteger(loanId)) {
      return next(new AppError('Prêt introuvable.', 'LOAN_NOT_FOUND', 404));
    }
    const { joursRetard: joursOverride, appliedDate } = req.body;

    const loanResult = await db.query.loans.findFirst({
      where: eq(loans.id, loanId),
      with: { repayments: { columns: { amount: true } } },
    });

    if (!loanResult) {
      return next(new AppError('Prêt introuvable.', 'LOAN_NOT_FOUND', 404));
    }

    // Les pénalités ne s'appliquent qu'aux prêts en retard
    // On vérifie le statut réel (calculé) et pas seulement le champ en base
    const totalRembourse = loanResult.repayments.reduce((s, r) => s + r.amount, 0);
    const solde = calculerSoldeRestant(loanResult.totalDue, loanResult.penalties, totalRembourse);
    const joursRetardReels = calculerJoursRetard(loanResult.dueDate);

    if (joursRetardReels <= 0 || solde <= 0) {
      return next(new AppError(
        'Les pénalités ne peuvent être appliquées qu\'à un prêt en retard.',
        'LOAN_NOT_OVERDUE',
        409
      ));
    }

    // Nombre de jours à utiliser pour le calcul.
    // Le taux journalier vient de la tranche de règles appliquée au prêt :
    // chaque tranche peut avoir sa propre pénalité de retard.
    const jours = joursOverride || joursRetardReels;
    const tranche = loanResult.tierId
      ? (await db.select().from(loanTiers).where(eq(loanTiers.id, loanResult.tierId)))[0]
      : null;
    const tauxPenaliteBp = tranche?.penaltyRateBpDaily ?? TAUX_PENALITE_DEFAUT_BP;
    const montantPenalite = calculerPenalite(loanResult.principal, jours, tauxPenaliteBp);

    const date = appliedDate || new Date().toISOString().slice(0, 10);

    // Enregistre la pénalité dans le journal
    const newPenalty = await insertAndFetch(penaltyLogs, {
      loanId,
      daysOverdue: jours,
      amount: montantPenalite,
      appliedDate: date,
      appliedBy: req.user.id,
    });

    // Met à jour le total des pénalités sur le prêt (dénormalisé pour la lisibilité)
    const newPenaltiesTotal = loanResult.penalties + montantPenalite;
    await db.update(loans)
      .set({ penalties: newPenaltiesTotal, updatedAt: new Date() })
      .where(eq(loans.id, loanId));

    // Journalise
    await db.insert(auditLogs).values({
      userId: req.user.id,
      action: 'penalty.apply',
      entityType: 'loan',
      entityId: loanId,
      details: {
        jours,
        montant: montantPenalite,
        capital: loanResult.principal,
        tauxPenaliteBp,
        devise: loanResult.currency,
        appliedDate: date,
      },
    });

    const nouveauSolde = calculerSoldeRestant(loanResult.totalDue, newPenaltiesTotal, totalRembourse);

    return res.status(201).json({
      data: {
        penalty: newPenalty,
        penaltiesTotales: newPenaltiesTotal,
        soldeRestant: nouveauSolde,
      },
    });
  } catch (error) {
    return next(error);
  }
}
