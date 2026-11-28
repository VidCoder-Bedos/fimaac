# PROMPT — Lot 24 : réintégrations proposées depuis la balance

> Prompt rédigé **avant** exécution, exécuté immédiatement.

## Contexte constaté (audit §F, point 11, reste)

Les réintégrations étaient saisissables (PR #25) mais **à saisir de mémoire** : il
fallait savoir que les pénalités fiscales (647) et les dons (6582/6583) ne sont
pas déductibles, retrouver leurs montants dans la balance, puis recopier le total
– trois occasions de se tromper, et aucune trace de l'origine du montant.

## Objectif

**Signaler** les comptes de nature en principe non déductible, avec leur montant
et leur raison, puis laisser la décision au fiscaliste — qui reste tracée.

Rien n'est décidé à sa place : un compte proposé n'est **pas** une réintégration.

## Spécification

| # | Exigence | Traduction |
|---|---|---|
| 1 | Catalogue court | `SUGGESTION_RULES` : 647 (pénalités et amendes), 6582/6583/835 (dons et mécénat), 6581 (jetons de présence) |
| 2 | Montants | Somme des soldes débiteurs des comptes concernés ; un compte soldé ne produit rien |
| 3 | Silence | Aucun montant nul, aucun compte créditeur, aucune proposition sans compte mouvementé |
| 4 | Une seule fois | Un retraitement repris porte `suggestionId` : il n'est plus proposé pour le même exercice |
| 5 | Exercice | La reprise vaut pour un exercice, pas pour les autres |
| 6 | Décision humaine | Rien n'est enregistré sans clic ; la saisie libre reste possible et n'est pas marquée « reprise » |
| 7 | Traçabilité | L'audit mentionne « proposition … reprise » et conserve montant + référence d'origine |
| 8 | Transparence | Chaque proposition affiche sa raison et ses comptes ; le pied de bloc rappelle que la déductibilité dépend des pièces |

## Livrables

- `src/lib/taxSuggestions.ts` (catalogue, `suggestAdjustments`, `describeSuggestions`).
- `src/lib/types.ts` (`TaxAdjustment.suggestionId`), `actions.ts` (propagation + audit).
- `src/pages/Tax.tsx` (bloc « Réintégrations proposées » dans les retraitements).
- `src/lib/__tests__/taxSuggestions.test.ts` — 9 tests.

## Critères d'acceptation

1. Balance avec 6471 = 150 000, 6473 = 50 000, 6582 = 200 000 → proposition « pénalités » **200 000** (2 comptes) et « dons » **200 000**.
2. Compte soldé (100 000 débit / 100 000 crédit) → **aucune** proposition.
3. Après reprise, la proposition est marquée `alreadyRecorded` pour 2026 et pas pour 2025.
4. La saisie libre d'une charge non justifiée n'a pas de `suggestionId`.
5. Le seed n'invente rien : `taxAdjustments` vide, aucun compte concerné mouvementé.
