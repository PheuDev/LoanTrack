# LoanTrack — Design technique

## Introduction

Ce document traduit les requirements en décisions de conception concrètes. Il couvre le modèle de données, l'API REST, l'architecture des couches backend et frontend, et justifie chaque décision importante.

Les références `REQ-XXX-YY` renvoient au fichier `requirements.md`.

---

## 1. Modèle de données

### 1.1 Décision : montants en entiers

**Pourquoi ?** Les flottants (nombres à virgule) ont des problèmes d'arrondi en arithmétique binaire. `0.1 + 0.2 === 0.30000000000000004` en JavaScript. Pour des données financières, ce comportement est inacceptable.

**Solution choisie** : tous les montants sont stockés en FCFA entiers dans des colonnes `integer`. Pas de décimales, pas de flottants. Les calculs intermédiaires sont arrondis avec `Math.round()` avant stockage.

**Alternative écartée** : utiliser `numeric(12,2)` dans MySQL. C'est correct mais ajoute de la complexité (conversion à l'affichage, gestion de strings dans certains drivers). Pour une devise sans centimes comme le FCFA, l'entier est plus simple et tout aussi fiable.

---

### 1.2 Tables

#### Table `users`

Stocke les comptes gestionnaire. Pour la v1, un seul compte suffit mais la table est conçue pour en accueillir plusieurs.

```
users
├── id              integer PRIMARY KEY AUTO_INCREMENT
├── username        varchar(100) NOT NULL UNIQUE
├── password_hash   text NOT NULL          -- bcrypt hash
├── created_at      datetime NOT NULL DEFAULT CURRENT_TIMESTAMP  -- UTC
```

---

#### Table `clients`

```
clients
├── id              integer PRIMARY KEY AUTO_INCREMENT
├── first_name      varchar(100) NOT NULL
├── last_name       varchar(100) NOT NULL
├── phone           varchar(20) NOT NULL UNIQUE
├── address         text
├── notes           text
├── status          varchar(20) NOT NULL DEFAULT 'actif'
│                   -- valeurs : 'actif' | 'suspendu'
├── created_at      datetime NOT NULL DEFAULT CURRENT_TIMESTAMP  -- UTC
└── updated_at      datetime NOT NULL DEFAULT CURRENT_TIMESTAMP  -- UTC
```

**Pourquoi `phone` unique ?** Le téléphone est l'identifiant naturel d'un client dans le contexte des microcrédits. Évite les doublons accidentels.

**Pourquoi pas d'enum (PostgreSQL/MySQL) pour `status` ?** Les enums sont difficiles à modifier (nécessitent une migration `ALTER TYPE`/`ALTER TABLE`). Une contrainte `CHECK` sur un varchar est plus flexible et tout aussi fiable pour quelques valeurs fixes.

---

#### Table `loans`

```
loans
├── id              integer PRIMARY KEY AUTO_INCREMENT
├── client_id       integer NOT NULL REFERENCES clients(id)
├── level           integer NOT NULL CHECK (level IN (1, 2, 3))
├── principal       integer NOT NULL          -- capital en FCFA
├── interest_amount integer NOT NULL          -- intérêts calculés à l'octroi
├── total_due       integer NOT NULL          -- principal + interest_amount
├── penalties       integer NOT NULL DEFAULT 0 -- pénalités accumulées
├── status          varchar(20) NOT NULL DEFAULT 'actif'
│                   -- valeurs : 'actif' | 'en_retard' | 'solde' | 'annule'
├── start_date      date NOT NULL
├── due_date        date NOT NULL
├── created_by      integer NOT NULL REFERENCES users(id)
├── created_at      datetime NOT NULL DEFAULT CURRENT_TIMESTAMP  -- UTC
└── updated_at      datetime NOT NULL DEFAULT CURRENT_TIMESTAMP  -- UTC
```

**Pourquoi stocker `interest_amount` et `total_due` à la création ?**
Ces valeurs sont calculées une fois et ne changent jamais (REQ-LOAN-02). Les stocker évite de recalculer à chaque lecture et garantit que les données historiques restent exactes même si les taux changeaient dans le futur.

