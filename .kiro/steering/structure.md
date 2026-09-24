# LoanTrack — Structure des dossiers et organisation des modules

## Arborescence générale

```
LoanTrack/
├── client/                  # Application React (frontend)
├── server/                  # API Express (backend)
├── docker-compose.yml       # Lance MySQL en développement (alternative à WAMP)
├── .env.example             # Variables d'environnement à copier
├── .gitignore
└── README.md
```

Le frontend et le backend sont des projets Node.js indépendants, chacun avec son propre `package.json`. Ils ne partagent pas de code source pour l'instant — si un besoin de partage émerge (validation commune par exemple), un dossier `shared/` sera ajouté et la décision documentée.

---

## Frontend — `client/`

```
client/
├── public/                  # Fichiers statiques servis tels quels (favicon, etc.)
├── src/
│   ├── main.jsx             # Point d'entrée React
│   ├── App.jsx              # Composant racine, définition du routing
│   │
│   ├── pages/               # Un fichier par page de l'application
│   │   ├── ClientsPage.jsx
│   │   ├── LoanDetailPage.jsx
│   │   └── DashboardPage.jsx
│   │
│   ├── components/          # Composants réutilisables
│   │   ├── LoanCard.jsx
│   │   ├── RepaymentForm.jsx
│   │   └── StatusBadge.jsx
│   │
│   ├── hooks/               # Custom hooks React (logique réutilisable)
│   │   └── useLoans.js
│   │
│   ├── api/                 # Fonctions d'appel à l'API backend
│   │   ├── clients.js       # ex: getClients(), createClient()
│   │   ├── loans.js         # ex: getLoan(), createLoan()
│   │   └── repayments.js    # ex: addRepayment()
│   │
│   └── utils/               # Fonctions utilitaires pures (formatage, dates)
│       └── format.js        # ex: formatFCFA(), formatDate()
│
├── index.html
├── vite.config.js
└── package.json
```

### Principes d'organisation frontend

- **`pages/`** : chaque fichier correspond à une route de l'application. Les pages orchestrent les données et les composants, elles ne contiennent pas de logique métier.
- **`components/`** : composants réutilisables entre plusieurs pages. Un composant reçoit des props et affiche des données — il ne fait pas d'appels réseau directement.
- **`api/`** : toutes les fonctions `fetch` vers le backend sont centralisées ici. Aucun `fetch` ne doit apparaître directement dans un composant ou une page.
- **`hooks/`** : custom hooks qui combinent état local et appels API quand la logique devient répétitive.
- **`utils/`** : fonctions pures sans effet de bord (pas de `fetch`, pas d'état React). Testables facilement.

---

## Backend — `server/`

```
server/
├── src/
│   ├── index.js             # Point d'entrée : crée et démarre le serveur Express
│   ├── app.js               # Configure Express (middlewares, routes)
│   │
│   ├── routes/              # Définition des routes HTTP par ressource
│   │   ├── clients.js       # GET /clients, POST /clients, GET /clients/:id
│   │   ├── loans.js         # GET /loans, POST /loans, GET /loans/:id
│   │   └── repayments.js    # POST /loans/:id/repayments
│   │
│   ├── controllers/         # Logique de traitement des requêtes
│   │   ├── clientsController.js
│   │   ├── loansController.js
│   │   └── repaymentsController.js
│   │
│   ├── services/            # Logique métier pure (calculs, règles)
│   │   └── loanService.js   # calculerMontantDu(), calculerPenalite(), determinerStatut()
│   │
│   ├── db/                  # Tout ce qui concerne la base de données
│   │   ├── index.js         # Connexion Drizzle + export du client db
│   │   ├── schema.js        # Définition des tables (clients, loans, repayments)
│   │   └── migrations/      # Fichiers de migration générés par Drizzle Kit
│   │
│   └── middlewares/         # Middlewares Express transversaux
│       ├── errorHandler.js  # Gestionnaire d'erreurs global
│       └── validate.js      # Middleware de validation Zod
│
├── .env.example
├── drizzle.config.js        # Configuration Drizzle Kit
└── package.json
```

### Principes d'organisation backend

- **`routes/`** : déclare uniquement les endpoints et appelle le contrôleur correspondant. Aucune logique ici.
- **`controllers/`** : reçoit la requête HTTP, valide les paramètres, appelle le service, renvoie la réponse. Pas de SQL ici.
- **`services/`** : contient la logique métier (calculs, règles de gestion). Ne connaît pas Express. Testable sans serveur HTTP.
- **`db/`** : tout ce qui touche à la base de données. Le schéma Drizzle y est défini, les migrations y sont stockées.
- **`middlewares/`** : comportements transversaux appliqués à plusieurs routes (validation, gestion d'erreurs).

### Flux d'une requête typique

```
Requête HTTP
  → Route (routes/)
    → Controller (controllers/)
      → Service (services/)  ←→  Base de données (db/)
    ← Controller construit la réponse
  ← Réponse HTTP
```

Ce flux est linéaire et facile à suivre. Chaque couche a une responsabilité unique.

---

## Base de données — tables principales

Trois tables sont anticipées pour la v1 :

| Table         | Rôle                                              |
|---------------|---------------------------------------------------|
| `clients`     | Informations sur les emprunteurs                  |
| `loans`       | Prêts accordés, liés à un client                  |
| `repayments`  | Remboursements effectués, liés à un prêt          |

Le schéma détaillé sera défini dans `server/src/db/schema.js` lors de la phase d'implémentation.

---

## Fichiers à la racine

| Fichier              | Rôle                                                    |
|----------------------|---------------------------------------------------------|
| `docker-compose.yml` | Démarre MySQL sur le port 3306 (WAMP recommandé en local) |
| `.env.example`       | Documente les variables attendues (DB_URL, PORT, etc.)  |
| `.gitignore`         | Exclut `node_modules`, `.env`, fichiers de build        |
| `README.md`          | Instructions d'installation et de démarrage             |
