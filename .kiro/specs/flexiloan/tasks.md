# LoanTrack — Tâches d'implémentation

## Principes d'organisation

Les tâches sont regroupées par phase. Chaque phase doit être complète avant de passer à la suivante — une phase frontend ne peut pas commencer si l'API correspondante n'existe pas encore.

Chaque tâche est :
- **petite** : réalisable en une session de travail (1–3 heures) ;
- **indépendante** : elle produit quelque chose de fonctionnel ou de testable ;
- **traçable** : elle référence les requirements et le design qu'elle implémente.

Les tâches ne sont pas toutes lancées d'un coup. Elles sont exécutées une par une, avec validation entre les phases.

---

## Phase 0 — Initialisation du projet

### TASK-000 — Structure du dépôt et configuration de base
Créer l'arborescence complète du projet, initialiser Git, créer les `.gitignore`, `.env.example` et le `README.md` minimal.

**Livrable** : le dépôt est clonable et la structure des dossiers correspond à `structure.md`.

**Inclut** :
- `docker-compose.yml` pour MySQL (alternative à WAMP)
- `.gitignore` (node_modules, .env, dist, build)
- `README.md` avec les instructions de démarrage
- Dossiers vides avec `.gitkeep` : `client/`, `server/`

---

### TASK-001 — Initialisation du backend (Node.js + Express)
Initialiser le projet Node.js dans `server/`, installer les dépendances de base, créer un serveur Express minimal qui répond sur `/health`.

**Dépendances** : `express`, `dotenv`, `cors`  
**DevDépendances** : `vitest`, `nodemon`

**Livrable** : `GET /health` répond `{ "status": "ok" }`. Le serveur démarre avec `npm run dev`.

---

### TASK-002 — Initialisation du frontend (React + Vite)
Initialiser le projet Vite + React dans `client/`, installer les dépendances de base, créer la structure des dossiers `src/`.

**Dépendances** : `react`, `react-dom`, `react-router-dom`, `recharts`  
**DevDépendances** : `vite`, `@vitejs/plugin-react`

**Livrable** : `npm run dev` lance l'application sur le port 5173 avec une page d'accueil vide. Aucune dépendance CSS externe — CSS Modules est natif dans Vite.

---

### TASK-003 — Connexion à la base de données avec Drizzle
Installer Drizzle ORM et Drizzle Kit, configurer la connexion MySQL (WAMP), créer un fichier de connexion `server/src/db/index.js` et un `drizzle.config.js`.

**Dépendances** : `drizzle-orm`, `mysql2`  
**DevDépendances** : `drizzle-kit`

**Livrable** : La connexion à la base de données est établie. Un script `npm run db:push` applique le schéma.

---

## Phase 1 — Base de données et schéma

### TASK-010 — Schéma Drizzle : tables `users` et `clients`
Définir les tables `users` et `clients` dans `server/src/db/schema.js` selon le design.

**Réf. design** : section 1.2 (tables users et clients)

**Livrable** : `npm run db:push` crée les deux tables en base. Vérifiable avec un client MySQL.

---

### TASK-011 — Schéma Drizzle : tables `loans`, `repayments`, `penalty_logs`
Ajouter les tables `loans`, `repayments` et `penalty_logs` dans `schema.js`.

**Réf. design** : section 1.2 (tables loans, repayments, penalty_logs)

**Livrable** : Les trois tables sont créées avec toutes leurs contraintes (CHECK, REFERENCES, DEFAULT).

---

### TASK-012 — Schéma Drizzle : table `audit_logs`
Ajouter la table `audit_logs` dans `schema.js`.

**Réf. design** : section 1.2 (table audit_logs)

**Livrable** : La table est créée avec le champ `details` en `json` (type MySQL).

---

## Phase 2 — Logique métier (services)

### TASK-020 — Service : calculs de prêt
Créer `server/src/services/loanService.js` avec les fonctions :
- `calculerMontantsPret(niveau)` 
- `calculerPenalite(capital, joursDeRetard)`
- `determinerStatut(montantRestant, dateEcheance, dateReference)`
- `calculerSoldeRestant(totalDu, penalites, totalRembourse)`

**Réf. requirements** : REQ-LOAN-02, REQ-LOAN-03, REQ-LOAN-04, REQ-PENALTY-02  
**Réf. design** : section 2.1

**Livrable** : Les fonctions sont exportées. Aucune dépendance Express.

