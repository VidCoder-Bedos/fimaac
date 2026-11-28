# PROMPT — Lot 31 : `actions.ts` — doublons supprimés, exports refermés, clé du dossier unifiée

> Prompt rédigé **avant** exécution, exécuté immédiatement.

## Contexte constaté (suite du point 21, PR #41)

`actions.ts` exposait **21 exports sans appelant**. L'audit de P26 s'arrêtait au
chiffre ; il fallait trancher un par un. Trois familles apparaissent :

1. **Doublons assumés** : `addCompany` (« conservée pour compatibilité »,
   remplacée par `addCompanyWithAccess`), et trois alias
   (`addClientRequest`, `createServiceRequest`, `setServiceRequestStatus`).
2. **Erreurs de surface** : `currentUserId` (66 usages internes),
   `currentOrgId` (50), `fiscalAdjustmentsFor` (2), `updateFSSession` (6) —
   privés exportés.
3. **Contournements** : `getCurrentCompany` / `clearCurrentCompany` n'étaient
   jamais appelés parce que le shell et la déconnexion recopiaient la clé
   `fimaac_company` **en dur** — trois copies d'une même clé dans trois fichiers.

## Décision

- Doublons → **supprimés** (les appelants utilisent la fonction réelle, dont le
  nom dit ce qu'elle fait).
- Privés → `export` **retiré** : la surface publique ne promet plus l'intimité.
- Contournés → **branchés** : une seule définition de la clé, dans
  `src/lib/companyScope.ts`, utilisée par le shell et par `logout()`.
- Non remplaçables et sans appelant → **documentés « à trancher »**, pas supprimés
  au hasard.
- Bonus trouvé en chemin : `markNotificationRead` n'était appelé par personne —
  cliquer une notification ne la marquait pas lue. Branché.

## Spécification

| # | Exigence | Traduction |
|---|---|---|
| 1 | Clé unique | `COMPANY_SCOPE_KEY` + `getStoredCompanyId` / `storeCompanyId` / `clearStoredCompanyId` |
| 2 | Robustesse | Stockage indisponible (quota, navigation privée, rendu serveur) → aucune exception, `null` |
| 3 | Déconnexion | `logout()` efface le dossier actif : il ne réapparaît pas chez l'utilisateur suivant |
| 4 | Notifications | Clic sur une notification non lue → lue ; bouton accessible, libellé explicite |
| 5 | Garde-fou | Test : le littéral `fimaac_company` n'existe que dans `companyScope.ts` |
| 6 | Garde-fou | Test : les six exports supprimés/fermés ne réapparaissent pas dans `actions.ts` |
| 7 | Honnêteté | Le document d'audit donne le verdict de chaque export, y compris « conservé » |

## Livrables

- `src/lib/companyScope.ts`.
- `src/lib/actions.ts` (4 suppressions, 4 exports refermés, `setCurrentCompany` délègue).
- `src/components/AppLayout.tsx` (lecture de la clé, notification lue au clic).
- `src/lib/auth.ts` (`logout` → `clearStoredCompanyId`).
- `docs/AUDIT_EXPORTS_MORTS.md` (tableau de verdicts).
- `src/lib/__tests__/companyScope.test.ts` — 7 tests.

## Critères d'acceptation

1. `storeCompanyId("c-42")` puis `getStoredCompanyId()` = `"c-42"`.
2. `clearStoredCompanyId()` → `null` (déconnexion réelle).
3. Stockage qui lève une exception ou absent → `null` et aucune exception.
4. `"fimaac_company"` n'apparaît que dans `companyScope.ts` (hors tests).
5. `actions.ts` n'exporte plus `addCompany`, `addClientRequest`,
   `createServiceRequest`, `setServiceRequestStatus`, `getCurrentCompany`,
   `clearCurrentCompany`, ni les quatre helpers internes — mais exporte toujours
   `createClientRequest` et `addCompanyWithAccess`.
6. Exports sans usage : **386 → 376**.
