import { eq, desc } from 'drizzle-orm';
import { db, insertAndFetch, updateAndFetch } from '../db/index.js';
import { loans, loanTiers, clients, appSettings, auditLogs } from '../db/schema.js';
import { AppError } from '../middlewares/AppError.js';
import { calculerEtatPret, calculerPenalite, STATUTS_PRET } from '../services/loanService.js';
import { calculerStatutClientReel } from '../services/clientService.js';
import { getSettings } from '../services/currencyService.js';
import {
  TAUX_PENALITE_DEFAUT_BP,
  calculerMontantsDepuisTranche,
  compterPretsClient,
  libellePret,
  trouverTranchePourMontant,
  verifierEligibiliteClient,
} from '../services/rulesService.js';

/**
 * Charge toutes les tranches et les indexe par identifiant.
 * Les tranches désactivées restent utiles : les prêts déjà octroyés y font
 * référence pour l'affichage et le calcul des pénalités.
 * @returns {Promise<Map<number, object>>}
 */
async function indexerTranches() {
  const rows = await db.select().from(loanTiers);
  return new Map(rows.map((t) => [t.id, t]));
}

/**
 * Champs d'une tranche utiles à l'affichage et aux calculs côté client.
 */
function trancheLite(tranche) {
  if (!tranche) return null;
  return {
    id: tranche.id,
    label: tranche.label,
    minAmount: tranche.minAmount,
    maxAmount: tranche.maxAmount,
    interestRateBp: tranche.interestRateBp,
    durationDays: tranche.durationDays,
    penaltyRateBpDaily: tranche.penaltyRateBpDaily,
    minPriorRepaidLoans: tranche.minPriorRepaidLoans,
    maxActiveLoansPerClient: tranche.maxActiveLoansPerClient,
  };
}

/**
 * GET /loans
 * Retourne la liste de tous les prêts avec solde calculé.
 * Query params : status, clientId
 */
