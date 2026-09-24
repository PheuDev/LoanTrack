// Service de logique métier pour les prêts.
// Ces fonctions ne connaissent pas Express — elles reçoivent des données
// et retournent des résultats. C'est ce qui les rend testables facilement.

import { TAUX_PENALITE_DEFAUT_BP } from './rulesService.js';

// ─── Constantes métier ────────────────────────────────────────────────────────
//
// Les tarifs des prêts (montant, taux, durée, pénalité) ne sont plus codés ici :
// ils sont définis par le gestionnaire dans les tranches de règles (loan_tiers)
// et calculés par `rulesService`. Ce fichier ne s'occupe que de l'état d'un prêt
// déjà octroyé.

// Statuts possibles d'un prêt
export const STATUTS_PRET = {
  ACTIF:     'actif',
  EN_RETARD: 'en_retard',
  SOLDE:     'solde',
  ANNULE:    'annule',
};

// ─── Fonctions ────────────────────────────────────────────────────────────────

/**
 * Calcule le statut réel (temps réel) d'un prêt chargé depuis la base.
 * `en_retard` n'est jamais persisté — il est déduit ici de l'échéance.
 * 'annule' et 'solde' sont persistés et conservés tels quels.
 *
 * @param {{ status: string, totalDue: number, penalties: number, dueDate: string|Date, repayments?: Array<{ amount: number }> }} loan
 * @param {Date} dateReference - Date à utiliser pour le calcul (par défaut aujourd'hui)
 * @returns {{ soldeRestant: number, totalRembourse: number, statut: string, joursRetard: number }}
 */
export function calculerEtatPret(loan, dateReference = new Date()) {
  const totalRembourse = (loan.repayments || []).reduce((s, r) => s + r.amount, 0);
  const soldeRestant = calculerSoldeRestant(loan.totalDue, loan.penalties, totalRembourse);
  const joursRetard = calculerJoursRetard(loan.dueDate, dateReference);
  const statut = loan.status === STATUTS_PRET.ANNULE || loan.status === STATUTS_PRET.SOLDE
    ? loan.status
    : determinerStatut(soldeRestant, loan.dueDate, dateReference);

  return { soldeRestant, totalRembourse, statut, joursRetard };
}

/**
 * Calcule le montant d'une pénalité de retard.
 * Formule : capital × taux journalier × nombre de jours de retard
 *
 * Le taux journalier vient de la tranche de règles appliquée au prêt
 * (`penaltyRateBpDaily`, en points de base). À défaut, on utilise le taux
 * par défaut (5 % par jour).
 *
 * @param {number} capital - Capital du prêt
 * @param {number} joursDeRetard - Nombre de jours écoulés depuis l'échéance
 * @param {number} [penaltyRateBpDaily] - Taux journalier en points de base (500 = 5 %)
 * @returns {number} Montant de la pénalité (entier, unités mineures)
 */
export function calculerPenalite(capital, joursDeRetard, penaltyRateBpDaily = TAUX_PENALITE_DEFAUT_BP) {
  if (joursDeRetard <= 0) return 0;

  // On arrondit à l'entier le plus proche : aucun montant décimal n'est stocké.
  return Math.round((capital * penaltyRateBpDaily * joursDeRetard) / 10000);
}

/**
 * Détermine le statut d'un prêt en fonction de son solde et de sa date d'échéance.
 * Cette fonction est appelée à chaque lecture d'un prêt pour avoir le statut en temps réel.
 *
 * Les statuts 'annule' et 'solde' ne peuvent pas être déduits automatiquement ici —
 * 'annule' est une action manuelle, et 'solde' est déclenché après un remboursement.
 * Cette fonction gère uniquement la transition actif → en_retard.
 *
 * @param {number} montantRestant - Solde encore dû
 * @param {string|Date} dateEcheance - Date limite de remboursement
 * @param {Date} dateReference - Date à utiliser pour le calcul (par défaut aujourd'hui)
 * @returns {'actif'|'en_retard'|'solde'}
 */
export function determinerStatut(montantRestant, dateEcheance, dateReference = new Date()) {
  // Un prêt soldé reste soldé, quelle que soit la date
  if (montantRestant <= 0) return STATUTS_PRET.SOLDE;

  const echeance = new Date(dateEcheance);
  // On compare uniquement les dates (sans l'heure) pour éviter
  // qu'un prêt créé le jour J soit considéré en retard le soir du jour J.
  const aujourdhui = new Date(dateReference);
  aujourdhui.setHours(0, 0, 0, 0);
  echeance.setHours(0, 0, 0, 0);

  if (aujourdhui > echeance) return STATUTS_PRET.EN_RETARD;

  return STATUTS_PRET.ACTIF;
}

/**
 * Calcule le nombre de jours de retard d'un prêt.
 * Retourne 0 si le prêt n'est pas en retard.
 *
 * @param {string|Date} dateEcheance
 * @param {Date} dateReference - Date à utiliser pour le calcul (par défaut aujourd'hui)
 * @returns {number} Nombre de jours entiers de retard
 */
export function calculerJoursRetard(dateEcheance, dateReference = new Date()) {
  const echeance = new Date(dateEcheance);
  const reference = new Date(dateReference);

  echeance.setHours(0, 0, 0, 0);
  reference.setHours(0, 0, 0, 0);

  const diffMs = reference - echeance;
  if (diffMs <= 0) return 0;

  // Conversion millisecondes → jours entiers
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Calcule le solde restant d'un prêt.
 * Formule : (montant total dû + pénalités) - total déjà remboursé
 *
 * Le résultat ne peut pas être négatif — un remboursement en trop
 * est bloqué en amont par la validation, mais on se protège ici aussi.
 *
 * @param {number} totalDu - Montant total dû à l'octroi (capital + intérêts)
 * @param {number} penalites - Total des pénalités accumulées
 * @param {number} totalRembourse - Somme de tous les remboursements effectués
 * @returns {number} Solde restant en FCFA (jamais négatif)
 */
export function calculerSoldeRestant(totalDu, penalites, totalRembourse) {
  const solde = (totalDu + penalites) - totalRembourse;
  return Math.max(0, solde);
}
