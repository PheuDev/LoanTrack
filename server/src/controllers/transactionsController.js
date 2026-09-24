import { db } from '../db/index.js';
import { loanTiers, repayments } from '../db/schema.js';
import { libellePret } from '../services/rulesService.js';

/**
 * GET /transactions
 * Retourne le journal global de tous les remboursements, paginé.
 * Query params : page (défaut 1), limit (défaut 20), from (date), to (date)
 *
 * Chaque entrée inclut `soldeRestantApres` : le solde du prêt juste après
 * ce paiement (cumul progressif par prêt, trié par date croissante).
 */
export async function getTransactions(req, res, next) {
  try {
    const page  = Math.max(1, parseInt(req.query.page  || '1',  10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));

    // Charge tous les remboursements avec les infos du prêt et du client
    const allRepayments = await db.query.repayments.findMany({
      with: {
        loan: {
          columns: { id: true, level: true, tierId: true, principal: true, totalDue: true, penalties: true },
          with: {
            client: { columns: { id: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy: (r, { desc }) => [desc(r.paymentDate), desc(r.createdAt)],
    });

    const tranchesParId = new Map((await db.select().from(loanTiers)).map((t) => [t.id, t]));

    // Filtre par date si fourni
    let filtered = allRepayments;
    if (req.query.from) {
      filtered = filtered.filter((r) => r.paymentDate >= req.query.from);
    }
    if (req.query.to) {
      filtered = filtered.filter((r) => r.paymentDate <= req.query.to);
    }

    // Calcule le solde restant après chaque paiement, par prêt.
    // On trie par prêt puis par date croissante pour cumuler dans l'ordre,
    // puis on réindexe le résultat par id de remboursement.
    const parPret = new Map();
    for (const r of filtered) {
      if (!parPret.has(r.loanId)) parPret.set(r.loanId, []);
      parPret.get(r.loanId).push(r);
    }
    const soldeParId = new Map();
    for (const liste of parPret.values()) {
      const totalDu = (liste[0]?.loan?.totalDue || 0) + (liste[0]?.loan?.penalties || 0);
      const ordonnes = [...liste].sort((a, b) =>
        a.paymentDate < b.paymentDate ? -1 : a.paymentDate > b.paymentDate ? 1 : a.id - b.id
      );
      let cumul = 0;
      for (const r of ordonnes) {
        cumul += r.amount;
        soldeParId.set(r.id, Math.max(0, totalDu - cumul));
      }
    }

    const avecSolde = filtered.map((r) => ({
      ...r,
      tierLabel: r.loan ? libellePret(r.loan, tranchesParId) : null,
      soldeRestantApres: soldeParId.get(r.id) ?? null,
    }));

    // Pagination
    const total = avecSolde.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const data = avecSolde.slice(offset, offset + limit);

    return res.json({
      data: {
        transactions: data,
        pagination: { page, limit, total, totalPages },
      },
    });
  } catch (error) {
    return next(error);
  }
}
