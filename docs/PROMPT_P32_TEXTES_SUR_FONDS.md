# PROMPT — Lot 36 : ce qui restait muet — textes sur fonds pleins et dans les graphiques

> Prompt rédigé **avant** exécution, exécuté immédiatement.

## Contexte constaté (suite directe de la PR #46)

La PR #46 avait mesuré et corrigé les **classes de texte sur fond clair**. Trois
angles morts subsistaient, tous visibles en calculant au lieu de supposer :

| Cas | Exemple réel | Contraste | Seuil |
|---|---|---:|---|
| Texte blanc sur fond **plein** | puces du calendrier des obligations, compteur « à classer » | `amber-500` **2,15:1**, `sky-500` **2,77:1**, `slate-400` **2,56:1**, `emerald-500` **2,54:1** | 4,5:1 |
| Couleurs **venues des données** | `avatarColor` / `logoColor` de la démonstration (`#f59e0b`, `#10b981`), initiales blanches | **2,15:1** et **2,54:1** | 4,5:1 |
| Libellés **SVG** des graphiques | axes `fill="#94a3b8"`, pourcentage des barres de composition `fill={couleur de la série}` | **2,56:1** et jusqu'à **1,52:1** | 4,5:1 |

Le libellé « ≤ 3 jours » d'une échéance — l'information la plus urgente de
l'écran — était peint en blanc sur `amber-500`, soit **2,15:1** : une puce qu'on
devine, pas qu'on lit.

## Spécification

| # | Exigence | Traduction |
|---|---|---|
| 1 | Texte blanc sur fond plein | ≥ **4,5:1** mesuré ; les teintes retenues sont `rose-700`, `amber-700`, `sky-700`, `emerald-700`, `slate-600` |
| 2 | Légendes alignées | la légende d'une puce emploie **la même teinte** que la puce (pas de légende qui mente) |
| 3 | Pastilles non textuelles | ≥ **3:1** sur le fond des cartes (`NON_TEXT_MIN`) |
| 4 | Couleurs venues des données | l'encre est **choisie par la mesure** (`bestTextOn`), jamais posée en blanc par convention |
| 5 | Graphiques | aucun texte SVG ne prend une couleur **variable** (donc non mesurable) ; les couleurs fixes atteignent 4,5:1 |
| 6 | Barre de composition | le pourcentage se lit sur une **pastille opaque**, aucune encre ne passant AA sur la palette des séries |
| 7 | Garde-fou | quatre balayages du code échouent si une teinte abandonnée revient |
| 8 | Honnêteté | les teintes claires **assumées** (halo décoratif, palette de composition) sont **déclarées avec leur raison**, pas cachées |

## Décisions

| Décision | Raison |
|---|---|
| `bestTextOn()` dans `contrast.ts` | sur une couleur qui vient des données, il n'y a pas de « bonne » encre à l'avance : blanc sur `#f59e0b` = 2,15:1, ardoise = 8,31:1. On mesure les deux et on garde la meilleure. |
| L'encre blanche reste retenue en cas d'égalité | `#8b5cf6` donne 4,23:1 en blanc et 4,22:1 en ardoise : la bascule doit être déterministe et testée. |
| Pastille blanche pour les pourcentages | meilleure encre sur la palette des séries = **4,47:1** (`#6366f1`), insuffisant. Aucune teinte de la palette ne porte AA : le chiffre se lit donc sur un fond opaque, pas sur la couleur. |
| Couleurs de seuil (`Gauge`, `Donut`, `BarChart`) en `-600` | `#10b981` **2,54:1** et `#f59e0b` **2,15:1** sous le minimum non-textuel de 3:1. |
| Deux dérogations seulement | la pastille « en direct » posée sur la tuile dégradée de marque (aucune information portée) : mesurée (`emerald-400` = 1,92:1) et **déclarée en test avec sa raison**. |

## Remplacements appliqués

| Abandonnée | Remplacée par | Contraste après |
|---|---|---:|
| blanc sur `amber-500` (2,15) | `amber-700` | **5,02:1** |
| blanc sur `sky-500` (2,77) | `sky-700` | **5,93:1** |
| blanc sur `slate-400` (2,56) | `slate-600` | **7,58:1** |
| blanc sur `rose-500` (3,67) | `rose-700` | **6,29:1** |
| blanc sur `emerald-500` (2,54) | `emerald-700` | **5,48:1** |
| `fill="#94a3b8"` (2,56) | `fill="#64748b"` | **4,76:1** |
| `fill={couleur de la série}` (1,52) | `fill="#334155"` / `#0f172a` | **10,35:1** / **17,85:1** |

## Fichiers touchés

`src/lib/contrast.ts` · `src/lib/__tests__/surfaces.test.ts` (nouveau) ·
`src/lib/__tests__/contrast.test.ts` · `src/components/{ui,charts,AppLayout,StorageNotice,OnboardingCard}.tsx` ·
`src/pages/{Obligations,Documents,Dashboard,Landing,AdminPages,Portal,StatementsWorkshop,ConformityWorkshop,Financials}.tsx`

## Vérifications attendues

`tsc` 0 erreur · `vitest` (14 nouveaux tests, dont 4 balayages du code) · build ·
`check:conflicts`.
