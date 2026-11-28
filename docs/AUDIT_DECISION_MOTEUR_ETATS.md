# Décision d'architecture — quel moteur d'états financiers devient la référence ?

**Date** : 28/11/2026 · **Statut** : recommandation argumentée, en attente de validation du propriétaire
**Question tranchée** : entre `lib/engine`, `lib/liasse` et `lib/financialStatements`, lequel doit produire les états financiers de FIMAAC ?

---

## 1. Méthode : un test décisif, pas une opinion

On ne peut pas départager trois moteurs sur un jeu de démonstration riche (102 écritures) : chacun peut « rater » de la même façon pour des raisons différentes. La méthode retenue est donc une **balance de contrôle** de 14 comptes, dont le bilan correct est calculable à la main, sans ambiguïté.

### Balance de contrôle (équilibrée : 21 200 000 = 21 200 000)

| Compte | Libellé | Débit | Crédit |
|---|---|---|---|
| 101 | Capital social | — | 7 300 000 |
| 2411 | Matériel industriel | 5 000 000 | — |
| 2841 | Amortissements du matériel | — | 1 000 000 |
| 311 | Marchandises | 2 000 000 | — |
| 411 | Clients | 3 000 000 | — |
| 521 | Banque | 4 000 000 | — |
| 401 | Fournisseurs | — | 2 000 000 |
| 4431 | TVA facturée | — | 500 000 |
| 4452 | TVA récupérable | 200 000 | — |
| 421 | Personnel | — | 300 000 |
| 4311 | CNSS | — | 100 000 |
| 601 | Achats | 6 000 000 | — |
| 661 | Charges de personnel | 1 000 000 | — |
| 701 | Ventes | — | 10 000 000 |

### Bilan attendu (calcul manuel)

- **ACTIF** : immobilisations nettes 4 000 000 + stocks 2 000 000 + clients 3 000 000 + TVA récupérable 200 000 + trésorerie 4 000 000 = **13 200 000**
- **PASSIF** : capital 7 300 000 + résultat 3 000 000 (produits 10 000 000 − charges 7 000 000) + fournisseurs 2 000 000 + dettes fiscales et sociales 900 000 = **13 200 000**
- Identité de contrôle : **actif = passif = 13 200 000**, résultat = **3 000 000**

---

## 2. Résultats d'exécution

| Valeur | Attendu | `lib/engine` | `lib/liasse` | `lib/financialStatements` |
|---|---|---|---|---|
| Immobilisations brutes | 5 000 000 | **3 000 000** ❌ | 5 000 000 ✅ | n/a (autre contrat) |
| Amortissements | 1 000 000 | 1 000 000 ✅ | 1 000 000 ✅ | n/a |
| Immobilisations nettes | 4 000 000 | **2 000 000** ❌ | 4 000 000 ✅ | n/a |
| Stocks | 2 000 000 | 2 000 000 ✅ | 2 000 000 ✅ | n/a |
| Créances (clients + TVA récup.) | 3 200 000 | **3 000 000** ❌ | 3 200 000 ✅ | n/a |
| Trésorerie | 4 000 000 | 4 000 000 ✅ | 4 000 000 ✅ | n/a |
| **Total actif** | **13 200 000** | **11 000 000** ❌ | **13 200 000** ✅ | exception à l'appel |
| Capital | 7 300 000 | 7 300 000 ✅ | 7 300 000 ✅ | n/a |
| Résultat au passif | 3 000 000 | **0** ❌ | 3 000 000 ✅ | n/a |
| Fournisseurs | 2 000 000 | 2 000 000 ✅ | 2 000 000 ✅ | n/a |
| Autres dettes (fiscales/sociales) | 900 000 | **0** ❌ | 900 000 ✅ | n/a |
| **Total passif** | **13 200 000** | **9 700 000** ❌ | **13 200 000** ✅ | n/a |
| **Écart actif − passif** | **0** | **1 300 000** ❌ | **0** ✅ | n/a |
| Compte de résultat | 3 000 000 | 3 000 000 ✅ | 3 000 000 ✅ | n/a |
| Contrôles internes | tous OK | `C1_ACTIF_PASSIF: Déséquilibré`, `C2_CR_PASSIF: Déséquilibré` | 7/7 `ok` | n/a |

