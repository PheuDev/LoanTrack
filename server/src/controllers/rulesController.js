import { eq } from 'drizzle-orm';
import { db, insertAndFetch, updateAndFetch } from '../db/index.js';
import { loanTiers, loans, auditLogs } from '../db/schema.js';
import { AppError } from '../middlewares/AppError.js';
import {
  validerTranche,
  chevaucheTranche,
  trouverTranchePourMontant,
} from '../services/rulesService.js';

function presenter(row) {
  return {
    id: row.id,
    label: row.label,
    minAmount: row.minAmount,
    maxAmount: row.maxAmount,
    interestRateBp: row.interestRateBp,
    tauxPourcent: row.interestRateBp / 100,
    durationDays: row.durationDays,
    minPriorRepaidLoans: row.minPriorRepaidLoans,
    penaltyRateBpDaily: row.penaltyRateBpDaily,
    maxActiveLoansPerClient: row.maxActiveLoansPerClient,
    isActive: row.isActive === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * GET /rules — liste les tranches actives (+ simulateur ?amount=&clientId=).
 */
export async function getRules(req, res, next) {
  try {
    const rows = await db.select().from(loanTiers).where(eq(loanTiers.isActive, 1));
    const actives = rows.map(presenter);

    let simulation = null;
    if (req.query.amount !== undefined) {
      const amount = parseInt(req.query.amount, 10);
      const tranche = trouverTranchePourMontant(amount, rows);
      if (tranche) {
        const svc = await import('../services/rulesService.js');
        const calc = svc.calculerMontantsDepuisTranche(tranche, amount);
        simulation = {
          tranche: presenter(tranche),
          capital: calc.capital, interets: calc.interets, montantTotalDu: calc.montantTotalDu,
          dateEcheance: calc.dateEcheance.toISOString().slice(0, 10),
        };
        if (req.query.clientId) {
          const clientId = parseInt(req.query.clientId, 10);
          const prets = await db.select().from(loans).where(eq(loans.clientId, clientId));
          const nbSoldes = prets.filter((l) => l.status === 'solde').length;
          simulation.eligible = svc.clientEligibleTranche(nbSoldes, tranche);
          simulation.nbPretsSoldes = nbSoldes;
        }
      }
    }

    return res.json({ data: { tiers: actives, simulation } });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /rules — crée une tranche (refuse les chevauchements).
 */
export async function createRule(req, res, next) {
  try {
    const body = req.body || {};
    const candidat = {
      label: body.label,
      minAmount: body.minAmount,
      maxAmount: body.maxAmount ?? null,
      interestRateBp: body.interestRateBp,
      durationDays: body.durationDays,
      minPriorRepaidLoans: body.minPriorRepaidLoans ?? 0,
      penaltyRateBpDaily: body.penaltyRateBpDaily ?? 500,
      maxActiveLoansPerClient: body.maxActiveLoansPerClient ?? 1,
    };

    const erreurs = validerTranche(candidat);
    if (erreurs.length > 0) {
      return next(new AppError(erreurs.join(' '), 'INVALID_TIER', 400));
    }

    const actives = await db.select().from(loanTiers).where(eq(loanTiers.isActive, 1));
    if (chevaucheTranche(candidat, actives)) {
      return next(new AppError('Cette tranche chevauche une tranche active.', 'TIER_OVERLAP', 409));
    }

    const created = await insertAndFetch(loanTiers, {
      ...candidat, isActive: 1, createdAt: new Date(), updatedAt: new Date(),
    });

    await db.insert(auditLogs).values({
      userId: req.user.id, action: 'rule.create', entityType: 'loan_tier',
      entityId: created.id, details: { snapshot: presenter(created) },
    });

    return res.status(201).json({ data: presenter(created) });
  } catch (error) {
    return next(error);
  }
}



/**
 * PATCH /rules/:id — modifie une tranche (refuse les chevauchements).
 */
export async function updateRule(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return next(new AppError('Tranche introuvable.', 'TIER_NOT_FOUND', 404));
    }
    const rows = await db.select().from(loanTiers).where(eq(loanTiers.id, id));
    if (rows.length === 0) {
      return next(new AppError('Tranche introuvable.', 'TIER_NOT_FOUND', 404));
    }
    const current = rows[0];
    const merged = {
      label: req.body.label ?? current.label,
      minAmount: req.body.minAmount ?? current.minAmount,
      maxAmount: req.body.maxAmount !== undefined ? req.body.maxAmount : current.maxAmount,
      interestRateBp: req.body.interestRateBp ?? current.interestRateBp,
      durationDays: req.body.durationDays ?? current.durationDays,
      minPriorRepaidLoans: req.body.minPriorRepaidLoans ?? current.minPriorRepaidLoans,
      penaltyRateBpDaily: req.body.penaltyRateBpDaily ?? current.penaltyRateBpDaily,
      maxActiveLoansPerClient: req.body.maxActiveLoansPerClient ?? current.maxActiveLoansPerClient,
    };

    const erreurs = validerTranche(merged);
    if (erreurs.length > 0) {
      return next(new AppError(erreurs.join(' '), 'INVALID_TIER', 400));
    }

    const actives = await db.select().from(loanTiers).where(eq(loanTiers.isActive, 1));
    if (chevaucheTranche({ ...merged, id }, actives)) {
      return next(new AppError('Chevauchement avec une tranche active.', 'TIER_OVERLAP', 409));
    }

    const updated = await updateAndFetch(loanTiers, { ...merged, updatedAt: new Date() }, id);

    await db.insert(auditLogs).values({
      userId: req.user.id, action: 'rule.update', entityType: 'loan_tier',
      entityId: id, details: { avant: presenter(current), apres: presenter(updated) },
    });

    return res.json({ data: presenter(updated) });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /rules/:id/deactivate — désactive une tranche (jamais de suppression dure).
 */
export async function deactivateRule(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return next(new AppError('Tranche introuvable.', 'TIER_NOT_FOUND', 404));
    }
    const rows = await db.select().from(loanTiers).where(eq(loanTiers.id, id));
    if (rows.length === 0) {
      return next(new AppError('Tranche introuvable.', 'TIER_NOT_FOUND', 404));
    }
    const updated = await updateAndFetch(loanTiers, { isActive: 0, updatedAt: new Date() }, id);

    await db.insert(auditLogs).values({
      userId: req.user.id, action: 'rule.deactivate', entityType: 'loan_tier',
      entityId: id, details: { snapshot: presenter(updated) },
    });

    return res.json({ data: presenter(updated) });
  } catch (error) {
    return next(error);
  }
}
