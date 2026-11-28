# PROMPT — Lot 28 : les écrans vides nomment ce qui manque

> Prompt rédigé **avant** exécution, exécuté immédiatement.

## Contexte constaté (reste du point 14, audit §D)

Après le parcours d'amorçage (PR #38), restaient les écrans eux-mêmes : ils
disaient « Aucune écriture », « Aucune déclaration », « Importez une balance » —
c'est-à-dire **ce que l'utilisateur voit déjà**. Aucun ne disait *pourquoi il n'y
a rien* ni *ce qu'il faut faire avant*. Un dossier sans exercice ouvrait la
liasse sur « importez une balance » alors que le manque était ailleurs.

## Spécification

| # | Exigence | Traduction |
|---|---|---|
| 1 | Une seule vérité | Les prérequis sont les **six étapes du parcours** (aucune liste parallèle) |
| 2 | Déclaration par écran | `SCREEN_PREREQUISITES` : écritures, fiscalité, liasse, états, paie, banque, note |
| 3 | Premier manque | On nomme **une** chose à faire, pas une liste de reproches |
| 4 | Chiffré | Le message reprend l'indice du parcours (« écart de 250 », « 0 écriture ») |
| 5 | Actionnable | Un bouton mène à l'écran qui règle le manque |
| 6 | Pas de faux vide | Si tous les prérequis sont remplis, l'écran n'affiche **aucun** conseil : son vide est un vrai vide |
| 7 | Branchement | `EmptyState` accepte `next` ; écritures, déclarations, liasse câblés |

## Livrables

- `src/lib/emptyStates.ts` (`SCREEN_PREREQUISITES`, `SCREEN_LABELS`, `explainMissing`, `missingFor`).
- `src/components/ui.tsx` (`EmptyState.next` — encart ambre + bouton).
- `src/pages/Accounting.tsx`, `src/pages/Tax.tsx`, `src/pages/Liasse.tsx`.
- `src/lib/__tests__/emptyStates.test.ts` — 7 tests.

## Critères d'acceptation

1. Dossier vide, écran écritures → « Pour les écritures, il manque d'abord : l'entreprise… », lien `/app/entreprises`.
2. Dossier avec NIF mais sans exercice, écran liasse → c'est **l'exercice** qui est nommé.
3. Dossier de démonstration → `explainMissing` renvoie `null` (aucun conseil parasite).
4. Écriture déséquilibrée de 250 → l'écran liasse nomme **les contrôles** et cite 250.
5. Tous les prérequis déclarés existent dans le parcours — vérifié par test.
6. Message < 220 caractères, lien sous `/app`.

## Effet mesuré

Sept écrans vides ne laissent plus l'utilisateur devant un constat : ils nomment
la première chose qui manque, avec son chiffre et son lien.
