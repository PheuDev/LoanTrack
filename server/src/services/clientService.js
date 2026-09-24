// Service de logique métier pour les clients.
// Ces fonctions ne connaissent pas Express ni la base de données —
// elles travaillent sur des données déjà chargées par le contrôleur.

import { STATUTS_PRET, calculerEtatPret } from './loanService.js';

// Statuts possibles d'un client
export const STATUTS_CLIENT = {
  ACTIF:     'actif',
  SUSPENDU:  'suspendu',
};

/**
 * Vérifie si un client peut contracter un nouveau prêt.
 *
 * Un client ne peut pas emprunter s'il a déjà un prêt en cours,
 * c'est-à-dire au statut 'actif' ou 'en_retard'.
 * Un prêt soldé ou annulé ne bloque pas.
 *
 * @param {Array<{ status: string }>} loansExistants - Liste des prêts du client
 * @returns {boolean} true si le client peut emprunter, false sinon
 */
export function peutContracterPret(loansExistants) {
  const statutsBloquants = [STATUTS_PRET.ACTIF, STATUTS_PRET.EN_RETARD];

  return !loansExistants.some((loan) => statutsBloquants.includes(loan.status));
}

/**
 * Calcule le statut réel (temps réel) d'un client à partir de ses prêts
 * chargés avec leurs remboursements ({ status, totalDue, penalties, dueDate, repayments }).
 * Le statut 'suspendu' n'est jamais persisté — il est déduit des échéances.
 *
 * @param {Array} loans - Liste des prêts du client (avec remboursements)
 * @param {Date} dateReference - Date à utiliser pour le calcul (par défaut aujourd'hui)
 * @returns {'actif'|'suspendu'}
 */
export function calculerStatutClientReel(loans, dateReference = new Date()) {
  const aUnPretEnRetard = (loans || []).some(
    (loan) => calculerEtatPret(loan, dateReference).statut === STATUTS_PRET.EN_RETARD
  );

  return aUnPretEnRetard ? STATUTS_CLIENT.SUSPENDU : STATUTS_CLIENT.ACTIF;
}

/**
 * Détermine le statut d'un client à partir de la liste de ses prêts.
 *
 * Un client est 'suspendu' dès qu'il a au moins un prêt 'en_retard'.
 * Il redevient 'actif' quand tous ses prêts en retard sont soldés.
 *
 * @param {Array<{ status: string }>} loans - Liste des prêts du client
 * @returns {'actif'|'suspendu'}
 */
export function determinerStatutClient(loans) {
  const aUnPretEnRetard = loans.some((loan) => loan.status === STATUTS_PRET.EN_RETARD);

  return aUnPretEnRetard ? STATUTS_CLIENT.SUSPENDU : STATUTS_CLIENT.ACTIF;
}
