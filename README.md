# LoanTrack

Application web de suivi de prêts. Permet de gérer des clients, accorder des prêts, suivre les remboursements, calculer les pénalités de retard et consulter les transactions.

## Stack

- **Frontend** : React 18 + Vite + CSS Modules
- **Backend** : Node.js + Express
- **Base de données** : MySQL (via WAMP) + Drizzle ORM
- **Tests** : Vitest

## Prérequis

- [Node.js](https://nodejs.org/) 20+
- [WAMP](https://www.wampserver.com/) 3+ (fournit MySQL 5.7/8) — **ou** [Docker Desktop](https://www.docker.com/products/docker-desktop/) (pour lancer MySQL dans un conteneur)

> WAMP démarre normalement MySQL automatiquement (port 3306). Si le service est arrêté, la commande suivante tente de le relancer (service Windows `wampmysqld64`/`wampmysqld` ou `mysqld.exe` direct) :
>
> ```powershell
> powershell -ExecutionPolicy Bypass -File scripts/db-start.ps1
> ```
>
> L'arrêt se fait avec `scripts/db-stop.ps1`.

## Installation

### 1. Cloner le dépôt

```bash
git clone <url-du-repo>
cd LoanTrack
```

### 2. Démarrer la base de données

**Option A — MySQL via WAMP (recommandé ici)**

1. Lancez WAMP (ou `scripts/db-start.ps1`) : MySQL doit répondre sur le port 3306.
2. Créez la base et l'utilisateur `loantrack` / `loantrack` (script idempotent, utilise le compte `root` — vide par défaut sous WAMP) :

   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/db-init-mysql.ps1
   ```

   Si le compte root a un mot de passe :

   ```powershell
   $env:MYSQL_ROOT_PASSWORD="votre_mot_de_passe"
   powershell -ExecutionPolicy Bypass -File scripts/db-init-mysql.ps1
   ```

   > Installations existantes : si votre base s'appelle encore `flexiloan`, gardez
   > votre `DATABASE_URL` actuelle (elle continue de fonctionner) ou migrez avec :
   > ```powershell
   > mysqldump flexiloan | mysql loantrack
   > ```

**Option B — Docker**

```bash
docker compose up -d
```

### 3. Configurer et démarrer le backend

```bash
cd server
copy .env.example .env   # (PowerShell)  ou  cp .env.example .env
npm install
npm run db:push
npm run db:seed
npm run dev
```

Le serveur écoute sur `http://localhost:3001`.

### 4. Configurer et démarrer le frontend

Dans un nouveau terminal :

```bash
cd client
copy .env.example .env   # (PowerShell)  ou  cp .env.example .env
npm install
npm run dev
```

L'application est accessible sur `http://localhost:5173`.

### 5. Se connecter

Identifiants par défaut (créés par le seed) :
- Utilisateur : `admin`
- Mot de passe : `admin123`

## Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| Le login échoue, message générique « Une erreur interne est survenue » | MySQL n'est pas démarré (port 3306 fermé) | Lancer WAMP ou `powershell -ExecutionPolicy Bypass -File scripts/db-start.ps1`, puis réessayer |
| `ECONNREFUSED ... 3306` dans les logs serveur | MySQL arrêté | Démarrer MySQL (WAMP Manager ou script db-start) |
| `Unknown database 'loantrack'` ou `Access denied for user 'loantrack'` | Base ou utilisateur non créés | `powershell -ExecutionPolicy Bypass -File scripts/db-init-mysql.ps1` |
| Erreur `Table '...' doesn't exist` | Schéma non appliqué | `cd server && npm run db:push` |
| Erreur `Identifiants incorrects` | Utilisateur non créé | `cd server && npm run db:seed` |

## Commandes disponibles

### Backend (`server/`)

| Commande           | Description                              |
|--------------------|------------------------------------------|
| `npm run dev`      | Démarre le serveur en mode développement |
| `npm run db:push`  | Applique le schéma Drizzle en base       |
| `npm run db:seed`  | Crée l'utilisateur admin par défaut      |
| `npm test`         | Lance les tests Vitest                   |

### Frontend (`client/`)

| Commande        | Description                              |
|-----------------|------------------------------------------|
| `npm run dev`   | Démarre Vite en mode développement       |
| `npm run build` | Compile pour la production               |

## Structure du projet

```
LoanTrack/
├── client/          # Application React
├── server/          # API Express
├── docker-compose.yml
└── README.md
```

Voir `.kiro/steering/structure.md` pour le détail complet de l'organisation.