**Pourquoi `penalties` dans `loans` et pas uniquement dans `penalty_logs` ?**
C'est une dénormalisation intentionnelle : le total des pénalités actives est une valeur souvent lue. La stocker directement évite un `SUM()` à chaque affichage. La valeur est toujours recalculée depuis `penalty_logs` en cas de doute.

---

#### Table `repayments`

```
repayments
├── id              integer PRIMARY KEY AUTO_INCREMENT
├── loan_id         integer NOT NULL REFERENCES loans(id)
├── amount          integer NOT NULL CHECK (amount > 0)
├── payment_date    date NOT NULL
├── recorded_by     integer NOT NULL REFERENCES users(id)
├── created_at      datetime NOT NULL DEFAULT CURRENT_TIMESTAMP  -- UTC
```

**Pourquoi pas de colonne `balance_after` ?**
Le solde après paiement est calculé dynamiquement : `total_due + penalties - SUM(repayments.amount)`. Stocker un solde cumulatif créerait un risque d'incohérence si un remboursement était modifié. On calcule, on ne stocke pas les dérivés.

**Pourquoi les remboursements sont immuables ?** (REQ-REPAY-06)
Un registre financier fiable ne se modifie pas. Si une erreur est commise, elle se corrige par une nouvelle opération (hors scope v1), pas par réécriture.

---

#### Table `penalty_logs`

```
penalty_logs
├── id              integer PRIMARY KEY AUTO_INCREMENT
├── loan_id         integer NOT NULL REFERENCES loans(id)
├── days_overdue    integer NOT NULL
├── amount          integer NOT NULL
├── applied_date    date NOT NULL
├── applied_by      integer NOT NULL REFERENCES users(id)
├── created_at      datetime NOT NULL DEFAULT CURRENT_TIMESTAMP  -- UTC
```

Chaque ligne représente une application manuelle de pénalité par un gestionnaire. L'historique est complet et immuable.

---

#### Table `audit_logs`

Journalisation des opérations sensibles (REQ-AUTH-06).

```
audit_logs
├── id              integer PRIMARY KEY AUTO_INCREMENT
├── user_id         integer NOT NULL REFERENCES users(id)
├── action          varchar(50) NOT NULL
│                   -- ex: 'loan.create', 'repayment.add', 'penalty.apply', 'loan.cancel'
├── entity_type     varchar(50) NOT NULL   -- ex: 'loan', 'client'
├── entity_id       integer NOT NULL
├── details         json                   -- données contextuelles libres
├── created_at      datetime NOT NULL DEFAULT CURRENT_TIMESTAMP  -- UTC
```

**Pourquoi `json` pour `details` ?**
Les informations contextuelles varient selon l'action (pour un prêt : niveau, montant ; pour un remboursement : montant payé). Un champ JSON flexible évite de créer une table d'audit différente : en PostgreSQL on aurait utilisé `jsonb`, en MySQL c'est le type `json`.

---

### 1.3 Schéma relationnel (résumé)

```
users ──────────────────────────────────────────────────┐
  │                                                      │
  │ created_by / recorded_by / applied_by / user_id      │
  ▼                                                      ▼
clients ──── loans ──── repayments                  audit_logs
              │
              └──── penalty_logs
```

---

## 2. Logique métier (couche service)

Toute la logique métier vit dans `server/src/services/`. Ces fonctions ne connaissent pas Express — elles reçoivent des données et retournent des résultats. C'est ce qui les rend testables facilement.

### 2.1 `loanService.js`

```js
// Calcule les montants à l'octroi d'un prêt
calculerMontantsPret(niveau)
// Retourne : { capital, interets, montantTotalDu, dateEcheance }

// Calcule le montant d'une pénalité
calculerPenalite(capital, joursDeRetard)
// Retourne : integer (montant en FCFA)

// Détermine le statut d'un prêt à partir de ses données
determinerStatut(montantRestant, dateEcheance, dateReference)
// Retourne : 'actif' | 'en_retard' | 'solde'

// Calcule le solde restant d'un prêt
calculerSoldeRestant(totalDu, penalites, totalRembourse)
// Retourne : integer
```

