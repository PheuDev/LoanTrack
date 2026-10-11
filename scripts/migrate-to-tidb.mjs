import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'server', 'package.json'));
const { parse } = require('dotenv');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const sourceEnv = parse(await readFile(path.join(root, 'server', '.env')));
const targetEnv = parse(await readFile(path.join(root, '.env.local')));
const tables = ['users', 'app_settings', 'loan_tiers', 'exchange_rates', 'clients', 'loans', 'repayments', 'penalty_logs', 'audit_logs'];
function connectionOptions(value, tls = false) {
  const url = new URL(value);
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
    charset: 'utf8mb4',
    dateStrings: true,
    ...(tls ? { ssl: { minVersion: 'TLSv1.2' } } : {}),
  };
}
const source = await mysql.createConnection(connectionOptions(sourceEnv.DATABASE_URL));
const target = await mysql.createConnection(connectionOptions(targetEnv.DATABASE_URL, true));
const counts = {};
const adminPassword = randomBytes(24).toString('base64url');
const adminHash = await bcrypt.hash(adminPassword, 12);
try {
  const existing = {};
  for (const table of tables) {
    const [[row]] = await target.query(`SELECT COUNT(*) AS n FROM \`${table}\``);
    existing[table] = Number(row.n);
  }
  if (Object.values(existing).some((count) => count !== 0)) {
    throw new Error('Import interrompu : au moins une table cible contient deja des donnees.');
  }
  const [[admin]] = await source.execute("SELECT COUNT(*) AS n FROM users WHERE username = 'admin'");
  if (Number(admin.n) !== 1) throw new Error('Compte administrateur source absent ou ambigu; aucune importation effectuee.');

  await target.query('SET FOREIGN_KEY_CHECKS = 0');
  await target.beginTransaction();
  try {
    for (const table of tables) {
      const [rows] = await source.query(`SELECT * FROM \`${table}\` ORDER BY 1`);
      counts[table] = rows.length;
      if (rows.length === 0) continue;
      const columns = Object.keys(rows[0]);
      const columnSql = columns.map((column) => `\`${column}\``).join(', ');
      const placeholders = `(${columns.map(() => '?').join(', ')})`;
      const sql = `INSERT INTO \`${table}\` (${columnSql}) VALUES ${placeholders}`;
      for (const row of rows) {
        const values = columns.map((column) => {
          const value = row[column];
          return value !== null && typeof value === 'object' && !(value instanceof Date) && !Buffer.isBuffer(value)
            ? JSON.stringify(value)
            : value;
        });
        await target.execute(sql, values);
      }
    }
    const [result] = await target.execute("UPDATE users SET password_hash = ? WHERE username = 'admin'", [adminHash]);
    if (result.affectedRows !== 1) throw new Error('Le compte admin n’a pas pu etre securise; import annule.');
    await target.commit();
  } catch (error) {
    await target.rollback();
    throw error;
  }
  await target.query('SET FOREIGN_KEY_CHECKS = 1');
  for (const table of tables) {
    const [[row]] = await target.query(`SELECT COUNT(*) AS n FROM \`${table}\``);
    if (Number(row.n) !== counts[table]) throw new Error(`Verification de lignes echouee pour ${table}.`);
  }
  console.log('Migration terminee; nombres de lignes verifies:', JSON.stringify(counts));
  console.log('Identifiant de connexion: admin');
  console.log('Mot de passe administrateur temporaire:', adminPassword);
} finally {
  await source.end();
  await target.end();
}