# P0-2 — Une seule source de vérité fiscale

> Prompt rédigé puis exécuté dans la même session, conformément à la règle de
> travail « l'agent écrit le prompt, puis l'exécute lui-même ».
> Statut : **exécuté et livré**.

## 1. Besoin métier

Un cabinet ne peut pas présenter deux impôts différents pour le même dossier.
L'audit E.3 a montré que FIMAAC en présentait **trois**, tous calculés sur les
mêmes 102 écritures :

| Question | Réponse de l'écran Fiscalité | Réponse du moteur factorisé | Réponse de la grille TVA |
|---|---|---|---|
| IS dû sur un exercice déficitaire | **0** | **201 900** | — |
| Base de la TVA | TVA collectée (**3 634 200**) | — | CA HT (**20 190 000**) |
| Libellé des comptes | 433 / 435 | 443 / 445 | 443 / 445 |

Conséquence chiffrée : **201 900 FCFA d'impôt sous-estimés** sur un seul
dossier de deux salariés, et une base de déclaration fausse sur le module le
plus sensible du produit. C'est un risque de redressement, pas une imperfection
d'affichage.

## 2. Module concerné

`lib/tax.ts` (page Fiscalité, génération de déclaration) ·
`lib/engine/fiscalite.ts` (moteur factorisé, dormant) ·
`lib/actions.ts :: tvaGrid` (onglet « Grille TVA ») ·
`lib/declarationEngine.ts` (champs de la déclaration TVA).

## 3. Existant constaté

- `computeIS` : `résultat × taux` si positif, **sans minimum de perception**.
- `computeTVA` : `base = collectée`, libellés 433/435, crédit de TVA présenté
  comme un net négatif.
- `engine/fiscalite.ts` : minimum de perception correct (formules du classeur
  H12/H14/H15), mais jamais branché sur l'interface.
- `tvaGrid` : recalcule la TVA de son côté et déduit la base HT du taux.
- `declarationEngine` : `TVA_DEDUCTIBLE` (préfixe `445`) recouvre
  `TVA_IMMO` (`4451`) et `TVA_ACHATS` (`4452`) → **déductible compté deux fois**
  dans le total de section.

## 4. Architecture retenue

Un module pur, sans React ni store : **`src/lib/fiscalite.ts`**.

```
mouvements (Map<compte, {debit, credit}>)
        │
        ├── fiscalBaseFromMoves()  →  FiscalBase { CA, produits, charges,
        │                                          résultat, TVA collectée,
        │                                          TVA déductible, dont immo }
        │
        ├── computeTvaFiscal(base, {rate, creditAnterieur})
        │        → baseHT, collectée, déductible, net, aPayer, creditReporte
        │
        └── computeIsFiscal(résultatFiscal, base, IS_PARAMS_DEFAUT)
                 → impotCalcule, minimumPerception, impotDu
```

Les quatre appelants deviennent des **adaptateurs** : ils ne calculent plus,
ils présentent. `IS_PARAMS_DEFAUT` (27 %, seuil 2 000 000, forfait 20 000,
1 % du CA) est exporté, donc paramétrable et auditable — aucune valeur n'a été
inventée, toutes proviennent du moteur existant et restent `verified: false`.

## 5. Non-régression

- Signatures publiques conservées : `computeTVA(entries, rule)`,
  `computeIS(entries, rule)`, `computeTax(code, entries, rules)`,
  `tvaGrid(companyId, entries)`.
- `TaxResult` **étendu** (`tva?: TvaComputation`, `is?: IsComputation`), jamais
  amputé : la page continue de fonctionner sans modification obligatoire.
- Aucun taux, seuil ou libellé métier supprimé ; seule la valeur affichée
  change, et elle change vers la plus prudente.
- `runPayroll`, `crossCheck`, déclarations : non touchés.

## 6. Résultat attendu

1. Un seul IS possible pour un dossier, quel que soit l'écran.
2. Le minimum de perception s'applique même en perte.
3. La base TVA affichée est le chiffre d'affaires HT.
4. Un crédit de TVA ne s'affiche jamais comme un montant négatif à payer.
5. Aucun total de section ne compte deux fois le même compte.
6. Les libellés de comptes sont conformes au plan comptable embarqué.

## 7. Règles de gestion

- **IS dû = max(IS au taux sur résultat fiscal arrondi, minimum de perception)**.
  Le minimum est assis sur le CA HT, forfaitaire sous 2 000 000 de CA.
- **TVA à payer = max(0, collectée − déductible − crédit antérieur)** ;
  le reliquat négatif devient un crédit à reporter, jamais une dette négative.
- **Base TVA = comptes 70** ; reconstitution depuis la TVA collectée
  uniquement si les comptes 70 sont absents (dossier importé sans ventes
  ventilées), et la valeur est alors signalée comme déduite.
- **TVA déductible = 445x net débiteur**, immobilisations incluses mais
  ventilées à part ; les champs de déclaration sont mutuellement exclusifs.

## 8. Cas particuliers traités

| Cas | Traitement |
|---|---|
| Exercice déficitaire | IS au taux = 0, minimum de perception dû |
| CA sous le seuil | minimum forfaitaire (20 000) |
| TVA créditrice | `aPayer = 0`, `creditReporte = 300 000` |
| Crédit antérieur > net | imputé avant conclusion, jamais oublié |
| 445 créditeur (régularisation) | réduit le déductible, donc augmente la TVA due |
| Comptes 70 absents | base reconstituée et signalée |
| Arrondis | `ROUNDDOWN` de tableur (troncature vers zéro), au millier pour l'IS |

## 9. Critères de validation

- `npx tsc --noEmit` : 0 erreur.
- `npx vitest run` : 24/24 verts.
- Sur le jeu de démonstration : page Fiscalité, moteur factorisé et grille TVA
  renvoient **le même IS (201 900)** et **la même TVA (collectée 3 634 200,
  déductible 1 160 868, à payer 2 473 332)**, base **20 190 000**.

## 10. Contrôles livrés

`src/lib/__tests__/fiscalite.test.ts` — 13 tests :
TVA à payer, TVA créditrice, crédit antérieur, base reconstituée, ventilation
immobilisations, IS bénéficiaire, IS déficitaire, minimum forfaitaire,
paramètres explicites, arrondis, et trois tests d'**accord des trois
implémentations** sur le dossier réel.

## 11. Points ouverts (assumés, non bloquants)

- Les taux restent `verified: false` : la validation humaine dans le
  Regulatory Engine est le seul chemin de publication. C'est volontaire.
- Le crédit de TVA antérieur n'est pas encore persisté dossier par dossier :
  il est paramétrable, pas encore historique.
- La TVA à taux multiples (exonéré, 9 %, 18 %) n'est pas ventilée : un taux
  normal unique s'applique. Lot dédié à prévoir.
- L'IS n'intègre pas encore les réintégrations/déductions dans l'écran (le
  moteur les accepte en paramètre) : prochain lot fiscal.

## 12. Cohérence globale

Ce lot ne modifie aucune règle métier : il **supprime des divergences**. Il
s'appuie sur la table de mapping unique livrée en P0-1 (`etatsMapping.ts`) pour
les agrégats comptables et prépare P0-3 (paie conforme : le brut, les retenues
et les cotisations devront eux aussi passer par une source unique).
