# PROMPT — Lot 30 : exports sans usage — mesurer, et requalifier le moteur factorisé

> Prompt rédigé **avant** exécution, exécuté immédiatement.

## Contexte constaté (audit §F, point 21)

Le registre parle de « 4 945 lignes jamais exécutées », sans outil pour le
vérifier ni décision par module. Mesure faite : **386 exports sur 932** ne sont
appelés par aucun code applicatif (52 uniquement par des tests).

Le plus grave n'était pas le chiffre, c'était une **croyance** : `src/lib/engine`
(970 lignes) se présentait comme co-source de vérité avec `lib/fiscalite.ts`
(« source de vérité, partagée avec le moteur factorisé »), et deux en-têtes
l'affirmaient. Il n'est importé **que par les tests**.

## Décisions

| Groupe | Verdict |
|---|---|
| `src/lib/archive/**` | Archivé (P25) — le non-usage est la décision, protégé par test |
| `src/lib/engine/**` | **Oracle de contre-vérification** — reste un test, n'entre jamais en production sans décision écrite |
| Référentiels (`RULE_*`, `regulatory-extensions`, `types`) | **Conservés-documentés** — ils portent un référentiel lisible ; encore faut-il que le code ne prétende pas le contraire |
| `actions.ts` (21), `analytics`, `production`, `etatsMapping` | **À trancher un par un** (liste de travail du document) |

Aucune suppression en bloc : c'est le registre lui-même qui l'interdit.

## Spécification

| # | Exigence | Traduction |
|---|---|---|
| 1 | Mesure rejouable | `scripts/dead-exports.mjs` + `npm run audit:dead` (comptage hors tests, commentaires exclus) |
| 2 | Politique écrite | `docs/AUDIT_EXPORTS_MORTS.md` : constat, tableau par fichier, verdicts |
| 3 | Rôle vrai | En-tête de `engine/index.ts` : oracle, pas production |
| 4 | Mensonges corrigés | `tax.ts` et `fiscalite.ts` ne présentent plus le moteur comme branché |
| 5 | Garde-fou | `engineOracle.test.ts` : échec si un fichier hors `__tests__` importe le moteur |
| 6 | Accord des oracles | Test : sur une balance réelle, `runEngine` et `buildStatements` donnent le **même** total d'actif |
| 7 | Pas de régression documentaire | Le test vérifie que le document contient constat, verdicts et le mot « oracle » |

## Livrables

- `scripts/dead-exports.mjs`, `npm run audit:dead`.
- `docs/AUDIT_EXPORTS_MORTS.md`.
- `src/lib/engine/index.ts` (en-tête), `src/lib/tax.ts`, `src/lib/fiscalite.ts`.
- `src/lib/__tests__/engineOracle.test.ts` — 6 tests.

## Critères d'acceptation

1. `npm run audit:dead` affiche 386 exports sans usage applicatif sur 932.
2. Aucun fichier hors `__tests__` n'importe `lib/engine` (vérifié par balayage réel).
3. `runEngine(...).bilan.N.totalActif` = `buildStatements(...).bilan.actifTotal` = **1 000 000** sur une balance 4111/101.
4. Les deux en-têtes qui présentaient le moteur comme branché sont corrigés — testé.
5. Le document nomme les trois verdicts et le rôle d'oracle.