---

### TASK-021 — Tests unitaires : loanService
Créer `server/src/services/loanService.test.js` avec des tests Vitest couvrant :
- les trois niveaux de prêt et leurs montants calculés ;
- les cas limites de pénalité (0 jour, 1 jour, 10 jours) ;
- les transitions de statut (actif, en_retard, soldé) ;
- le calcul de solde avec et sans pénalités.

**Réf. requirements** : REQ-NFR-06

**Livrable** : `npm run test` passe avec 100% de succès sur ce fichier.

---

### TASK-022 — Service : logique client
Créer `server/src/services/clientService.js` avec :
- `peutContracterPret(loansActifs)` — vérifie qu'aucun prêt actif/en_retard n'existe
- `determinerStatutClient(loans)` — retourne 'actif' ou 'suspendu'

**Réf. requirements** : REQ-CLIENT-04, REQ-CLIENT-07  
**Réf. design** : section 2.2

**Livrable** : Fonctions exportées, testables sans base de données.

---

## Phase 3 — Authentification (backend)

### TASK-030 — Middleware et routes d'authentification
Installer `jsonwebtoken` et `bcrypt`. Créer :
- `server/src/routes/auth.js` avec `POST /auth/login`
- `server/src/middlewares/authenticate.js`
- `server/src/middlewares/validate.js`
- `server/src/middlewares/errorHandler.js`
- La classe `AppError` pour les erreurs métier

**Dépendances** : `jsonwebtoken`, `bcrypt`, `zod`

**Réf. requirements** : REQ-AUTH-01, REQ-AUTH-02, REQ-AUTH-03, REQ-AUTH-04  
**Réf. design** : sections 3.2, 4.2, 4.3, 4.4

**Livrable** : `POST /auth/login` avec des identifiants valides retourne un JWT. Un token invalide sur une route protégée retourne 401.

---

### TASK-031 — Script de seed : créer le premier gestionnaire
Créer `server/src/db/seed.js` qui insère un utilisateur par défaut (username: `admin`, password: `admin123` hashé avec bcrypt).

**Livrable** : `npm run db:seed` crée l'utilisateur en base. La connexion avec ces identifiants via `POST /auth/login` retourne un token valide.

---

## Phase 4 — API Clients (backend)

### TASK-040 — Routes et contrôleur clients : liste et création
Créer `server/src/routes/clients.js` et `server/src/controllers/clientsController.js` avec :
- `GET /clients` — liste tous les clients
- `POST /clients` — crée un client (validation Zod)

**Réf. requirements** : REQ-CLIENT-01, REQ-CLIENT-02, REQ-CLIENT-06  
**Réf. design** : section 3.2 (routes clients)

**Livrable** : Les deux routes fonctionnent, requièrent un JWT valide, et valident les données entrantes.

---

### TASK-041 — Routes clients : détail et modification
Ajouter dans le contrôleur :
- `GET /clients/:id` — retourne le client avec ses prêts (statut, solde, niveau)
- `PATCH /clients/:id` — modifie les informations du client

**Réf. requirements** : REQ-CLIENT-03, REQ-CLIENT-05

**Livrable** : `GET /clients/:id` retourne les prêts du client avec leur solde calculé dynamiquement.

---

## Phase 5 — API Prêts (backend)

### TASK-050 — Routes prêts : liste et création
Créer `server/src/routes/loans.js` et `server/src/controllers/loansController.js` avec :
- `GET /loans` — liste tous les prêts (filtres : status, client_id)
- `POST /loans` — crée un prêt (utilise `loanService.calculerMontantsPret`)

Inclut la vérification que le client peut contracter (REQ-CLIENT-07) et la journalisation (REQ-AUTH-06).

**Réf. requirements** : REQ-LOAN-01, REQ-LOAN-02, REQ-LOAN-03, REQ-CLIENT-07  
**Réf. design** : section 3.2 (routes prêts)

**Livrable** : `POST /loans` crée le prêt avec tous les montants calculés. Un client suspendu reçoit une erreur 409.

---

### TASK-051 — Route prêt : détail et annulation
Ajouter :
- `GET /loans/:id` — retourne toutes les informations du prêt (capital, intérêts, pénalités, solde, statut)
- `PATCH /loans/:id/cancel` — annule un prêt actif sans remboursements

**Réf. requirements** : REQ-LOAN-04, REQ-LOAN-05

