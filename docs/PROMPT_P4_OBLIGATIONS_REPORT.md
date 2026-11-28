# PROMPT — Lot 8 : échéances légales, report au jour ouvré et calendrier affiché

> Prompt rédigé **avant** exécution, exécuté immédiatement.

## Contexte constaté (audit)

`src/lib/obligations.ts` portait un catalogue de 14 obligations Togo 2026 et un
générateur d'instances **jamais appelé par aucun écran** (code mort assumé). Ses
règles de date étaient fausses ou incomplètes :

- échéance trimestrielle T4 calculée au **15 décembre** (`Math.min(dueMonth + 1, 12)`),
  au lieu du 15 janvier N+1 ;
- aucun **report** quand l'échéance tombe un week-end ou un jour férié togolais ;
- aucun jour férié togolais modélisé ;
- génération des 12 mois de l'année civile, y compris les périodes déjà passées :
  un dossier neuf affichait des dizaines de « en retard » jamais dus ;
- `generateObligationInstances` n'exposait ni fenêtre, ni date de référence.

## Objectif

Des échéances **justes**, une fenêtre glissante honnête, et un calendrier
**visible** dans le Centre des Obligations — pas un moteur de plus qui dort.

## Spécification

| # | Exigence | Traduction |
|---|---|---|
| 1 | Jours fériés | Fixes (1/1, 13/1, 27/4, 1/5, 21/6, 15/8, 1/11, 25/12) + mobiles calculés (Pâques → lundi de Pâques, Ascension, Pentecôte) |
| 2 | Report | `nextBusinessDay` : samedi, dimanche et férié → premier jour ouvré, avec le **motif** renvoyé |
| 3 | Mensuel | 15 du mois M+1, bascule d'année correcte |
| 4 | Trimestriel | 15 du mois suivant le trimestre ; **T4 → 15 janvier N+1** |
| 5 | Annuel | DAS 31/01, IS / liasse / états 31/03, TPU/TVM 31/03 de l'exercice |
| 6 | Fenêtre | `{ from, until, today }` ; par défaut 12 mois glissants à partir du mois courant ; ancien appel par `year` conservé |
| 7 | Traçabilité | `prorogatedFrom` expose la date légale reportée ; jamais de report silencieux |
| 8 | Synthèse | `summarizeObligations` : total, retard, ≤ 30 j, par organisme, nombre de reports, **limites affichées** |
| 9 | Profil | `companyProfileFrom` dérive les assujettissements de l'entreprise (TVA, salariés, transport) |
| 10 | Écran | Onglet « Calendrier légal » : 4 compteurs, sélecteur 12/24 mois, tableau groupé par mois, colonne report, carte des limites |
| 11 | Honnêteté | Aïd el-Fitr / Aïd el-Adha (calendrier lunaire) **non paramétrés** : écrit tel quel |

## Livrables

- `src/lib/obligations.ts` — `easterSunday`, `togoHolidays`, `isNonWorkingDay`,
  `nextBusinessDay`, `computeMonthly/Quarterly/AnnualDueDate`, `prorogationReason`,
  `generateObligationInstances` (fenêtré), `summarizeObligations`, `companyProfileFrom`.
- `src/pages/Obligations.tsx` — onglet « Calendrier légal » alimenté par le moteur.
- `src/lib/__tests__/obligations.test.ts` — 17 tests (fériés, reports, échéances, fenêtre, profil).

## Critères d'acceptation

1. Pâques 2024/2025/2026 exactes (31/03, 20/04, 05/04).
2. 15/08/2026 (samedi) → lundi 17/08 ; 01/05/2026 (férié) → lundi 04/05.
3. T4 2026 → 15/01/2027.
4. Une génération par défaut ne produit pas de retard antérieur au mois courant.
5. Sur une année pleine : aucune échéance générée un week-end ou un férié.
6. `vitest` vert, `tsc` 0, build vert.
