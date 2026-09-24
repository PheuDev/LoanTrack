# LoanTrack — Stack technique et choix d'outillage

## Vue d'ensemble

L'architecture est une application web classique en deux parties séparées :

- un **frontend** React servi par Vite ;
- un **backend** Node.js/Express exposant une API REST ;
- une **base de données** MySQL (via WAMP) pilotée via Drizzle ORM.

Les deux parties vivent dans le même dépôt Git (monorepo minimal), dans deux dossiers distincts : `client/` et `server/`.

---

## Frontend

| Outil       | Version cible | Rôle                                      |
|-------------|---------------|-------------------------------------------|
| React       | 18+           | Construction de l'interface utilisateur   |
| Vite        | 5+            | Serveur de développement et build         |
| JavaScript  | ES2022+       | Langage unique — pas de TypeScript        |

### Pourquoi pas TypeScript ?

Le projet est pensé pour être lisible et pédagogique. TypeScript ajoute de la valeur dans les grandes équipes ou les bases de code très larges. Ici, des noms de variables explicites et des commentaires ciblés remplissent le même rôle sans alourdir la syntaxe ni la courbe d'apprentissage.

### Styling

**Décision : CSS Modules** (natif dans Vite, zéro dépendance supplémentaire).

Chaque composant possède son propre fichier `.module.css` colocalisé. Les styles sont scopés automatiquement par Vite — pas de collision de noms entre composants. L'approche est explicite : on sait exactement quels styles s'appliquent à quel composant en lisant son fichier.

```
components/
  LoanCard.jsx
  LoanCard.module.css    ← styles de LoanCard uniquement
```

Le thème visuel (couleurs, typographie, espacements) est défini via des **CSS custom properties** dans un fichier global `src/styles/theme.css`. C'est ce fichier qui porte les deux thèmes clair et sombre.

**Pourquoi pas Tailwind ?** Tailwind aurait été plus rapide pour prototyper, mais CSS Modules est plus lisible, plus pédagogique, et ne nécessite aucune dépendance. Pour un projet de portfolio dont la lisibilité du code est un objectif premier, c'est le bon choix.

### Dark mode

Le switcher de thème clair/sombre est implémenté via :
- un attribut `data-theme="light"` ou `data-theme="dark"` sur `<html>` ;
- des CSS custom properties redéfinies selon la valeur de cet attribut dans `theme.css` ;
- la préférence est persistée dans `localStorage` ;
- le thème initial respecte `prefers-color-scheme` si aucune préférence n'est enregistrée.

```css
/* Exemple de structure dans theme.css */
:root[data-theme="light"] {
  --color-bg: #f8fafc;
  --color-surface: #ffffff;
  --color-text: #0f172a;
  --color-primary: #2563eb;
}

:root[data-theme="dark"] {
  --color-bg: #0f172a;
  --color-surface: #1e293b;
  --color-text: #f1f5f9;
  --color-primary: #3b82f6;
}
```

### Graphiques

**Décision : Recharts** pour les graphiques du tableau de bord.

Recharts est pensé pour React (composants déclaratifs), légère (~500 Ko), bien documentée. Utilisée pour :
- la courbe d'évolution des prêts (`LineChart`) ;
- le donut de répartition des statuts (`PieChart`).

**Pourquoi pas Chart.js ?** Chart.js est plus complète mais plus lourde et nécessite une manipulation impérative du canvas. Recharts est plus lisible dans un contexte React.

### Gestion d'état

Pas de Redux ni de Zustand. L'état local React (`useState`, `useReducer`) et le Context API suffisent pour ce niveau de complexité. Si un besoin de state global émerge, il sera traité au cas par cas.

### Appels API

Fetch natif du navigateur. Pas d'Axios — la dépendance supplémentaire n'est pas justifiée pour des appels REST simples.

---

## Backend

| Outil       | Version cible | Rôle                                          |
|-------------|---------------|-----------------------------------------------|
| Node.js     | 20 LTS+       | Runtime JavaScript côté serveur               |
| Express     | 4+            | Framework HTTP minimaliste                    |
| Drizzle ORM | latest stable | Accès à la base de données, migrations        |
| MySQL      | 5.7+/8 (WAMP) | Base de données relationnelle |

### Pourquoi Express et pas Fastify ou Hono ?

Express est le plus connu, le mieux documenté et le plus facile à comprendre pour quelqu'un qui apprend. L'objectif n'est pas la performance maximale mais la lisibilité. Express correspond parfaitement à cet objectif.

### Pourquoi Drizzle ORM ?

Drizzle est léger, typé en option, et produit du SQL prévisible et lisible. Contrairement à Sequelize ou Prisma, il ne cache pas ce qu'il fait. Le schéma est défini en JavaScript pur, les migrations sont explicites, et il est facile de comprendre la requête SQL générée.

### Structure des routes

Les routes Express sont organisées par ressource métier (`/clients`, `/loans`, `/repayments`). Chaque ressource a son propre fichier de routes. Pas de routeur imbriqué profond.

### Validation des entrées

Zod sera utilisé côté serveur pour valider les corps de requête. C'est la bibliothèque la plus lisible pour exprimer des règles de validation en JavaScript.

---

## Base de données

- MySQL est fourni par WAMP en développement (service Windows, port 3306).
- En production, une instance MySQL standard est utilisée.
- Les migrations sont gérées par Drizzle Kit (`drizzle-kit push` en développement, `drizzle-kit migrate` en production).
- Aucun ORM ne masque les requêtes : les requêtes Drizzle restent proches du SQL.

---

## Tests

| Outil   | Rôle                                          |
|---------|-----------------------------------------------|
| Vitest  | Tests unitaires et d'intégration              |

Les tests portent en priorité sur la **logique métier** (calculs de prêts, pénalités, statuts) et les **routes API** critiques. Pas de tests end-to-end dans un premier temps.

Les fichiers de test sont placés à côté des fichiers testés avec l'extension `.test.js`.

---

## Docker

Docker est utilisé uniquement là où il apporte une valeur réelle :

- **MySQL en développement** : fourni par WAMP ; le `docker-compose.yml` est une alternative qui lance MySQL 8 dans un conteneur.
- Le frontend et le backend ne sont pas dockerisés en développement — ils tournent directement avec Node.js pour simplifier le workflow.

Un `docker-compose.yml` à la racine suffit pour lancer la base de données.

---

## Git

- Dépôt unique contenant `client/` et `server/`.
- Branches : `main` (stable), `develop` (intégration), branches de feature nommées `feature/<nom>`.
- Commits en anglais, format conventionnel recommandé : `feat:`, `fix:`, `refactor:`, `docs:`, `test:`.

---

## Variables d'environnement

- Les variables sensibles (connexion base de données, secrets) sont stockées dans des fichiers `.env`, jamais commitées.
- Un fichier `.env.example` documente les variables attendues dans chaque partie du projet.

---

## Décisions arrêtées

Toutes les décisions techniques initiales ont été tranchées :

| Sujet                    | Décision                                                         |
|--------------------------|------------------------------------------------------------------|
| Framework CSS            | CSS Modules (natif Vite, zéro dépendance)                        |
| Dark mode                | CSS custom properties + `data-theme` sur `<html>`                |
| Graphiques               | Recharts (composants React déclaratifs)                          |
| Authentification         | JWT 8h, stocké en `localStorage` (compromis conscient pour v1)   |
| Format de réponse API    | Enveloppe `{ data }` / `{ error: { message, code } }`           |
| Refresh token            | Absent en v1 — redirection vers `/login` à expiration            |
