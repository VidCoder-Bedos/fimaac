# PROMPT — Lot 29 : moteurs dormants, branchés ou archivés

> Prompt rédigé **avant** exécution, exécuté immédiatement.

## Contexte constaté (audit §F, point 20)

L'audit listait quatre « moteurs encore dormants ». Vérification faite **sur
l'import réel** (et non sur la renommée du fichier) :

| Module | Importé par | Verdict |
|---|---|---|
| `obligations.generateObligationInstances` | `pages/Obligations.tsx` | **branché** (l'audit était périmé) |
| `notes` | `actions.ts`, `liasseFiller` | **branché** |
| `liasseEngine` | Liasse, Ateliers, analytics, liveCoherence | **branché** |
| `declarationEngine` (440 l.) | personne | dormant |
| `financialStatements` (369 l.) | personne | dormant |
| `liasseFiller` (267 l.) | personne | dormant |
| `formulaRegistry` (244 l.) | personne | dormant |

1 320 lignes compilaient, passaient la revue de types, et **ne s'exécutaient
jamais**. Le pire des deux mondes : on croit avoir deux moteurs, on n'en a qu'un,
et personne ne sait lequel fait foi.

## Décision, module par module

Aucune suppression en bloc, aucun branchement de complaisance :

- `declarationEngine` → **archivé** : il doublerait `generateTvaDeclaration` /
  `generateIsDeclaration`, avec un autre modèle de traçabilité.
- `financialStatements` → **archivé** : second moteur de bilan et de résultat,
  face à `liasseEngine` + `lib/liasse` qui produisent les montants affichés.
- `liasseFiller` → **archivé** : pipeline concurrent de `fillStateTemplate`.
- `formulaRegistry` → **archivé** : registre documentaire, jamais branché ; il
  reste utile à relire, donc il est conservé comme documentation.

**Pourquoi archiver plutôt que supprimer** : ces fichiers portent des
correspondances qui ont coûté du travail. **Pourquoi archiver plutôt que
brancher** : deux moteurs qui calculent la même chose produisent deux vérités —
et l'écran finit par afficher celle qui n'a pas été testée.

## Spécification

| # | Exigence | Traduction |
|---|---|---|
| 1 | Décision visible | En-tête `ARCHIVÉ` dans chaque fichier : ce qu'il faisait, son remplaçant, comment le réactiver |
| 2 | Notice | `src/lib/archive/README.md` : tableau module → lignes → remplaçant |
| 3 | Compilation | Les modules archivés restent typés (imports réécrits vers `../`) — on archive, on ne casse pas |
| 4 | Garde-fou | Test qui échoue si un module archivé est importé depuis `src/` (import statique **ou** dynamique) |
| 5 | Pas de dépotoir | L'archive ne contient **que** les modules décidés : y déposer un fichier fait échouer le test |
| 6 | Cohérence documentaire | Le registre renvoie vers la décision, il ne laisse pas croire à un oubli |

## Livrables

- `src/lib/archive/{declarationEngine,financialStatements,liasseFiller,formulaRegistry}.ts` (déplacés, en-têtes ajoutés).
- `src/lib/archive/README.md`.
- `src/lib/__tests__/archive.test.ts` — 5 tests (dont résolution réelle des imports).
- `docs/RESTE_A_FAIRE.md` : point 20 clos avec le détail.

## Critères d'acceptation

1. Aucun fichier de `src/` (hors archive) n'importe un module archivé — vérifié par balayage réel du système de fichiers.
2. L'archive contient exactement les quatre modules décidés.
3. Chaque fichier archivé porte son en-tête et nomme son remplaçant.
4. Chaque import relatif d'un module archivé résout vers un fichier **hors** archive.
5. Le registre mentionne la décision (PR #40) et non un oubli.
