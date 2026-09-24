# LoanTrack — Requirements

## Introduction

Ce document liste les exigences fonctionnelles et non-fonctionnelles de LoanTrack. Il sert de référence lors du design et de l'implémentation : toute fonctionnalité construite doit être traçable vers une exigence listée ici.

Les exigences sont numérotées pour faciliter leur référence dans les autres documents.

---

## 1. Authentification et sécurité

### REQ-AUTH-01 — Connexion par identifiants
Le système doit permettre à un gestionnaire de se connecter avec un nom d'utilisateur et un mot de passe.

### REQ-AUTH-02 — Protection par token JWT
Après connexion, le serveur émet un token JWT. Toutes les routes API (sauf `/auth/login`) doivent exiger ce token dans l'en-tête `Authorization: Bearer <token>`.

### REQ-AUTH-03 — Durée de vie du token
Le token JWT expire après 8 heures. Le gestionnaire doit se reconnecter à expiration.

### REQ-AUTH-04 — Stockage sécurisé du mot de passe
Les mots de passe ne sont jamais stockés en clair. Ils sont hachés avec bcrypt avant insertion en base.

### REQ-AUTH-05 — Validation côté serveur
Toutes les données reçues par l'API sont validées côté serveur, indépendamment de toute validation frontend. Un appel API direct contournant le frontend doit toujours être rejeté si les données sont invalides.

### REQ-AUTH-06 — Journalisation des opérations sensibles
Les opérations suivantes sont enregistrées avec leur auteur, leur date et leur résultat :
- création d'un prêt ;
- enregistrement d'un remboursement ;
- application d'une pénalité ;
- annulation d'un prêt.

---

## 2. Gestion des clients

### REQ-CLIENT-01 — Création d'un client
Le gestionnaire peut créer un client en renseignant :
- prénom et nom (obligatoires) ;
- numéro de téléphone (obligatoire, unique) ;
- adresse (optionnelle) ;
- une note libre (optionnelle).

### REQ-CLIENT-02 — Identifiant unique
Chaque client reçoit un identifiant unique généré automatiquement par la base de données.

### REQ-CLIENT-03 — Modification d'un client
Le gestionnaire peut modifier les informations d'un client existant, sauf son identifiant.

### REQ-CLIENT-04 — Statut d'un client
Un client a un statut parmi :
- `actif` : peut contracter un nouveau prêt ;
- `suspendu` : ne peut pas contracter de nouveau prêt (prêt en retard non soldé).

La suspension est automatique : un client dont l'un des prêts passe au statut `en_retard` est automatiquement suspendu. Il retrouve le statut `actif` dès que tous ses prêts en retard sont soldés.

### REQ-CLIENT-05 — Consultation d'un client
La fiche client affiche :
- ses informations personnelles ;
- son statut actuel ;
- la liste de tous ses prêts avec leur statut et leur solde restant.

### REQ-CLIENT-06 — Liste des clients
Le gestionnaire peut consulter la liste de tous les clients avec possibilité de filtrer par statut (`actif` / `suspendu`).

### REQ-CLIENT-07 — Contrainte de prêt unique actif
Un client ne peut pas avoir deux prêts simultanément au statut `actif` ou `en_retard`. Un nouveau prêt ne peut être créé que si le client n'a aucun prêt en cours.

---

## 3. Gestion des prêts

### REQ-LOAN-01 — Création d'un prêt
Le gestionnaire peut accorder un prêt à un client en sélectionnant :
- le client (identifié par son ID) ;
- le niveau du prêt (1, 2 ou 3).

La date de début est la date du jour au moment de la création.

### REQ-LOAN-02 — Calcul automatique à l'octroi
À la création, le système calcule et enregistre automatiquement et de manière irrévocable :
- le capital selon le niveau choisi ;
- les intérêts = capital × taux du niveau ;
- le montant total dû = capital + intérêts ;
- la date d'échéance = date de début + durée du niveau en jours.

Ces valeurs ne changent plus après création. Seules les pénalités et les paiements évoluent.

### REQ-LOAN-03 — Niveaux de prêt
Les trois niveaux sont des constantes métier immuables :

| Niveau | Capital     | Durée    | Taux  |
|--------|-------------|----------|-------|
| 1      | 25 000 FCFA | 7 jours  | 30 %  |
| 2      | 50 000 FCFA | 10 jours | 25 %  |
| 3      | 75 000 FCFA | 15 jours | 20 %  |

### REQ-LOAN-04 — Statut d'un prêt
Un prêt a exactement un statut parmi :
- `actif` : en cours, dans les délais ;
- `en_retard` : date d'échéance dépassée et montant non soldé ;
- `soldé` : montant restant = 0 ;
- `annulé` : annulé avant tout remboursement.