**Livrable** : `GET /loans/:id` retourne le solde calculé en temps réel (SUM des remboursements).

---

## Phase 6 — API Remboursements et pénalités (backend)

### TASK-060 — Routes remboursements
Créer `server/src/routes/repayments.js` et `server/src/controllers/repaymentsController.js` avec :
- `GET /loans/:id/repayments` — historique des remboursements
- `POST /loans/:id/repayments` — enregistre un remboursement

Inclut la vérification anti-surpaiement (REQ-REPAY-05), la mise à jour automatique du statut du prêt (REQ-REPAY-04) et du statut du client, et la journalisation.

**Réf. requirements** : REQ-REPAY-01 à REQ-REPAY-07

**Livrable** : Un prêt passe automatiquement à `soldé` quand le solde atteint 0.

---

### TASK-061 — Routes pénalités
Créer `server/src/routes/penalties.js` et `server/src/controllers/penaltiesController.js` avec :
- `GET /loans/:id/penalties` — historique des pénalités
- `POST /loans/:id/penalties` — applique une pénalité (prêt `en_retard` uniquement)

Inclut le calcul via `loanService.calculerPenalite` et la mise à jour de `loans.penalties`.

**Réf. requirements** : REQ-PENALTY-01 à REQ-PENALTY-06

**Livrable** : Appliquer une pénalité augmente le montant total dû et le solde restant.

---

## Phase 7 — Tableau de bord (backend)

### TASK-070 — Route dashboard étendue
Créer `server/src/routes/dashboard.js` avec `GET /dashboard` qui retourne :
- KPIs : nombre de prêts par statut, montant total prêté, montant récupéré, montant restant dû ;
- évolution mensuelle : nombre de prêts créés par mois sur les 6 derniers mois ;
- répartition des statuts : count et pourcentage par statut ;
- 5 dernières opérations (remboursements et pénalités mélangés, triés par date) ;
- liste des prêts en retard avec nom du client, niveau, date d'échéance, jours de retard, solde restant.

**Réf. requirements** : REQ-DASH-01, REQ-DASH-02, REQ-DASH-03  
**Réf. design** : section 7 (format JSON de réponse)

**Livrable** : Une seule requête retourne toutes les données nécessaires au tableau de bord, y compris les données des graphiques.

---

## Phase 7b — API Transactions (backend)

### TASK-071 — Route transactions
Créer `server/src/routes/transactions.js` avec `GET /transactions` qui retourne le journal global de tous les remboursements, paginé.

Paramètres de query : `page` (défaut 1), `limit` (défaut 20), `from` (date ISO), `to` (date ISO).

Chaque entrée retourne : id, loan_id, nom du client, montant, date de paiement, solde restant après paiement.

**Réf. design** : section 7 (route Transactions)

**Livrable** : `GET /transactions?page=1&limit=20` retourne la première page du journal. La pagination fonctionne correctement.

---

## Phase 8 — Frontend : socle

### TASK-080 — Routing, AuthContext, ThemeContext et ProtectedRoute
Créer dans `client/src/` :
- `context/AuthContext.jsx` — gestion du token et de l'utilisateur courant
- `context/ThemeContext.jsx` — gestion du thème clair/sombre
- `App.jsx` — routing React Router avec toutes les routes (y compris `/transactions` et `/settings`)
- `components/ProtectedRoute.jsx` — redirige vers `/login` si non authentifié

**Réf. design** : sections 5.1, 5.2, 5.3, 6.2

**Livrable** : La navigation entre pages fonctionne. Une route protégée sans token redirige vers `/login`. Le ThemeContext lit `localStorage` au démarrage et applique `data-theme` sur `<html>`.

---

### TASK-081 — Fonctions API centralisées
Créer `client/src/api/http.js` (helper headers) et les fichiers :
- `client/src/api/auth.js` — `login()`, `logout()`
- `client/src/api/clients.js` — `getClients()`, `getClient()`, `createClient()`, `updateClient()`
- `client/src/api/loans.js` — `getLoans()`, `getLoan()`, `createLoan()`, `cancelLoan()`
- `client/src/api/repayments.js` — `getRepayments()`, `addRepayment()`
- `client/src/api/penalties.js` — `getPenalties()`, `applyPenalty()`
- `client/src/api/dashboard.js` — `getDashboardData()`
- `client/src/api/transactions.js` — `getTransactions(page, limit)`

