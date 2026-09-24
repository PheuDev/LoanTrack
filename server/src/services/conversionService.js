// Service de logique métier pour le changement de devise.
// Fonctions pures : elles reçoivent des lignes chargées depuis la base et
// retournent les valeurs converties. Aucun accès base, aucun accès HTTP.

import { convertirMineur } from './currencyService.js';

/**
 * Convertit un montant isolé, en conservant les valeurs nulles.
 */
export function convertirMontant(montant, de, vers, taux) {
  if (montant === null || montant === undefined) return montant;
  return convertirMineur(montant, de, vers, taux);
}

/**
 * Convertit les montants d'un prêt.
 *
 * Le total dû est recalculé à partir du capital et des intérêts convertis au
 * lieu d'être converti séparément : c'est le seul moyen de garantir que
 * total_due reste exactement égal à principal + interest_amount après arrondis
 * (sinon un écart d'une unité mineure apparaîtrait dans les soldes).
 *
 * @returns {object} valeurs prêtes pour un UPDATE (sans l'id)
 */
export function convertirPret(pret, de, vers, taux) {
  const principal = convertirMineur(pret.principal, de, vers, taux);
  const interestAmount = convertirMineur(pret.interestAmount, de, vers, taux);
  const totalDue = principal + interestAmount;

  return {
    principal,
    interestAmount,
    totalDue,
    penalties: convertirMineur(pret.penalties || 0, de, vers, taux),
    currency: vers,
    // Tous les montants vivant désormais dans la devise de référence,
    // le taux de conversion vers la base devient neutre.
    baseCurrency: vers,
    rateToBase: '1',
    baseTotalDue: totalDue,
  };
}

/**
 * Convertit un remboursement (montant + snapshot comptable).
 */
export function convertirRemboursement(remboursement, de, vers, taux) {
  const amount = convertirMineur(remboursement.amount, de, vers, taux);
  return {
    amount,
    currency: vers,
    rateToBase: '1',
    baseAmount: amount,
  };
}

/**
 * Convertit une pénalité journalisée.
 */
export function convertirPenalite(penalite, de, vers, taux) {
  return { amount: convertirMineur(penalite.amount, de, vers, taux) };
}

/**
 * Convertit une tranche de règles (bornes de montant).
 * Le taux d'intérêt et la durée sont des règles métier, pas des montants :
 * ils ne sont pas touchés par le changement de devise.
 */
export function convertirTranche(tranche, de, vers, taux) {
  return {
    minAmount: convertirMineur(tranche.minAmount, de, vers, taux),
    maxAmount: convertirMontant(tranche.maxAmount, de, vers, taux),
  };
}