**Pourquoi des fonctions séparées plutôt qu'une seule fonction `calculerEtatPret()` ?**
Chaque fonction a une responsabilité précise et peut être testée et réutilisée indépendamment. La composition est explicite dans le contrôleur, pas cachée dans une fonction monolithique.

### 2.2 `clientService.js`

```js
// Détermine si un client peut contracter un nouveau prêt
peutContracterPret(clientId, loansActifs)
// Retourne : boolean

// Détermine le statut du client selon ses prêts
determinerStatutClient(loans)
// Retourne : 'actif' | 'suspendu'
```

---

## 3. API REST

### 3.1 Décision : format de réponse uniforme

Toutes les réponses de l'API suivent le même format :

**Succès :**
```json
{ "data": { ... } }
```
ou pour les listes :
```json
{ "data": [ ... ] }
```

**Erreur :**
```json
{ "error": { "message": "Description lisible", "code": "LOAN_NOT_FOUND" } }
```

**Pourquoi une enveloppe ?** Sans enveloppe, les erreurs et les succès peuvent avoir des formes imprévisibles. L'enveloppe garantit que le frontend sait toujours où chercher les données ou le message d'erreur, quelle que soit la route.

**Pourquoi un `code` d'erreur ?** Le `message` est pour l'humain, le `code` est pour le frontend. Le frontend peut afficher un message adapté au contexte sans parser le message texte.

---

### 3.2 Routes

#### Authentification

| Méthode | Route          | Description                     | Auth requise |
|---------|----------------|---------------------------------|--------------|
| POST    | /auth/login    | Connexion, retourne un JWT      | Non          |
| POST    | /auth/logout   | Invalide le token côté client   | Oui          |

---

#### Clients

| Méthode | Route              | Description                          | Auth |
|---------|--------------------|--------------------------------------|------|
| GET     | /clients           | Liste tous les clients               | Oui  |
| POST    | /clients           | Crée un nouveau client               | Oui  |
| GET     | /clients/:id       | Détail d'un client + ses prêts       | Oui  |
| PATCH   | /clients/:id       | Modifie les informations du client   | Oui  |

**Pourquoi `PATCH` et pas `PUT` ?** `PUT` remplace entièrement la ressource. `PATCH` met à jour uniquement les champs fournis. Pour une fiche client, on veut pouvoir modifier juste le téléphone sans renvoyer tous les champs.

---

#### Prêts

| Méthode | Route              | Description                                | Auth |
|---------|--------------------|--------------------------------------------|------|
| GET     | /loans             | Liste tous les prêts (filtrables)          | Oui  |
| POST    | /loans             | Crée un nouveau prêt                       | Oui  |
| GET     | /loans/:id         | Détail complet d'un prêt                   | Oui  |
| PATCH   | /loans/:id/cancel  | Annule un prêt (statut `actif` uniquement) | Oui  |

---

#### Remboursements

| Méthode | Route                        | Description                         | Auth |
|---------|------------------------------|-------------------------------------|------|
| GET     | /loans/:id/repayments        | Historique des remboursements       | Oui  |
| POST    | /loans/:id/repayments        | Enregistre un remboursement         | Oui  |

---

#### Pénalités

| Méthode | Route                        | Description                         | Auth |
|---------|------------------------------|-------------------------------------|------|
| GET     | /loans/:id/penalties         | Historique des pénalités            | Oui  |
| POST    | /loans/:id/penalties         | Applique une pénalité               | Oui  |

---

#### Tableau de bord

| Méthode | Route          | Description                              | Auth |
|---------|----------------|------------------------------------------|------|
| GET     | /dashboard     | Indicateurs globaux et prêts en retard   | Oui  |

---

### 3.3 Codes HTTP utilisés

