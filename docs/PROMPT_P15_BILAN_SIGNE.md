# PROMPT — Lot 19 : le sens du solde décide du côté du bilan

> Prompt rédigé **avant** exécution, exécuté immédiatement.

## Contexte constaté (audit §F, point 10 : « cas 441 débiteur »)

Le compte **441 « État, impôt sur les bénéfices »** porte un solde **débiteur de
520 000 FCFA** dans le dossier de démonstration. Présenté « en diminution des
dettes fiscales », il ne figurait **ni à l'actif** (où il est une créance sur
l'État) **ni au passif** (où il n'a rien à faire) : deux postes du bilan étaient
faux, et 520 000 FCFA d'actif avaient disparu.

Le bilan restait équilibré — c'est ce qui rendait le défaut invisible : aucun
contrôle d'équilibre ne pouvait le voir.

## Objectif

Un compte 42/43/44 **débiteur** est une **créance** ; un compte **créditeur**
est une **dette**. Le signe décide, jamais le préfixe seul. Et les deux moteurs
d'états doivent dire la même chose.

## Spécification

| # | Exigence | Traduction |
|---|---|---|
| 1 | Poste d'actif | Nouveau poste `creancesFiscalesSociales` : 42/43/44 hors 445/4492, solde débiteur |
| 2 | Poste de passif | `dettesFiscalesSociales` restreint aux soldes **créditeurs** (`onlySign`) |
| 3 | Équilibre | Le bilan reste équilibré : l'actif et le passif progressent du même montant |
| 4 | Total | `actifTotal` intègre le nouveau poste (sinon il serait calculé mais invisible) |
| 5 | Moteur factorisé | `aggregateSigned` + `RULE_CREANCES_FISCALES_SOCIALES` ; `RULE_TOTAL_ACTIF` et `creances` du moteur mis à jour |
| 6 | Écrans et impressions | Ligne « Créances sociales et fiscales » dans l'écran États, l'impression d'états et la liasse |
| 7 | Transparence | Le total du bilan change : il est écrit dans le test de référence, avec la cause |

## Livrables

- `src/lib/etatsMapping.ts`, `src/lib/liasse.ts` (poste, total, exposition).
- `src/lib/engine/soldes.ts` (`aggregateSigned`), `agregateurs.ts`, `etats.ts`.
- `src/components/LiassePrint.tsx`, `StatementsPrint.tsx`, `src/pages/Financials.tsx`.
- `src/lib/__tests__/bilanSigne.test.ts` (5 tests) ; référence mise à jour dans `etats.test.ts`.

## Critères d'acceptation

1. Comptes `4311` créditeur 300 000 + `4441` débiteur 120 000 + `421` débiteur 50 000 → dettes **300 000**, créances **170 000**, actif = passif = 300 000.
2. Seed : `creancesFiscalesSociales = 520 000`, `dettesFiscalesSociales = 16 889 734`, **actif = passif = 27 960 921** (contre 27 440 921 avant).
3. Aucun compte 42/43/44 non classé, quel que soit son sens.
4. `engine` et `liasse` donnent le même actif, le même passif et les mêmes dettes fiscales.
