# PROMPT — Lot 25 : le régime déclaré décide (réel / forfait, exonération, taux différenciés)

> Prompt rédigé **avant** exécution, exécuté immédiatement.

## Contexte constaté (audit §F, point 8, reste)

`Company.taxRegime` existait : saisi à la création du dossier, affiché dans la
liste des entreprises, utilisé par les obligations… et **jamais lu par un
calcul**. Conséquences mesurables :

- une entreprise déclarée **exonérée** voyait un IS et une TVA à payer, et
  pouvait générer les deux déclarations ;
- une entreprise au **forfait** (RSMI, RNC) voyait le calcul du régime réel,
  avec son taux et son minimum de perception, présenté comme le sien ;
- les **taux différenciés** par catégorie d'entreprise étaient inapplicables :
  aucune règle ne portait de catégorie.

## Décision de conception

Aucun régime ni taux n'est inventé : les cinq régimes déjà déclarables
(`ri`, `rs`, `rsmi`, `rnc`, `exempt`) sont conservés. Ce qui change, c'est que la
**règle porte sa portée** (`regimes`, `categories`) et que le moteur refuse de
combler un manque avec le régime du voisin.

Ordre de résolution : règle propre au régime (et à la catégorie) → exonération
déclarée → règle générique **annoncée comme telle** → absence explicite.

## Spécification

| # | Exigence | Traduction |
|---|---|---|
| 1 | Portée | `TaxRuleRef.regimes?: TaxRegime[]`, `categories?: string[]` ; absence = générique |
| 2 | Spécificité | Une règle propre au régime et à la catégorie passe avant la générique |
| 3 | Pas de fuite | Une règle visant un autre régime n'est **jamais** appliquée ; le message nomme les deux régimes |
| 4 | Exonération | Régime `exempt` sans règle propre → aucun calcul, montants affichés « — », déclarations refusées avec la raison |
| 5 | Exonération partielle | Si une règle existe pour `exempt`, elle s'applique (le dossier peut déclarer un taux 0) |
| 6 | Catégories | Une règle catégorielle ne s'applique pas à un dossier sans catégorie déclarée |
| 7 | Déclaration | Régime et catégorie se saisissent dans l'écran Fiscalité, avec audit (`COMPANY_TAX_PROFILE_UPDATE`) ; une redite n'écrit rien |
| 8 | Transparence | Bandeau par code fiscal : générique = ambre, exonéré/manquant = rose |

## Livrables

- `src/lib/taxRegime.ts` (`resolveTaxRule`, `ruleMatchesProfile`, `describeProfile`, `validateCategory`).
- `src/lib/types.ts` (`TaxRuleRef.regimes/categories`, `Company.taxCategory`).
- `src/lib/actions.ts` (`setCompanyTaxProfile` + gardes sur `generateTvaDeclaration` / `generateIsDeclaration`).
- `src/pages/Tax.tsx` (carte « Profil fiscal déclaré », bandeaux, montants « — »).
- `src/lib/__tests__/taxRegime.test.ts` — 13 tests.

## Critères d'acceptation

1. Règles {générique 27 %, RSMI 5 %, RI 27 %} + régime `rsmi` → **règle RSMI**, statut `ok`.
2. Seule règle RI + régime `rsmi` → **aucune règle**, statut `regime_missing`, message citant RI et RSMI.
3. Régime `exempt` sans règle propre → `shouldCompute = false`.
4. Régime `exempt` **avec** règle propre → `ok`, calculable.
5. `PME` déclarée → règle PME ; « Grande entreprise » → règle générique, statut `generic`.
6. Dossier exonéré → `generateTvaDeclaration` et `generateIsDeclaration` **refusent**, motif explicite.
7. Profil inchangé → aucun nouvel auditt ; régime inconnu ou catégorie de 50 caractères → refusés.
8. Seed : régime déclaré conservé (`ri`), aucune catégorie inventée.
