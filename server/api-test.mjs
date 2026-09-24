// Sonde temporaire : parcours API complet (login → réglages → règles → prêt → conversion).
import fs from 'node:fs';

const BASE = 'http://localhost:3001';
const sortie = [];

async function appel(methode, chemin, corps, token) {
  const reponse = await fetch(`${BASE}${chemin}`, {
    method: methode,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  let json = null;
  try { json = await reponse.json(); } catch { /* réponse vide */ }
  return { status: reponse.status, json };
}

function tracer(label, resultat) {
  sortie.push(`${label} → HTTP ${resultat.status} ${JSON.stringify(resultat.json).slice(0, 600)}`);
}

// 1. Connexion
const connexion = await appel('POST', '/auth/login', { username: 'admin', password: 'admin123' });
tracer('POST /auth/login', connexion);
const token = connexion.json?.data?.token;

// 2. Paramètres et règles
tracer('GET /settings', await appel('GET', '/settings', null, token));
tracer('GET /rules', await appel('GET', '/rules', null, token));
tracer('GET /rules?amount=20000', await appel('GET', '/rules?amount=20000', null, token));

// 3. Client de test
const clients = await appel('GET', '/clients', null, token);
const existant = clients.json?.data?.[0];
let clientId = existant?.id;
if (!clientId) {
  const creation = await appel('POST', '/clients', {
    firstName: 'Client', lastName: 'Démonstration', phone: '0000000000',
  }, token);
  tracer('POST /clients', creation);
  clientId = creation.json?.data?.id;
}

// 4. Octroi d'un prêt par tranche (20 000 XOF, tranche 1 à 30 %)
const pret = await appel('POST', '/loans', { clientId, amount: 20000 }, token);
tracer('POST /loans { amount: 20000 }', pret);
const pretId = pret.json?.data?.id;

// Éligibilité : la même tranche refuse un second prêt simultané
tracer('POST /loans (2e prêt simultané)', await appel('POST', '/loans', { clientId, amount: 20000 }, token));

// 5. Changement de devise XOF → EUR (taux de marché)
tracer('POST /settings/currency { EUR }', await appel('POST', '/settings/currency', { currency: 'EUR' }, token));
tracer('GET /loans (après conversion)', await appel('GET', '/loans', null, token));

// 6. Retour en XOF (taux de marché inverse)
tracer('POST /settings/currency { XOF }', await appel('POST', '/settings/currency', { currency: 'XOF' }, token));
tracer(`GET /loans/${pretId}`, await appel('GET', `/loans/${pretId}`, null, token));

// 7. Tableau de bord et erreurs attendues
tracer('GET /dashboard', await appel('GET', '/dashboard', null, token));
tracer('PATCH /settings { default_currency }', await appel('PATCH', '/settings', { default_currency: 'USD' }, token));

fs.writeFileSync('api-test-out.txt', sortie.join('\n\n'), 'utf8');
