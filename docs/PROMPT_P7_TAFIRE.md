# PROMPT — Lot 11 : TAFIRE (tableau des flux de trésorerie)

> Prompt rédigé **avant** exécution, exécuté immédiatement.

## Contexte constaté (audit)

La liasse s'arrêtait au bilan et au compte de résultat. Le **TAFIRE**, tableau
obligatoire du modèle GUDEF/SYSCOHADA révisé, manquait — alors que la page
Liasse importe déjà la **balance N-1** (`prev`) et ne s'en servait que pour le
remplissage Excel. La donnée nécessaire était donc présente, le tableau absent.

## Objectif

Produire un TAFIRE **déduit de la comptabilité**, sans aucune saisie de flux, et
le **réconcilier avec la trésorerie réelle**. Si le bouclage ne tombe pas juste,
le tableau est refusé au dépôt, pas publié avec un écart silencieux.

## Spécification

| # | Exigence | Traduction |
|---|---|---|
| 1 | Entrées | Balance N-1 (ouverture) + balance N (clôture) ; aucune autre saisie |
| 2 | CAFG | Résultat de l'exercice + variation des amortissements et provisions (dotations nettes des reprises) |
| 3 | BFR | Comptes de stocks (classe 3) et de tiers (40 à 48), **classés par le sens de leur solde** : solde débiteur = créance, créditeur = dette — sinon 419/421/443/445 sont comptés deux fois |
| 4 | Investissement | Variation des immobilisations **brutes** (net classe 2 + amortissements cumulés), présentée nette des cessions |
| 5 | Financement | Capitaux propres hors résultat (classe 13 exclue, le résultat étant déjà dans la CAFG) + dettes financières 16/17 |
| 6 | Bouclage | Trésorerie d'ouverture + zone A + zone B + zone C = trésorerie de clôture ; écart ≠ 0 → **bloquant** |
| 7 | Balance N-1 absente | Le tableau est déclaré **non calculable** avec le motif ; aucun zéro inventé, la trésorerie de clôture reste affichée |
| 8 | Traçabilité | Chaque ligne porte sa justification (`basis`) : comptes et variations d'origine |
| 9 | Diffusion | Onglet TAFIRE dans la liasse, page dédiée dans le document imprimé, feuille « TAFIRE » dans l'export XLSX — mêmes montants partout |
| 10 | Limite affichée | Cessions non isolées (pas de prix de cession dans une balance) : écrit tel quel |

## Livrables

- `src/lib/tafire.ts` — `buildTafire`, `workingCapital`, `balanceOf`, `tafireLines`.
- `src/lib/liasse.ts` — feuille « TAFIRE » dans `exportLiasseXlsx`.
- `src/components/LiassePrint.tsx` — section TAFIRE du document remis au client.
- `src/pages/Liasse.tsx` — onglet TAFIRE (compteurs, tableau, contrôles).
- `src/lib/__tests__/tafire.test.ts` — 11 tests.

## Critères d'acceptation

1. Sur un exercice construit pièce par pièce (11 tests) : CAFG 600 000, BFR 300 000 → −150 000, investissement −500 000, financement −100 000, trésorerie 500 000 → 950 000, **écart de bouclage = 0**.
2. Un flux manquant de 100 000 produit un écart de −100 000 et un contrôle **bloquant**.
3. Sans balance N-1 : `available === false`, motif explicite, aucun montant inventé.
4. Le document imprimé et le XLSX affichent les mêmes montants.
5. `tsc` 0, build vert, `vitest` vert.