### Sur les données réelles (102 écritures de démonstration)

| | `engine` | `liasse` |
|---|---|---|
| Total actif | 25 820 053 | 28 140 921 |
| Total passif | 15 233 349 | 28 032 921 |
| Écart | **10 586 704** | **108 000** |

---

## 3. Diagnostic des causes (précises, donc corrigeables)

### `lib/engine` — quatre défauts de conception, pas de simples oublis de mapping

1. **Double déduction des amortissements.** `RULE_IMMO_BRUT` calcule `Σ comptes 2 (débit) − Σ comptes 28/29 (crédit)`, alors que l'agrégat des comptes 2 inclut déjà le solde net des 2841 : l'amortissement est retiré **deux fois** → 5 000 000 − 1 000 000 − 1 000 000 = 3 000 000 au lieu de 5 000 000. C'est exactement ce qu'on observe. La règle correcte est `Σ comptes 2 (débit brut)`, l'amortissement restant porté par `RULE_AMORT`.
2. **Résultat non reporté au passif.** `bilan.resultat` vaut 0 alors que le compte de résultat calcule 3 000 000 : l'identité du bilan ne peut structurellement pas tenir.
3. **Classe 4 incomplète.** Seuls 411/412/414/416/417/418 sont lus côté créances et « 46 » côté autres créances ; **aucune règle ne capte les créditeurs de classe 4 autres que 401** (TVA 443/445, social 421/431, 444…). D'où `autresDettes = 0` alors que 900 000 devraient y figurer.
4. **`totalPassif` n'est pas la somme de ses composantes.** Sur la balance de contrôle : composantes = 9 300 000, `totalPassif` = 9 700 000, soit **400 000 non expliqués**. Une règle `RULE_TOTAL_PASSIF` indépendante coexiste avec les règles de détail : deux façons de calculer le même total, donc deux résultats.

**Conclusion** : `engine` ne peut pas devenir la référence sans réécrire intégralement ses agrégateurs. En revanche, ses **contrôles** (`C1_ACTIF_PASSIF`, `C2_CR_PASSIF`, `C3_TFT_FLUX`, `DC_BALANCE_N/N-1`) et sa **traçabilité** (84 entrées de trace sur 14 comptes) ont une réelle valeur : ils ont correctement signalé le déséquilibre.

### `lib/liasse` — correct par construction, avec une limite identifiée

`buildStatements` est un mapping de 22 lignes, lisible et auditable :

```
16 → dettes financières · 1 → capitaux · 28/29 → amortissements · 2 → immobilisations brutes
3 → stocks · 4 (solde > 0 → créances ; 40 → fournisseurs ; sinon autres dettes)
5 (débit → trésorerie ; crédit → trésorerie passif) · 6 → charges · 7 → produits
```

**Pourquoi il est exact** : chaque compte est affecté à **un seul** côté du bilan, et la somme de tous les soldes est nulle par construction comptable. L'identité actif = passif est donc une **propriété mathématique** du mapping, pas une vérification a posteriori. C'est ce qui explique le résultat parfait (13 200 000 = 13 200 000, 7 contrôles sur 7 `ok`).

**Pourquoi il reste 108 000 sur les données réelles** : deux comptes de **classe 8** (`812` solde créditeur 342 000, `822` solde débiteur 450 000, soit −108 000 net) ne sont mappés nulle part, donc silencieusement écartés. L'écart du bilan (108 000) est exactement leur solde. **Un défaut de 3 lignes à corriger, pas une refonte.**

### `lib/financialStatements` — la cible, pas la référence

