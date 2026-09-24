import { describe, it, expect } from 'vitest';
import {
  calculerMontantsDepuisTranche,
  calculerPenaliteDepuisTranche,
  chevaucheTranche,
  clientEligibleTranche,
  compterPretsClient,
  libellePret,
  trouverTranchePourMontant,
  validerTranche,
  verifierEligibiliteClient,
} from './rulesService.js';

// Tranches de référence : des intervalles contigus, comme dans l'application.
const TRANCHES = [
  { id: 1, label: 'Découverte', minAmount: 5000,  maxAmount: 25000, interestRateBp: 3000, durationDays: 7,  minPriorRepaidLoans: 0, penaltyRateBpDaily: 500, maxActiveLoansPerClient: 1 },
  { id: 2, label: 'Confirmée',  minAmount: 25001, maxAmount: 50000, interestRateBp: 2500, durationDays: 10, minPriorRepaidLoans: 1, penaltyRateBpDaily: 400, maxActiveLoansPerClient: 2 },
  { id: 3, label: 'Privilège',  minAmount: 50001, maxAmount: null,  interestRateBp: 2000, durationDays: 15, minPriorRepaidLoans: 2, penaltyRateBpDaily: 300, maxActiveLoansPerClient: 3 },
];

describe('validerTranche', () => {
  const valide = {
    label: 'Découverte',
    minAmount: 5000,
    maxAmount: 25000,
    interestRateBp: 3000,
    durationDays: 7,
    minPriorRepaidLoans: 0,
    penaltyRateBpDaily: 500,
    maxActiveLoansPerClient: 1,
  };

  it('accepte une tranche cohérente', () => {
    expect(validerTranche(valide)).toEqual([]);
  });

  it('accepte une borne maximale absente (tranche illimitée)', () => {
    expect(validerTranche({ ...valide, maxAmount: null, minAmount: 100000 })).toEqual([]);
  });

  it('refuse un maximum inférieur ou égal au minimum', () => {
    expect(validerTranche({ ...valide, maxAmount: 5000 }).join(' ')).toContain('supérieur au montant minimum');
  });

  it('refuse un taux hors bornes et une durée nulle', () => {
    expect(validerTranche({ ...valide, interestRateBp: 12000 }).join(' ')).toContain('points de base');
    expect(validerTranche({ ...valide, durationDays: 0 }).join(' ')).toContain('durée');
  });

  it('refuse un libellé vide', () => {
    expect(validerTranche({ ...valide, label: '   ' }).join(' ')).toContain('libellé');
  });
});

describe('chevaucheTranche', () => {
  const actives = [
    { id: 1, minAmount: 5000,  maxAmount: 25000 },
    { id: 2, minAmount: 25001, maxAmount: 50000 },
  ];

  it('accepte une tranche contiguë sans recouvrement', () => {
    expect(chevaucheTranche({ minAmount: 50001, maxAmount: 75000 }, actives)).toBe(false);
  });

  it('détecte un recouvrement partiel', () => {
    expect(chevaucheTranche({ minAmount: 20000, maxAmount: 30000 }, actives)).toBe(true);
  });

  it('détecte un recouvrement avec une tranche illimitée', () => {
    expect(chevaucheTranche({ minAmount: 60000, maxAmount: null }, [
      { id: 4, minAmount: 50001, maxAmount: null },
    ])).toBe(true);
  });

  it('ignore la tranche en cours de modification', () => {
    expect(chevaucheTranche({ id: 1, minAmount: 5000, maxAmount: 25000 }, actives)).toBe(false);
  });
});


describe('trouverTranchePourMontant', () => {
  it('retourne la tranche dont l\'intervalle contient le montant', () => {
    expect(trouverTranchePourMontant(20000, TRANCHES).id).toBe(1);
    expect(trouverTranchePourMontant(25001, TRANCHES).id).toBe(2);
    expect(trouverTranchePourMontant(100000, TRANCHES).id).toBe(3);
  });

  it('retourne null quand aucune tranche ne couvre le montant', () => {
    expect(trouverTranchePourMontant(100, TRANCHES)).toBeNull();
  });
});

