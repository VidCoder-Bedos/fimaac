# FIMAAC — Référentiel de compréhension (document de référence)

> **Usage** : ce document est la mémoire de travail du projet. Il est destiné à être lu (par moi) au début de chaque nouvelle conversation et à servir de base à la rédaction des prompts de développement.
> **Dernière mise à jour** : 28/11/2026 — correspond au commit `6db2b62` (code applicatif `1c828db`), en production sur `https://fimaac-9f4v.vercel.app`.
> **Statut de chaque affirmation** : `[E]` exécuté · `[L]` lu dans le code · `[H]` hypothèse à confirmer.

---

## 1. Identité du produit

| | |
|---|---|
| Nom | FIMAAC |
| Nature technique | SPA React 19 + Vite 7 + Tailwind 4, **sans backend**, données en `localStorage` (`fimaac_db_v1`) |
| Domaine | Comptabilité SYSCOHADA révisé, finance, fiscalité et social — espace OHADA, Togo en priorité |
| Cible | Cabinets d'expertise comptable (5–50 collaborateurs), leurs clients, et l'éditeur (super admin) |
| Build | `npm run build` → `dist/index.html` unique 2,1 Mo (615 ko gzip) via `vite-plugin-singlefile` |
| Déploiement | Vercel, projet `vidcoder-bedos/fimaac`, branche de production `main`, auto-deploy au merge |
| Variables d'environnement | aucune |
| Dépendances clés | exceljs, jszip, framer-motion, lucide-react, react-router-dom (HashRouter) |
| Langue / devise | français, XOF (FCFA), Togo (TG) en dur |

### Doctrines non négociables du produit
1. **Ne rien inventer** : valeur inconnue = `null`, jamais `0` ; taux non vérifié = avertissement explicite ; l'IA refuse de publier une règle non sourcée.
2. **Traçabilité intégrale** : montant → formule → comptes → écritures → règle → version → date d'effet.
3. **Une plateforme, tout le cycle** : pièce → écriture → balance → états → liasse → obligations → portail client.

---

## 2. Structure du code

```
src/
  App.tsx                 41 routes, 3 layouts, gardes de rôle, PasswordGate
  main.tsx                StrictMode + createRoot
  lib/
    types.ts              modèle de données (40 collections, 60+ interfaces)
    store.ts              état global (useSyncExternalStore) + migrations + multi-onglets
    actions.ts            81 verbes métier — POINT D'ÉCRITURE UNIQUE
    auth.ts               login / logout / inscription cabinet & client / session
    permissions.ts        16 permissions, 13 rôles, table ROLE_PERMISSIONS
    hash.ts               hash de mot de passe côté client (NON cryptographique)
    seed.ts               jeu de démonstration (102 écritures, 1 274 comptes)
    accounting.ts         totaux, balance, grand livre, résumé financier, ratios
    chart.ts              1 274 comptes SYSCOHADA (source déclarée officielle)
    tax.ts                TVA / IS « moteur historique » utilisé par la page Fiscalité
    regulatory-engine.ts  taux, barème IRPP, CNSS/AMU, versions réglementaires
    regulatory-extensions.ts  TVM, TPU, IRPP par catégorie  [DORMANT]
    declarationEngine.ts  TVA/CNSS/DAS explicables + traçabilité  [DORMANT]
    liasse.ts             états financiers + export + remplissage modèle
    liasseEngine.ts       balance 6 colonnes + cohérence SYSCOHADA + couverture mapping
    liasseFiller.ts       remplissage complet  [DORMANT]
    engine/               moteur factorisé bilan/CR/TFT/fiscalité/contrôles  [DORMANT]
    production/           zones, scoring de complétude, graphe de dépendances  [DORMANT]
    notes.ts              946 lignes de notes annexes  [DORMANT]
    obligations.ts        catalogue 14 obligations + génération d'instances  [DORMANT]
    crossCheck.ts         contrôles croisés compta ↔ paie ↔ banque  [DORMANT]
    financialStatements.ts  3ᵉ construction des états  [DORMANT]
    importers.ts / universalImport.ts  lecture XLSX/CSV + détection de colonnes
    reconstitution.ts / reports.ts / excelAudit.ts  audit et patch non destructif de classeurs
    ocr.ts                extraction TXT/CSV/XLSX + refus explicite sur image
    ai.ts                 6 agents, réponses déterministes par mots-clés
    documentStore.ts      registre des fichiers **en mémoire** (perdus au rechargement)
    format.ts, hash.ts, scope.ts, liveCoherence.ts, normative.ts, analytics.ts, ledger.ts
  components/             ui.tsx (design system), Layout.tsx, AppLayout.tsx, charts.tsx,
                          EntryEditor, DocumentViewer, GlobalSearch, Can, ErrorBoundary, AccountInquiry
  pages/                  23 fichiers = 41 routes
docs/                     journaux de lots, décisions, audits, ce référentiel
```

