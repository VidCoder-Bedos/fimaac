# PROMPT — Lot 32 : ouvrir un exercice, une seule fois et pour de vrai

> Prompt rédigé **avant** exécution, exécuté immédiatement.

## Contexte constaté (fin du point 21, exports sans usage)

Parmi les six actions restantes, `ensureFiscalYear` était la plus révélatrice.
Vérification faite :

1. elle n'était **appelée par personne** ;
2. `addCompanyWithAccess` **recopiait** son code pour créer l'exercice et les
   douze périodes — en terminant chaque période le **28** du mois
   (`endDate: ${exercise}-${m}-28`) ;
3. rien, dans aucun écran, ne permettait d'ouvrir l'exercice **suivant**.

Conséquence concrète : un dossier clôturé au 31 décembre ne pouvait plus rien
saisir l'année suivante. `resolveAccountingDate` refusait la date avec un motif
juste, mais l'utilisateur n'avait **aucun moyen** d'ouvrir l'exercice manquant —
sinon recréer le dossier.

## Spécification

| # | Exigence | Traduction |
|---|---|---|
| 1 | Une seule implémentation | `openFiscalYearIn(state, companyId, year, startMonth)` ; `ensureFiscalYear` et la création de dossier l'appellent |
| 2 | Idempotence | Un exercice déjà présent n'est pas dupliqué **et** n'écrit pas d'audit |
| 3 | Bornes | Exercice refusé hors 1990-2100 ; mois de début refusé hors 1-12 ; dossier manquant refusé |
| 4 | Dates justes | Périodes du 1er au **dernier jour réel** du mois (février bissextile compris) ; exercice décalé géré |
| 5 | Traçabilité | Ouverture auditée (`FISCAL_YEAR_OPEN`) avec l'exercice et le nombre de périodes |
| 6 | Porte de sortie | Écran Clôture : bandeau « l'exercice N n'est pas ouvert » + bouton d'ouverture |
| 7 | Pas de doublon | La création de dossier passe par le même code (fin du 28 → vraie fin de mois) |

## Livrables

- `src/lib/actions.ts` : `openFiscalYearIn`, `ensureFiscalYear` (mutation + audit),
  `addCompanyWithAccess` (appel au cœur commun), périodes à la vraie fin de mois.
- `src/pages/Accounting.tsx` : `ClosingView` reçoit le dossier et les exercices,
  affiche le prochain exercice manquant et l'ouvre en un clic.
- `src/lib/__tests__/fiscalYearOpen.test.ts` — 7 tests.

## Critères d'acceptation

1. `ensureFiscalYear(c, 2031)` → exercice du **2031-01-01** au **2031-12-31**,
   12 périodes, janvier **2031-01-31**, février **2031-02-28**.
2. Second appel → `created: false`, aucun doublon, **aucune** écriture d'audit.
3. Audit : `FISCAL_YEAR_OPEN`, message contenant l'année et « 12 périodes ».
4. `1800`, `2200`, mois `0`, dossier vide → refus.
5. Après ouverture, `resolveAccountingDate("2034-01-15")` trouve sa période.
6. Un dossier créé en 2035 obtient 12 périodes, janvier finissant le **31**.
7. Une date hors exercices reste refusée, avec le motif nommant l'année.
