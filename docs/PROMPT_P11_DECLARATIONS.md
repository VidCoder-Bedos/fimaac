# PROMPT — Lot 15 : base fiscale complète, déclarations TVA et IS alignées

> **Ajout en cours d'exécution (mesuré, non prévu)** : en écrivant les tests de la
> déclaration IS, le résultat comptable calculé par le moteur fiscal tombait à
> **−587 805** alors que la liasse et le dashboard annoncent **−479 805**. Cause :
> `fiscalBaseFromMoves` ne lisait que les classes 6 et 7, ignorant la **classe 8**
> (opérations hors activités ordinaires), qui appartient pourtant au résultat net.
> Écart réel sur le dossier de démonstration : **108 000 FCFA**. Corrigé ici :
> la base fiscale et `financialSummary` intègrent la classe 8 (solde créditeur =
> produit, solde débiteur = charge), le CA restant strict (70x).

> Prompt rédigé **avant** exécution, exécuté immédiatement.

## Contexte constaté (audit)

- `generateTvaDeclaration` produit un décompte à **un seul taux**, sans la
  ventilation 18 / 9 / exonéré livrée en #19 : la déclaration générée ne montre
  pas ce que l'écran affiche.
- **Aucune déclaration IS n'existe** : les réintégrations et déductions saisies
  (#25) n'ont aucune traduction déclarative, et l'IS dû ne peut pas être déposé
  depuis l'application.
- L'échéance de la TVA générée est écrite en dur (`15 du mois M+1`) sans la règle
  de report au jour ouvré livrée en #18.

## Objectif

Une déclaration **générée depuis les mêmes moteurs que l'écran**, avec l'échéance
légale calculée, et un décompte qui montre chaque assiette et chaque taux.

## Spécification

| # | Exigence | Traduction |
|---|---|---|
| 1 | TVA | Décompte = ventilation par taux (base et TVA de chaque tranche) + collectée − déductible − crédit + net |
| 2 | IS | Nouvelle génération : résultat comptable, réintégrations, déductions, résultat fiscal, IS au taux, minimum de perception, impôt dû |
| 3 | Échéance | TVA : 15 du mois suivant **reporté** au jour ouvré ; IS : 31 mars N+1 reporté |
| 4 | Source unique | `computeTax` + `ventilateVat` + `computeAnnualDueDate` — aucune formule locale |
| 5 | Traçabilité | Chaque génération est auditée (code, montant, exercice) |
| 6 | Refus explicite | Pas de règle TVA/IS paramétrée → message d'erreur, pas de déclaration vide |
| 7 | Écran | Bouton « Générer la déclaration IS » sur la carte IS, à côté de celui de la TVA |

## Livrables

- `src/lib/actions.ts` — `generateTvaDeclaration` enrichie, `generateIsDeclaration(companyId, exercise)`.
- `src/pages/Tax.tsx` — bouton de génération IS, exercice courant.
- `src/lib/__tests__/declarations.test.ts`.

## Critères d'acceptation

1. TVA générée : base 20 190 000, collectée 3 634 200, déductible 1 160 868, net 2 473 332, décompte contenant la tranche 18 %.
2. IS généré sur le seed : résultat comptable −479 805, réintégrations 0, résultat fiscal arrondi −480 000, impôt dû 201 900 (minimum de perception), échéance `2027-03-31`.
3. Une réintégration saisie de 1 000 000 change la déclaration IS suivante (résultat fiscal 520 000, IS calculé 140 400, impôt dû 201 900).
4. `tsc` 0, build vert, `vitest` vert.
