// Sonde temporaire : état des données de démarrage (à supprimer après usage).
import 'dotenv/config';
import mysql from 'mysql2/promise';
import fs from 'node:fs';

const c = await mysql.createConnection({ uri: process.env.DATABASE_URL });
const lignes = [];

for (const [requete, label] of [
  ['SELECT id, username, display_name FROM users', 'users'],
  ['SELECT `key`, value FROM app_settings', 'app_settings'],
  ['SELECT id, label, min_amount, max_amount, interest_rate_bp, duration_days, min_prior_repaid_loans, is_active FROM loan_tiers', 'loan_tiers'],
  ['SELECT pair, rate, source FROM exchange_rates', 'exchange_rates'],
  ['SELECT id, level, tier_id, principal, interest_amount, total_due, currency, status FROM loans', 'loans'],
]) {
  const [rows] = await c.query(requete);
  lignes.push(`${label} (${rows.length}) => ${JSON.stringify(rows)}`);
}

await c.end();
fs.writeFileSync(process.argv[2] || 'verif-out.txt', lignes.join('\n'), 'utf8');
