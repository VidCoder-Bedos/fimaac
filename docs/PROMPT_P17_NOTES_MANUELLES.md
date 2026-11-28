# PROMPT — Lot 21 : saisie des notes annexes manuelles

> Prompt rédigé **avant** exécution, exécuté immédiatement.

## Contexte constaté (audit §F, point 5)

15 notes du référentiel (NOTE_02 dirigeants, NOTE_18 engagements hors bilan,
NOTE_24 rémunérations des dirigeants, NOTE_26 échéances, NOTE_29/30 ventilation
du CA, NOTE_33 effectifs, NOTE_35…) ne se déduisent d'**aucune balance**. Elles
restaient « à compléter » à perpétuité : la liasse ne pouvait donc **jamais** être
déposée complète, et le cabinet n'avait aucun moyen de renseigner l'information
qu'il possède forcément (statuts, bail, registre du personnel).

## Objectif

Permettre la **saisie**, la **conserver**, la **tracer** — sans jamais confondre
une valeur fournie par un humain avec un calcul.

## Spécification

| # | Exigence | Traduction |
|---|---|---|
| 1 | Persistance | Collection `manualNotes` (DB_VERSION 5, migrée à vide) : une entrée par société × exercice × note |
| 2 | Structure | Lignes attendues issues du **référentiel** ; lignes supplémentaires du cabinet conservées |
| 3 | Vérité | Une ligne non saisie reste `null` : jamais 0, jamais une valeur déduite |
| 4 | Complétude | `isNoteComplete` : toutes les lignes attendues portent une valeur N ; `describeCompletion` dit ce qui reste |
| 5 | Traçabilité | `SAISIE_NOTE` et `SUPPR_NOTE` scellés, avec nombre de lignes renseignées et laissées vides |
| 6 | Refus | Note qui n'est pas manuelle, exercice non AAAA, saisie entièrement vide, société inconnue |
| 7 | Écran | Bouton « Saisir » / « Modifier » par note, modale avec libellés du référentiel, effacement possible |
| 8 | Séparation | `entered` / `complete` / `enteredAt` distinguent une saisie d'un calcul ; les notes calculées restent intactes |

## Livrables

- `src/lib/types.ts` (`ManualNote`, `ManualNoteRow`), `store.ts` (DB_VERSION 5), `seed.ts`.
- `src/lib/manualNotes.ts` (normalisation, fusion, complétude, totaux).
- `src/lib/notesAnnex.ts` (`manualValues`, `entered`/`complete`/`enteredAt`, contrôle enrichi).
- `src/lib/actions.ts` (`saveManualNote`, `clearManualNote`).
- `src/pages/Liasse.tsx` (`ManualNoteModal`).
- `src/lib/__tests__/manualNotes.test.ts` — 14 tests.

## Critères d'acceptation

1. Note non saisie : `entered` absent, total `null`, 15 notes manuelles.
2. Note saisie (NOTE_18, 5 000 000 + 1 000 000) : total **6 000 000**, N-1 **4 000 000**, horodatée ; les lignes attendues non saisies restent `null`.
3. « 1 250 000,4 » → **1 250 000** ; « néant » → `null` (jamais 0).
4. Deux saisies successives sur la même note : **une** entrée, mise à jour, audit `SAISIE_NOTE`.
5. Effacement : la note redevient à compléter, audit `SUPPR_NOTE`.
6. Exercices séparés : la saisie 2026 ne fuit pas sur 2025.
7. Les notes calculées ne bougent pas : NOTE_04 = 15 167 298, 13 calculées.