export async function getLoans(req, res, next) {
  try {
    const { status, clientId } = req.query;

    const loansResult = await db.query.loans.findMany({
      with: {
        client: { columns: { id: true, firstName: true, lastName: true, phone: true } },
        repayments: { columns: { amount: true } },
      },
      orderBy: [desc(loans.createdAt)],
    });

    const tranches = await indexerTranches();

    let result = loansResult.map((loan) => {
      const { soldeRestant, totalRembourse, statut, joursRetard } = calculerEtatPret(loan);

      return {
        id: loan.id,
        client: loan.client,
        tierId: loan.tierId,
        tierLabel: libellePret(loan, tranches),
        level: loan.level,
        currency: loan.currency,
        principal: loan.principal,
        interestAmount: loan.interestAmount,
        totalDue: loan.totalDue,
        penalties: loan.penalties,
        soldeRestant,
        totalRembourse,
        status: statut,
        startDate: loan.startDate,
        dueDate: loan.dueDate,
        joursRetard,
        createdAt: loan.createdAt,
      };
    });

    if (status) result = result.filter((l) => l.status === status);
    if (clientId) result = result.filter((l) => l.client.id === parseInt(clientId, 10));

    return res.json({ data: result });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /loans
 * Octroie un prêt à partir des tranches de règles définies par le gestionnaire.
 *
 * Body : { clientId, amount, tierId? }
 *  - `amount` est le capital demandé, exprimé dans l'unité majeure de la devise
 *    de référence (ex. 30 000 FCFA, 45.50 EUR) ;
 *  - `tierId` est optionnel : s'il est fourni, la tranche est vérifiée, sinon
 *    elle est déduite du montant.
 */
export async function createLoan(req, res, next) {
  try {
    const { clientId, amount, tierId } = req.body;

    // ── Client ────────────────────────────────────────────────────────────────
    const clientResult = await db.select().from(clients).where(eq(clients.id, clientId));
    if (clientResult.length === 0) {
      return next(new AppError('Client introuvable.', 'CLIENT_NOT_FOUND', 404));
    }

    // ── Tranche de règles applicable ──────────────────────────────────────────
    const tranchesActives = await db.select().from(loanTiers).where(eq(loanTiers.isActive, 1));
    if (tranchesActives.length === 0) {
      return next(new AppError(
        "Aucune tranche de règles active. Définissez d'abord vos règles de prêt.",
        'NO_ACTIVE_TIER',
        409
      ));
    }

    const tranche = tierId
      ? tranchesActives.find((t) => t.id === tierId)
      : trouverTranchePourMontant(amount, tranchesActives);

    if (!tranche) {
      return next(new AppError(
        'Aucune de vos tranches de règles ne couvre ce montant.',
        'TIER_NOT_FOUND',
        409
      ));
    }

    const plafond = tranche.maxAmount ?? Number.POSITIVE_INFINITY;
    if (amount < tranche.minAmount || amount > plafond) {
      return next(new AppError(
        `Le montant doit être compris entre ${tranche.minAmount} et ${tranche.maxAmount ?? '∞'} (tranche « ${tranche.label} »).`,
        'AMOUNT_OUTSIDE_TIER',
        400
      ));
    }

    // ── Éligibilité du client (marge de prêt / prêts simultanés) ─────────────
    // On calcule le statut réel de chaque prêt : `en_retard` n'est pas persisté.
    const pretsClient = await db.query.loans.findMany({
      where: eq(loans.clientId, clientId),
      columns: { status: true, totalDue: true, penalties: true, dueDate: true },
      with: { repayments: { columns: { amount: true } } },
    });
    const pretsAvecStatutReel = pretsClient.map((l) => ({ status: calculerEtatPret(l).statut }));
    const { nbSoldes, nbEnCours } = compterPretsClient(pretsAvecStatutReel);

    const eligibilite = verifierEligibiliteClient({
      tranche,
      nbPretsSoldes: nbSoldes,
      nbPretsEnCours: nbEnCours,
    });

    if (!eligibilite.eligible) {
      // Un prêt en retard mérite un message dédié : le client est suspendu.
      const suspendu = calculerStatutClientReel(pretsClient) === 'suspendu';
      return next(new AppError(
        suspendu
          ? `Ce client est suspendu : il a un prêt en retard non soldé. ${eligibilite.raisons.join(' ')}`
          : eligibilite.raisons.join(' '),
        suspendu ? 'CLIENT_SUSPENDED' : 'CLIENT_NOT_ELIGIBLE',
        409
      ));
    }

    // ── Calcul et enregistrement ─────────────────────────────────────────────
    const settings = await getSettings(db, appSettings);
    const devise = settings.default_currency;
    const today = new Date();
    const { capital, interets, montantTotalDu, dateEcheance } = calculerMontantsDepuisTranche(tranche, amount, today);

    const newLoan = await insertAndFetch(loans, {
      clientId,
      tierId: tranche.id,
      level: null,
      principal: capital,
      interestAmount: interets,
      totalDue: montantTotalDu,
      penalties: 0,
      currency: devise,
      baseCurrency: devise,
      rateToBase: '1',
      baseTotalDue: montantTotalDu,
      status: STATUTS_PRET.ACTIF,
      startDate: today.toISOString().slice(0, 10),
      dueDate: dateEcheance.toISOString().slice(0, 10),
      createdBy: req.user.id,
    });

    await db.insert(auditLogs).values({
      userId: req.user.id,
      action: 'loan.create',
      entityType: 'loan',
      entityId: newLoan.id,
      details: {
        clientId,
        tierId: tranche.id,
        tierLabel: tranche.label,
        amount,
        principal: capital,
        totalDue: montantTotalDu,
        currency: devise,
      },
    });

    return res.status(201).json({ data: newLoan });
  } catch (error) {
    return next(error);
  }
}


/**
 * GET /loans/:id
 * Retourne le détail complet d'un prêt : règles appliquées, solde calculé en
 * temps réel et montant de la pénalité éventuelle (calculé côté serveur, comme
 * tous les autres calculs financiers).
 */
export async function getLoanById(req, res, next) {
  try {
    const loanId = parseInt(req.params.id, 10);
    if (!Number.isInteger(loanId)) {
      return next(new AppError('Prêt introuvable.', 'LOAN_NOT_FOUND', 404));
    }

    const loanResult = await db.query.loans.findFirst({
      where: eq(loans.id, loanId),
      with: {
        client: { columns: { id: true, firstName: true, lastName: true, phone: true } },
        repayments: { orderBy: (r, { desc }) => [desc(r.paymentDate)] },
        penaltyLogs: { orderBy: (p, { asc }) => [asc(p.appliedDate)] },
      },
    });

    if (!loanResult) {
      return next(new AppError('Prêt introuvable.', 'LOAN_NOT_FOUND', 404));
    }

    const { soldeRestant, totalRembourse, statut, joursRetard } = calculerEtatPret(loanResult);
    const tranches = await indexerTranches();
    const tranche = tranches.get(loanResult.tierId);
    const tauxPenaliteBp = tranche?.penaltyRateBpDaily ?? TAUX_PENALITE_DEFAUT_BP;
    const penaltyPreview = {
      joursRetard,
      penaltyRateBpDaily: tauxPenaliteBp,
      montant: calculerPenalite(loanResult.principal, joursRetard, tauxPenaliteBp),
      applicable: statut === STATUTS_PRET.EN_RETARD && joursRetard > 0,
    };

    return res.json({
      data: {
        ...loanResult,
        tierLabel: libellePret(loanResult, tranches),
        tier: trancheLite(tranche),
        soldeRestant,
        totalRembourse,
        joursRetard,
        status: statut,
        penaltyPreview,
      },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * PATCH /loans/:id/cancel
 * Annule un prêt actif sans remboursements. Action irréversible.
 */
export async function cancelLoan(req, res, next) {
  try {
    const loanId = parseInt(req.params.id, 10);
    if (!Number.isInteger(loanId)) {
      return next(new AppError('Prêt introuvable.', 'LOAN_NOT_FOUND', 404));
    }

    const loanResult = await db.query.loans.findFirst({
      where: eq(loans.id, loanId),
      with: { repayments: { columns: { id: true } } },
    });

    if (!loanResult) {
      return next(new AppError('Prêt introuvable.', 'LOAN_NOT_FOUND', 404));
    }
    if (loanResult.status !== STATUTS_PRET.ACTIF) {
      return next(new AppError(
        'Seul un prêt actif peut être annulé.',
        'LOAN_CANNOT_BE_CANCELLED',
        409
      ));
    }
    if (loanResult.repayments.length > 0) {
      return next(new AppError(
        'Un prêt ayant reçu des remboursements ne peut pas être annulé.',
        'LOAN_HAS_REPAYMENTS',
        409
      ));
    }

    const updatedLoan = await updateAndFetch(
      loans,
      { status: STATUTS_PRET.ANNULE, updatedAt: new Date() },
      loanId
    );

    await db.insert(auditLogs).values({
      userId: req.user.id,
      action: 'loan.cancel',
      entityType: 'loan',
      entityId: loanId,
      details: { clientId: loanResult.clientId, tierId: loanResult.tierId, level: loanResult.level },
    });

    return res.json({ data: updatedLoan });
  } catch (error) {
    return next(error);
  }
}

