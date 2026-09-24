import { eq } from 'drizzle-orm';
import { db, insertAndFetch } from '../db/index.js';
import { loans, repayments, clients, auditLogs } from '../db/schema.js';
import { AppError } from '../middlewares/AppError.js';
import {
  calculerSoldeRestant,
  STATUTS_PRET,
} from '../services/loanService.js';
import { determinerStatutClient, calculerStatutClientReel } from '../services/clientService.js';
import { formaterMontant } from '../services/currencyService.js';

/**
 * GET /loans/:id/repayments
 * Retourne l'historique des remboursements d'un prêt,
 * avec le solde restant après chaque paiement (calculé en cumul progressif).
 */
export async function getRepayments(req, res, next) {
  try {
    const loanId = parseInt(req.params.id, 10);
    if (!Number.isInteger(loanId)) {
      return next(new AppError('Prêt introuvable.', 'LOAN_NOT_FOUND', 404));
    }

    const loanResult = await db.select().from(loans).where(eq(loans.id, loanId));
    if (loanResult.length === 0) {
      return next(new AppError('Prêt introuvable.', 'LOAN_NOT_FOUND', 404));
    }

    const historique = await db.select().from(repayments)
      .where(eq(repayments.loanId, loanId))
      .orderBy(repayments.paymentDate);

    const loan = loanResult[0];
    const totalDuFinal = loan.totalDue + loan.penalties;

    // Solde restant après chaque paiement : cumul croissant des remboursements.
    // NB : les pénalités appliquées après coup augmentent le solde final réel —
    // le solde historique affiché ici est donc indicatif (voir transactions pour le solde courant).
    let cumul = 0;
    const data = historique.map((r) => {
      cumul += r.amount;
      return { ...r, soldeRestantApres: Math.max(0, totalDuFinal - cumul) };
    });

    return res.json({ data });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /loans/:id/repayments
 * Enregistre un remboursement. Met à jour le statut du prêt et du client si soldé.
 */
export async function addRepayment(req, res, next) {
  try {
    const loanId = parseInt(req.params.id, 10);
    if (!Number.isInteger(loanId)) {
      return next(new AppError('Prêt introuvable.', 'LOAN_NOT_FOUND', 404));
    }
    const { amount, paymentDate } = req.body;

    // Charge le prêt avec ses remboursements existants
    const loanResult = await db.query.loans.findFirst({
      where: eq(loans.id, loanId),
      with: { repayments: { columns: { amount: true } } },
    });

    if (!loanResult) {
      return next(new AppError('Prêt introuvable.', 'LOAN_NOT_FOUND', 404));
    }

    // Seuls les prêts actifs ou en retard peuvent recevoir un remboursement
    if (loanResult.status === STATUTS_PRET.SOLDE) {
      return next(new AppError('Ce prêt est déjà soldé.', 'LOAN_ALREADY_PAID', 409));
    }
    if (loanResult.status === STATUTS_PRET.ANNULE) {
      return next(new AppError('Un prêt annulé ne peut pas recevoir de remboursement.', 'LOAN_CANCELLED', 409));
    }

    const totalRembourseActuel = loanResult.repayments.reduce((s, r) => s + r.amount, 0);
    const soldeActuel = calculerSoldeRestant(loanResult.totalDue, loanResult.penalties, totalRembourseActuel);
    const devise = loanResult.currency || 'XOF';

    // Vérifie que le remboursement ne dépasse pas le solde restant
    if (amount > soldeActuel) {
      return next(new AppError(
        `Le montant (${formaterMontant(amount, devise)}) dépasse le solde restant (${formaterMontant(soldeActuel, devise)}).`,
        'AMOUNT_EXCEEDS_BALANCE',
        400
      ));
    }

    const date = paymentDate || new Date().toISOString().slice(0, 10);

    // Enregistre le remboursement avec sa devise et le taux utilisé à la date
    // du paiement (traçabilité comptable : les montants sont en unités mineures).
    const newRepayment = await insertAndFetch(repayments, {
      loanId,
      amount,
      paymentDate: date,
      currency: devise,
      rateToBase: '1',
      baseAmount: amount,
      recordedBy: req.user.id,
    });

    // Calcule le nouveau solde
    const nouveauSolde = soldeActuel - amount;

    // Met à jour le statut du prêt si soldé
    if (nouveauSolde <= 0) {
      await db.update(loans)
        .set({ status: STATUTS_PRET.SOLDE, updatedAt: new Date() })
        .where(eq(loans.id, loanId));

      // Recalcule le statut du client en temps réel — s'il ne lui reste
      // aucun prêt en retard, il redevient actif.
      // (La requête ci-dessous est post-insertion : elle inclut déjà
      // le remboursement qu'on vient d'enregistrer, et le prêt soldé
      // est déjà passé à 'solde' en base — le calcul est donc exact.)
      const loansClient = await db.query.loans.findMany({
        where: eq(loans.clientId, loanResult.clientId),
        columns: { status: true, totalDue: true, penalties: true, dueDate: true },
        with: { repayments: { columns: { amount: true } } },
      });
      const statutClient = calculerStatutClientReel(loansClient);

      await db.update(clients)
        .set({ status: statutClient, updatedAt: new Date() })
        .where(eq(clients.id, loanResult.clientId));
    } else {
      // Met à jour la date de modification du prêt
      await db.update(loans)
        .set({ updatedAt: new Date() })
        .where(eq(loans.id, loanId));
    }

    // Journalise
    await db.insert(auditLogs).values({
      userId: req.user.id,
      action: 'repayment.add',
      entityType: 'loan',
      entityId: loanId,
      details: { amount, paymentDate: date, soldeAvant: soldeActuel, soldeApres: nouveauSolde },
    });

    return res.status(201).json({
      data: {
        repayment: newRepayment,
        soldeRestant: Math.max(0, nouveauSolde),
        loanStatus: nouveauSolde <= 0 ? STATUTS_PRET.SOLDE : loanResult.status,
      },
    });
  } catch (error) {
    return next(error);
  }
}
