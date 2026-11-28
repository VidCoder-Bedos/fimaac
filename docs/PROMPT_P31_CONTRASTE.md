# PROMPT — Lot 35 : contraste mesuré, corrigé, gardé

> Prompt rédigé **avant** exécution, exécuté immédiatement.

## Contexte constaté (audit §D, point 12, reste)

Le contraste n'avait jamais été audité. Il suffisait de calculer :

| Classe | Occurrences | Contraste sur blanc | Seuil AA (texte) |
|---|---:|---:|---|
| `text-slate-400` | **327** | **2,56:1** | 4,5:1 |
| `text-slate-300` | 26 | 1,48:1 | 4,5:1 (3:1 pour une icône) |
| `text-indigo-500` | 17 | 4,47:1 | 4,5:1 |
| `text-amber-600` | 24 | 3,19:1 | 4,5:1 |
| `text-rose-500` | 34 | 3,67:1 | 4,5:1 |
| `text-emerald-600` | 37 | 3,77:1 | 4,5:1 |

Le libellé secondaire d'un tableau comptable était donc **moins lisible** qu'un
texte gris de site vitrine. Aucune mesure n'existait pour le dire.

## Spécification

| # | Exigence | Traduction |
|---|---|---|
| 1 | Formule exacte | WCAG 2.1 : luminance relative linéarisée, pondération 0.2126/0.7152/0.0722 |
| 2 | Bornes vérifiées | Blanc/blanc = **1:1** ; noir/blanc = **21:1** ; symétrie |
| 3 | Palette mesurable | Teintes réellement employées, valeur hexadécimale de Tailwind |
| 4 | Seuils | AA 4,5:1 (texte), 3:1 (grand texte et composant d'interface), AAA 7:1 |
| 5 | Correction | Toute teinte de **texte** atteint 4,5:1 sur blanc **et** sur le fond des cartes |
| 6 | Garde-fou | Un test balaie les écrans et échoue si une teinte abandonnée revient |
| 7 | Honnêteté | Les teintes non mesurées (décoratives) sont explicitement hors périmètre |

## Remplacements appliqués

| Abandonnée | Remplacée par | Contraste après |
|---|---|---:|
| `slate-400` (2,56) | `slate-500` | **4,76:1** |
| `slate-300` (1,48) | `slate-500` | **4,76:1** |
| `indigo-500` (4,47) | `indigo-600` | **6,29:1** |
| `amber-500` (2,15) / `amber-600` (3,19) | `amber-700` | **5,02:1** |
| `rose-500` (3,67) / `rose-600` (4,49) | `rose-700` | **5,72:1** sur `rose-50` |
| `emerald-500` (2,54) / `emerald-600` (3,77) | `emerald-700` | **5,48:1** |
| `sky-600` (4,10) | `sky-700` | **5,57:1** sur `sky-50` |
| `violet-500` | `violet-600` | **5,70:1** |

## Livrables

- `src/lib/contrast.ts` (`hexToRgb`, `relativeLuminance`, `contrastRatio`, `wcagLevel`, `PALETTE`, `describeContrast`).
- 32 écrans et composants corrigés (changement de classes uniquement, aucune structure modifiée).
- `src/lib/__tests__/contrast.test.ts` — 12 tests, dont **deux balayages du code**.

## Critères d'acceptation

1. Blanc/blanc = 1:1 (à 10⁻⁵), noir/blanc = 21:1 (à 10⁻⁵).
2. `slate-400` < 3:1, `slate-300` < 3:1, `indigo-500` < 4,5:1, `amber-600` < 4,5:1, `rose-500` < 4,5:1.
3. Toutes les teintes de texte retenues ≥ **4,5:1** sur `white` **et** `slate-50`.
4. Aucune classe de la liste abandonnée ne subsiste dans `src/`.
5. Toute teinte de texte employée et mesurée atteint 4,5:1 — test automatisé.
