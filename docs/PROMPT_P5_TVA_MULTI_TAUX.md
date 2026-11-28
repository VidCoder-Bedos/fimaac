# PROMPT — Lot 9 : TVA à taux multiples (18 %, 9 %, exonéré)

> Prompt rédigé **avant** exécution, exécuté immédiatement.

## Contexte constaté (audit)

Le moteur fiscal (`fiscalite.ts`) ne connaît qu'**un taux** : `TvaParams.rate`
vaut 18 % partout, la base HT est déduite de `TVA collectée / 18`, et la grille
TVA affiche un seul bloc. Pour une entreprise mixte (ventes taxables à 18 %,
prestations à 9 %, exportations exonérées), le net déclaré est faux et le crédit
de TVA devient inexploitable. Le modèle de données, lui, le permettait déjà :
`TaxRuleV2` (type `vat`, `rate`) et `JournalEntryLine.taxCode`.

## Objectif

Une ventilation **lue dans la comptabilité**, pas saisie à la main : base HT et
TVA par taux, écart au théorique, TVA déductible isolée (dont immobilisations),
et un jeu de contrôles qui dit quelles écritures ne portent pas de code taxe.

## Spécification

| # | Exigence | Traduction |
|---|---|---|
| 1 | Résolution du taux | (a) code taxe de la ligne (`TVA18`, `TVA9`, `EXO`, `18`, `9.5`) ; (b) sinon taux **effectif** `TVA / base`, rattaché au taux paramétré le plus proche à 0,5 point ; (c) sinon exonération **constatée** |
| 2 | Base | Crédits − débits des comptes 70x de l'écriture validée |
| 3 | TVA collectée | Crédits − débits des comptes 443x de la même écriture |
| 4 | Déductible | Débits − crédits des 445x, dont 4451 pour les immobilisations (non ventilé par taux : il n'en dépend pas) |
| 5 | Taux paramétrés | 18 % et 9 % par défaut + 0 %, surchargeables ; taux inconnu → écarté de la grille mais **signalé**, jamais perdu |
| 6 | Contrôles | cohérence base × taux, codes inconnus, taux déduits, taux hors grille, ventes sans TVA, facture à deux taux, déductible/immobilisations |
| 7 | Périmètre | Écritures `validated` uniquement |
| 8 | Écran | Onglet « Grille TVA » : tableau des tranches, totaux, contrôles statués, note sur la déductible |

## Livrables

- `src/lib/tvaVentilation.ts` — `ventilateVat`, `rateFromTaxCode`, `snapRate`.
- `src/pages/Tax.tsx` — ventilation insérée sous la grille TVA existante.
- `src/lib/__tests__/tvaVentilation.test.ts` — 12 tests.

## Critères d'acceptation

1. Sur le seed : base **20 190 000**, TVA collectée **3 634 200**, déductible
   **1 160 868** (dont **576 000** d'immobilisations), net **2 473 332** —
   exactement les montants du moteur fiscal existant.
2. Une vente à 9 % codée `TVA9` tombe dans la tranche 9 %, pas dans 18 %.
3. Une vente sans TVA est traitée comme exonérée et **nommée** dans le contrôle.
4. Une facture mêlant deux taux est signalée.
5. `tsc` 0, build vert, `vitest` vert.
