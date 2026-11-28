# Audit — exports sans usage applicatif

> Mesure reproductible : `npm run audit:dead` (`scripts/dead-exports.mjs`).
> Un « export sans usage applicatif » n'est utilisé par **aucun** fichier de
> `src/` hors `__tests__`, commentaires exclus.

## Constat

**376 exports sur 926** ne sont appelés par aucun code de l'application
(**53** ne sont appelés que par des tests) — après la première passe de
suppressions de P27 (386 / 932 avant). Ce chiffre n'est pas un défaut en
soi : un référentiel de constantes ou un registre de règles peut légitimement
n'être lu que par ses tests. Le défaut, c'est **une promesse que rien ne tient** :
lire `export function validerLiasse()` et croire que le logiciel valide.

| Fichier | Exports sans usage | Ce que c'est réellement |
|---|---:|---|
| `src/lib/engine/agregateurs.ts` | 39 | Règles `RULE_*` du moteur factorisé — consommées par le moteur lui-même (registre) |
| `src/lib/regulatory-extensions.ts` | 23 | Référentiel TVM / TPU / régimes — **documentaire**, jamais branché |
| `src/lib/actions.ts` | 10 | 6 actions encore non branchées + 4 types de signature (voir P27) |
| `src/lib/obligations.ts` | 18 | Helpers de calcul de dates, utilisés en interne ou par les tests |
| `src/lib/archive/*` | 30 | Modules **archivés** en P25 — leur non-usage est la décision |
| `src/lib/regulatory-engine.ts` | 17 | Barèmes IRPP/CNSS — consommés indirectement par `paie.ts` |
| `src/lib/types.ts` | 15 | Types exportés, non importés (contrats de données futurs) |
| `src/lib/analytics.ts` | 11 | Séries du tableau de bord, non toutes affichées |
| `src/lib/production/*` | 17 | Graphe de dépendances de production, non branché |
| `src/lib/etatsMapping.ts` | 7 | Mapping d'états, partiellement consommé |

## Le cas qui n'était pas un compte : le moteur factorisé

`src/lib/engine/**` (970 lignes) se présentait comme **co-source de vérité** avec
`lib/fiscalite.ts` (« source de vérité, partagée avec le moteur factorisé »).
Vérification faite : il n'est importé **que par les tests**. Personne ne
l'exécutait en production — et deux commentaires d'en-tête affirmaient le
contraire.

Décision : il devient explicitement un **oracle de contre-vérification**.

- Il **reste** : recalculer indépendamment est la meilleure défense contre une
  régression silencieuse du moteur affiché (les tests comparent déjà bilan,
  TAFIRE et résultat, dont les **27 960 921** du dossier de démonstration).
- Il **n'entre pas** en production : le test `engineOracle.test.ts` échoue si un
  fichier hors `__tests__` l'importe. Si ce moteur doit un jour être branché, la
  décision s'écrira — elle ne se subira pas.
- Les en-têtes mensongers sont corrigés (`engine/index.ts`, `lib/tax.ts`).

## Verdicts

| Groupe | Verdict |
|---|---|
| `src/lib/archive/**` | Archivé (P25) — non-usage = décision, protégé par test |
| `src/lib/engine/**` | **Oracle de test** — protégé par test, en-tête corrigé |
| Référentiels (`regulatory-extensions`, `RULE_*`, `types`) | **Conservés-documentés** : ils portent un référentiel lisible ; le commentaire doit dire qu'ils ne sont pas branchés |
| `actions.ts` | **Première passe faite (P27)** — voir ci-dessous ; 6 actions restent à trancher |
| `analytics`, `production`, `etatsMapping` | **À trancher** au prochain lot, avec le même critère : branché, archivé, ou supprimé |

Aucune suppression en bloc : le registre impose de trancher **un par un**, et ce
document est la liste de travail.

## Ce que ce lot a réellement changé

1. La mesure existe et se rejoue (`npm run audit:dead`).
2. Le rôle du moteur factorisé est écrit, corrigé dans le code, et protégé.
3. La catégorie « conservé-documenté » est nommée : elle évite de confondre un
   référentiel utile avec du code mort, et inversement.

## P27 — Première passe sur `actions.ts`

Vérification une par une (usage hors `__tests__`, commentaires exclus) :

| Export | Constat | Verdict |
|---|---|---|
| `addCompany` | Doublon de `addCompanyWithAccess`, conservé « pour compatibilité », 0 appelant | **Supprimé** |
| `addClientRequest` | Alias de `createClientRequest` (0 appelant) | **Supprimé** |
| `createServiceRequest` | Alias du même `createClientRequest` (0 appelant) | **Supprimé** |
| `setServiceRequestStatus` | Alias de `setClientRequestStatus` (0 appelant) | **Supprimé** |
| `getCurrentCompany` | Le shell lisait la clé **en dur** au lieu de l'appeler | **Remplacé** par `companyScope.getStoredCompanyId()`, utilisé par le shell |
| `clearCurrentCompany` | La déconnexion recopiait la clé **en dur** | **Remplacé** par `companyScope.clearStoredCompanyId()`, utilisé par `logout()` |
| `currentUserId`, `currentOrgId`, `fiscalAdjustmentsFor`, `updateFSSession` | 66, 50, 2 et 6 usages **internes** | `export` retiré : la surface publique ne promet plus ce qui est privé |
| `ensureFiscalYear`, `setDocCategory`, `setDocStatus`, `setDocumentRequestStatus`, `runAllSubscriptions`, `togglePlanActive` | 0 appelant, aucune fonction en place ne les remplace | **À trancher** : soit un écran les branche, soit ils disparaissent |
| `CompanyAccessInput`, `CompanyAccessResult`, `AccessResult`, `PlatformAnnouncement` | Types de signature d'API exportées, ou contrat de données | **Conservés** (un type exporté accompagne la fonction qui le prend) |

Le vrai défaut trouvé ici n'était pas une fonction morte, c'était une **clé
dupliquée** : `fimaac_company` était écrite en dur dans trois fichiers. Elle vit
désormais dans `src/lib/companyScope.ts`, et un test échoue si le littéral
réapparaît ailleurs. Le dossier actif ne survit plus à une déconnexion — il
pouvait sinon réapparaître chez l'utilisateur suivant.

Bilan de la passe : **10 exports en moins** (386 → 376), quatre doublons
supprimés, deux fonctions réellement utilisées là où le code recopiait leur
travail.
