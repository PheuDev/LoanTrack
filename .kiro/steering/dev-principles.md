# LoanTrack — Principes de développement JavaScript

Ce fichier définit les règles de style et les principes de simplicité qui s'appliquent à tout le code du projet. L'objectif est de produire un code qu'on peut relire plusieurs semaines plus tard et comprendre immédiatement.

---

## Principe fondamental

> Un code simple n'est pas un code paresseux. C'est un code qui fait exactement ce qu'il faut faire, ni plus, ni moins, et qu'on peut comprendre sans effort.

---

## Nommage

Le nom d'une variable ou d'une fonction doit rendre son rôle évident sans avoir à lire son implémentation.

```js
// ✗ Trop vague
const d = new Date();
const calc = (a, b) => a + b;
const data = await fetch('/api/loans');

// ✓ Explicite
const dateEcheance = new Date();
const calculerMontantTotal = (capital, interets) => capital + interets;
const loans = await fetch('/api/loans');
```

- Variables et fonctions : `camelCase`
- Constantes métier fixes : `SCREAMING_SNAKE_CASE`
- Composants React : `PascalCase`
- Fichiers de composants React : `PascalCase.jsx`
- Tous les autres fichiers : `camelCase.js`

```js
// Exemples de constantes métier
const NIVEAUX_PRET = {
  1: { capital: 25000, dureeJours: 7,  tauxInteret: 0.30 },
  2: { capital: 50000, dureeJours: 10, tauxInteret: 0.25 },
  3: { capital: 75000, dureeJours: 15, tauxInteret: 0.20 },
};

const TAUX_PENALITE_JOURNALIER = 0.05;
```

---

## Fonctions

### Longueur

Une fonction fait une seule chose. Si elle dépasse 20–25 lignes, c'est un signal qu'elle fait probablement trop.

```js
// ✗ Trop long, trop de responsabilités mélangées
function traiterPret(pret, remboursements) {
  // 50 lignes qui calculent, formatent, sauvegardent ET envoient un email
}

// ✓ Chaque fonction a un rôle clair
function calculerMontantDu(capital, tauxInteret) { ... }
function calculerPenalite(capital, joursRetard) { ... }
function determinerStatut(montantRestant, dateEcheance) { ... }
```

### Paramètres

Pas plus de 3 paramètres. Au-delà, regrouper dans un objet.

```js
// ✗ Trop de paramètres positionnels
function creerPret(clientId, niveau, dateDebut, montant, statut) { ... }

// ✓ Un objet descriptif
function creerPret({ clientId, niveau, dateDebut }) { ... }
```

### Valeur de retour

Une fonction retourne toujours la même forme. Pas de `return undefined` dans un chemin et un objet dans un autre.

---

## Commentaires

Commenter le **pourquoi**, pas le **quoi**. Le code dit déjà ce qu'il fait. Le commentaire explique la raison d'un choix non évident.

```js
// ✗ Inutile — le code dit déjà ça
// On multiplie le capital par le taux
const interets = capital * tauxInteret;

// ✓ Utile — explique une règle métier
// L'intérêt est calculé une seule fois à l'octroi, pas recalculé à chaque remboursement.
// Modifier ici affecte tous les nouveaux prêts mais pas les prêts existants.
const interets = capital * tauxInteret;
```

```js
// ✓ Utile — explique pourquoi on arrondit
// On arrondit à l'entier le plus proche car les montants en FCFA ne comportent pas de centimes.
return Math.round(capital * tauxInteret);
```

---

## Gestion des erreurs

Ne jamais avaler silencieusement une erreur.

```js
// ✗ L'erreur disparaît sans laisser de trace
try {
  const result = await db.query(...);
} catch (e) {}

// ✓ On propage ou on logue explicitement
try {
  const result = await db.query(...);
} catch (error) {
  console.error('Erreur lors de la récupération des prêts :', error.message);
  throw error; // ou retourner une erreur formatée selon le contexte
}
```

Côté API, toutes les erreurs non gérées remontent au middleware `errorHandler.js` qui répond avec un format cohérent.

---

## Async / Await

Toujours utiliser `async/await` plutôt que les chaînes `.then()/.catch()`. C'est plus lisible.

```js
// ✗ Chaîne de promesses difficile à lire
getLoan(id)
  .then(loan => getRepayments(loan.id))
  .then(repayments => formatSummary(repayments))
  .catch(err => handleError(err));

// ✓ Async/await — séquentiel et lisible
async function getLoanSummary(id) {
  const loan = await getLoan(id);
  const repayments = await getRepayments(loan.id);
  return formatSummary(loan, repayments);
}
```

---

## Modules

Chaque fichier exporte ce dont les autres ont besoin, rien de plus.

```js
// ✓ Exports nommés explicites — on sait exactement ce que le fichier expose
export function calculerMontantDu(capital, tauxInteret) { ... }
export function calculerPenalite(capital, joursRetard) { ... }

// À éviter sauf pour les composants React
export default function MonComposant() { ... }
```

Pas de barrel files (`index.js` qui ré-exporte tout) sauf si la structure devient vraiment grande et que c'est justifié.

---

## Ce qu'on évite dans ce projet

| Anti-pattern                  | Pourquoi on l'évite                                                           |
|-------------------------------|-------------------------------------------------------------------------------|
| Abstractions prématurées      | On écrit d'abord le cas concret, on abstrait seulement si le besoin se répète |
| Higher-order functions partout| Utiles, mais pas systématiques. `map/filter/reduce` oui, compositions profondes non |
| Classes pour tout             | Des fonctions simples suffisent dans la majorité des cas de ce projet         |
| `any` implicite               | Même sans TypeScript, on nomme les formes de données dans les commentaires    |
| Dépendances inutiles          | Avant d'installer un package, vérifier si 10 lignes de code suffisent         |
| Magie cachée                  | Pas de métaprogrammation, pas de Proxy, pas d'introspection dynamique         |

---

## Structure d'un fichier typique

```js
// 1. Imports — du plus général au plus spécifique
import express from 'express';
import { db } from '../db/index.js';
import { calculerMontantDu } from '../services/loanService.js';

// 2. Constantes locales (si nécessaire)
const STATUT_ACTIF = 'actif';

// 3. Fonctions exportées (dans l'ordre logique d'utilisation)
export async function getLoans(req, res) { ... }
export async function getLoanById(req, res) { ... }
export async function createLoan(req, res) { ... }
```

---

## Règle d'or

Avant d'ajouter de la complexité, poser la question : **est-ce que ce projet en a vraiment besoin ?**

Si la réponse n'est pas un « oui » clair, la réponse est « non ».