| Code | Signification dans ce projet                          |
|------|-------------------------------------------------------|
| 200  | Succès, données retournées                            |
| 201  | Ressource créée avec succès                           |
| 400  | Données invalides (validation échouée)                |
| 401  | Non authentifié (token absent ou expiré)              |
| 403  | Authentifié mais action non autorisée                 |
| 404  | Ressource introuvable                                 |
| 409  | Conflit (ex : client déjà suspendu, prêt déjà soldé) |
| 500  | Erreur serveur inattendue                             |

---

## 4. Architecture backend

### 4.1 Flux d'une requête

```
Requête HTTP entrante
  │
  ├─ Middleware auth (vérifie le JWT, attache req.user)
  ├─ Middleware validate (valide le body avec Zod)
  │
  ▼
Route → Controller → Service → DB
                       │
                       └─ loanService.js / clientService.js
                          (logique métier pure, sans Express)
  │
  ▼
Réponse JSON { data: ... } ou { error: ... }
```

### 4.2 Middleware d'authentification (`authenticate.js`)

Vérifie que le token JWT est présent dans `Authorization: Bearer <token>`, le décode, récupère l'utilisateur en base et l'attache à `req.user`. Si le token est absent ou invalide, répond 401.

### 4.3 Middleware de validation (`validate.js`)

Reçoit un schéma Zod en paramètre, valide `req.body` contre ce schéma. Si invalide, répond 400 avec le détail des erreurs. Exemple d'utilisation dans une route :

```js
router.post('/loans', authenticate, validate(createLoanSchema), loansController.createLoan);
```

### 4.4 Middleware de gestion d'erreurs (`errorHandler.js`)

Dernier middleware Express. Attrape toutes les erreurs propagées avec `next(error)` et renvoie une réponse JSON cohérente. Différencie les erreurs métier connues (classe `AppError`) des erreurs inattendues.

```js
// Erreur métier (ex: client suspendu)
class AppError extends Error {
  constructor(message, code, statusCode) { ... }
}
```

---

## 5. Architecture frontend

### 5.1 Pages et routing

React Router v6 gère la navigation. Les routes sont définies dans `App.jsx`.

| Route                  | Page                  | Description                                      |
|------------------------|-----------------------|--------------------------------------------------|
| `/`                    | `DashboardPage`       | Tableau de bord avec KPIs et graphiques          |
| `/clients`             | `ClientsPage`         | Liste des clients avec filtres                   |
| `/clients/new`         | `ClientFormPage`      | Formulaire création client                       |
| `/clients/:id`         | `ClientDetailPage`    | Fiche client + liste prêts                       |
| `/loans`               | `LoansPage`           | Liste des prêts avec filtres                     |
| `/loans/new`           | `LoanFormPage`        | Formulaire création prêt avec récapitulatif      |
| `/loans/:id`           | `LoanDetailPage`      | Fiche prêt + remboursements + pénalités          |
| `/transactions`        | `TransactionsPage`    | Journal global de tous les remboursements        |
| `/settings`            | `SettingsPage`        | Paramètres (compte, sécurité, notifications)     |
| `/login`               | `LoginPage`           | Formulaire de connexion (pleine page, sans nav)  |

Les routes protégées sont enveloppées dans un composant `ProtectedRoute` qui redirige vers `/login` si aucun token n'est présent.

**Page Transactions** : vue globale de tous les remboursements enregistrés dans le système, triés par date décroissante, avec nom du client, numéro de prêt, montant et date. C'est le journal financier de l'application — équivalent d'un grand livre de caisse.

**Page Paramètres** : gestion du compte gestionnaire (changement de mot de passe), préférences d'affichage (devise affichée = FCFA, langue = français pour la v1), et notifications (toggles visuels, sans backend pour la v1).

### 5.2 Gestion du token JWT

Le token JWT est stocké dans `localStorage`. C'est un compromis conscient :

- **Avantage** : simple, persistant entre les onglets, pas de configuration serveur de session.
- **Inconvénient** : vulnérable aux attaques XSS. Acceptable pour une v1 de portfolio sans données réellement sensibles.

Si le projet évoluait vers la production, il faudrait passer à un cookie `httpOnly`. Cette décision est documentée pour être révisée.