**Réf. design** : sections 5.4, 7

**Livrable** : Tous les appels API sont centralisés. Aucune page ne contient de `fetch` direct.

---

### TASK-082 — Système de style global et Layout
Créer les fichiers de style fondamentaux et le composant de mise en page :

- `src/styles/reset.css` — reset CSS minimal (box-sizing, margin 0)
- `src/styles/theme.css` — toutes les CSS custom properties pour les thèmes clair et sombre (couleurs, statuts, typographie, espacements)
- `components/Layout/Layout.jsx` + `Layout.module.css` — mise en page avec sidebar fixe à gauche et zone de contenu à droite
- `components/Layout/Sidebar.jsx` + `Sidebar.module.css` — navigation avec logo, liens, profil utilisateur en bas, bouton switcher de thème
- Responsive : sur mobile (< 768px), la sidebar devient une barre de navigation en bas de l'écran

**Réf. design** : sections 6.1, 6.2, 6.3

**Livrable** : Le Layout s'affiche correctement en thème clair et sombre. Le switcher change le thème instantanément et persiste au rechargement. La sidebar se transforme en bottom nav sur mobile.

---

### TASK-083 — Composants partagés de base
Créer les composants réutilisables fondamentaux (chacun avec son `.module.css`) :
- `components/StatusBadge.jsx` — badge coloré pour les statuts prêt et client (utilise `--color-status-*`)
- `components/LoadingSpinner.jsx` — indicateur de chargement
- `components/ErrorMessage.jsx` — affichage d'erreur cohérent
- `components/KpiCard.jsx` — carte d'indicateur pour le tableau de bord (valeur, label, variation)
- `utils/format.js` — `formatFCFA(montant)`, `formatDate(date)`, `formatJours(n)`, `formatMois(dateStr)`

**Livrable** : Les composants utilisent exclusivement les CSS custom properties du thème — ils s'adaptent automatiquement au dark mode.

---

## Phase 9 — Frontend : authentification

### TASK-090 — Page de connexion
Créer `pages/LoginPage.jsx` avec le formulaire de connexion (username, password), gestion des erreurs et redirection après succès.

**Réf. requirements** : REQ-AUTH-01

**Livrable** : La connexion avec des identifiants valides redirige vers le dashboard. Une erreur affiche un message clair.

---

## Phase 10 — Frontend : clients

### TASK-100 — Page liste des clients
Créer `pages/ClientsPage.jsx` affichant la liste des clients avec leur statut, et un bouton vers la création.

**Réf. requirements** : REQ-CLIENT-06

**Livrable** : La liste se charge, affiche les statuts avec `StatusBadge`, et supporte le filtre actif/suspendu.

---

### TASK-101 — Page création et modification de client
Créer `pages/ClientFormPage.jsx` avec le formulaire (prénom, nom, téléphone, adresse, notes) et validation côté frontend.

**Réf. requirements** : REQ-CLIENT-01, REQ-CLIENT-03

**Livrable** : La création d'un client redirige vers sa fiche. Les erreurs de validation (téléphone déjà utilisé) sont affichées.

---

### TASK-102 — Page détail client
Créer `pages/ClientDetailPage.jsx` affichant les informations du client et la liste de ses prêts avec statut et solde.

**Réf. requirements** : REQ-CLIENT-05

**Livrable** : La fiche client est complète. Un lien « Nouveau prêt » pré-remplit le client dans le formulaire.

---

## Phase 11 — Frontend : prêts

### TASK-110 — Page liste des prêts
Créer `pages/LoansPage.jsx` affichant tous les prêts avec filtres par statut.

**Réf. requirements** : REQ-LOAN-06

**Livrable** : La liste se charge et les filtres fonctionnent.

---

