# PROMPT — Lot 33 : les cinq dernières actions sans appelant

> Prompt rédigé **avant** exécution, exécuté immédiatement.

## Contexte constaté (fin du point 21)

Après P27 et P28, cinq exports d'`actions.ts` restaient sans appelant. Vérification
faite, chacun racontait une histoire différente :

| Export | Ce qu'on a trouvé |
|---|---|
| `setDocStatus` | Mutait le statut documentaire **sans aucune trace d'audit** ; et rien dans l'écran ne permettait d'archiver une pièce — elle restait dans les travaux à faire indéfiniment. |
| `setDocCategory` | Même famille : la nature d'une pièce (facture, reçu, relevé) ne pouvait plus être corrigée après import, et un changement de nature n'était jamais tracé. |
| `setDocumentRequestStatus` | Le cabinet voyait les demandes de pièces en lecture seule : impossible de dire « reçue », donc impossible de savoir ce qui restait dû. |
| `runAllSubscriptions` | **Le nom mentait** : elle n'a jamais touché aux abonnements — elle exécute tous les modèles d'écriture. Introuvable sous ce nom, elle n'était donc appelée nulle part, et générer les écritures récurrentes du mois était impossible. |
| `togglePlanActive` | N'écrivait **qu'une ligne d'audit** (« plan activé/désactivé ») sans modifier aucun état. |

## Spécification

| # | Exigence | Traduction |
|---|---|---|
| 1 | Toute mutation se voit | `setDocStatus`, `setDocCategory`, `setDocumentRequestStatus` écrivent une ligne d'audit avec l'avant → après |
| 2 | Pas de bruit | Une valeur identique n'écrit **rien** ; un identifiant inconnu ne casse rien et n'écrit rien |
| 3 | Pièce terminée | Bouton « Archiver » sur les pièces classées (jamais sur `non_classe`) |
| 4 | Nature corrigeable | Sélecteur de nature dans la modale de classement (8 natures du modèle) |
| 5 | Demande statuable | Sélecteur de statut côté cabinet, avec les 5 états réels de `RequestStatus` |
| 6 | Nom honnête | `runAllSubscriptions` → `runAllEntryTemplates`, et un bouton « Tout exécuter » dans « Mes modèles » |
| 7 | Ce qui ment s'en va | `togglePlanActive` supprimée : un audit qui annonce un changement inexistant est pire que pas d'audit |

## Livrables

- `src/lib/actions.ts` : 3 mutations auditées, renommage, suppression.
- `src/pages/Documents.tsx` : bouton « Archiver », nature dans la modale.
- `src/pages/Requests.tsx` : statut de demande, bouton « Tout exécuter ».
- `src/lib/__tests__/documentActions.test.ts` — 9 tests.

## Critères d'acceptation

1. `setDocStatus(doc, "archive")` → statut `archive` **et** audit `DOC_STATUS` avec « a_traiter → archive ».
2. Même statut → aucune nouvelle ligne d'audit.
3. `setDocCategory(doc, "bank")` → audit « invoice → bank » ; second appel identique → rien.
4. Identifiant inconnu → ni exception, ni audit.
5. Demande créée en `sent` → `received` enregistré et audité (« sent → received »).
6. `runAllEntryTemplates(companyId)` renvoie exactement le nombre de modèles dotés d'un journal, et crée autant d'écritures.
7. `runAllSubscriptions` et `togglePlanActive` ne sont **plus exportés**.
8. Exports sans usage applicatif : **376 → 370**.
