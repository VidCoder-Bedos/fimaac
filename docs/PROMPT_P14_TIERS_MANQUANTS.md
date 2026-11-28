# PROMPT — Lot 18 : compléter les tiers manquants (contrôle FEC actionnable)

> Prompt rédigé **avant** exécution, exécuté immédiatement.

## Contexte constaté (audit §F, point 7)

Le contrôle du FEC affiche depuis la PR #17 : « **5/67** lignes de tiers portent
un code auxiliaire ; **62 sans tiers identifié** ». C'est exact, et **inutile** :
aucun écran ne permet de rattacher un tiers à une ligne d'écriture existante. Le
dossier de démonstration ne peut donc jamais sortir un FEC complet, la balance
âgée ne peut expliquer 62 mouvements, et le client n'a aucun moyen d'y remédier.

## Objectif

Rendre ce contrôle **actionnable** : lister précisément les lignes fautives,
proposer les bons tiers, affecter par compte ou ligne à ligne, et tracer chaque
affectation.

## Spécification

| # | Exigence | Traduction |
|---|---|---|
| 1 | Détection | `missingThirdPartyLines(entries, companyId)` : comptes 40x/41x, lignes non nulles, sans tiers |
| 2 | Regroupement | `groupMissingTiers` par compte, avec enjeu en FCFA et nature attendue (client / fournisseur) |
| 3 | Propositions | `tiersForAccount` classe d'abord le tiers du bon collectif, puis du bon type — sans jamais masquer les autres |
| 4 | Affectation ligne | `assignThirdPartyToLine` : refus si le compte n'est pas un compte de tiers, si le tiers est d'une autre société |
| 5 | Affectation en masse | `assignThirdPartyToAccount` : uniquement les lignes **encore sans tiers**, compte rendu du nombre exact |
| 6 | Anti-écrasement | Une ligne déjà rattachée n'est **jamais** réaffectée silencieusement |
| 7 | Traçabilité | `AFFECT_TIER` / `AFFECT_TIER_MASSE` scellés dans le journal d'audit, avec pièce, compte et montant |
| 8 | Écran | Carte « Tiers manquants » dans Comptabilité › Tiers : montant en jeu, sélecteur, détail des lignes, affectation ligne à ligne |
| 9 | Contrôle FEC | Le message indique **où** corriger |

## Livrables

- `src/lib/thirdParties.ts` (détection, regroupement, propositions, description).
- `src/lib/actions.ts` — `assignThirdPartyToLine`, `assignThirdPartyToAccount` (auditées).
- `src/pages/Accounting.tsx` — `MissingTiersView` en tête de l'onglet Tiers.
- `src/lib/fec.ts` — message de contrôle rendu actionnable.
- `src/lib/__tests__/thirdParties.test.ts` — 12 tests.

## Critères d'acceptation

1. Seed : **62** lignes sans tiers sur **67** lignes de tiers → groupes `4011` (38 lignes, 11 157 286 FCFA) et `4111` (24 lignes, 37 704 751 FCFA).
2. Affectation en masse sur `4011` → `count = 38`, les **24** lignes clients restent intactes.
3. Deuxième affectation sur le même compte → `count = 0` (aucun écrasement).
4. Refus explicite : compte non-tiers (`5211`), tiers d'une autre société, tiers inconnu, écriture inconnue.
5. Une ligne à montant nul n'est pas comptée comme « à compléter ».
