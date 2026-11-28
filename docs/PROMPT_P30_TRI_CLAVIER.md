# PROMPT — Lot 34 : tri des tableaux au clavier, état annoncé

> Prompt rédigé **avant** exécution, exécuté immédiatement.

## Contexte constaté (audit §D, point 12, reste)

L'accessibilité des dialogues était faite (PR #27). Il restait **les tableaux** :
aucun ne se triait au clavier, la plupart ne se triaient pas du tout, et les
en-têtes n'exposaient aucun état (`aria-sort`). Sur une balance ou un journal de
plusieurs centaines de lignes, l'utilisateur triait « à l'œil » — ou exportait
dans un tableur, ce qui est un aveu.

## Spécification

| # | Exigence | Traduction |
|---|---|---|
| 1 | Logique pure | `src/lib/tableSort.ts` : `toggleSort`, `ariaSort`, `compareValues`, `sortRows` |
| 2 | Bascule à trois états | Nouvelle colonne → croissant ; même colonne → décroissant ; troisième clic → **ordre d'origine** |
| 3 | Annonce | `aria-sort` = `ascending` / `descending` / `none`, plus une flèche visible |
| 4 | Clavier | L'en-tête est un **bouton** : atteignable, activable avec Entrée ou Espace |
| 5 | Comparaison honnête | Nombres comparés comme des nombres (montants saisis en texte), textes selon la locale française, accents et casse ignorés |
| 6 | Vides | Toujours en fin de liste, **y compris en décroissant** — sinon la première ligne d'un tri descendant serait une ligne sans donnée |
| 7 | Stabilité | Les ex æquo gardent leur ordre d'origine |
| 8 | Pureté | `sortRows` ne modifie jamais le tableau reçu |

## Livrables

- `src/lib/tableSort.ts`.
- `src/pages/Accounting.tsx` : `SortableTh` + tri du journal (N°, date, libellé, montant, statut) ;
  en-têtes passés de `slate-400` à `slate-500` (contraste).
- `src/lib/__tests__/tableSort.test.ts` — 12 tests.

## Critères d'acceptation

1. `toggleSort(null, "amount")` → `{asc}` → `{desc}` → `null`.
2. `ariaSort` cohérent avec l'état, `none` pour les autres colonnes.
3. Montants : croissant → `445, 601, 4011, 4111`, la ligne sans montant en **fin**.
4. Décroissant → `4111, 4011, 601, 445`, ligne vide **encore en fin**.
5. Libellés : `Achats, Clients, État, TVA, fournisseurs, Sans compte` — accents et casse ignorés.
6. Ex æquo : ordre d'origine conservé (`1, 3, 2, 4`).
7. Le tableau d'entrée n'est jamais modifié ; sans état de tri, l'ordre est rendu tel quel.