Le token est joint à chaque requête via une fonction helper dans `client/src/api/` :

```js
// client/src/api/http.js
function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}
```

### 5.3 Gestion d'état

Pas de state management global. Chaque page gère son propre état avec `useState` + `useEffect` pour les chargements. Le contexte React est utilisé uniquement pour l'état d'authentification (token + utilisateur courant) partagé entre toutes les pages, et pour le thème actif.

```js
// client/src/context/AuthContext.jsx
// Expose : user, token, login(token, user), logout()

// client/src/context/ThemeContext.jsx
// Expose : theme ('light' | 'dark'), toggleTheme()
// Persiste dans localStorage, respecte prefers-color-scheme au premier chargement
```

### 5.4 Appels API

Tous les appels réseau passent par les fonctions de `client/src/api/`. Aucun `fetch` direct dans les composants.

```js
// Structure type d'une fonction API
export async function createLoan(clientId, level) {
  const response = await fetch(`${API_BASE_URL}/loans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ clientId, level }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error.message);
  return json.data;
}
```

---

## 6. Styling : CSS Modules et dark mode

### 6.1 Organisation des fichiers de style

Chaque composant possède son fichier `.module.css` colocalisé :

```
components/
  LoanCard.jsx
  LoanCard.module.css
pages/
  DashboardPage.jsx
  DashboardPage.module.css
```

Un fichier global `src/styles/theme.css` définit les CSS custom properties communes. Il est importé une seule fois dans `main.jsx`.

```
src/styles/
  theme.css      ← variables de couleur, typographie, espacements
  reset.css      ← reset CSS minimal (box-sizing, margin 0, etc.)
```

### 6.2 Système de thème (dark/light)

Le thème est contrôlé par un attribut `data-theme` sur la balise `<html>`. Toutes les couleurs de l'application utilisent des custom properties — jamais de valeurs hardcodées dans les `.module.css`.

```css
/* src/styles/theme.css */

:root[data-theme="light"] {
  --color-bg:          #f8fafc;
  --color-surface:     #ffffff;
  --color-border:      #e2e8f0;
  --color-text:        #0f172a;
  --color-text-muted:  #64748b;
  --color-primary:     #2563eb;
  --color-primary-hover: #1d4ed8;

  /* Statuts */
  --color-status-actif:     #16a34a;
  --color-status-en-retard: #dc2626;
  --color-status-solde:     #2563eb;
  --color-status-annule:    #64748b;
}