### TASK-111 — Page création d'un prêt
Créer `pages/LoanFormPage.jsx` permettant de choisir le client et le niveau, et affichant le détail du calcul (capital, intérêts, montant total, date d'échéance) avant confirmation.

**Réf. requirements** : REQ-LOAN-01, REQ-LOAN-02, REQ-LOAN-03

**Livrable** : Le formulaire affiche le récapitulatif calculé à la sélection du niveau. La création redirige vers la fiche prêt.

---

### TASK-112 — Page détail d'un prêt
Créer `pages/LoanDetailPage.jsx` affichant toutes les informations du prêt : montants, statut, historique des remboursements, historique des pénalités, et les formulaires d'action (remboursement, pénalité).

**Réf. requirements** : REQ-LOAN-05, REQ-REPAY-07, REQ-PENALTY-04, REQ-PENALTY-05

**Livrable** : La page est le centre de contrôle d'un prêt. Toutes les informations sont visibles. Les actions disponibles dépendent du statut du prêt.

---

## Phase 12 — Frontend : tableau de bord

### TASK-120 — Page tableau de bord
Créer `pages/DashboardPage.jsx` + `DashboardPage.module.css` affichant :
- 4 KPI cards (prêts actifs, montant total prêté, montant récupéré, prêts en retard) via `KpiCard` ;
- courbe d'évolution mensuelle des prêts avec `LineChart` de Recharts ;
- donut de répartition des statuts avec `PieChart` de Recharts ;
- tableau des 5 dernières opérations ;
- liste des prêts en retard.

Les couleurs des graphiques lisent les CSS custom properties via `getComputedStyle` pour s'adapter au dark mode.

**Réf. requirements** : REQ-DASH-01, REQ-DASH-02, REQ-DASH-03, REQ-DASH-04  
**Réf. design** : sections 5.1, 6.4, 7

**Livrable** : Le tableau de bord est la page d'accueil après connexion. Les graphiques s'affichent correctement en thème clair et sombre.

---

## Phase 13 — Frontend : pages secondaires

### TASK-130 — Page Transactions
Créer `pages/TransactionsPage.jsx` + `TransactionsPage.module.css` affichant le journal global de tous les remboursements avec pagination et filtres de dates.

**Réf. design** : section 5.1 (TransactionsPage), section 7 (route /transactions)

**Livrable** : La page affiche les remboursements paginés. Les filtres de date fonctionnent. La pagination charge les pages suivantes.

---

### TASK-131 — Page Paramètres
Créer `pages/SettingsPage.jsx` + `SettingsPage.module.css` avec :
- section Compte : formulaire de changement de mot de passe (appel `PATCH /auth/password`) ;
- section Préférences : devise affichée (FCFA, non modifiable en v1 — affiché en lecture seule), langue (français, non modifiable en v1) ;
- section Notifications : toggles visuels persistés dans `localStorage` (pas de backend pour la v1).

**Réf. design** : section 5.1 (SettingsPage)

**Livrable** : Le changement de mot de passe fonctionne. Les toggles de notification persistent au rechargement.

### TASK-140 — Tests d'intégration des routes API critiques
Écrire des tests Vitest pour les routes :
- `POST /loans` (création avec vérification des calculs)
- `POST /loans/:id/repayments` (passage à soldé, rejet de surpaiement)
- `POST /loans/:id/penalties` (rejet si prêt non en_retard)

**Réf. requirements** : REQ-NFR-06

**Livrable** : `npm run test` passe sur tous les fichiers de test.

---

### TASK-141 — README complet
Rédiger le `README.md` final avec :
- présentation du projet
- prérequis (Node.js, Docker, Git)
- instructions d'installation en 5 étapes
- description des commandes disponibles
- captures d'écran des pages principales (à ajouter en dernier)

**Livrable** : Un développeur peut installer et démarrer le projet en suivant uniquement le README.

---

## Récapitulatif des phases

| Phase | Contenu                              | Tâches              |
|-------|--------------------------------------|---------------------|
| 0     | Initialisation                       | 000, 001, 002, 003  |
| 1     | Schéma base de données               | 010, 011, 012       |
| 2     | Services métier + tests              | 020, 021, 022       |
| 3     | Authentification backend             | 030, 031            |
| 4     | API Clients                          | 040, 041            |
| 5     | API Prêts                            | 050, 051            |
| 6     | API Remboursements + Pénalités       | 060, 061            |
| 7     | API Tableau de bord + Transactions   | 070, 071            |
| 8     | Frontend socle (routing, styles, layout) | 080, 081, 082, 083 |
| 9     | Frontend authentification            | 090                 |
| 10    | Frontend clients                     | 100, 101, 102       |
| 11    | Frontend prêts                       | 110, 111, 112       |
| 12    | Frontend tableau de bord             | 120                 |
| 13    | Frontend pages secondaires           | 130, 131            |
| 14    | Finalisation                         | 140, 141            |

**Total : 36 tâches**
