# PROMPT — Lot 7 : export FEC conforme (18 colonnes, point décimal, contrôles)

> Prompt rédigé **avant** exécution, conformément à la règle de travail.
> Exécution immédiate, sans redemander d'autorisation.

## Contexte constaté (audit)

`src/lib/ledger.ts::exportFEC` produisait un fichier « FEC-like » de 15 colonnes :
montants avec **virgule** décimale (rejetés par tout outil de contrôle),
`CompAuxNum` toujours vide malgré `JournalEntryLine.thirdPartyId` et
`ThirdParty.code`, aucune colonne devise utile, `DateRglt` systématiquement vide,
`ValidDate` confondue avec la date d'écriture, `EcritureNum` repris du numéro de
pièce (donc troué), pas de filtre sur les écritures validées dans l'en-tête
annoncé, aucun contrôle avant dépôt.

## Objectif

Un export **remettable** : 18 colonnes de référence, format pipe, encodage
UTF-8, et un jeu de contrôles qui dit *avant* le dépôt si le fichier est
exploitable — ou pourquoi il ne l'est pas.

## Spécification

| # | Exigence | Traduction |
|---|---|---|
| 1 | Montants | Point décimal, 2 décimales, jamais de séparateur de milliers, jamais de signe |
| 2 | Dates | `AAAAMMJJ`, vide si la date est inexploitable (jamais `NaN`) |
| 3 | Colonnes | `JournalCode, JournalLib, EcritureNum, EcritureDate, CompteNum, CompteLib, CompAuxNum, CompAuxLib, PieceRef, PieceDate, EcritureLib, Debit, Credit, EcritureLet, DateLet, ValidDate, Montantdevise, Idevise` |
| 4 | Auxiliaires | `CompAuxNum` = `ThirdParty.code`, `CompAuxLib` = `ThirdParty.name`, résolus par ligne |
| 5 | Numérotation | `EcritureNum` = `JOURNAL-0001…` reconstituée par journal, chronologique et continue ; le numéro de pièce interne part dans `PieceRef` |
| 6 | Libellés | Libellé de ligne conservé seulement s'il apporte une information (≠ libellé du compte), sinon libellé d'écriture |
| 7 | Périmètre | Écritures `validated` uniquement, tri stable date puis numéro |
| 8 | Robustesse | `|`, tabulations et retours à la ligne neutralisés dans les libellés (sinon colonnes décalées) |
| 9 | Contrôles | Équilibre global, équilibre par écriture, format, devise, numérotation, doublons de pièce, auxiliaires de tiers, période, lettrage, `ValidDate` |
| 10 | Bloquant | Un déséquilibre rend le fichier **non déposable** ; l'écran l'écrit en clair |
| 11 | Transparence | Les limites (date de lettrage et de validation non historisées, exercice non filtré) sont affichées, pas masquées |

## Livrables

- `src/lib/fec.ts` — `buildFec`, `fecAmount`, `fecDate`, `fecFileName`, `FEC_COLUMNS`, `FecControl`.
- `src/lib/ledger.ts` — `exportFEC` délègue au module (signature rétro-compatible, `tiers` en paramètre optionnel).
- `src/pages/Financials.tsx` — onglet FEC : en-tête réel, compteurs, contrôles statués, aperçu tronqué, bouton de génération.
- `src/lib/__tests__/fec.test.ts` — format, périmètre, auxiliaires, numérotation, tri, déséquilibre, doublons, neutralisation.

## Critères d'acceptation

1. Le seed (102 écritures validées, 281 lignes) sort **équilibré au centime** (80 951 571,00 = 80 951 571,00) avec 0 contrôle bloquant.
2. Aucune virgule décimale dans le fichier.
3. Une écriture déséquilibrée produit **deux** contrôles bloquants et un message explicite à l'écran.
4. `vitest` vert, `tsc` 0 erreur, build vert.
