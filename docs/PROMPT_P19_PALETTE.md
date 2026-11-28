# PROMPT — Lot 23 : palette de commandes ⌘K

> Prompt rédigé **avant** exécution, exécuté immédiatement.

## Contexte constaté (audit §D, point 15)

`GlobalSearch` existait, mais : accessible seulement par la touche « / » (aucun
bouton ne l'annonçait), **sans navigation clavier** (ni flèches ni Entrée), sans
rôle ARIA, et servant uniquement à **chercher des pièces** — jamais à aller
quelque part ni à agir. Sur 8 onglets et une vingtaine d'écrans, c'est un
utilisateur perdu par écran.

## Objectif

Une palette **annoncée** (⌘K / Ctrl+K, bouton visible), pilotable **au clavier**,
qui propose d'abord **où aller** et **quoi faire**, ensuite les données
accessibles.

## Spécification

| # | Exigence | Traduction |
|---|---|---|
| 1 | Logique pure | `src/lib/commands.ts` : normalisation, score, classement, regroupement — testables sans DOM |
| 2 | Accents | « fiscalite » trouve « Fiscalité » ; sous-séquence acceptée (« lsse » → Liasse) |
| 3 | Multi-mots | Tous les mots saisis doivent être trouvés (ET), dans le libellé, l'indice ou les mots-clés |
| 4 | Priorité | Exact > préfixe > début de mot > inclusion > sous-séquence ; plafond par section |
| 5 | Raccourci | ⌘K / Ctrl+K ouvre et referme ; « / » continue de fonctionner ; Échap ferme |
| 6 | Clavier | ↑ ↓ parcourent, Entrée ouvre, la ligne active reste visible |
| 7 | Accessibilité | `role="dialog"`, `combobox` + `aria-activedescendant`, `listbox`/`option`, bouton nommé en mobile |
| 8 | Données | Écritures et documents cherchés à partir de 2 caractères, dans le périmètre de l'utilisateur ; sélection de la société au passage |
| 9 | Pas de doublon | L'ancienne recherche est **remplacée**, pas doublée : aucun module mort |

## Livrables

- `src/lib/commands.ts` (commandes fixes : 14 navigations, 4 actions).
- `src/components/GlobalSearch.tsx` réécrit en palette (même point de montage).
- `src/lib/__tests__/commands.test.ts` — 11 tests.

## Critères d'acceptation

1. « lia » → première proposition **Liasse fiscale**.
2. « liasse paie » → aucun résultat (ET strict) ; « liasse notes » → Liasse.
3. « cnss » trouve **Paie** par ses mots-clés.
4. 20 lignes « Écriture » → au plus **3** proposées avec le plafond à 3.
5. Requête vide → la liste des commandes ; « qqqqzzz » → vide.
6. Toutes les navigations pointent vers `/app…`.
