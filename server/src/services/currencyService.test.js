import { describe, it, expect } from 'vitest';
import {
  convertirMineur,
  facteurMineur,
  formaterMontant,
  getDevise,
  pairKey,
  resolveRateFromCache,
  versMajeur,
  versMineur,
} from './currencyService.js';

// Taux utilisé dans les tests : 1 EUR = 655,957 XOF (parité officielle)
const TAUX_XOF_EUR = 1 / 655.957;

describe('versMajeur / versMineur', () => {
  it('le XOF n\'a pas de décimale', () => {
    expect(versMajeur(32500, 'XOF')).toBe(32500);
    expect(versMineur(32500.4, 'XOF')).toBe(32500);
  });

  it('l\'EUR et le USD ont deux décimales', () => {
    expect(versMajeur(4955, 'EUR')).toBeCloseTo(49.55, 5);
    expect(versMineur(49.5459, 'EUR')).toBe(4955);
    expect(versMineur(1234.567, 'USD')).toBe(123457);
  });

  it('lève une erreur pour une devise non supportée', () => {
    expect(() => getDevise('GBP')).toThrow('Devise non supportée');
    expect(() => versMajeur(100, 'GBP')).toThrow('Devise non supportée');
  });
});

describe('convertirMineur', () => {
  it('XOF → EUR : 32 500 FCFA valent 49,55 € (arrondi au centime)', () => {
    // 32500 × (1/655.957) = 49.5459… → 4955 centimes
    expect(convertirMineur(32500, 'XOF', 'EUR', TAUX_XOF_EUR)).toBe(4955);
  });

  it('EUR → XOF : 49,55 € valent 32 503 FCFA (l\'aller a arrondi au centime)', () => {
    // 4955 centimes × 655,957 = 32 502,67 → 32 503 FCFA.
    // L'écart de 3 FCFA vient de l'arrondi au centime fait au sens aller.
    expect(convertirMineur(4955, 'EUR', 'XOF', 655.957)).toBe(32503);
  });

  it('XOF → USD passe par le taux majeur fourni (1 XOF = 0,0017 USD)', () => {
    // 100 000 × 0.0017 = 170 USD → 17 000 centimes
    expect(convertirMineur(100000, 'XOF', 'USD', 0.0017)).toBe(17000);
  });

  it('une conversion identique conserve le montant', () => {
    expect(convertirMineur(1234, 'EUR', 'EUR', 1)).toBe(1234);
  });

  it('refuse un taux nul ou négatif', () => {
    expect(() => convertirMineur(1000, 'XOF', 'EUR', 0)).toThrow('Taux de conversion invalide');
    expect(() => convertirMineur(1000, 'XOF', 'EUR', -1)).toThrow('Taux de conversion invalide');
  });
});

describe('facteurMineur', () => {
  it('intègre la différence de décimales entre les deux devises', () => {
    // 1 XOF = 0.00152449 EUR → x100 pour passer des francs aux centimes
    const facteur = facteurMineur('XOF', 'EUR', TAUX_XOF_EUR);
    expect(facteur).toBeCloseTo(0.1524494, 6);
    expect(Math.round(32500 * facteur)).toBe(4955);
  });

  it('facteur inverse cohérent (EUR → XOF)', () => {
    const facteur = facteurMineur('EUR', 'XOF', 655.957);
    // 49,55 € → 32 503 FCFA : la perte d'information vient de l'arrondi au centime
    expect(Math.round(4955 * facteur)).toBe(32503);
  });
});

describe('formaterMontant', () => {
  it('affiche les montants avec le bon nombre de décimales', () => {
    // Le séparateur de milliers utilisé par Intl en fr-FR est l'espace insécable
    expect(formaterMontant(32500, 'XOF').replace(/\u202f|\u00a0/g, ' ')).toBe('32 500 FCFA');
    expect(formaterMontant(4955, 'EUR').replace(/\u202f|\u00a0/g, ' ')).toBe('49,55 €');
  });
});

describe('cache des taux', () => {
  const cache = [
    { pair: 'EUR_XOF', rate: '655.957' },
    { pair: 'EUR_USD', rate: '1.1463' },
  ];

  it('lit un taux direct', () => {
    expect(resolveRateFromCache(cache, 'EUR', 'XOF').rate).toBeCloseTo(655.957, 3);
  });

  it('déduit le taux inverse quand la paire directe est absente', () => {
    const resultat = resolveRateFromCache(cache, 'XOF', 'EUR');
    expect(resultat.inverse).toBe(true);
    expect(resultat.rate).toBeCloseTo(1 / 655.957, 9);
  });

  it('retourne 1 pour une devise identique et null si inconnu', () => {
    expect(resolveRateFromCache(cache, 'XOF', 'XOF')).toEqual({ rate: 1, inverse: false });
    expect(resolveRateFromCache(cache, 'USD', 'XOF')).toBeNull();
  });

  it('construit les clés de paire en majuscules', () => {
    expect(pairKey('eur', 'xof')).toBe('EUR_XOF');
  });
});