Les transitions autorisées sont :
- `actif` → `en_retard` (automatique, à la détection du dépassement d'échéance) ;
- `actif` → `soldé` (automatique, quand le solde atteint 0) ;
- `en_retard` → `soldé` (automatique, quand le solde atteint 0) ;
- `actif` → `annulé` (manuel, gestionnaire uniquement, interdit si des paiements ont été effectués).

### REQ-LOAN-05 — Consultation d'un prêt
La fiche prêt affiche en temps réel :
- capital, intérêts, pénalités ;
- montant total dû (capital + intérêts + pénalités) ;
- montant déjà payé ;
- montant restant ;
- date de début, date d'échéance ;
- nombre de jours de retard (si applicable) ;
- statut.

### REQ-LOAN-06 — Liste des prêts
Le gestionnaire peut consulter tous les prêts avec filtres par statut et par client.

### REQ-LOAN-07 — Montants stockés en entiers
Tous les montants financiers sont stockés en **entiers (FCFA entier)**, sans décimales, pour éviter les erreurs d'arrondi des flottants. Les calculs intermédiaires sont arrondis à l'entier le plus proche avant stockage.

---

## 4. Remboursements

### REQ-REPAY-01 — Enregistrement d'un remboursement
Le gestionnaire peut enregistrer un remboursement sur un prêt `actif` ou `en_retard`. Un remboursement nécessite :
- le montant payé (entier positif, en FCFA) ;
- la date de paiement (par défaut : date du jour, modifiable).

### REQ-REPAY-02 — Remboursements partiels autorisés
Un prêt peut recevoir plusieurs remboursements partiels successifs. Il n'y a pas de montant minimum par remboursement.

### REQ-REPAY-03 — Mise à jour du solde
Après chaque remboursement, le solde restant est recalculé :
```
soldeRestant = montantTotalDu − totalRembourse
```
où `totalRembourse` est la somme de tous les remboursements enregistrés sur ce prêt.

### REQ-REPAY-04 — Passage automatique au statut soldé
Dès que `soldeRestant ≤ 0`, le prêt passe automatiquement au statut `soldé` et le client retrouve le statut `actif` si ce prêt était la cause de sa suspension.

### REQ-REPAY-05 — Interdiction de surpayer
Un remboursement ne peut pas dépasser le montant restant dû. Le serveur rejette tout remboursement qui porterait le solde en dessous de zéro.

### REQ-REPAY-06 — Historique immuable
Un remboursement enregistré ne peut pas être modifié ni supprimé. En cas d'erreur, le gestionnaire doit contacter un administrateur (hors scope v1).

### REQ-REPAY-07 — Historique consultable
La liste de tous les remboursements d'un prêt est consultable, avec pour chaque entrée : date, montant, solde restant après paiement.

---

## 5. Pénalités de retard

### REQ-PENALTY-01 — Déclenchement manuel
L'application des pénalités est à la discrétion du gestionnaire. Elles ne sont pas calculées ni appliquées automatiquement.

### REQ-PENALTY-02 — Formule de calcul
```
pénalité = capital × 0.05 × nombreDeJoursDeRetard
```
Le nombre de jours de retard est calculé depuis la date d'échéance jusqu'à la date du jour (ou la date choisie par le gestionnaire).

### REQ-PENALTY-03 — Application de la pénalité
Quand le gestionnaire applique une pénalité, le montant calculé est ajouté aux pénalités totales du prêt, ce qui augmente le montant total dû et donc le solde restant.

### REQ-PENALTY-04 — Historique des pénalités
Chaque application de pénalité est enregistrée avec : date d'application, nombre de jours pris en compte, montant appliqué.

### REQ-PENALTY-05 — Transparence du calcul
L'interface affiche le détail du calcul avant confirmation : capital, taux journalier, nombre de jours, montant résultant.

### REQ-PENALTY-06 — Prêt concerné
Les pénalités ne peuvent être appliquées qu'à un prêt au statut `en_retard`.

---

## 6. Tableau de bord

### REQ-DASH-01 — Indicateurs globaux
Le tableau de bord affiche :
- nombre total de prêts actifs ;
- nombre total de prêts en retard ;
- nombre total de prêts soldés ;
- montant total du capital prêté (tous prêts confondus) ;
- montant total récupéré (somme de tous les remboursements) ;
- montant total encore dû (somme des soldes restants des prêts non soldés).

### REQ-DASH-02 — Liste des prêts en retard
Le tableau de bord affiche la liste des prêts en retard avec : nom du client, niveau, date d'échéance, nombre de jours de retard, solde restant.

### REQ-DASH-03 — Prêts récents
Le tableau de bord affiche les 5 derniers prêts créés.

### REQ-DASH-04 — Actualisation des données
Les données du tableau de bord sont chargées à chaque visite de la page. Pas de rafraîchissement automatique en temps réel (pas de WebSocket).

---

## 7. Exigences non-fonctionnelles

### REQ-NFR-01 — Lisibilité du code
Le code doit pouvoir être compris par un développeur junior après quelques minutes de lecture. Voir `dev-principles.md`.

### REQ-NFR-02 — Fiabilité des calculs financiers
Tous les calculs financiers (intérêts, pénalités, soldes) sont effectués côté serveur. Le frontend n'affiche que ce que le serveur renvoie — il ne recalcule pas.

### REQ-NFR-03 — Cohérence des données
Les transitions de statut (prêt, client) sont gérées côté serveur dans les services métier. Elles ne peuvent pas être contournées par un appel API direct.

### REQ-NFR-04 — Gestion des erreurs
L'API renvoie des messages d'erreur clairs et cohérents. L'interface affiche ces messages à l'utilisateur de manière compréhensible.

### REQ-NFR-05 — Environnement reproductible
Le projet démarre en moins de 5 commandes à partir d'un environnement vierge disposant de Node.js, Docker et Git.

### REQ-NFR-06 — Tests de la logique métier
Les fonctions de calcul (`calculerMontantDu`, `calculerPenalite`, `determinerStatut`) sont couvertes par des tests unitaires Vitest.
