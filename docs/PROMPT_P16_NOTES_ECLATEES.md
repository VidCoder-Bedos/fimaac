# PROMPT — Lot 20 : notes clients et dettes fiscales éclatées par compte

> Prompt rédigé **avant** exécution, exécuté immédiatement.

## Contexte constaté (audit §F, point 5)

NOTE_04 affiche « Clients 15 167 298 FCFA » et NOTE_16A « Dettes fiscales et
sociales 18 570 602 FCFA », **sans dire quels comptes les composent**. Pour
vérifier une seule ligne, le réviseur doit refaire la balance à la main — et rien
ne garantit que la ligne corresponde encore à la balance après un import.

## Objectif

Chaque ligne de ces deux notes porte son **détail par compte**, produit par le
même agrégat que la ligne : la somme des détails vaut la ligne par construction,
et les comptes à solde nul ne sont pas inventés.

## Spécification

| # | Exigence | Traduction |
|---|---|---|
| 1 | Structure | `NoteRow.details` : `{ code, label, n, n1 }[]` |
| 2 | Cohérence | Les détails sont calculés par `detailOf` avec **les mêmes préfixes et le même sens** que la ligne |
| 3 | Fidélité | Aucun compte à solde nul n'est listé ; un compte absent de la ligne reste absent du détail |
| 4 | Libellés | Le libellé vient du plan comptable ; à défaut, « Compte {code} » — jamais une chaîne vide |
| 5 | Périmètre | Seules NOTE_04 et NOTE_16A sont éclatées (les autres notes n'ont pas de sous-comptes à montrer) |
| 6 | Écran | Sous-lignes indentées, en petit, sous la ligne mère, dans la liasse |
| 7 | N-1 | Le détail porte aussi la valeur N-1 quand elle existe |

## Livrables

- `src/lib/production/types.ts` (`NoteDetail`), `src/lib/notes.ts` (`detailOf`, `row` enrichi).
- `src/lib/notesAnnex.ts` (propagation), `src/pages/Liasse.tsx` (rendu indenté).
- `src/lib/__tests__/notesDetail.test.ts` — 7 tests.

## Critères d'acceptation

1. Totaux inchangés : NOTE_04 **15 167 298**, NOTE_16A **18 570 602**.
2. Somme des détails de chaque ligne = valeur de la ligne (NOTE_04 et NOTE_16A).
3. Aucun détail à zéro ; aucun code dupliqué dans une même ligne.
4. Libellés issus du plan comptable, sinon « Compte {code} ».
5. Seules NOTE_04 et NOTE_16A portent des détails.
6. Référentiel inchangé : 13 calculées, 15 à saisir, 38 au référentiel.
