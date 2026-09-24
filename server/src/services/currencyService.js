// Service de logique métier pour les devises.
// Travaille sur des données déjà chargées — ne connaît ni Express ni la base.
//
// Convention de stockage : tous les montants sont des ENTIERS en unités mineures
// de la devise (XOF : francs ; EUR/USD : centimes). Aucun flottant n'est stocké,
// ce qui évite les erreurs d'arrondi binaires.

// Devises supportées par l'application.
// - code : code ISO 4217
// - decimals : décimales de la devise (XOF : 0, EUR/USD : 2)
// - minorPerMajor : unités mineures par unité majeure (100 pour les centimes, 1 pour le XOF)
export const SUPPORTED_CURRENCIES = {
  XOF: { code: 'XOF', label: 'Franc CFA',  symbol: 'FCFA', decimals: 0, minorPerMajor: 1 },
  EUR: { code: 'EUR', label: 'Euro',       symbol: '€',    decimals: 2, minorPerMajor: 100 },
  USD: { code: 'USD', label: 'Dollar US',  symbol: '$',    decimals: 2, minorPerMajor: 100 },
};

export const DEFAULT_CURRENCY = 'XOF';

// Paramètres globaux par défaut (seedés dans app_settings)
export const DEFAULT_SETTINGS = {
  app_name: 'LoanTrack',
  default_currency: DEFAULT_CURRENCY,
  default_language: 'fr',
};

/**
 * Récupère les paramètres globaux (avec défauts si absents en base).
 * @returns {Promise<Object>} { app_name, default_currency, default_language }
 */
export async function getSettings(db, appSettings) {
  const rows = await db.select().from(appSettings);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { ...DEFAULT_SETTINGS, ...map };
}

/**
 * Indique si une devise est gérée par l'application.
 */
export function estDeviseSupportee(code) {
  return Object.prototype.hasOwnProperty.call(SUPPORTED_CURRENCIES, String(code || '').toUpperCase());
}

/**
 * Retourne la fiche d'une devise supportée (lève une erreur sinon).
 * @returns {{ code: string, label: string, symbol: string, decimals: number, minorPerMajor: number }}
 */
export function getDevise(code) {
  const cle = String(code || '').toUpperCase();
  const devise = SUPPORTED_CURRENCIES[cle];
  if (!devise) throw new Error(`Devise non supportée : ${code}.`);
  return devise;
}

/**
 * Convertit un montant des unités mineures vers l'unité majeure.
 * Ex : 4955 → 49.55 EUR ; 32500 → 32500 XOF
 */
export function versMajeur(montantMineur, code) {
  return montantMineur / getDevise(code).minorPerMajor;
}

/**
 * Convertit un montant de l'unité majeure vers les unités mineures (entier).
 * Ex : 49.5459 EUR → 4955 ; 32500.4 XOF → 32500
 */
export function versMineur(montantMajeur, code) {
  return Math.round(montantMajeur * getDevise(code).minorPerMajor);
}

/**
 * Convertit un montant d'une devise vers une autre au taux de marché donné.
 *
 * Le taux attendu est exprimé en unité MAJEURE : « 1 unité de `de` vaut `taux`
 * unités de `vers` » (ex. 1 XOF = 0,00152449 EUR). Le passage par les unités
 * majeures est indispensable car les deux devises n'ont pas le même nombre de
 * décimales (XOF : 0, EUR/USD : 2) — on ne peut pas convertir directement les
 * unités mineures.
 *
 * @param {number} montantMineur - Montant dans la devise source (entier)
 * @param {string} de - Code ISO 4217 de la devise source
 * @param {string} vers - Code ISO 4217 de la devise cible
 * @param {number} taux - Taux majeur de `de` vers `vers`
 * @returns {number} Montant en unités mineures de la devise cible (entier)
 */
export function convertirMineur(montantMineur, de, vers, taux) {
  if (!Number.isFinite(taux) || taux <= 0) throw new Error('Taux de conversion invalide.');
  return versMineur(versMajeur(montantMineur, de) * taux, vers);
}

/**
 * Facteur multiplicatif à appliquer à des montants en unités mineures pour les
 * convertir d'une devise à l'autre (utile pour les conversions en lot).
 * Ex : XOF → EUR avec 1 XOF = 0,00152449 EUR → facteur ≈ 0,152449
 */
export function facteurMineur(de, vers, taux) {
  if (!Number.isFinite(taux) || taux <= 0) throw new Error('Taux de conversion invalide.');
  const source = getDevise(de);
  const cible = getDevise(vers);
  return (taux * cible.minorPerMajor) / source.minorPerMajor;
}

/**
 * Formate un montant en unités mineures pour les messages destinés à l'utilisateur
 * (erreurs, journal d'audit). Le formatage d'affichage reste côté frontend.
 * Ex : 30000 XOF → « 30 000 FCFA »
 */
export function formaterMontant(montantMineur, code) {
  const devise = getDevise(code);
  const nombre = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: devise.decimals,
    maximumFractionDigits: devise.decimals,
  }).format(versMajeur(montantMineur, devise.code));
  return `${nombre} ${devise.symbol}`;
}

/**
 * Construit la clé de paire de devises (ex. EUR_XOF).
 */
export function pairKey(from, to) {
  return `${String(from).toUpperCase()}_${String(to).toUpperCase()}`;
}

/**
 * Résout le taux from→to depuis le cache (avec paire inverse si besoin).
 * @returns {{ rate: number, inverse: boolean } | null}
 */
export function resolveRateFromCache(cacheRows, from, to) {
  const f = String(from).toUpperCase();
  const t = String(to).toUpperCase();
  if (f === t) return { rate: 1, inverse: false };
  const direct = cacheRows.find((r) => r.pair === pairKey(f, t));
  if (direct) return { rate: parseFloat(direct.rate), inverse: false };
  const inverse = cacheRows.find((r) => r.pair === pairKey(t, f));
  if (inverse && parseFloat(inverse.rate) > 0) {
    return { rate: 1 / parseFloat(inverse.rate), inverse: true };
  }
  return null;
}