### Conventions de code observées (à respecter dans toute contribution)
- Écritures métier **uniquement** via `actions.ts` → `mutate()` ; jamais d'écriture directe dans `useDB()`.
- Un montant en base est un **entier FCFA**. Affichage via `fcfa()`, formatage date via `format.ts`.
- Identifiants via `uid()`. Dates ISO (`toISOString`).
- Toute nouvelle collection doit être ajoutée à `COLLECTION_KEYS` + `DB_VERSION++` dans `store.ts`, sinon crash sur état existant.
- Les moteurs restent **purs** (pas d'accès au store) : entrée = données, sortie = résultat + trace.
- Commentaires de code en français, référencés par lot (`B1 —`, `M2 —`, `Lot 5 —`).

---

## 3. Modèle de données (40 collections)

Comptabilité : `accounts` (1 274), `journals` (48), `fiscalYears`, `periods`, `entries`, `tiers`, `permanentDocs`
Fiscalité : `taxRules`, `taxRulesV2`, `taxBrackets` (8), `socialRules` (2), `taxProfiles`, `taxDeclarations`, `taxDeadlines`, `declarationTemplates`, `declarationWorkflows`
Social : `employees`, `payslips`, `payrollConfig`, `payrollComponents`
Trésorerie & actifs : `bankAccounts`, `bankTransactions`, `reconRules`, `fixedAssets`, `stockItems`
Documents : `documents` (métadonnées), fichiers en mémoire seulement
Cabinet : `organizations`, `users`, `companies`, `missions`, `tasks`, `notifications`, `auditLogs`
Relation client : `clientRequests`, `documentRequests`, `taxPaymentRequests`, `complianceIssues`, `conversations`
Plateforme : `subscriptions`, `invoices`, `announcements`
États financiers : `fsSessions`

Champs pivots : `Company.organizationId` (propriétaire) + `Company.cabinetOrganizationId` (cabinet gestionnaire), `User.role` + `User.userType` + `User.mustChangePassword`, `JournalEntry.status` (`draft|in_review|validated|rejected|cancelled`) + `attachmentDocIds`, `AccountingPeriod.status` (`open|closed`).

---

## 4. Comptes de démonstration (jeu de seed)

| Compte | Mot de passe | Rôle |
|---|---|---|
| `fimaac.africa@gmail.com` | `Fimaac@2026` | super_admin (plateforme) |
| `compta@cabinet.demo` | `Cabinet@2026` | cabinet_admin |
| `assistant@cabinet.demo` | `Cabinet@2026` | accountant |
| (client portail) | `Client@2026` | client |

Deux entreprises : « SARL Technologie Lomé » (**102 écritures**, seule alimentée) et « Distribution Golfe SARL » (0 écriture). Écart à corriger : un dossier de démo vide n'aide pas à démontrer le multi-dossiers.

---

## 5. Registre des défauts (base de travail des prompts)

Sévérité : **S1** bloquant client · **S2** majeur · **S3** moyen · **S4** mineur.

| ID | Sév. | Défaut | Preuve | Où |
|---|---|---|---|---|
| D-01 | S1 | Bilan du moteur factorisé déséquilibré : actif 25 820 053 vs passif 15 233 349 | [E] | `lib/engine/agregateurs.ts`, `etats.ts` |
| D-02 | S1 | `totalPassif` ≠ somme de ses composantes (11 550 992 vs 15 233 349) | [E] | `lib/engine/etats.ts` |
| D-03 | S1 | Résultat de l'exercice non repris au passif (`resultat = 0` alors que CR = −587 805) | [E] | `lib/engine/etats.ts` |
| D-04 | S1 | Créditeurs de classe 4 hors 401 non mappés (`autresDettes = 0` : TVA, CNSS, 422, 444…) | [E] | `lib/engine/agregateurs.ts` |
| D-05 | S1 | Trois moteurs d'états divergents : actif 25 820 053 (`engine`) vs 28 140 921 (`liasse`) | [E] | `engine/`, `liasse.ts`, `financialStatements.ts` |
| D-06 | S1 | Bilan `liasse` déséquilibré de 108 000 | [E] | `lib/liasse.ts` |
| D-07 | S1 | IS à deux valeurs : 0 (page Fiscalité) vs 201 900 (minimum de perception, moteur dormant) | [E] | `lib/tax.ts` vs `lib/engine/fiscalite.ts` |
| D-08 | S1 | Paie : retenue forfaitaire 5 % au lieu du barème IRPP → 49 500 FCFA/mois sous-retenus sur 2 salariés | [E] | `lib/actions.ts` `runPayroll`, `payrollConfig.irppBrackets = []` |
| D-09 | S1 | AMU (2 %/4 %) jamais retenue malgré sa présence dans `payrollConfig` et `socialRules` | [E] | `lib/actions.ts` `runPayroll` |
| D-10 | S1 | Sécurité : auth côté client, hash non cryptographique, **0 appel `hasPermission` dans `actions.ts`**, toutes les données dans un JSON local | [E] | `lib/auth.ts`, `lib/hash.ts`, `lib/actions.ts` |
| D-11 | S1 | Perte de données : quota ~5 Mo → saturation vers ~1 160 écritures, erreur de quota avalée silencieusement | [E] | `lib/store.ts` `persist()` |
| D-12 | S2 | Import universel : en-tête « Code » non reconnu → **0 ligne importée sans message d'erreur** | [E] | `lib/importers.ts` `ROLE_PATTERNS` |
| D-13 | S2 | Import universel : une colonne « N° » est interprétée comme montant → montants 1 et 2 au lieu de 1 250 000 / 2 400 000 | [E] | `lib/importers.ts` `normalize` |
| D-14 | S2 | Base de TVA affichée = TVA collectée (3 634 200) au lieu du CA HT (20 190 000) | [E] | `lib/tax.ts` `computeTVA` |
| D-15 | S2 | Libellés TVA faux sur 4 fichiers : « 433 » (Autres organismes sociaux) et « 435 » (inexistant) au lieu de 443/444/445 | [E] | `tax.ts`, `pages/Tax.tsx`, `ai.ts`, `seed.ts` |
| D-16 | S2 | Déclaration TVA de démonstration : 90 000 stockés vs 2 473 332 recalculés | [E] | `lib/seed.ts` |
| D-17 | S2 | `declarationEngine` : recouvrement de préfixes (445 ⊃ 4451/4452) → déductible compté deux fois | [E] | `lib/declarationEngine.ts` `TVA_FIELDS` |
| D-18 | S2 | 4 945 lignes de moteurs dormants (declarationEngine, obligations, crossCheck, notes, engine, production, financialStatements, regulatory-extensions, liasseFiller, formulaRegistry) | [E] | `lib/**` |
| D-19 | S2 | Pièces : aucun fichier persisté, aperçu perdu au rechargement | [L] | `lib/documentStore.ts` |
| D-20 | S2 | Accessibilité : 1 `aria-*`, 0 `role`, 2 `htmlFor`, 0 `tabIndex` | [E] | `src/**` |
| D-21 | S2 | Mapping liasse : 6 postes SYSCOHADA sans préfixe de compte (AG 207, AH 208, TG 74, TK 76, TM 796, RN 683) | [E] | `lib/liasseEngine.ts` |
| D-22 | S3 | `generateObligationInstances` : 63 instances dont 50 « en retard » (génération rétroactive) | [E] | `lib/obligations.ts` |
| D-23 | S3 | Écriture datée hors exercice rattachée silencieusement à `periods[0]` | [L] | `lib/actions.ts` `addEntry` |
| D-24 | S3 | Numérotation des pièces = `count + 1` par journal → doublons possibles après suppression/import | [L] | `lib/actions.ts` `addEntry` |
| D-25 | S3 | Export FEC incomplet : 15 colonnes, pas de devise, `DateRglt` vide | [L] | `lib/ledger.ts` `exportFEC` |
| D-26 | S4 | Audit : `ip` figée `127.0.0.1`, `before` toujours `null`, pas de chaînage | [L] | `lib/actions.ts` `audit()` |
| D-27 | S4 | OCR XLSX : 1 champ sur 10 lu ; PDF lus seulement si texte non compressé | [E] | `lib/ocr.ts` |
| D-28 | S4 | `alert()` natif résiduel dans certains flux | [L] | `pages/Tax.tsx`, `pages/StatementsWorkshop.tsx` |

> À chaque correction : mettre à jour cette table (statut + commit) plutôt que la supprimer, pour garder la mémoire des régressions.

---

## 6. Ce qui est solide et ne doit pas être cassé

1. Contrôles de partie double et de validité des comptes (`isEntryValidatable`).
2. File de mutations sérialisée + `structuredClone` + migration versionnée (`store.ts`).
3. Point d'écriture unique (`actions.ts`) et moteurs purs.
4. Refus d'inventer : OCR (`null` plutôt que `0`), IA (jamais de taux non sourcé), taux `verified: false`.
5. Design system unique (`components/ui.tsx`) et hiérarchie de page homogène.
6. Blocage effectif de la saisie dans une période clôturée.
7. Portail client : 21 actes administratifs avec formulaires dynamiques.
8. `HashRouter` + fichier unique : déploiement statique sans configuration serveur.

---

## 7. Comment écrire un prompt de développement pour FIMAAC

Structure imposée (12 blocs) :

1. **Besoin métier réel** — le problème du cabinet, pas la fonctionnalité.
2. **Module concerné** — chemin exact (`src/pages/X.tsx`, `src/lib/Y.ts`).
3. **État de l'existant** — ce qui existe déjà, preuves (fichier:ligne), ce qui est dormant.
4. **Contraintes d'architecture** — `actions.ts` comme point d'écriture, moteurs purs, `DB_VERSION++` si nouvelle collection.
5. **Non-régression explicite** — liste des comportements à préserver (§6).
6. **Résultat attendu** — description observable, écran par écran, avec les libellés exacts.
7. **Interactions** — navigation, états de chargement/vide/erreur, permissions requises.
8. **Règles de gestion** — formules, arrondis, ordre des opérations, source de chaque taux.
9. **Cas particuliers** — 0, négatif, devise, exercice clos, données manquantes, multi-dossiers.
10. **Critères de validation** — chiffres attendus sur le jeu de démo (reproductibles).
11. **Tests** — cas nominal + 3 cas limites + cas de régression.
12. **Cohérence globale** — dépendances touchées, impact sur les autres modules, mise à jour du registre D-xx.

Règles de rédaction :
- Jamais de prompt « vague » : chaque nombre, chaque libellé, chaque fichier est nommé.
- Toujours distinguer **fait vérifié** et **hypothèse**.
- Toujours chiffrer l'impact (écart en FCFA, nombre d'écritures, taille, temps).
- Une correction = un prompt = un commit = un déploiement vérifié.

