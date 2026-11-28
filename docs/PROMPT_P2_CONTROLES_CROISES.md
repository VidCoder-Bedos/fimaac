# P2 — Brancher les contrôles croisés

> Prompt rédigé puis exécuté dans la même session. Statut : **exécuté et livré**.

## 1. Besoin métier

Un chef de mission ne veut pas seulement des états justes : il veut savoir
**où le dossier ne se recoupe pas**. `crossCheck` produisait déjà exactement
cela — « Paie ↔ Compta : 12 872 643 vs 800 000 », « CNSS ↔ Paie : 774 000 vs
32 000 », « 1 transaction non rapprochée » — et **aucun écran ne l'affichait**.
Le moteur existait, la valeur n'atteignait jamais l'utilisateur.

## 2. Intégration

`pages/Financials.tsx` (Centre de conformité) : nouvelle carte
« Contrôles croisés entre modules », alimentée par `runCrossChecks` avec les
données réelles du dossier (écritures, salariés, transactions bancaires,
immobilisations).

Chaque ligne expose : module, source A, source B, écart chiffré, niveau et
constat rédigé. Le bandeau rappelle la règle de lecture : *un écart n'est pas
une erreur du logiciel, c'est un point à justifier dans le dossier*.

## 3. Défaut trouvé en branchant (et corrigé)

Le résumé du rapport ne comptait pas les constats de niveau `info`
(immobilisations, rapprochement) : `okCount + warningCount + criticalCount`
valait 4 pour 5 contrôles affichés. Le total sous-estimait donc le travail
effectué. Ajout de `infoCount` et prise en compte dans le sous-titre.

## 4. Règles

- Aucune donnée inventée : les quatre sources viennent du store du dossier.
- Aucun écart masqué : un contrôle critique rend le statut global critique.
- Les écarts restent chiffrés au franc, jamais remplacés par un libellé.

## 5. Validation

- `tsc --noEmit` : 0 erreur · `npm run build` : succès (11,56 s).
- `vitest` : **71/71** verts, dont 6 nouveaux tests :
  rapport complet, équilibre de la balance, cohérence des compteurs,
  écarts chiffrés, détection d'une écriture déséquilibrée (écart 100 000,
  statut critique), remontée d'une transaction non rapprochée.

## 6. Points ouverts

- Les taux de CNSS/TVA déclarés ne sont pas encore passés aux contrôles :
  `declaredCNSS` / `declaredTVA` restent optionnels et non fournis.
- Le rapport n'est pas encore exportable (CSV/PDF) ni historisé par mission.
