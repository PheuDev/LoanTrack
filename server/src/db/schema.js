// Schéma de la base de données LoanTrack
// Ce fichier définit toutes les tables ET leurs relations.
// Drizzle Kit s'en sert pour générer les migrations.
// Les relations (relations()) sont utilisées uniquement pour les requêtes avec `with:`.

import {
  mysqlTable,
  int,
  varchar,
  text,
  date,
  datetime,
  json,
} from 'drizzle-orm/mysql-core';
import { relations, sql } from 'drizzle-orm';

// Raccourci pour les colonnes de date système.
// MySQL n'a pas de type « timestamp with time zone » : on stocke des DATETIME en UTC.
// Le pool définit `time_zone = '+00:00'` (voir db/index.js) pour que le DEFAULT
// CURRENT_TIMESTAMP soit évalué en UTC, cohérent avec les dates écrites par l'app
// (Drizzle convertit les Date JS en UTC pour MySQL).
const datetimeUtc = (name) => datetime(name).default(sql`CURRENT_TIMESTAMP`);

// ─── users ────────────────────────────────────────────────────────────────────
export const users = mysqlTable('users', {
  id:           int('id').primaryKey().autoincrement(),
  username:     varchar('username', { length: 100 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  // Nom affiché (modifiable dans les Paramètres ; défaut = username)
  displayName:  varchar('display_name', { length: 100 }),
  // Rôle ('gestionnaire' en v1 — champ préparé pour le multi-rôle futur)
  role:         varchar('role', { length: 20 }).notNull().default('gestionnaire'),
  // Préférences personnelles (null = suit les réglages globaux de l'app)
  preferredCurrency: varchar('preferred_currency', { length: 3 }),
  preferredLanguage: varchar('preferred_language', { length: 5 }),
  createdAt:    datetimeUtc('created_at').notNull(),
  updatedAt:    datetimeUtc('updated_at').notNull(),
});

// ─── app_settings ─────────────────────────────────────────────────────────────
// Paramètres globaux de l'application (clé/valeur).
// Ex : default_currency=XOF, default_language=fr, app_name=LoanTrack
export const appSettings = mysqlTable('app_settings', {
  key:       varchar('key', { length: 50 }).primaryKey(),
  value:     text('value').notNull(),
  updatedAt: datetimeUtc('updated_at').notNull(),
});

// ─── loan_tiers (tranches de règles de prêt configurables) ────────────────────
// Remplace les constantes NIVEAUX_PRET codées en dur.
// Montants en unités mineures (XOF : francs ; EUR/USD : centimes), taux en
// points de base (2500 = 25,00 %) pour éviter les flottants.
export const loanTiers = mysqlTable('loan_tiers', {
  id:                   int('id').primaryKey().autoincrement(),
  label:                varchar('label', { length: 100 }).notNull(),
  minAmount:            int('min_amount').notNull(),
  maxAmount:            int('max_amount'),
  interestRateBp:       int('interest_rate_bp').notNull(),
  durationDays:         int('duration_days').notNull(),
  minPriorRepaidLoans:  int('min_prior_repaid_loans').notNull().default(0),
  penaltyRateBpDaily:   int('penalty_rate_bp_daily').notNull().default(500),
  maxActiveLoansPerClient: int('max_active_loans_per_client').notNull().default(1),
  isActive:             int('is_active').notNull().default(1),
  createdAt:            datetimeUtc('created_at').notNull(),
  updatedAt:            datetimeUtc('updated_at').notNull(),
});

// ─── exchange_rates (cache des taux de change) ────────────────────────────────
// Renseigne par la route /fx/refresh (provider externe) ou saisie manuelle.
export const exchangeRates = mysqlTable('exchange_rates', {
  pair:      varchar('pair', { length: 11 }).primaryKey(),
  rate:      varchar('rate', { length: 30 }).notNull(),
  source:    varchar('source', { length: 50 }).notNull().default('manual'),
  fetchedAt: datetimeUtc('fetched_at').notNull(),
});

// ─── clients ──────────────────────────────────────────────────────────────────
export const clients = mysqlTable('clients', {
  id:        int('id').primaryKey().autoincrement(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName:  varchar('last_name', { length: 100 }).notNull(),
  phone:     varchar('phone', { length: 20 }).notNull().unique(),
  address:   text('address'),
  notes:     text('notes'),
  // 'actif' | 'suspendu'
  status:    varchar('status', { length: 20 }).notNull().default('actif'),
  createdAt: datetimeUtc('created_at').notNull(),
  updatedAt: datetimeUtc('updated_at').notNull(),
});

// ─── loans ────────────────────────────────────────────────────────────────────
export const loans = mysqlTable('loans', {
  id:             int('id').primaryKey().autoincrement(),
  clientId:       int('client_id').notNull().references(() => clients.id),
  level:          int('level'),
  // Tranche de règle appliquée à l'octroi (nullable pour les prêts historiques).
  // Pas de FK : évite les problèmes d'ordre de création et garde les prêts
  // historiques valides même si une tranche est désactivée.
  tierId:         int('tier_id'),
  principal:      int('principal').notNull(),
  interestAmount: int('interest_amount').notNull(),
  totalDue:       int('total_due').notNull(),
  penalties:      int('penalties').notNull().default(0),
  // Devise du prêt + snapshot comptable en devise de référence
  currency:       varchar('currency', { length: 3 }).notNull().default('XOF'),
  baseCurrency:   varchar('base_currency', { length: 3 }).notNull().default('XOF'),
  rateToBase:     varchar('rate_to_base', { length: 30 }).notNull().default('1'),
  baseTotalDue:   int('base_total_due'),
  // 'actif' | 'en_retard' | 'solde' | 'annule'
  status:         varchar('status', { length: 20 }).notNull().default('actif'),
  startDate:      date('start_date').notNull(),
  dueDate:        date('due_date').notNull(),
  createdBy:      int('created_by').notNull().references(() => users.id),
  createdAt:      datetimeUtc('created_at').notNull(),
  updatedAt:      datetimeUtc('updated_at').notNull(),
});

// ─── repayments ───────────────────────────────────────────────────────────────
export const repayments = mysqlTable('repayments', {
  id:          int('id').primaryKey().autoincrement(),
  loanId:      int('loan_id').notNull().references(() => loans.id),
  amount:      int('amount').notNull(),
  paymentDate: date('payment_date').notNull(),
  currency:    varchar('currency', { length: 3 }).notNull().default('XOF'),
  rateToBase:  varchar('rate_to_base', { length: 30 }).notNull().default('1'),
  baseAmount:  int('base_amount'),
  recordedBy:  int('recorded_by').notNull().references(() => users.id),
  createdAt:   datetimeUtc('created_at').notNull(),
});

// ─── penalty_logs ─────────────────────────────────────────────────────────────
export const penaltyLogs = mysqlTable('penalty_logs', {
  id:          int('id').primaryKey().autoincrement(),
  loanId:      int('loan_id').notNull().references(() => loans.id),
  daysOverdue: int('days_overdue').notNull(),
  amount:      int('amount').notNull(),
  appliedDate: date('applied_date').notNull(),
  appliedBy:   int('applied_by').notNull().references(() => users.id),
  createdAt:   datetimeUtc('created_at').notNull(),
});

// ─── audit_logs ───────────────────────────────────────────────────────────────
export const auditLogs = mysqlTable('audit_logs', {
  id:         int('id').primaryKey().autoincrement(),
  userId:     int('user_id').notNull().references(() => users.id),
  action:     varchar('action', { length: 50 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId:   int('entity_id').notNull(),
  details:    json('details'),
  createdAt:  datetimeUtc('created_at').notNull(),
});

// ─── Relations ────────────────────────────────────────────────────────────────
// Ces déclarations permettent d'utiliser `with:` dans les requêtes Drizzle.
// Elles ne créent pas de colonnes — elles décrivent les liens entre tables.

export const clientsRelations = relations(clients, ({ many }) => ({
  loans: many(loans),
}));

export const loansRelations = relations(loans, ({ one, many }) => ({
  client:      one(clients, { fields: [loans.clientId],   references: [clients.id] }),
  createdBy:   one(users,   { fields: [loans.createdBy],  references: [users.id] }),
  repayments:  many(repayments),
  penaltyLogs: many(penaltyLogs),
}));

export const repaymentsRelations = relations(repayments, ({ one }) => ({
  loan:       one(loans, { fields: [repayments.loanId],     references: [loans.id] }),
  recordedBy: one(users, { fields: [repayments.recordedBy], references: [users.id] }),
}));

export const penaltyLogsRelations = relations(penaltyLogs, ({ one }) => ({
  loan:      one(loans, { fields: [penaltyLogs.loanId],    references: [loans.id] }),
  appliedBy: one(users, { fields: [penaltyLogs.appliedBy], references: [users.id] }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  loans:       many(loans),
  repayments:  many(repayments),
  penaltyLogs: many(penaltyLogs),
  auditLogs:   many(auditLogs),
}));
