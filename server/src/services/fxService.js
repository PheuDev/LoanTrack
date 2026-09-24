// Service de logique métier pour les taux de change.
// Il n'accède pas à la base : il calcule des taux et sait les récupérer auprès
// du fournisseur de marché (BCE via l'API Frankfurter, sans clé).

import { SUPPORTED_CURRENCIES, pairKey } from './currencyService.js';

// Devise pivot des taux de marché : la BCE publie ses taux de référence en euro.
export const DEVISE_PIVOT = 'EUR';

// Le franc CFA (XOF) n'est pas publié par la BCE : il est rattaché à l'euro par
// une parité FIXE et légale (1 EUR = 655,957 XOF). C'est donc la vraie valeur de
// marché de la devise — ces taux sont marqués « parite » dans le cache.
export const PARITES_FIXES = { XOF: 655.957 };

// Fournisseur de taux (BCE). Remplaçable : il suffit de changer cette URL.
const URL_TAUX_MARCHE = 'https://api.frankfurter.app/latest';

/**
 * Construit la table des taux pivot→devise (1 EUR = x DEVISE).
 * Le pivot lui-même vaut 1. Les devises à parité fixe sont injectées ici.
 *
 * @param {Object<string, number>} tauxPubies - Taux publiés par le fournisseur (pivot → devise)
 * @returns {Object<string, { taux: number, source: string }>}
 */
export function construireTauxPivot(tauxPubies = {}) {
  const table = { [DEVISE_PIVOT]: { taux: 1, source: 'pivot' } };

  for (const [code, taux] of Object.entries(tauxPubies)) {
    const valeur = parseFloat(taux);
    if (Number.isFinite(valeur) && valeur > 0) {
      table[code] = { taux: valeur, source: 'marche' };
    }
  }

  // Les parités fixes complètent/écrasent les taux publiés (le XOF est absent du flux BCE)
  for (const [code, taux] of Object.entries(PARITES_FIXES)) {
    table[code] = { taux, source: 'parite' };
  }

  return table;
}

/**
 * Calcule le taux base→cible à partir de la table pivot.
 * taux(base → cible) = tauxPivot[cible] / tauxPivot[base]
 *
 * @returns {{ pair: string, rate: number } | null} null si une devise est absente
 */
export function calculerTaux(base, cible, tablePivot) {
  const b = String(base).toUpperCase();
  const c = String(cible).toUpperCase();
  const tauxBase = tablePivot[b];
  const tauxCible = tablePivot[c];
  if (!tauxBase || !tauxCible) return null;
  return { pair: pairKey(b, c), rate: tauxCible.taux / tauxBase.taux };
}

/**
 * Construit les paires base→cible pour toutes les devises demandées.
 * @returns {Array<{ pair: string, rate: string, source: string }>}
 */
export function construirePaires(base, cibles, tablePivot) {
  const paires = [];
  for (const cible of cibles) {
    const taux = calculerTaux(base, cible, tablePivot);
    if (!taux) continue;
    paires.push({
      pair: taux.pair,
      // Les taux sont stockés en texte pour ne jamais perdre de précision
      rate: String(taux.rate),
      source: tablePivot[String(base).toUpperCase()]?.source === 'parite'
        ? 'parite'
        : (tablePivot[String(cible).toUpperCase()]?.source || 'marche'),
    });
  }
  return paires;
}

/**
 * Liste les devises supportées dont le taux doit être demandé au fournisseur
 * (on exclut le pivot et les devises à parité fixe, connues d'avance).
 */
export function devisesAConsulter() {
  return Object.keys(SUPPORTED_CURRENCIES).filter(
    (code) => code !== DEVISE_PIVOT && PARITES_FIXES[code] === undefined
  );
}

/**
 * Récupère les taux de marché du jour et retourne les paires demandées.
 * Lève une erreur si le fournisseur est injoignable — l'appelant décide alors
 * d'utiliser le cache ou une saisie manuelle.
 *
 * @param {string} base - Devise de départ
 * @param {Array<string>} cibles - Devises d'arrivée
 * @returns {Promise<{ base: string, paires: Array, fetchedAt: Date }>}
 */
export async function recupererTauxMarche(base, cibles = devisesAConsulter()) {
  const aConsulter = cibles.filter((code) => PARITES_FIXES[code] === undefined && code !== DEVISE_PIVOT);

  let tauxPublies = {};
  if (aConsulter.length > 0) {
    const url = `${URL_TAUX_MARCHE}?from=${DEVISE_PIVOT}&to=${aConsulter.join(',')}`;
    const reponse = await fetch(url);
    if (!reponse.ok) throw new Error(`Fournisseur de taux indisponible (HTTP ${reponse.status}).`);
    const json = await reponse.json();
    tauxPublies = json.rates || {};
  }

  const tablePivot = construireTauxPivot(tauxPublies);
  return {
    base: String(base).toUpperCase(),
    paires: construirePaires(base, cibles, tablePivot),
    fetchedAt: new Date(),
  };
}
