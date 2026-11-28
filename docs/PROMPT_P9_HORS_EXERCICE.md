# PROMPT — Lot 13 : écriture hors exercice (refus explicite, plus de rattachement silencieux)

> Prompt rédigé **avant** exécution, exécuté immédiatement.

## Contexte constaté (audit)

`addEntry` résolvait l'exercice et la période ainsi :

```ts
const fy = db.fiscalYears.find((f) => f.companyId === companyId);           // 1er exercice, toujours
const period = db.periods.find(p => p.companyId === companyId && p.month === month && p.year === year)
            || db.periods.find(p => p.companyId === companyId);             // 1re période, n'importe laquelle
```

Trois conséquences, toutes silencieuses :

1. une écriture datée **hors exercice** (antérieure ou postérieure) est rattachée
   à la première période du dossier — elle apparaît dans les états d'un exercice
   qu'elle ne concerne pas ;
2. le `fiscalYearId` enregistré est **toujours le premier exercice**, même quand
   la date appartient au second ;
3. le contrôle « période clôturée » porte sur la mauvaise période, donc une
   écriture peut être saisie dans un exercice clos.

`updateEntry` ne contrôle que la période, jamais l'exercice.

## Objectif

Une date comptable est **acceptée pour ce qu'elle est** : dans un exercice ouvert
dont la période est ouverte. Sinon elle est **refusée en nommant la date, les
exercices disponibles et le motif** — jamais déplacée.

## Spécification

| # | Exigence | Traduction |
|---|---|---|
| 1 | Date invalide | Refus, motif `invalid-date` |
| 2 | Exercice | Sélection de l'exercice qui **contient** la date (`startDate ≤ date ≤ endDate`), jamais le premier trouvé |
| 3 | Aucun exercice | Refus, motif `outside-fiscal-year`, avec la liste des exercices et leurs bornes |
| 4 | Exercice clôturé | Refus, motif `closed-fiscal-year` |
| 5 | Période clôturée | Refus, motif `closed-period` |
| 6 | Période absente | Dans un exercice **ouvert** : la période mensuelle est **créée** (tracée dans l'audit), plutôt que de refuser une date légitime ou de détourner une autre période |
| 7 | Action | `addEntry` et `updateEntry` utilisent la même résolution ; message d'erreur complet, jamais un échec muet |
| 8 | Écran | L'éditeur d'écriture affiche la plage autorisée et refuse la sauvegarde avec le motif, au lieu de fermer la fenêtre en perdant la saisie |
| 9 | Contrôle | `auditFiscalYearPlacement(entries, periods)` : écritures dont la période ne contient pas la date — mesure de l'héritage à corriger |

## Livrables

- `src/lib/periods.ts` — `resolveAccountingDate`, `fiscalYearFor`, `describeFiscalYears`, `auditFiscalYearPlacement`.
- `src/lib/actions.ts` — `addEntry` / `updateEntry` branchés, création de période auditée.
- `src/components/EntryEditor.tsx` — plage autorisée affichée, erreur restituée sans perdre la saisie.
- `src/lib/__tests__/periods.test.ts`.

## Critères d'acceptation

1. Date `2025-05-12` sur un dossier ouvert en 2026 → refus `outside-fiscal-year`, message contenant « 2025 » et les bornes de l'exercice.
2. Date dans un second exercice (2027) → `fiscalYearId` du second, et non du premier.
3. Période de mars clôturée → refus, message nommant « mars ».
4. Mois sans période dans un exercice ouvert → résolution `ok` avec `periodCreated: true`, puis création effective et auditée.
5. `auditFiscalYearPlacement` détecte une écriture mal placée héritée.
6. `tsc` 0, build vert, `vitest` vert.
