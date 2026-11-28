# PROMPT — Lot 17 : FEC déposé par exercice

> Prompt rédigé **avant** exécution, exécuté immédiatement.

## Contexte constaté (audit §F, point 7)

`buildFec` prenait toutes les écritures validées du dossier, sans notion
d'exercice, et `fecFileName` ne portait que la date du jour. Un dossier à deux
exercices produisait donc **un seul fichier contenant N et N-1** : impossible à
rattacher à une liasse, refusé au contrôle, et rien à l'écran ne signalait le
périmètre exporté.

## Objectif

Un fichier **par exercice**, un périmètre **visible** avant le clic, et un nom
de dépôt qui ne contient ni espace ni caractère refusé.

## Spécification

| # | Exigence | Traduction |
|---|---|---|
| 1 | Périmètre | `FecScope {label, startDate, endDate}` ; bornes **incluses** |
| 2 | Source | `fecScopeFromFiscalYear(fy)` — l'exercice comptable, pas une année civile devinée |
| 3 | Transparence | Le rapport expose `scope` et `excludedCount` : l'écran dit combien d'écritures sont écartées |
| 4 | Compatibilité | Sans périmètre, l'export reste celui de tout l'historique (aucune rupture d'appel) |
| 5 | Nom de fichier | `FEC_AAAAMMJJ_raisonSociale[_exercice].txt`, sans espace ni « & » |
| 6 | Écran | Sélecteur d'exercice sur l'onglet FEC, sous-titre « du … au … », 4e indicateur « hors exercice » |

## Livrables

- `src/lib/fec.ts` — `FecScope`, `entriesInScope`, `fecScopeFromFiscalYear`, `buildFec(…, scope)`, nom suffixé.
- `src/lib/ledger.ts` — `exportFEC(…, scope)`.
- `src/pages/Financials.tsx` — sélecteur d'exercice, périmètre affiché.
- `src/lib/__tests__/fecPeriode.test.ts` — 6 tests.

## Critères d'acceptation

1. Exercice 2026 du seed : 102 écritures, 281 lignes, Σ débit = Σ crédit = 80 951 571, 0 exclue.
2. Exercice 2025 : 0 ligne, **102 exclues** (et non un fichier vide silencieux).
3. Une écriture au 31/12/2025 et une au 01/01/2027 ne passent pas ; celles du 01/01/2026 et du 31/12/2026 passent.
4. `fecFileName("Sarl Acme & Fils", date, "Exercice 2026")` → `FEC_20261128_Sarl_Acme_Fils_Exercice_2026.txt`.
5. Sans périmètre : 102 écritures, `scope === null` — aucun appel existant ne casse.
