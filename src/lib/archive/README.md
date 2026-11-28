# Modules archivés

Ces quatre modules ne sont **importés par aucun code de l'application**. Ils ne
sont ni morts par accident, ni en attente : leur archivage est une **décision**,
inscrite dans l'en-tête de chaque fichier.

| Module | Lignes | Ce qu'il faisait | Ce qui le remplace |
|---|---:|---|---|
| `declarationEngine.ts` | 440 | Produire des déclarations fiscales avec traçabilité montant → formule → comptes | `actions.generateTvaDeclaration` / `generateIsDeclaration`, déclenchées depuis l'écran Fiscalité |
| `financialStatements.ts` | 369 | Un second moteur de bilan et de compte de résultat | `liasseEngine` et `lib/liasse`, seuls producteurs des montants affichés |
| `liasseFiller.ts` | 267 | Un pipeline de remplissage de la liasse | `liasseEngine.fillStateTemplate` / `fillTemplate`, appelés par l'écran Liasse |
| `formulaRegistry.ts` | 244 | Un registre documentaire des formules Excel d'origine | Aucun : c'est une documentation, elle n'a jamais été branchée |

**Pourquoi archiver plutôt que supprimer** : ces fichiers portent des
descriptions et des correspondances qui ont coûté du travail et qui restent
utiles à relire. **Pourquoi archiver plutôt que brancher** : brancher deux
moteurs qui calculent la même chose produit deux vérités — et l'écran finit par
afficher celle qui n'a pas été testée.

Le test `src/lib/__tests__/archive.test.ts` échoue si l'un de ces modules est
importé depuis le reste de `src/`, ou si un fichier déposé ici perd son en-tête
`ARCHIVÉ`.
