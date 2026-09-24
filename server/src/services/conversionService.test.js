import { describe, it, expect } from 'vitest';
import {
  convertirMontant,
  convertirPenalite,
  convertirPret,
  convertirRemboursement,
  convertirTranche,
} from './conversionService.js';

// Parité officielle : 1 EUR = 655,957 XOF
const TAUX_XOF_EUR = 1 / 655.957;

describe('convertirPret', () => {
  const pret = {
    id: 1,
    principal: 32500,
    interestAmount: 9750,
    totalDue: 42250,
    penalties: 1625,
    currency: 'XOF',
  };

  it('convertit tous les montants et garde le total cohérent avec ses composantes', () => {
    const converti = convertirPret(pret, 'XOF', 'EUR', TAUX_XOF_EUR);

    expect(converti.principal).toBe(4955);        // 32 500 FCFA ≈ 49,55 €
    expect(converti.interestAmount).toBe(1486);   // 9 750 FCFA ≈ 14,86 €
    expect(converti.penalties).toBe(248);         // 1 625 FCFA ≈ 2,48 €
    // Le total est recalculé : jamais d'écart d'arrondi entre le total et ses parts
    expect(converti.totalDue).toBe(converti.principal + converti.interestAmount);
  });

  it('met à jour la devise et neutralise le taux vers la base', () => {
    const converti = convertirPret(pret, 'XOF', 'EUR', TAUX_XOF_EUR);
    expect(converti.currency).toBe('EUR');
    expect(converti.baseCurrency).toBe('EUR');
    expect(converti.rateToBase).toBe('1');
    expect(converti.baseTotalDue).toBe(converti.totalDue);
  });

  it('conversion aller-retour : écart maximal d\'un demi-centime exprimé en francs', () => {
    const enEuros = convertirPret(pret, 'XOF', 'EUR', TAUX_XOF_EUR);
    const retour = convertirPret(
      { ...enEuros, id: 1, totalDue: enEuros.totalDue },
      'EUR',
      'XOF',
      655.957
    );
    // Le passage par le centime arrondit à 0,005 € près, soit ≈ 3,3 FCFA
    expect(Math.abs(retour.principal - pret.principal)).toBeLessThanOrEqual(4);
  });
});

describe('convertirRemboursement', () => {
  it('convertit le montant et le snapshot comptable', () => {
    const converti = convertirRemboursement(
      { id: 3, amount: 10000, currency: 'XOF' },
      'XOF',
      'EUR',
      TAUX_XOF_EUR
    );
    expect(converti.amount).toBe(1524);   // 10 000 FCFA ≈ 15,24 €
    expect(converti.currency).toBe('EUR');
    expect(converti.baseAmount).toBe(1524);
    expect(converti.rateToBase).toBe('1');
  });
});

describe('convertirTranche', () => {
  it('convertit les bornes de montant sans toucher aux règles (taux, durée)', () => {
    const tranche = {
      id: 2,
      label: 'Tranche 2',
      minAmount: 25001,
      maxAmount: 50000,
      interestRateBp: 2500,
      durationDays: 10,
    };

    const convertie = convertirTranche(tranche, 'XOF', 'EUR', TAUX_XOF_EUR);
    expect(convertie.minAmount).toBe(3811);  // 25 001 FCFA ≈ 38,11 €
    expect(convertie.maxAmount).toBe(7622);  // 50 000 FCFA ≈ 76,22 €
    expect(convertie).not.toHaveProperty('interestRateBp');
    expect(convertie).not.toHaveProperty('durationDays');
  });

  it('gère une borne maximale absente (tranche illimitée)', () => {
    const convertie = convertirTranche(
      { id: 9, minAmount: 100000, maxAmount: null },
      'XOF',
      'EUR',
      TAUX_XOF_EUR
    );
    expect(convertie.maxAmount).toBeNull();
  });
});

describe('convertirMontant / convertirPenalite', () => {
  it('convertit un montant isolé', () => {
    expect(convertirMontant(655.957, 'XOF', 'EUR', TAUX_XOF_EUR)).toBe(100);
  });

  it('conserve les valeurs nulles ou absentes', () => {
    expect(convertirMontant(null, 'XOF', 'EUR', TAUX_XOF_EUR)).toBeNull();
    expect(convertirMontant(undefined, 'XOF', 'EUR', TAUX_XOF_EUR)).toBeUndefined();
  });

  it('convertit une pénalité journalisée', () => {
    expect(convertirPenalite({ amount: 1625 }, 'XOF', 'EUR', TAUX_XOF_EUR)).toEqual({ amount: 248 });
  });
});
