// Script de seed — installe les données de démarrage :
//   1. l'utilisateur admin (admin / admin123) ;
//   2. les paramètres globaux (nom de l'application, devise, langue) ;
//   3. les tranches de règles de prêt par défaut ;
//   4. la parité officielle EUR/XOF (le franc CFA est rattaché à l'euro).
//
// Idempotent : chaque section ne fait rien si les données existent déjà.
// À exécuter après db:push : npm run db:seed
//
// IMPORTANT : changer le mot de passe admin en production.

import 'dotenv/config';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { db } from './index.js';
import { appSettings, exchangeRates, loanTiers, users } from './schema.js';
import { DEFAULT_SETTINGS } from '../services/currencyService.js';
import { PARITES_FIXES } from '../services/fxService.js';

// Tranches de règles livrées par défaut : un point de départ concret, que le
// gestionnaire ajuste ensuite librement depuis la page Règles.
const TRANCHES_PAR_DEFAUT = [
  {
    label: 'Tranche 1 — Découverte',
    minAmount: 5000,
    maxAmount: 25000,
    interestRateBp: 3000,          // 30 %
    durationDays: 7,
    minPriorRepaidLoans: 0,        // accessible aux nouveaux clients
    penaltyRateBpDaily: 500,       // 5 % par jour de retard
    maxActiveLoansPerClient: 1,
  },
  {
    label: 'Tranche 2 — Confirmée',
    minAmount: 25001,
    maxAmount: 50000,
    interestRateBp: 2500,          // 25 %
    durationDays: 10,
    minPriorRepaidLoans: 1,        // après 1 prêt soldé
    penaltyRateBpDaily: 500,
    maxActiveLoansPerClient: 1,
  },
  {
    label: 'Tranche 3 — Privilège',
    minAmount: 50001,
    maxAmount: 75000,
    interestRateBp: 2000,          // 20 %
    durationDays: 15,
    minPriorRepaidLoans: 2,        // après 2 prêts soldés
    penaltyRateBpDaily: 500,
    maxActiveLoansPerClient: 1,
  },
];

async function seedAdmin() {
  const existants = await db.select().from(users).where(eq(users.username, 'admin'));
  if (existants.length > 0) {
    console.log("- Utilisateur admin : déjà présent.");
    return;
  }

  // 10 tours de bcrypt — bon équilibre entre sécurité et rapidité du seed
  const passwordHash = await bcrypt.hash('admin123', 10);
  await db.insert(users).values({ username: 'admin', passwordHash, displayName: 'Gestionnaire' });

  console.log('- Utilisateur admin créé (admin / admin123).');
}

async function seedSettings() {
  let crees = 0;

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    const existants = await db.select().from(appSettings).where(eq(appSettings.key, key));
    if (existants.length > 0) continue;
    await db.insert(appSettings).values({ key, value: String(value), updatedAt: new Date() });
    crees++;
  }

  console.log(`- Paramètres globaux : ${crees} valeur(s) initialisée(s).`);
}

async function seedTranches() {
  const existantes = await db.select().from(loanTiers);
  if (existantes.length > 0) {
    console.log(`- Tranches de règles : déjà présentes (${existantes.length}).`);
    return;
  }

  const now = new Date();
  await db.insert(loanTiers).values(
    TRANCHES_PAR_DEFAUT.map((tranche) => ({ ...tranche, isActive: 1, createdAt: now, updatedAt: now }))
  );

  console.log(`- Tranches de règles : ${TRANCHES_PAR_DEFAUT.length} créées.`);
}

async function seedTaux() {
  const now = new Date();
  const paires = [];

  // 1 EUR = 655,957 XOF (parité officielle) et sa réciproque
  for (const [code, taux] of Object.entries(PARITES_FIXES)) {
    paires.push({ pair: `EUR_${code}`, rate: String(taux) });
    paires.push({ pair: `${code}_EUR`, rate: String(1 / taux) });
  }

  let crees = 0;
  for (const { pair, rate } of paires) {
    const existants = await db.select().from(exchangeRates).where(eq(exchangeRates.pair, pair));
    if (existants.length > 0) continue;
    await db.insert(exchangeRates).values({ pair, rate, source: 'parite', fetchedAt: now });
    crees++;
  }

  console.log(`- Taux de change : ${crees} paire(s) de parité enregistrée(s).`);
}

async function seed() {
  console.log('Démarrage du seed…');

  await seedAdmin();
  await seedSettings();
  await seedTranches();
  await seedTaux();

  console.log('Seed terminé.');
  process.exit(0);
}

seed().catch((error) => {
  console.error('Erreur lors du seed :', error.message);
  process.exit(1);
});
