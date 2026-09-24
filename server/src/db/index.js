import 'dotenv/config';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { eq } from 'drizzle-orm';
import * as schema from './schema.js';

// Pool de connexions MySQL (WAMP).
// Un pool gère plusieurs connexions simultanées efficacement
// plutôt que d'ouvrir/fermer une connexion à chaque requête.
const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  // Unicode complet (accents, emojis…)
  charset: 'UTF8MB4_UNICODE_CI',
});

// Cohérence des horodatages : MySQL évalue CURRENT_TIMESTAMP dans le fuseau de
// session (par défaut celui de Windows) alors que Drizzle interprète les DATETIME
// comme UTC. On force donc la session en UTC dès la création de chaque connexion.
// L'événement 'connection' est émis de façon synchrone avant que la connexion ne
// soit remise au pool : le SET est bien exécuté avant la première requête.
pool.on('connection', (connection) => {
  connection.query("SET time_zone = '+00:00'", (err) => {
    if (err) console.error("Impossible d'appliquer time_zone='+00:00' :", err.message);
  });
});

// Instance Drizzle qui sera utilisée dans tous les contrôleurs.
// On passe le schéma pour que Drizzle connaisse la structure des tables.
// `mode: 'default'` est requis par le driver MySQL quand un schéma est fourni.
export const db = drizzle(pool, { schema, mode: 'default' });

// ─── Aides d'écriture pour MySQL (pas de support RETURNING) ──────────────────
// MySQL ne connaît pas INSERT/UPDATE … RETURNING :
//  - `insert().returning()` n'existe pas sur le builder MySQL de Drizzle ;
//  - `update().returning()` n'existe pas non plus.
// Ces deux helpers écrivent puis relisent la ligne concernée.

/**
 * Insère une ligne puis la relit depuis la base.
 *
 * @param {import('drizzle-orm/mysql-core').MySqlTable} table
 * @param {object} values - Valeurs à insérer (les colonnes par défaut peuvent être omises)
 * @returns {Promise<object>} La ligne insérée complète
 */
export async function insertAndFetch(table, values) {
  const insertResult = await db.insert(table).values(values);
  const insertId = insertResult[0].insertId;
  const rows = await db.select().from(table).where(eq(table.id, insertId));
  return rows[0];
}

/**
 * Met à jour une ligne par son id puis la relit depuis la base.
 *
 * @param {import('drizzle-orm/mysql-core').MySqlTable} table
 * @param {object} values - Colonnes à mettre à jour
 * @param {number} id - Clé primaire de la ligne
 * @returns {Promise<object>} La ligne mise à jour complète
 */
export async function updateAndFetch(table, values, id) {
  await db.update(table).set(values).where(eq(table.id, id));
  const rows = await db.select().from(table).where(eq(table.id, id));
  return rows[0];
}