Son contrat n'est pas `BalanceRow[] → bilan` mais `StatementLine[] + EngineContext → BuiltStatement` : il repose sur `FINANCIAL_CONCEPTS` et une notion de contexte d'exercice. Il n'est appelé par aucune page (dormant), et il n'accepte pas une balance brute (exception à l'appel dans mon test). Architecturally, c'est **la meilleure cible à moyen terme** (présentation par concepts, proche du modèle SYSCOHADA), mais l'adopter aujourd'hui reviendrait à écrire le socle sur un moteur jamais exercé.

---

## 4. Décision recommandée

> **`lib/liasse` devient la référence de calcul des états financiers.**
> `lib/engine` est conservé comme **couche de contrôle** (contrôles + traçabilité), avec ses agrégateurs neutralisés.
> `lib/financialStatements` devient la **cible de présentation** à moyen terme, pas la référence immédiate.

### Justification en une phrase
C'est le seul moteur dont l'équilibre est **structurel** (et non constaté), le seul exact sur une balance de contrôle indépendante, et son unique écart sur données réelles est un défaut de mapping identifié de 108 000 FCFA corrigeable en trois lignes.

### Ce que `liasse` **ne** fait pas encore (à ne pas confondre avec « correct »)
1. Regroupements grossiers : `16` est noyé dans la classe 1, « autres dettes » mélange fiscal, social et divers.
2. Aucune distinction provisions / dépréciations (`19`, `29`, `39`, `49`), ni écarts de conversion.
3. Aucune séparation actif immobilisé / actif circulant / actif circulant HAO.
4. Aucune référence aux postes du modèle officiel (AD, AG, AE… du bilan SYSCOHADA) : c'est un **calcul**, pas encore une **présentation**.
5. Classe 8 (HAO) non traitée → cause de l'écart résiduel.

Autrement dit : `liasse` donne des **totaux justes**, pas encore un **bilan présentable**. Les deux étapes sont distinctes et doivent être traitées dans cet ordre.

---

## 5. Plan de migration en 5 étapes (base du prompt P0)

| Étape | Action | Critère d'acceptation |
|---|---|---|
| 1 | Extraire une **table de mapping unique** `préfixe de compte → poste` (fichier `lib/etatsMapping.ts`), consommée par `liasse`, `engine` et `financialStatements` | une seule source ; plus aucun préfixe dupliqué dans trois fichiers |
| 2 | Ajouter la **classe 8** (HAO) dans le mapping et **un garde-fou** : tout compte à solde non nul non mappé déclenche un contrôle bloquant | sur les 102 écritures : écart bilan = 0, et les 2 comptes 8xx visibles en contrôle |
| 3 | Corriger `engine` : `RULE_IMMO_BRUT` sans déduction d'amortissement, résultat reporté au passif, classe 4 complète, `totalPassif` = somme des composantes | sur la balance de contrôle : actif = passif = 13 200 000 ; `C1_ACTIF_PASSIF: OK!` |
| 4 | **Tests unitaires** sur la balance de contrôle (14 comptes, valeurs du §1) + un cas déficitaire + un cas avec TVA créditrice | 3 tests bloquants dans la CI |
| 5 | **Présentation** : faire dériver les postes du bilan des références officielles (AD → RN), à partir du mapping de l'étape 1 | un bilan dont chaque ligne porte sa référence SYSCOHADA |

### Jeu de tests à figer (repris des valeurs du §1)
```
actifTotal   = 13 200 000
passifTotal  = 13 200 000
immoBrut     =  5 000 000
amort        =  1 000 000
immoNet      =  4 000 000
stocks       =  2 000 000
creances     =  3 200 000   (411 + 4452)
tresorerie   =  4 000 000
capitaux     =  7 300 000
resultat     =  3 000 000
dettesFourn  =  2 000 000
autresDettes =    900 000   (4431 + 421 + 4311)
```

---

## 6. Ce que cette décision ne tranche pas

- L'opportunité de supprimer physiquement les deux autres moteurs (recommandé à terme : `engine` réduit aux contrôles, `financialStatements` conservé comme cible).
- Le **minimum de perception IS** (D-07), indépendant de la construction du bilan.
- La paie (D-08/D-09), indépendante également : elle relève d'un autre prompt P0.

Ces trois sujets sont liés par un même principe : **une seule source de vérité par calcul**, et un test qui échoue quand deux sources divergent.
