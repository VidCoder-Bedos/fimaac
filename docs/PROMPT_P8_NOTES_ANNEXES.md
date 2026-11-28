# PROMPT — Lot 12 : notes annexes de la liasse

> Prompt rédigé **avant** exécution, exécuté immédiatement.

## Contexte constaté (audit)

`src/lib/notes.ts` contient **38 modules de notes SYSCOHADA révisé** (calcul
complet, réconciliation, questions dérivées) et une règle explicite : *une valeur
non déterminée vaut `null`, jamais 0*. **Aucun écran ne l'appelait.** La liasse
remise au client s'arrêtait donc au bilan, au compte de résultat et, depuis la
PR #21, au TAFIRE — sans une seule note annexe, alors qu'elles sont attendues
dans le modèle GUDEF.

## Objectif

Brancher ces notes sur les balances N / N-1, les rendre lisibles et imprimables,
et **dire exactement ce qui reste à saisir à la main** — sans jamais combler un
vide par un zéro.

## Spécification

| # | Exigence | Traduction |
|---|---|---|
| 1 | Calcul | `createProdContext({ balances: { n, n1 } })` puis `computeAllNotes` : aucune formule dupliquée |
| 2 | Tri | Ordre du référentiel : numéro de note puis suffixe A / B / C |
| 3 | Statut | `calculated` = produite depuis la balance ; `to_confirm` + `MANUAL_NOTE_CODES` = à saisir |
| 4 | Variation | N − N-1 seulement si les deux existent ; sinon `null` affiché « — » |
| 5 | N-1 absente | Colonne N-1 et variations vides, signalées — aucune extrapolation |
| 6 | Indéterminé | Comptage des cellules nulles, explication de la règle « — », jamais de 0 |
| 7 | Manuelles | Liste nominative avec le motif (`missingInfo`) : engagements hors bilan, effectifs, ventilation du CA… |
| 8 | Totaux | Un total de note est la somme de ses lignes, **pas un poste du bilan** : deux notes ne s'additionnent pas |
| 9 | Diffusion | Onglet « Notes annexes », section du document imprimé, feuille XLSX — mêmes valeurs |
| 10 | Gravité | Aucun contrôle bloquant : une note manquante est une information, pas une erreur de calcul |

## Livrables

- `src/lib/notesAnnex.ts` — `buildNotesAnnex` + `AnnexNote`, `AnnexControl`, `NotesAnnex`.
- `src/pages/Liasse.tsx` — onglet « Notes annexes » (compteurs, contrôles, notes dépliables, à compléter).
- `src/components/LiassePrint.tsx` — section « Notes annexes » du document remis.
- `src/lib/liasse.ts` — feuille « Notes annexes » dans l'export XLSX.
- `src/lib/__tests__/notesAnnex.test.ts` — 7 tests.

## Critères d'acceptation

1. Sur le seed : **13 notes calculées**, **15 à compléter**, 38 au référentiel —
   dont NOTE_01 (capital), NOTE_03A/03C (immobilisations, amortissements),
   NOTE_04 (clients), NOTE_09 (fournisseurs), NOTE_16A (dettes fiscales et sociales).
2. Aucune note manuelle n'est remplie de zéros.
3. Sans balance N-1, tous les `variation` restent `null`.
4. `blockingCount === 0` dans tous les cas.
5. `tsc` 0, build vert, `vitest` vert.