:root[data-theme="dark"] {
  --color-bg:          #0f172a;
  --color-surface:     #1e293b;
  --color-border:      #334155;
  --color-text:        #f1f5f9;
  --color-text-muted:  #94a3b8;
  --color-primary:     #3b82f6;
  --color-primary-hover: #60a5fa;

  /* Statuts — légèrement plus clairs pour le fond sombre */
  --color-status-actif:     #22c55e;
  --color-status-en-retard: #f87171;
  --color-status-solde:     #60a5fa;
  --color-status-annule:    #94a3b8;
}
```

**Fonctionnement du ThemeContext :**
1. Au premier chargement, lit `localStorage.getItem('theme')`.
2. Si absent, détecte `prefers-color-scheme` du navigateur.
3. Applique `document.documentElement.setAttribute('data-theme', theme)`.
4. Le bouton switcher dans le `Layout` appelle `toggleTheme()`.

### 6.3 Mise en page principale (Layout)

La mise en page correspond aux maquettes : sidebar fixe à gauche, contenu principal à droite.

```
┌──────────┬───────────────────────────────┐
│          │  Header (fil d'Ariane + user) │
│ Sidebar  ├───────────────────────────────┤
│  (fixe)  │                               │
│          │   Contenu de la page          │
│          │                               │
└──────────┴───────────────────────────────┘
```

La sidebar contient : logo LoanTrack, liens de navigation, et en bas le profil du gestionnaire connecté + le bouton switcher de thème.

Sur mobile (< 768px) : la sidebar se réduit à une barre de navigation en bas de l'écran (bottom navigation), conforme aux maquettes mobiles.

### 6.4 Graphiques (Recharts)

Le tableau de bord affiche deux graphiques :

**Courbe d'évolution des prêts** (`LineChart`) :
- Axe X : les 6 derniers mois
- Axe Y : nombre de prêts créés par mois
- Données fournies par `GET /dashboard`

**Donut de répartition des statuts** (`PieChart` avec `innerRadius`) :
- Segments : actif (bleu), en retard (rouge), soldé (vert)
- Légende à droite avec pourcentages

Les couleurs des graphiques utilisent les CSS custom properties via des variables JavaScript lues au rendu — ce qui assure la cohérence avec les thèmes clair/sombre.

---

## 7. API supplémentaire — Transactions et Dashboard étendu

### Route Transactions

| Méthode | Route          | Description                                         | Auth |
|---------|----------------|-----------------------------------------------------|------|
| GET     | /transactions  | Journal global de tous les remboursements (paginé)  | Oui  |

Paramètres de query optionnels : `page` (défaut 1), `limit` (défaut 20), `from` (date), `to` (date).

Retourne pour chaque entrée : id, loan_id, client (prénom + nom), montant, date, solde restant après paiement.

### Route Dashboard — données graphiques

`GET /dashboard` est étendu pour inclure :

```json
{
  "data": {
    "kpis": {
      "loansActifs": 24,
      "montantTotalPrete": 1450000,
      "montantRecupere": 1032500,
      "loansEnRetard": 5
    },
    "evolutionMensuelle": [
      { "mois": "2025-04", "count": 8 },
      { "mois": "2025-05", "count": 12 }
    ],
    "repartitionStatuts": [
      { "statut": "actif", "count": 14, "pourcentage": 58 },
      { "statut": "en_retard", "count": 5, "pourcentage": 21 },
      { "statut": "solde", "count": 5, "pourcentage": 21 }
    ],
    "dernieresOperations": [ ... ],
    "pretsEnRetard": [ ... ]
  }
}
```

---

## 8. Décisions arrêtées

| Sujet                    | Décision                                                         |
|--------------------------|------------------------------------------------------------------|
| Framework CSS            | CSS Modules (natif Vite, zéro dépendance)                        |
| Dark mode                | CSS custom properties + `data-theme` + ThemeContext              |
| Graphiques               | Recharts (LineChart + PieChart)                                  |
| Authentification         | JWT 8h, stocké en `localStorage` (compromis conscient pour v1)   |
| Format de réponse API    | Enveloppe `{ data }` / `{ error: { message, code } }`           |
| Refresh token            | Absent en v1 — redirection vers `/login` à expiration            |
| Page Transactions        | Journal global des remboursements, paginé                        |
| Page Paramètres          | Compte + préférences visuelles (notifications : UI seulement v1) |
| Responsive               | Sidebar → bottom nav sur mobile (< 768px)                        |

---

## 9. Variables d'environnement

### `server/.env.example`

```
DATABASE_URL=mysql://loantrack:loantrack@localhost:3306/loantrack
PORT=3001
JWT_SECRET=change_this_to_a_long_random_string
JWT_EXPIRES_IN=8h
NODE_ENV=development
```

### `client/.env.example`

```
VITE_API_BASE_URL=http://localhost:3001
```

---

## 10. Docker Compose

Le `docker-compose.yml` à la racine lance uniquement MySQL (alternative à WAMP). Le frontend et le backend tournent directement avec Node.js en développement.

```yaml
services:
  mysql:
    image: mysql:8
    environment:
      MYSQL_ROOT_PASSWORD: loantrack
      MYSQL_DATABASE: loantrack
      MYSQL_USER: loantrack
      MYSQL_PASSWORD: loantrack
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql

volumes:
  mysql_data:
```

**Pourquoi MySQL 8 ?** Sur cette machine, MySQL est livré par WAMP (service Windows, port 3306) — c'est l'environnement recommandé. Docker reste une alternative pour ceux qui ne veulent pas installer WAMP.
