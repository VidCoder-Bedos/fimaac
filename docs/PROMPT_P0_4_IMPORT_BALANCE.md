# P0-4 — Import de balance robuste

> Prompt rédigé puis exécuté dans la même session. Statut : **exécuté et livré**.

## 1. Besoin métier

Un cabinet importe une balance une fois, puis travaille dessus des semaines.
Si cet import échoue en silence, tout le reste est faux — et l'utilisateur ne
peut pas distinguer « le dossier n'a pas d'activité » de « le fichier n'a pas
été lu ». C'est exactement le défaut constaté : une balance aux en-têtes réels
(« N° de compte », « Intitulé », « Mouvement débit »), ou une balance dont les
montants utilisent l'espace comme séparateur de milliers, renvoyait **0 ligne
sans un mot**, et l'écran affichait ensuite un bilan vide.

## 2. Module concerné

`lib/liasse.ts :: parseBalance` (et son CSV maison) · `pages/Liasse.tsx`
(zones d'import et affichage du résultat).

## 3. Existant constaté

- CSV : `split(/[;,]/)` puis `parseFloat` — un libellé contenant le séparateur
  casse la ligne ; « 1 234 567 » ne se lit pas.
- XLSX : `headerOf` cherchait des mots-clés très littéraux ; en cas d'échec,
  un repli positionnel silencieux supposait `[compte, libellé, débit, crédit]`.
- Aucun chemin ne produisait d'erreur : `return rows` renvoyait `[]`.

## 4. Architecture retenue

`src/lib/balanceImport.ts` — module pur, sans DOM ni ExcelJS :

```
parseDelimited(text)      → grille, guillemets et délimiteur détectés
normalizeHeader(v)        → sans accents ni ponctuation
parseAmount(v)            → 1 234 567,89 · 1.234.567 · (1 000) · 2 500- · FCFA
parseBalanceGrid(grid)    → BalanceImportResult (rapport complet)
parseBalanceText(text)    → idem depuis un CSV/TSV
```

`parseBalanceReport(file)` (liasse.ts) lit le fichier, choisit CSV ou XLSX,
convertit la feuille en grille et délègue. `parseBalance` reste disponible et
**lève une erreur explicable** au lieu de renvoyer une liste vide.

## 5. Règles de détection

1. En-têtes reconnus par mots-clés normalisés (`compte`, `n° de compte`,
   `intitulé`, `mouvement débit`, `solde débiteur`…), testés dans l'ordre
   `solde débit` → `solde crédit` → `code` → `libellé` → `débit` → `crédit` → `solde`.
2. À défaut, détection **par le contenu** : la colonne la plus « codeuse »
   (≥ 60 % de valeurs `^\d{2,12}$`) devient la colonne des comptes, puis elle
   est **retirée** des candidates aux montants.
3. Montants : deux colonnes numériques → débit/crédit (hypothèse signalée) ;
   une seule → solde signé (positif = débit), également signalé.
4. Lignes de total ignorées sans bruit ; lignes au code invalide **listées**
   avec leur motif ; comptes dupliqués **cumulés** et signalés.

## 6. Cas particuliers traités

| Cas | Traitement |
|---|---|
| Fichier vide | refus explicite : « aucune ligne exploitable » |
| Fichier qui n'est pas une balance | refus explicite avec les colonnes attendues |
| En-têtes exotiques | reconnus par normalisation |
| Aucun en-tête | détection par contenu, hypothèses affichées |
| `1 234 567,89` / `(1 000)` / `12 000 FCFA` | montants corrects |
| Libellé contenant `,` ou `;` | préservé (guillemets) |
| Balance déséquilibrée | acceptée, écart affiché au franc près |
| Compte présent deux fois | cumulé, pas écrasé |
| Ligne à code invalide | listée, jamais silencieuse |

## 7. Critères de validation

- `npx tsc --noEmit` : 0 erreur.
- `npx vitest run` : **50/50** verts.
- Aller-retour complet : un CSV de 14 comptes aux en-têtes métier importé puis
  passé au moteur d'états donne actif = passif = **13 200 000**, écart 0.

## 8. Contrôles livrés

`src/lib/__tests__/balanceImport.test.ts` — 14 tests : forme canonique,
variantes métier, nombres français, guillemets, normalisation des en-têtes,
détection sans en-tête, solde signé, cumul des doublons, refus explicites,
lignes écartées listées, déséquilibre chiffré, lignes de total, intégration
avec `buildStatements`.

## 9. Points ouverts

- La « Balance 6 colonnes » (`parseBalance6`) garde son propre lecteur :
  elle est spécifique (N / N-1 sur une seule feuille) et sera alignée sur ce
  module dans un lot dédié, avec ses propres tests.
- Les codes alphanumériques (comptes auxiliaires non numériques) restent
  refusés : le plan comptable embarqué est numérique.
- Aucune détection de colonne « devise » ni de multi-exercice.
