import { db } from '../db/index.js';
import { loans, loanTiers, repayments } from '../db/schema.js';
import { calculerEtatPret, calculerJoursRetard } from '../services/loanService.js';
import { libellePret } from '../services/rulesService.js';

/**
 * GET /dashboard
 * Retourne tous les indicateurs nécessaires au tableau de bord en une seule requête.
 */
export async function getDashboard(req, res, next) {
  try {
    // Charge tous les prêts avec leurs remboursements pour calculer les soldes
    const loansResult = await db.query.loans.findMany({
      with: {
        client: { columns: { id: true, firstName: true, lastName: true } },
        repayments: { columns: { amount: true } },
      },
      orderBy: (loans, { desc }) => [desc(loans.createdAt)],
    });

    // Calcule le statut et le solde réels de chaque prêt
    const loansAvecStatut = loansResult.map((loan) => {
      const { soldeRestant, totalRembourse, statut } = calculerEtatPret(loan);
      return { ...loan, soldeRestant, totalRembourse, statut };
    });

    // Libellés des tranches de règles (prêts récents, prêts en retard)
    const tranchesParId = new Map((await db.select().from(loanTiers)).map((t) => [t.id, t]));

    // ── KPIs ───────────────────────────────────────────────────────────────────
    const loansActifs    = loansAvecStatut.filter((l) => l.statut === 'actif');
    const loansEnRetard  = loansAvecStatut.filter((l) => l.statut === 'en_retard');
    const loansSoldes    = loansAvecStatut.filter((l) => l.statut === 'solde');
    const loansNonAnnules = loansAvecStatut.filter((l) => l.statut !== 'annule');

    const montantTotalPrete   = loansNonAnnules.reduce((s, l) => s + l.principal, 0);
    const montantRecupere     = loansNonAnnules.reduce((s, l) => s + l.totalRembourse, 0);
    const montantRestantTotal = loansNonAnnules
      .filter((l) => l.statut !== 'solde')
      .reduce((s, l) => s + l.soldeRestant, 0);

    // ── Répartition des statuts ────────────────────────────────────────────────
    const totalNonAnnules = loansNonAnnules.length || 1; // évite division par zéro
    const repartitionStatuts = [
      {
        statut: 'actif',
        count: loansActifs.length,
        pourcentage: Math.round((loansActifs.length / totalNonAnnules) * 100),
      },
      {
        statut: 'en_retard',
        count: loansEnRetard.length,
        pourcentage: Math.round((loansEnRetard.length / totalNonAnnules) * 100),
      },
      {
        statut: 'solde',
        count: loansSoldes.length,
        pourcentage: Math.round((loansSoldes.length / totalNonAnnules) * 100),
      },
    ];

    // ── Évolution mensuelle (6 derniers mois) ─────────────────────────────────
    const evolutionMensuelle = calculerEvolutionMensuelle(loansNonAnnules);

    // ── Prêts en retard détaillés ──────────────────────────────────────────────
    const pretsEnRetard = loansEnRetard.map((l) => ({
      id: l.id,
      client: { id: l.client.id, firstName: l.client.firstName, lastName: l.client.lastName },
      tierLabel: libellePret(l, tranchesParId),
      level: l.level,
      principal: l.principal,
      dueDate: l.dueDate,
      joursRetard: calculerJoursRetard(l.dueDate),
      soldeRestant: l.soldeRestant,
    })).sort((a, b) => b.joursRetard - a.joursRetard);

    // ── 5 derniers prêts créés ─────────────────────────────────────────────────
    const derniersPrets = loansNonAnnules.slice(0, 5).map((l) => ({
      id: l.id,
      client: l.client,
      tierLabel: libellePret(l, tranchesParId),
      level: l.level,
      principal: l.principal,
      status: l.statut,
      createdAt: l.createdAt,
    }));

    // ── 5 dernières opérations (remboursements) ────────────────────────────────
    const dernieresOperations = await db.query.repayments.findMany({
      with: {
        loan: {
          columns: { id: true, level: true },
          with: {
            client: { columns: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: (r, { desc }) => [desc(r.createdAt)],
      limit: 5,
    });

    return res.json({
      data: {
        kpis: {
          loansActifs:      loansActifs.length,
          loansEnRetard:    loansEnRetard.length,
          loansSoldes:      loansSoldes.length,
          montantTotalPrete,
          montantRecupere,
          montantRestantTotal,
        },
        repartitionStatuts,
        evolutionMensuelle,
        pretsEnRetard,
        derniersPrets,
        dernieresOperations,
      },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * Calcule le nombre de prêts créés par mois sur les 6 derniers mois.
 * @param {Array} loans
 * @returns {Array<{ mois: string, count: number }>}
 */
function calculerEvolutionMensuelle(loans) {
  const aujourd = new Date();
  const mois = [];

  // Génère les 6 derniers mois (du plus ancien au plus récent)
  for (let i = 5; i >= 0; i--) {
    const date = new Date(aujourd.getFullYear(), aujourd.getMonth() - i, 1);
    const cle = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    mois.push({ mois: cle, count: 0 });
  }

  // Compte les prêts par mois
  for (const loan of loans) {
    const d = new Date(loan.createdAt);
    const cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const entry = mois.find((m) => m.mois === cle);
    if (entry) entry.count++;
  }

  return mois;
}
