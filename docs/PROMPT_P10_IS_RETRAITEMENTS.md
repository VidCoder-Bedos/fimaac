# PROMPT — Lot 14 : réintégrations et déductions fiscales (IS)

> Prompt rédigé **avant** exécution, exécuté immédiatement.

## Contexte constaté (audit)

`computeIS` calculait :

```ts
const is = computeIsFiscal(base.resultatComptable, base, params);
```

Le **résultat comptable était pris pour le résultat fiscal**. Aucune
réintégration (amendes et pénalités, dons sans reçu, charges non justifiées) ni
déduction (produits non imposables) n'entrait dans le calcul, alors que
`liasse.ts` sait déjà les traiter (`computeResultatFiscal`). L'écran Fiscalité ne
les exposait pas davantage : l'IS affiché était donc faux pour tout dossier un
peu réel — ou juste par hasard.

## Objectif

Saisir les retraitements **une fois**, les **persister avec leur auteur, leur
date et leur justification**, et les faire entrer dans le calcul de l'IS, à
l'écran comme dans les états.

## Spécification

| # | Exigence | Traduction |
|---|---|---|
| 1 | Arithmétique | `résultat fiscal = résultat comptable + réintégrations − déductions`, arrondi au franc |
| 2 | Robustesse | Un montant négatif est ramené à zéro : un signe saisi par erreur ne doit pas inverser le retraitement |
| 3 | Calcul unique | `computeIsFiscal` applique les retraitements ; l'écran, la déclaration et la liasse partent du même montant |
| 4 | Détail | Le décompte affiché contient « Réintégrations fiscales », « Déductions fiscales », « Résultat fiscal avant arrondi » |
| 5 | Persistance | Collection `taxAdjustments` (DB_VERSION 4, migrée à vide — aucune valeur déduite) |
| 6 | Saisie | Type, libellé obligatoire, montant strictement positif, exercice AAAA, référence justificative |
| 7 | Traçabilité | Création et suppression scellées dans le journal d'audit (auteur, horodatage, montant) |
| 8 | Transparence | Sans retraitement saisi : écrit à l'écran que le résultat fiscal égale le résultat comptable — aucune réintégration supposée |

## Livrables

- `src/lib/fiscalite.ts` — `FiscalAdjustments`, `applyFiscalAdjustments`, `totalAdjustments`, `computeIsFiscal(…, adjustments)`.
- `src/lib/tax.ts` — `computeIS(…, adjustments)`, `computeTax({ adjustments })`, détail enrichi.
- `src/lib/types.ts`, `${"store.ts"}`, `seed.ts` — `TaxAdjustment`, `DBState.taxAdjustments`, `DB_VERSION` 4.
- `src/lib/actions.ts` — `addTaxAdjustment`, `deleteTaxAdjustment`, `fiscalAdjustmentsFor` (audités).
- `src/pages/Tax.tsx` — carte « Retraitements fiscaux » (exercice, totaux, liste, saisie).
- `src/lib/__tests__/taxAdjustments.test.ts` — 9 tests.

## Critères d'acceptation

1. Seed : résultat comptable −479 805 + réintégration 1 000 000 → résultat fiscal 520 195 → arrondi 520 000 → IS calculé 140 400, **mais** minimum de perception 201 900 reste dû.
2. Une réintégration négative ne diminue pas le résultat fiscal.
3. Un minimum de perception n'est jamais modifié par les retraitements.
4. Le seed expose une collection vide : aucune valeur inventée.
5. `tsc` 0, build vert, `vitest` vert.
