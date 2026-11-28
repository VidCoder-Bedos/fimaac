# PROMPT — Lot 22 : jours fériés exceptionnels et prorogations

> Prompt rédigé **avant** exécution, exécuté immédiatement.

## Contexte constaté (audit §F, point 8)

Le moteur d'échéances connaissait les jours fixes togolais, Pâques, l'Ascension
et la Pentecôte. Il ignorait **les fêtes musulmanes** (Aïd el-Fitr, Aïd el-Adha)
et **les prorogations** décidées par l'administration : une échéance tombant ces
jours-là n'était pas reportée. Le registre portait « à paramétrer chaque année »
— sans aucun moyen de le faire.

Une date religieuse **ne se calcule pas** : la conversion du calendrier hégirien
dépend de l'observation, et une prorogation est un acte administratif. Les
deviner serait pire que les ignorer.

## Objectif

Permettre de **déclarer** ces jours, une fois leur date annoncée, et faire
qu'ils décalent réellement toutes les échéances concernées — avec le motif
affiché.

## Spécification

| # | Exigence | Traduction |
|---|---|---|
| 1 | Aucune invention | Le seed contient **zéro** jour férié ; seule une déclaration humaine en ajoute |
| 2 | Persistance | Collection `holidays` (DB_VERSION 6, migrée à vide) : date, libellé, référence, auteur, date de création |
| 3 | Moteur | `holidaysWithExtras` fusionne calendrier légal + déclarations ; `isNonWorkingDay`, `nextBusinessDay`, `computeMonthly/Quarterly/AnnualDueDate` acceptent ces extras |
| 4 | Report en chaîne | Jour férié déclaré + week-end + second jour férié → report jusqu'au premier jour ouvré |
| 5 | Périmètre | Un jour déclaré pour 2025 ne contamine pas 2026 |
| 6 | Refus | Date non ISO, libellé vide, doublon exact |
| 7 | Traçabilité | `ADD_HOLIDAY` / `REMOVE_HOLIDAY` scellés |
| 8 | Cohérence | Les déclarations TVA et IS générées utilisent le même calendrier |
| 9 | Écran | Carte de déclaration dans le Calendrier légal : date, libellé, référence, liste, retrait |

## Livrables

- `src/lib/obligations.ts` (`holidaysWithExtras`, paramètre `extras` sur 6 fonctions, `holidays` dans `GenerationOptions`).
- `src/lib/types.ts` (`Holiday`), `store.ts` (DB_VERSION 6), `seed.ts`.
- `src/lib/actions.ts` (`addHoliday`, `removeHoliday`, `holidayMonthMap`, déclarations TVA/IS alignées).
- `src/pages/Obligations.tsx` (carte de déclaration).
- `src/lib/__tests__/holidays.test.ts` — 10 tests.

## Critères d'acceptation

1. Sans déclaration : `computeMonthlyDueDate(2026, 2)` = **2026-04-15**.
2. Aïd el-Fitr déclaré le **2026-04-15** → échéance **2026-04-16**, motif « Aïd el-Fitr ».
3. Trois jours déclarés 15-16-17/04 → échéance **2026-04-20** (18-19 = week-end).
4. Échéance annuelle : 31/03/2027 déclaré férié → **2027-04-01**.
5. Une déclaration sur un samedi ne déplace rien de plus.
6. Doublon, date `20/03/2026` et libellé vide refusés ; seed vide.
