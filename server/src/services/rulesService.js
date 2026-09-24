// Service de logique métier pour les tranches de règles de prêt.
// Travaille sur des données déjà chargées — ne connaît ni Express ni la base.

/**
 * Vérifie qu'une tranche est cohérente (montants, taux, durée).
 * @returns {string[]} liste des messages d'erreur (vide = valide)
 */
export function validerTranche({ label, minAmount, maxAmount, interestRateBp, durationDays, minPriorRepaidLoans, penaltyRateBpDaily, maxActiveLoansPerClient }) {
  const erreurs = [];
  if (!label || !String(label).trim()) erreurs.push('Le libellé est requis.');
  if (!Number.isInteger(minAmount) || minAmount <= 0) erreurs.push('Le montant minimum doit être un entier positif.');
  if (maxAmount !== null && maxAmount !== undefined && (!Number.isInteger(maxAmount) || maxAmount <= 0)) {
    erreurs.push('Le montant maximum doit être un entier positif ou vide (illimité).');
  }
  if (maxAmount !== null && maxAmount !== undefined && maxAmount <= minAmount) {
    erreurs.push('Le montant maximum doit être supérieur au montant minimum.');
  }
  if (!Number.isInteger(interestRateBp) || interestRateBp < 0 || interestRateBp > 10000) {
    erreurs.push('Le taux doit être compris entre 0 et 10000 points de base (0–100 %).');
  }
  if (!Number.isInteger(durationDays) || durationDays <= 0) {
    erreurs.push('La durée doit être un nombre de jours positif.');
  }
  if (minPriorRepaidLoans !== undefined && (!Number.isInteger(minPriorRepaidLoans) || minPriorRepaidLoans < 0)) {
    erreurs.push('Le nombre de prêts préalables doit être un entier positif ou nul.');
  }
  if (penaltyRateBpDaily !== undefined && (!Number.isInteger(penaltyRateBpDaily) || penaltyRateBpDaily < 0)) {
    erreurs.push('Le taux de pénalité doit être un entier positif ou nul (points de base).');
  }
  if (maxActiveLoansPerClient !== undefined && (!Number.isInteger(maxActiveLoansPerClient) || maxActiveLoansPerClient < 1)) {
    erreurs.push('Le nombre maximal de prêts simultanés doit être au moins 1.');
  }
  return erreurs;
}

/**
 * Détecte si une tranche chevauche une tranche existante.
 * @param {{ minAmount: number, maxAmount: number|null, id?: number }} candidate
 * @param {Array} actives - tranches actives ({ id, minAmount, maxAmount })
 * @returns {boolean} true si chevauchement
 */
export function chevaucheTranche(candidate, actives) {
  const cMin = candidate.minAmount;
  const cMax = candidate.maxAmount ?? Number.POSITIVE_INFINITY;
  return (actives || [])
    .filter((t) => t.id !== candidate.id)
    .some((t) => {
      const tMax = t.maxAmount ?? Number.POSITIVE_INFINITY;
      return cMin <= tMax && t.minAmount <= cMax;
    });
}

/**
 * Trouve la tranche applicable pour un montant donné.
 * @returns {object|null} la tranche active dont [min, max] contient le montant
 */
export function trouverTranchePourMontant(amount, tranchesActives) {
  return (tranchesActives || []).find((t) =>
    amount >= t.minAmount && (t.maxAmount === null || t.maxAmount === undefined || amount <= t.maxAmount)
  ) || null;
}

/**
 * Vérifie si un client peut accéder à une tranche (prêts soldés requis).
 * @param {number} nbPretsSoldes - nombre de prêts au statut 'solde' du client
 */
export function clientEligibleTranche(nbPretsSoldes, tranche) {
  return nbPretsSoldes >= (tranche.minPriorRepaidLoans || 0);
}

/**
 * Calcule les montants d'un prêt depuis une tranche (montant libre dans [min, max]).
 * @returns {{ capital, interets, montantTotalDu, dateEcheance }}
 */
