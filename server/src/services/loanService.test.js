import { describe, it, expect } from 'vitest';
import {
  calculerPenalite,
  determinerStatut,
  calculerJoursRetard,
  calculerSoldeRestant,
  calculerEtatPret,
  STATUTS_PRET,
} from './loanService.js';
import {
  peutContracterPret,
  determinerStatutClient,
  calculerStatutClientReel,
} from './clientService.js';

// ─── calculerPenalite ─────────────────────────────────────────────────────────

describe('calculerPenalite', () => {
  it('0 jour de retard → pénalité de 0', () => {
    expect(calculerPenalite(25000, 0)).toBe(0);
  });

  it('retard négatif → pénalité de 0 (sécurité)', () => {
    expect(calculerPenalite(25000, -3)).toBe(0);
  });

  it('1 jour de retard sur capital 25000 → 1250 FCFA', () => {
    // 25000 × 0.05 × 1 = 1250
    expect(calculerPenalite(25000, 1)).toBe(1250);
  });

  it('3 jours de retard sur capital 25000 → 3750 FCFA', () => {
    // 25000 × 0.05 × 3 = 3750
    expect(calculerPenalite(25000, 3)).toBe(3750);
  });

  it('accepte un taux journalier propre à la tranche de règles (points de base)', () => {
    // Tranche à 2 % par jour : 25000 × 0.02 × 3 = 1500
    expect(calculerPenalite(25000, 3, 200)).toBe(1500);
    // Tranche à 10 % par jour : 25000 × 0.10 × 2 = 5000
    expect(calculerPenalite(25000, 2, 1000)).toBe(5000);
  });

  it('10 jours de retard sur capital 50000 → 25000 FCFA', () => {
    // 50000 × 0.05 × 10 = 25000
    expect(calculerPenalite(50000, 10)).toBe(25000);
  });

  it('7 jours de retard sur capital 75000 → 26250 FCFA', () => {
    // 75000 × 0.05 × 7 = 26250
    expect(calculerPenalite(75000, 7)).toBe(26250);
  });

  it('retourne un entier (pas de décimales)', () => {
    // Capital fictif qui produirait un flottant sans Math.round
    const result = calculerPenalite(33333, 1); // 33333 × 0.05 = 1666.65 → 1667
    expect(Number.isInteger(result)).toBe(true);
  });
});

// ─── determinerStatut ─────────────────────────────────────────────────────────

describe('determinerStatut', () => {
  // Date de référence fixe pour des tests déterministes
  const aujourdhui = new Date('2025-06-15T12:00:00.000Z');
  const hier       = new Date('2025-06-14T00:00:00.000Z');
  const demain     = new Date('2025-06-16T00:00:00.000Z');

  it('solde restant = 0 → statut "solde", peu importe la date', () => {
    expect(determinerStatut(0, hier, aujourdhui)).toBe(STATUTS_PRET.SOLDE);
    expect(determinerStatut(0, demain, aujourdhui)).toBe(STATUTS_PRET.SOLDE);
  });

  it('solde restant négatif → statut "solde" (sécurité)', () => {
    expect(determinerStatut(-100, hier, aujourdhui)).toBe(STATUTS_PRET.SOLDE);
  });

  it('échéance dépassée et solde > 0 → statut "en_retard"', () => {
    expect(determinerStatut(10000, hier, aujourdhui)).toBe(STATUTS_PRET.EN_RETARD);
  });

  it('échéance aujourd\'hui et solde > 0 → statut "actif" (pas encore en retard)', () => {
    // Le prêt est dû aujourd'hui : il n'est en retard que demain
    expect(determinerStatut(10000, aujourdhui, aujourdhui)).toBe(STATUTS_PRET.ACTIF);
  });

  it('échéance dans le futur et solde > 0 → statut "actif"', () => {
    expect(determinerStatut(10000, demain, aujourdhui)).toBe(STATUTS_PRET.ACTIF);
  });

  it('accepte des dates en format string ISO', () => {
    expect(determinerStatut(10000, '2025-06-14', aujourdhui)).toBe(STATUTS_PRET.EN_RETARD);
    expect(determinerStatut(10000, '2025-06-16', aujourdhui)).toBe(STATUTS_PRET.ACTIF);
  });
});

// ─── calculerJoursRetard ──────────────────────────────────────────────────────

describe('calculerJoursRetard', () => {
  const reference = new Date('2025-06-15T00:00:00.000Z');

  it('échéance dans le futur → 0 jour de retard', () => {
    expect(calculerJoursRetard('2025-06-20', reference)).toBe(0);
  });

  it('échéance aujourd\'hui → 0 jour de retard', () => {
    expect(calculerJoursRetard('2025-06-15', reference)).toBe(0);
  });

  it('échéance hier → 1 jour de retard', () => {
    expect(calculerJoursRetard('2025-06-14', reference)).toBe(1);
  });

  it('échéance il y a 7 jours → 7 jours de retard', () => {
    expect(calculerJoursRetard('2025-06-08', reference)).toBe(7);
  });

  it('retourne un entier (jamais de fraction de jour)', () => {
    const result = calculerJoursRetard('2025-06-10', reference);
    expect(Number.isInteger(result)).toBe(true);
  });
});

// ─── calculerSoldeRestant ─────────────────────────────────────────────────────