### Vérification après déploiement
```bash
gh api repos/VidCoder-Bedos/fimaac/commits/main/status \
  --jq '.statuses[] | "\(.context) → \(.state) — \(.description)"'
# attendu : Vercel → success — Deployment has completed
```

---

## 8. Questions ouvertes (à trancher avec le propriétaire du produit)

1. **Quel moteur d'états financiers est la référence ?** `engine`, `liasse` ou `financialStatements` ? La réponse conditionne toutes les corrections P0.
2. **Le minimum de perception IS** doit-il être appliqué (201 900 sur la démo) ou est-ce une option par dossier ?
3. **Le barème IRPP** embarqué (8 tranches) est-il celui à retenir pour la paie, ou la retenue forfaitaire de 5 % est-elle volontaire (régime particulier) ?
4. **L'AMU** est-elle due par tous les employeurs, avec quel plafond ?
5. **La cible réelle du premier client** : cabinet de 5 collaborateurs au Togo, ou éditeur multi-pays dès le départ ? Cela décide de l'ordre backend / multi-pays.
6. **Le modèle GUDEF officiel** peut-il être embarqué (licence, millésime) ou doit-il rester téléversé par l'utilisateur ?
7. **La persistance** doit-elle être serveur dès la V1 (recommandé) ou un repli IndexedDB chiffré est-il acceptable pour un pilote ?
8. **Le domaine définitif** : `fimaac.vercel.app`, `fimaac-9f4v.vercel.app` ou un domaine propre ? (impact : migration de `localStorage` = perte de données)
