import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  appSettings,
  auditLogs,
  exchangeRates,
  loanTiers,
  loans,
  penaltyLogs,
  repayments,
} from '../db/schema.js';
import { AppError } from '../middlewares/AppError.js';
import {
  SUPPORTED_CURRENCIES,
  estDeviseSupportee,
  getSettings,
  resolveRateFromCache,
} from '../services/currencyService.js';
import { recupererTauxMarche } from '../services/fxService.js';
import {
  convertirPenalite,
  convertirPret,
  convertirRemboursement,
  convertirTranche,
} from '../services/conversionService.js';

// Écrit (ou crée) un paramètre global.
async function ecrireParametre(executeur, key, value) {
  const existing = await executeur.select().from(appSettings).where(eq(appSettings.key, key));
  if (existing.length === 0) {
    await executeur.insert(appSettings).values({ key, value: String(value), updatedAt: new Date() });
  } else {
    await executeur.update(appSettings)
      .set({ value: String(value), updatedAt: new Date() })
      .where(eq(appSettings.key, key));
  }
}

// Écrit (ou met à jour) un taux dans le cache.
async function ecrireTaux(executeur, { pair, rate, source }, fetchedAt) {
  const existing = await executeur.select().from(exchangeRates).where(eq(exchangeRates.pair, pair));
  const valeurs = { rate: String(rate), source, fetchedAt };
  if (existing.length === 0) {
    await executeur.insert(exchangeRates).values({ pair, ...valeurs });
  } else {
    await executeur.update(exchangeRates).set(valeurs).where(eq(exchangeRates.pair, pair));
  }
  return { pair, ...valeurs };
}

/**
 * Construit la table des équivalences d'une devise de base vers toutes les
 * devises supportées, à partir du cache de taux.
 * @returns {Object<string, { taux: number, inverse: boolean } | null>}
 */
function equivalencesDepuisCache(cacheRows, base) {
  const equivalences = {};
  for (const code of Object.keys(SUPPORTED_CURRENCIES)) {
    const trouve = resolveRateFromCache(cacheRows, base, code);
    equivalences[code] = trouve ? { taux: trouve.rate, inverse: trouve.inverse } : null;
  }
  return equivalences;
}

/**
 * GET /settings
 * Retourne les paramètres globaux, les devises supportées et les taux connus.
 */