export function calculerMontantsDepuisTranche(tranche, amount, dateDebut = new Date()) {
  if (!Number.isInteger(amount) || amount < tranche.minAmount) {
    throw new Error(`Montant invalide : minimum ${tranche.minAmount} pour cette tranche.`);
  }
  const max = tranche.maxAmount ?? Number.POSITIVE_INFINITY;
  if (amount > max) {
    throw new Error(`Montant invalide : maximum ${tranche.maxAmount} pour cette tranche.`);
  }
  const interets = Math.round((amount * tranche.interestRateBp) / 10000);
  const montantTotalDu = amount + interets;
  const dateEcheance = new Date(dateDebut);
  dateEcheance.setUTCDate(dateEcheance.getUTCDate() + tranche.durationDays);
  return { capital: amount, interets, montantTotalDu, dateEcheance };
}

/**
 * Calcule une pénalité depuis le taux journalier d'une tranche (points de base).
 */
export function calculerPenaliteDepuisTranche(capital, joursDeRetard, penaltyRateBpDaily) {
  if (joursDeRetard <= 0) return 0;
  return Math.round((capital * (penaltyRateBpDaily ?? 500) * joursDeRetard) / 10000);
}

// Taux de pénalité appliqué quand aucune tranche n'est disponible
// (prêts historiques créés avant les règles configurables) : 5 % par jour.
export const TAUX_PENALITE_DEFAUT_BP = 500;

/**
 * Libellé affiché d'un prêt : le nom de sa tranche de règles, ou le niveau
 * historique pour les prêts créés avant les règles configurables.
 *
 * @param {{ tierId: number|null, level: number|null, id: number }} pret
 * @param {Map<number, { label: string }>} [tranchesParId]
 * @returns {string}
 */
export function libellePret({ tierId, level, id }, tranchesParId) {
  const tranche = tranchesParId?.get(tierId);
  if (tranche) return tranche.label;
  if (level) return `Niveau ${level}`;
  return `Prêt #${id}`;
}

/**
 * Compte les prêts d'un client par catégorie, à partir de leur statut réel.
 * @param {Array<{ status: string }>} prets - Prêts avec statut calculé (temps réel)
 * @returns {{ nbSoldes: number, nbEnCours: number }}
 */
export function compterPretsClient(prets = []) {
  const nbSoldes = prets.filter((p) => p.status === 'solde').length;
  const nbEnCours = prets.filter((p) => p.status === 'actif' || p.status === 'en_retard').length;
  return { nbSoldes, nbEnCours };
}

/**
 * Vérifie qu'un client peut accéder à une tranche :
 *  - il doit avoir soldé au moins `minPriorRepaidLoans` prêts (marge de prêt suivante) ;
 *  - il ne doit pas dépasser `maxActiveLoansPerClient` prêts en cours.
 *
 * @returns {{ eligible: boolean, raisons: string[] }} raisons = messages lisibles
 */
export function verifierEligibiliteClient({ tranche, nbPretsSoldes, nbPretsEnCours }) {
  const raisons = [];

  const minimumPrets = tranche.minPriorRepaidLoans || 0;
  if (nbPretsSoldes < minimumPrets) {
    raisons.push(
      `Cette tranche exige au moins ${minimumPrets} prêt${minimumPrets > 1 ? 's' : ''} soldé${minimumPrets > 1 ? 's' : ''} ` +
      `(le client en a ${nbPretsSoldes}).`
    );
  }

  const maximumEnCours = tranche.maxActiveLoansPerClient || 1;
  if (nbPretsEnCours >= maximumEnCours) {
    raisons.push(
      `Ce client a déjà ${nbPretsEnCours} prêt${nbPretsEnCours > 1 ? 's' : ''} en cours ` +
      `(maximum ${maximumEnCours} pour cette tranche).`
    );
  }

  return { eligible: raisons.length === 0, raisons };
}
