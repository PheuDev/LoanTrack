# LoanTrack — Contexte produit

## Vision

LoanTrack est une application web de suivi de prêts. Elle permet à un gestionnaire de :

- enregistrer des clients et leur accorder des prêts ;
- suivre l'état des remboursements en temps réel ;
- calculer automatiquement les intérêts, pénalités et montants restants ;
- consulter l'historique complet des opérations sur chaque prêt.

L'objectif est de disposer d'un outil fiable, lisible et évolutif, utilisable comme référence de portfolio professionnel.

---

## Niveaux de prêt

Trois niveaux de prêt sont disponibles. Chaque niveau définit un montant fixe, une durée en jours et un taux d'intérêt appliqué au capital.

| Niveau | Capital     | Durée   | Taux d'intérêt |
|--------|-------------|---------|----------------|
| 1      | 25 000 FCFA | 7 jours | 30 %           |
| 2      | 50 000 FCFA | 10 jours| 25 %           |
| 3      | 75 000 FCFA | 15 jours| 20 %           |

### Calcul du montant total dû à l'octroi

```
montantDû = capital + (capital × tauxIntérêt)
```

Exemple (niveau 1) :
```
montantDû = 25 000 + (25 000 × 0.30) = 32 500 FCFA
```

---

## Remboursements

- Les remboursements partiels sont autorisés.
- Chaque remboursement est enregistré avec sa date, son montant et son auteur.
- Le système déduit chaque paiement du montant restant dû.

---

## Pénalités de retard

- Une pénalité de **5 % du capital par jour de retard** peut être appliquée.
- Le déclenchement de la pénalité est à la discrétion du gestionnaire (elle n'est pas automatique).
- Les pénalités s'accumulent jour après jour à partir de la date d'échéance dépassée.

### Calcul de la pénalité

```
pénalité = capital × 0.05 × nombreDeJoursDeRetard
```

---

## Informations suivies par prêt

Pour chaque prêt, le système doit permettre de connaître à tout moment :

| Information       | Description                                         |
|-------------------|-----------------------------------------------------|
| Capital           | Montant emprunté à l'origine                        |
| Intérêts          | Montant des intérêts calculés à l'octroi            |
| Pénalités         | Total des pénalités accumulées                      |
| Montant total dû  | Capital + intérêts + pénalités                      |
| Montant déjà payé | Somme de tous les remboursements effectués          |
| Montant restant   | Montant total dû − montant déjà payé                |
| Date d'échéance   | Date de début + durée du niveau                     |
| Statut            | État actuel du prêt (voir section suivante)         |

---

## Statuts d'un prêt

| Statut     | Signification                                                      |
|------------|--------------------------------------------------------------------|
| `actif`    | Prêt en cours, dans les délais                                     |
| `en_retard`| Date d'échéance dépassée, montant non soldé                        |
| `soldé`    | Montant restant = 0, prêt entièrement remboursé                    |
| `annulé`   | Prêt annulé avant tout remboursement (cas exceptionnel)            |

La transition de `actif` vers `en_retard` se fait automatiquement dès que la date d'échéance est dépassée et que le prêt n'est pas soldé.

---

## Acteurs du système

Pour cette première version, un seul rôle est prévu :

- **Gestionnaire** : accès complet à toutes les fonctionnalités (créer des clients, octroyer des prêts, enregistrer des remboursements, appliquer des pénalités, consulter les historiques).

L'authentification multi-rôles pourra être ajoutée dans une version future si besoin.

---

## Glossaire

| Terme         | Définition                                                                 |
|---------------|----------------------------------------------------------------------------|
| Capital       | Montant du prêt accordé, avant intérêts                                    |
| Échéance      | Date limite à laquelle le prêt doit être entièrement remboursé             |
| Intérêt       | Coût du crédit, calculé une seule fois à l'octroi                          |
| Pénalité      | Majoration appliquée en cas de retard de remboursement                     |
| Remboursement | Paiement partiel ou total effectué par le client sur un prêt               |
| Solde         | Montant encore dû sur un prêt à un instant donné                           |
| Niveau        | Catégorie de prêt définissant capital, durée et taux                       |
| FCFA          | Franc CFA — devise utilisée dans le système                                |
