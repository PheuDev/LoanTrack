import { describe, it, expect } from 'vitest';
import {
  calculerTaux,
  construirePaires,
  construireTauxPivot,
  devisesAConsulter,
} from './fxService.js';

describe('construireTauxPivot', () => {
  it('inclut le pivot, les taux publiés et les parités fixes', () => {
    const table = construireTauxPivot({ USD: 1.1463 });

    expect(table.EUR).toEqual({ taux: 1, source: 'pivot' });
    expect(table.USD).toEqual({ taux: 1.1463, source: 'marche' });
    // Le XOF n'est pas publié par la BCE : sa parité légale est injectée
    expect(table.XOF).toEqual({ taux: 655.957, source: 'parite' });
  });

  it('ignore les taux invalides renvoyés par le fournisseur', () => {
    const table = construireTauxPivot({ USD: 0, GBP: 'abc' });
    expect(table.USD).toBeUndefined();
    expect(table.GBP).toBeUndefined();
  });
});

describe('calculerTaux', () => {
  const table = construireTauxPivot({ USD: 1.1463 });

  it('calcule un taux croisé via le pivot EUR', () => {
    // 1 XOF = 1.1463 / 655.957 USD
    const taux = calculerTaux('XOF', 'USD', table);
    expect(taux.pair).toBe('XOF_USD');
    expect(taux.rate).toBeCloseTo(1.1463 / 655.957, 10);
  });

  it('retourne le taux de parité EUR → XOF', () => {
    expect(calculerTaux('EUR', 'XOF', table).rate).toBeCloseTo(655.957, 3);
  });

  it('retourne null si une devise est absente de la table', () => {
    expect(calculerTaux('XOF', 'GBP', table)).toBeNull();
  });
});

describe('construirePaires', () => {
  const table = construireTauxPivot({ USD: 1.1463 });

  it('produit une paire par devise cible, en texte (aucune perte de précision)', () => {
    const paires = construirePaires('EUR', ['XOF', 'USD'], table);

    expect(paires).toHaveLength(2);
    expect(paires[0]).toEqual({ pair: 'EUR_XOF', rate: '655.957', source: 'parite' });
    expect(paires[1].pair).toBe('EUR_USD');
    expect(paires[1].rate).toBe('1.1463');
    expect(typeof paires[1].rate).toBe('string');
  });

  it('marque les paires dérivées d\'une parité fixe', () => {
    const paires = construirePaires('XOF', ['EUR'], table);
    expect(paires[0].source).toBe('parite');
  });

  it('ignore les cibles inconnues', () => {
    expect(construirePaires('EUR', ['GBP'], table)).toEqual([]);
  });
});

describe('devisesAConsulter', () => {
  it('exclut le pivot et les devises à parité fixe', () => {
    // XOF est rattaché à l'euro, EUR est le pivot : seul USD doit être demandé
    expect(devisesAConsulter()).toEqual(['USD']);
  });
});
