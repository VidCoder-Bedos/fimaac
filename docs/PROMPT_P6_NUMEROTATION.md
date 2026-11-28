# PROMPT — Lot 10 : numérotation des pièces (fin du « count + 1 »)

> Prompt rédigé **avant** exécution, exécuté immédiatement.

## Contexte constaté (audit)

`addEntry` calculait le numéro ainsi :

```ts
const seq = String(db.entries.filter(e => e.companyId === companyId && e.journalId === data.journalId).length + 1).padStart(4, "0");
```

Trois défauts silencieux :

1. **Recyclage** : supprimer une écriture libère son numéro, qui sera réattribué à
   la suivante — deux pièces différentes portent alors le même numéro selon
   l'historique.
2. **Import** : un historique importé (numéros 0104 à 195 dans le seed) rend le
   compteur incapable de reprendre la suite → collision quasi certaine.
3. **Aucun contrôle** : rien dans le produit ne signalait un doublon de
   numérotation, alors que le FEC en dépend.

## Objectif

Un numéro de pièce **unique, jamais recyclé, contrôlable**, et un contrôle
visible dans la page Écritures.

## Spécification

| # | Exigence | Traduction |
|---|---|---|
| 1 | Analyse | `parseEntryNumber` : préfixe, séquence, suffixe d'extourne, largeur |
| 2 | Séquence suivante | `max(séquences du journal) + 1`, jamais `count + 1` |
| 3 | Unicité | On saute les numéros déjà pris (`while taken`) |
| 4 | Extournes | Un numéro `ACH-0001-C` ne consomme pas de séquence et ne crée pas de trou |
| 5 | Portée | Le compteur est propre au journal : `BAQ-0900` n'influence pas `ACH` |
| 6 | Contrôle | `auditNumbering` : doublons, trous par journal/année, numéros illisibles, séries couvertes |
| 7 | Écran | Carte « Numérotation des pièces » dans l'onglet Écritures, avec le nombre de trous d'import |
| 8 | Définition du succès | Un trou est une **information** (reprise d'historique), un doublon est une **erreur** |

## Livrables

- `src/lib/entryNumbering.ts` — `parseEntryNumber`, `maxSequence`, `nextEntryNumber`, `auditNumbering`.
- `src/lib/actions.ts` — `addEntry` utilise `nextEntryNumber`.
- `src/pages/Accounting.tsx` — carte `NumberingCard`.
- `src/lib/__tests__/entryNumbering.test.ts` — 12 tests.

## Critères d'acceptation

1. Trois écritures `ACH` dont la dernière porte 0104 → la suivante est `ACH-0105`, pas `ACH-0004`.
2. `ACH-0001` supprimée puis nouvelle saisie avec `ACH-0003` existante → `ACH-0004`.
3. Deux numéros identiques → `auditNumbering.ok === false`.
4. Un trou n'invalide pas le contrôle, mais il est compté.
5. `tsc` 0, build vert, `vitest` vert.