export async function getAppSettings(req, res, next) {
  try {
    const settings = await getSettings(db, appSettings);
    const rows = await db.select().from(exchangeRates);

    return res.json({
      data: {
        settings,
        currencies: Object.values(SUPPORTED_CURRENCIES),
        taux: {
          base: settings.default_currency,
          equivalences: equivalencesDepuisCache(rows, settings.default_currency),
          fetchedAt: rows.length ? rows.map((r) => r.fetchedAt).sort().reverse()[0] : null,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * PATCH /settings
 * Met à jour les paramètres d'affichage (nom de l'application, langue).
 * La devise n'est PAS modifiable ici : elle implique une conversion de tous les
 * montants (voir POST /settings/currency).
 */
export async function updateAppSettings(req, res, next) {
  try {
    const allowed = ['app_name', 'default_language'];
    const updates = Object.entries(req.body || {}).filter(([k]) => allowed.includes(k));

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'default_currency')) {
      return next(new AppError(
        'Le changement de devise se fait depuis la section Devise : il convertit tous les montants.',
        'CURRENCY_REQUIRES_CONVERSION',
        400
      ));
    }

    if (updates.length === 0) {
      return next(new AppError('Aucun paramètre valide fourni.', 'INVALID_SETTINGS', 400));
    }

    for (const [key, value] of updates) {
      const v = String(value ?? '').trim();
      if (key === 'app_name' && !v) {
        return next(new AppError("Le nom de l'application est requis.", 'INVALID_SETTINGS', 400));
      }
      if (key === 'default_language' && !['fr', 'en'].includes(v)) {
        return next(new AppError('Langue non supportée (fr, en).', 'INVALID_SETTINGS', 400));
      }
      await ecrireParametre(db, key, v);
    }

    await db.insert(auditLogs).values({
      userId: req.user.id,
      action: 'settings.update',
      entityType: 'settings',
      entityId: 0,
      details: Object.fromEntries(updates),
    });

    const settings = await getSettings(db, appSettings);
    return res.json({ data: { settings } });
  } catch (error) {
    return next(error);
  }
}


/**
 * POST /settings/currency
 * Change la devise de référence en convertissant RÉELLEMENT tous les montants
 * stockés, au taux du marché (ou au taux fourni).
 *
 * Les montants ne sont pas seulement réétiquetés : chaque prêt, remboursement,
 * pénalité et tranche de règles est converti puis réécrit en base dans une
 * transaction unique — un échec en cours de route annule tout.
 *
 * Body : { currency: 'EUR', taux?: 0.00152449 }
 */
export async function convertAppCurrency(req, res, next) {
  try {
    const settings = await getSettings(db, appSettings);
    const source = settings.default_currency;
    const cible = String(req.body?.currency || '').toUpperCase();

    if (!estDeviseSupportee(cible)) {
      return next(new AppError('Devise non supportée (XOF, EUR, USD).', 'INVALID_SETTINGS', 400));
    }
    if (cible === source) {
      return next(new AppError(`La devise de référence est déjà ${cible}.`, 'CURRENCY_UNCHANGED', 400));
    }

    // ── Détermination du taux : saisie manuelle, cache, sinon marché ──────────
    let taux;
    let origineTaux = 'marche';

    if (req.body?.taux !== undefined) {
      taux = parseFloat(req.body.taux);
      origineTaux = 'manuel';
      if (!Number.isFinite(taux) || taux <= 0) {
        return next(new AppError('Taux de conversion invalide.', 'INVALID_FX_RATE', 400));
      }
    } else {
      const cache = await db.select().from(exchangeRates);
      const trouve = resolveRateFromCache(cache, source, cible);
      if (trouve) {
        taux = trouve.rate;
        origineTaux = 'cache';
      } else {
        try {
          const marche = await recupererTauxMarche(source, Object.keys(SUPPORTED_CURRENCIES));
          for (const paire of marche.paires) {
            await ecrireTaux(db, paire, marche.fetchedAt);
          }
          const paireCible = marche.paires.find((p) => p.pair === `${source}_${cible}`);
          taux = paireCible ? parseFloat(paireCible.rate) : null;
        } catch (fetchError) {
          void fetchError;
          return next(new AppError(
            'Taux de marché indisponibles (connexion requise). Renseignez un taux manuel pour continuer.',
            'FX_UNAVAILABLE',
            503
          ));
        }
        if (!taux) {
          return next(new AppError(`Aucun taux disponible pour ${source} → ${cible}.`, 'FX_UNAVAILABLE', 503));
        }
      }
    }

    // ── Conversion de tous les montants (transaction unique) ─────────────────
    // Le volume d'une application de suivi de prêts reste faible : on écrit
    // ligne par ligne pour garder la conversion lisible et auditable.
    const compteur = await db.transaction(async (tx) => {
      const now = new Date();
      const total = { tranches: 0, prets: 0, remboursements: 0, penalites: 0 };

      const tranches = await tx.select().from(loanTiers);
      for (const tranche of tranches) {
        await tx.update(loanTiers)
          .set({ ...convertirTranche(tranche, source, cible, taux), updatedAt: now })
          .where(eq(loanTiers.id, tranche.id));
        total.tranches++;
      }

      const prets = await tx.select().from(loans);
      for (const pret of prets) {
        await tx.update(loans)
          .set({ ...convertirPret(pret, source, cible, taux), updatedAt: now })
          .where(eq(loans.id, pret.id));
        total.prets++;
      }

      const listeRemboursements = await tx.select().from(repayments);
      for (const remboursement of listeRemboursements) {
        await tx.update(repayments)
          .set(convertirRemboursement(remboursement, source, cible, taux))
          .where(eq(repayments.id, remboursement.id));
        total.remboursements++;
      }

      const listePenalites = await tx.select().from(penaltyLogs);
      for (const penalite of listePenalites) {
        await tx.update(penaltyLogs)
          .set(convertirPenalite(penalite, source, cible, taux))
          .where(eq(penaltyLogs.id, penalite.id));
        total.penalites++;
      }

      await ecrireParametre(tx, 'default_currency', cible);

      await tx.insert(auditLogs).values({
        userId: req.user.id,
        action: 'settings.currency.convert',
        entityType: 'settings',
        entityId: 0,
        details: { de: source, vers: cible, taux, origineTaux, compteur: total },
      });

      return total;
    });

    // Le taux utilisé restera consultable dans le cache
    const tauxEnregistre = await ecrireTaux(
      db,
      { pair: `${source}_${cible}`, rate: taux, source: origineTaux },
      new Date()
    );

    const nouvelles = await getSettings(db, appSettings);
    return res.json({
      data: {
        settings: nouvelles,
        conversion: { de: source, vers: cible, taux, origineTaux, compteur, tauxEnregistre },
      },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /fx/rates — taux connus + équivalences depuis la devise de référence.
 * Query : base (défaut = devise de référence)
 */
export async function getFxRates(req, res, next) {
  try {
    const settings = await getSettings(db, appSettings);
    const base = String(req.query.base || settings.default_currency).toUpperCase();
    if (!estDeviseSupportee(base)) {
      return next(new AppError('Devise non supportée (XOF, EUR, USD).', 'INVALID_SETTINGS', 400));
    }

    const rows = await db.select().from(exchangeRates);
    return res.json({
      data: {
        base,
        taux: rows.map((r) => ({ pair: r.pair, rate: r.rate, source: r.source, fetchedAt: r.fetchedAt })),
        equivalences: equivalencesDepuisCache(rows, base),
      },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /fx/refresh — récupère les taux du jour (taux BCE + parité XOF/EUR).
 * En cas d'échec réseau : 503 avec consigne d'utiliser le cache ou la saisie manuelle.
 * Body optionnel : { base }
 */
export async function refreshFxRates(req, res, next) {
  try {
    const settings = await getSettings(db, appSettings);
    const base = String(req.body?.base || settings.default_currency).toUpperCase();
    if (!estDeviseSupportee(base)) {
      return next(new AppError('Devise non supportée (XOF, EUR, USD).', 'INVALID_SETTINGS', 400));
    }

    let marche;
    try {
      marche = await recupererTauxMarche(base, Object.keys(SUPPORTED_CURRENCIES));
    } catch (fetchError) {
      void fetchError;
      return next(new AppError(
        'Taux indisponibles (hors-ligne). Utilisez les derniers taux connus ou la saisie manuelle.',
        'FX_UNAVAILABLE',
        503
      ));
    }

    const enregistres = [];
    for (const paire of marche.paires) {
      enregistres.push(await ecrireTaux(db, paire, marche.fetchedAt));
    }

    const rows = await db.select().from(exchangeRates);
    return res.json({
      data: { base, taux: enregistres, equivalences: equivalencesDepuisCache(rows, base) },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /fx/manual — saisie manuelle d'un taux (auditée).
 * Body : { pair: "EUR_XOF", rate: "655.957" }
 */
export async function setManualRate(req, res, next) {
  try {
    const pair = String(req.body?.pair || '').toUpperCase();
    const [de, vers] = pair.split('_');
    if (!/^[A-Z]{3}_[A-Z]{3}$/.test(pair) || !estDeviseSupportee(de) || !estDeviseSupportee(vers)) {
      return next(new AppError('Paire invalide (ex. EUR_XOF).', 'INVALID_FX_PAIR', 400));
    }

    const taux = parseFloat(req.body?.rate);
    if (!Number.isFinite(taux) || taux <= 0) {
      return next(new AppError('Taux invalide.', 'INVALID_FX_RATE', 400));
    }

    const enregistre = await ecrireTaux(db, { pair, rate: taux, source: 'manuel' }, new Date());

    await db.insert(auditLogs).values({
      userId: req.user.id,
      action: 'fx.manual',
      entityType: 'exchange_rate',
      entityId: 0,
      details: { pair, rate: taux },
    });

    return res.status(201).json({ data: enregistre });
  } catch (error) {
    return next(error);
  }
}