describe('calculerSoldeRestant', () => {
  it('sans remboursement ni pénalité → solde = montant total dû', () => {
    expect(calculerSoldeRestant(32500, 0, 0)).toBe(32500);
  });

  it('remboursement partiel → solde diminue', () => {
    expect(calculerSoldeRestant(32500, 0, 10000)).toBe(22500);
  });

  it('remboursement total → solde = 0', () => {
    expect(calculerSoldeRestant(32500, 0, 32500)).toBe(0);
  });

  it('avec pénalités → le solde inclut les pénalités', () => {
    // totalDu = 32500, pénalités = 3750 (3 jours), remboursé = 10000
    // solde = (32500 + 3750) - 10000 = 26250
    expect(calculerSoldeRestant(32500, 3750, 10000)).toBe(26250);
  });

  it('remboursement supérieur au total → solde = 0 (jamais négatif)', () => {
    // Normalement bloqué en amont, mais on se protège ici
    expect(calculerSoldeRestant(32500, 0, 40000)).toBe(0);
  });

  it('prêt entièrement remboursé avec pénalités → solde = 0', () => {
    expect(calculerSoldeRestant(32500, 3750, 36250)).toBe(0);
  });
});

// ─── calculerEtatPret ──────────────────────────────────────────────────────────

describe('calculerEtatPret', () => {
  const reference = new Date('2025-06-15T12:00:00.000Z');

  function pretActif() {
    return {
      status: 'actif',
      totalDue: 32500,
      penalties: 0,
      dueDate: '2025-06-20',
      repayments: [{ amount: 10000 }],
    };
  }

  it('calcule solde + total remboursé + jours de retard', () => {
    const etat = calculerEtatPret(pretActif(), reference);
    expect(etat.totalRembourse).toBe(10000);
    expect(etat.soldeRestant).toBe(22500);
    expect(etat.joursRetard).toBe(0);
    expect(etat.statut).toBe(STATUTS_PRET.ACTIF);
  });

  it('prêt soldé en base → reste soldé même après échéance', () => {
    const etat = calculerEtatPret(
      { ...pretActif(), status: 'solde', dueDate: '2025-06-01', repayments: [{ amount: 32500 }] },
      reference
    );
    expect(etat.statut).toBe(STATUTS_PRET.SOLDE);
    expect(etat.soldeRestant).toBe(0);
  });

  it('prêt annulé en base → reste annulé même après échéance', () => {
    const etat = calculerEtatPret(
      { ...pretActif(), status: 'annule', dueDate: '2025-06-01' },
      reference
    );
    expect(etat.statut).toBe(STATUTS_PRET.ANNULE);
  });

  it('échéance dépassée + solde > 0 → en_retard (jamais persisté, toujours calculé)', () => {
    const etat = calculerEtatPret(
      { ...pretActif(), dueDate: '2025-06-10' },
      reference
    );
    expect(etat.statut).toBe(STATUTS_PRET.EN_RETARD);
    expect(etat.joursRetard).toBe(5);
  });

  it('sans remboursements → total 0 et solde = total dû', () => {
    const etat = calculerEtatPret({ ...pretActif(), repayments: [] }, reference);
    expect(etat.totalRembourse).toBe(0);
    expect(etat.soldeRestant).toBe(32500);
  });
});

// ─── calculerStatutClientReel ──────────────────────────────────────────────────

describe('calculerStatutClientReel', () => {
  const reference = new Date('2025-06-15T12:00:00.000Z');

  it('aucun prêt → actif', () => {
    expect(calculerStatutClientReel([], reference)).toBe('actif');
  });

  it('prêt actif dans les délais → actif', () => {
    const prets = [{
      status: 'actif', totalDue: 32500, penalties: 0,
      dueDate: '2025-06-20', repayments: [],
    }];
    expect(calculerStatutClientReel(prets, reference)).toBe('actif');
  });

  it('prêt actif mais échéance dépassée → suspendu (le bug historique : le champ base reste actif)', () => {
    const prets = [{
      status: 'actif', totalDue: 32500, penalties: 0,
      dueDate: '2025-06-10', repayments: [],
    }];
    expect(calculerStatutClientReel(prets, reference)).toBe('suspendu');
  });

  it('prêt soldé après retard → actif', () => {
    const prets = [{
      status: 'solde', totalDue: 32500, penalties: 0,
      dueDate: '2025-06-10', repayments: [{ amount: 32500 }],
    }];
    expect(calculerStatutClientReel(prets, reference)).toBe('actif');
  });
});

// ─── peutContracterPret + determinerStatutClient (non-régression) ──────────────

describe('peutContracterPret', () => {
  it('aucun prêt → peut emprunter', () => {
    expect(peutContracterPret([])).toBe(true);
  });

  it('prêt soldé ou annulé → peut emprunter', () => {
    expect(peutContracterPret([{ status: 'solde' }])).toBe(true);
    expect(peutContracterPret([{ status: 'annule' }])).toBe(true);
  });

  it('prêt actif ou en_retard (statut réel calculé) → bloqué', () => {
    expect(peutContracterPret([{ status: 'actif' }])).toBe(false);
    expect(peutContracterPret([{ status: 'en_retard' }])).toBe(false);
  });
});

describe('determinerStatutClient', () => {
  it('prêt en_retard → suspendu, sinon actif', () => {
    expect(determinerStatutClient([{ status: 'en_retard' }])).toBe('suspendu');
    expect(determinerStatutClient([{ status: 'actif' }])).toBe('actif');
    expect(determinerStatutClient([])).toBe('actif');
  });
});