describe('clientEligibleTranche', () => {
  it('compare le nombre de prêts soldés au minimum de la tranche', () => {
    expect(clientEligibleTranche(0, TRANCHES[0])).toBe(true);
    expect(clientEligibleTranche(0, TRANCHES[1])).toBe(false);
    expect(clientEligibleTranche(2, TRANCHES[2])).toBe(true);
  });
});

describe('calculerMontantsDepuisTranche', () => {
  it('applique le taux de la tranche au montant demandé', () => {
    const resultat = calculerMontantsDepuisTranche(TRANCHES[0], 20000, new Date('2025-01-01T00:00:00.000Z'));
    expect(resultat.capital).toBe(20000);
    expect(resultat.interets).toBe(6000);        // 30 % de 20 000
    expect(resultat.montantTotalDu).toBe(26000);
    expect(resultat.dateEcheance.toISOString().slice(0, 10)).toBe('2025-01-08');
  });

  it('accepte la borne haute d\'une tranche illimitée', () => {
    const resultat = calculerMontantsDepuisTranche(TRANCHES[2], 500000);
    expect(resultat.montantTotalDu).toBe(600000); // 20 % de 500 000
  });

  it('refuse un montant hors bornes', () => {
    expect(() => calculerMontantsDepuisTranche(TRANCHES[0], 4000)).toThrow('Montant invalide');
    expect(() => calculerMontantsDepuisTranche(TRANCHES[0], 26000)).toThrow('Montant invalide');
  });
});

describe('calculerPenaliteDepuisTranche', () => {
  it('utilise le taux journalier de la tranche (points de base)', () => {
    // 20 000 × 5 % × 3 jours
    expect(calculerPenaliteDepuisTranche(20000, 3, 500)).toBe(3000);
    // 20 000 × 3 % × 2 jours
    expect(calculerPenaliteDepuisTranche(20000, 2, 300)).toBe(1200);
  });

  it('retourne 0 sans jours de retard', () => {
    expect(calculerPenaliteDepuisTranche(20000, 0, 500)).toBe(0);
  });
});

describe('compterPretsClient', () => {
  it('sépare les prêts soldés des prêts en cours', () => {
    const compte = compterPretsClient([
      { status: 'solde' },
      { status: 'solde' },
      { status: 'actif' },
      { status: 'annule' },
    ]);
    expect(compte).toEqual({ nbSoldes: 2, nbEnCours: 1 });
  });

  it('compte les prêts en retard comme des prêts en cours', () => {
    expect(compterPretsClient([{ status: 'en_retard' }]).nbEnCours).toBe(1);
  });
});

describe('verifierEligibiliteClient', () => {
  it('accepte un client qui remplit les deux conditions', () => {
    const resultat = verifierEligibiliteClient({
      tranche: TRANCHES[1],
      nbPretsSoldes: 1,
      nbPretsEnCours: 0,
    });
    expect(resultat).toEqual({ eligible: true, raisons: [] });
  });

  it('explique le manque de prêts soldés (marge de prêt suivante)', () => {
    const resultat = verifierEligibiliteClient({
      tranche: TRANCHES[2],
      nbPretsSoldes: 1,
      nbPretsEnCours: 0,
    });
    expect(resultat.eligible).toBe(false);
    expect(resultat.raisons.join(' ')).toContain('au moins 2 prêts soldés');
    expect(resultat.raisons.join(' ')).toContain('le client en a 1');
  });

  it('explique la limite de prêts simultanés', () => {
    const resultat = verifierEligibiliteClient({
      tranche: TRANCHES[0],
      nbPretsSoldes: 5,
      nbPretsEnCours: 1,
    });
    expect(resultat.eligible).toBe(false);
    expect(resultat.raisons.join(' ')).toContain('déjà 1 prêt en cours');
  });
});

describe('libellePret', () => {
  const tranchesParId = new Map([[7, { label: 'Tranche 3 — Privilège' }]]);

  it('affiche le libellé de la tranche quand elle existe', () => {
    expect(libellePret({ id: 1, tierId: 7, level: null }, tranchesParId)).toBe('Tranche 3 — Privilège');
  });

  it('retombe sur le niveau historique pour les prêts d\'avant les règles', () => {
    expect(libellePret({ id: 2, tierId: null, level: 2 }, tranchesParId)).toBe('Niveau 2');
    expect(libellePret({ id: 3, tierId: null, level: null }, tranchesParId)).toBe('Prêt #3');
  });
});
