# Suivi des lots — session en cours (chat)

> **Convention de numérotation.** Chaque message de code envoyé par le porteur du projet
> constitue un **LOT**, numéroté à partir de 1 **dans cette session uniquement**.
>
> ⚠️ **Ne pas confondre** avec les « 9 lots » décrits dans `JOURNAL_RECEPTION.md` : ce
> document est l'historique **d'une session antérieure** (routeur, pages, seed 102
> écritures, 49 modèles d'écritures, 35 notes, pipeline GUDEF…). Ce contenu n'a **pas**
> été retransmis ni rejoué dans la session en cours. Il n'est donc **pas renuméroté** et
> reste tel quel.
>
> **Règle de travail :** aucun `npm run build` n'est lancé tant que le porteur n'a pas
> donné son feu vert.

---

## LOT 1 — Socle backend + docs + composant consultation de compte

| Fichier reçu | Destinataire | Statut |
|---|---|---|
| `schema.prisma` | `backend/prisma/schema.prisma` | ✅ |
| `docker-compose.yml` | `backend/docker-compose.yml` | ✅ |
| `README.md` backend | `backend/README.md` | ✅ |
| Audit Phase 0 | `docs/AUDIT_PHASE0.md` | ✅ |
| Doc OCR & pièces | `docs/OCR_PIECES.md` | ✅ |
| Journal de réception (historique) | `docs/JOURNAL_RECEPTION.md` | ✅ (conservé tel quel) |
| Dump classeur GUDEF (formules + valeurs) | `scripts/dump_workbook_full.py` | ✅ |
| Dump classeur GUDEF (read-only) | `scripts/dump_workbook_readonly.py` | ✅ |
| Générateur barème Liquidation DP | `scripts/generate-liquidation-dp.mjs` | ✅ |
| `AccountInquiry.tsx` | `src/components/AccountInquiry.tsx` | ✅ |
| `Layout.tsx` (**implémentation complète**) | voir note 1 | ✅ |

**Note 1 — décision d'intégration.** Le lot 1 a livré `Layout.tsx` avec l'implémentation
complète (`WorkspaceLayout`, `PortalLayout`, `AdminLayout`, `useCompanyScope`, `Page`,
`NAV`). Le lot 2 a ensuite livré un `Layout.tsx` **shim** qui ré-exporte depuis
`./AppLayout`. Pour respecter les deux sans casser les imports des pages, l'implémentation
a été déplacée dans `src/components/AppLayout.tsx` (contenu strictement identique) et
`Layout.tsx` est le shim. **Si un lot futur retransmet `Layout.tsx` avec le code complet,
le signaler explicitement** pour éviter l'écrasement par le shim.

**Dépendances installées** (via npm, pas d'édition manuelle de `package.json`) :
`react-router-dom@7`, `framer-motion`, `lucide-react`.

---

## LOT 2 — Design system, graphiques, moteur factorisé

| Fichier reçu | Destinataire | Statut |
|---|---|---|
| `charts.tsx` (11 graphiques) | `src/components/charts.tsx` | ✅ |
| `DocumentViewer.tsx` | `src/components/DocumentViewer.tsx` | ✅ |
| `EntryEditor.tsx` | `src/components/EntryEditor.tsx` | ✅ |
| `GlobalSearch.tsx` | `src/components/GlobalSearch.tsx` | ✅ |
| `ui.tsx` (design system) | `src/components/ui.tsx` | ✅ |
| `Layout.tsx` (**shim**) | `src/components/Layout.tsx` | ✅ (remplace le lot 1) |
| moteur `types.ts` | `src/lib/engine/types.ts` | ✅ |
| moteur `soldes.ts` | `src/lib/engine/soldes.ts` | ✅ |
| moteur `agregateurs.ts` | `src/lib/engine/agregateurs.ts` | ✅ |
| moteur `etats.ts` | `src/lib/engine/etats.ts` | ✅ |
| moteur `fiscalite.ts` | `src/lib/engine/fiscalite.ts` | ✅ |
| moteur `controles.ts` | `src/lib/engine/controles.ts` | ✅ |
| moteur `index.ts` (+ `runEngine`) | `src/lib/engine/index.ts` | ✅ |
| production `context.ts` | `src/lib/production/context.ts` | ✅ |
| production `dependencyGraph.ts` | `src/lib/production/dependencyGraph.ts` | ✅ |
| production `scoring.ts` | `src/lib/production/scoring.ts` | ✅ |
| production `index.ts` | `src/lib/production/index.ts` | ✅ |

**⚠️ Manquants signalés à l'issue du lot 2** : `src/lib/production/types.ts`
(`ProdContext`, `ZoneDef`, `DataPoint`, `NoteResult`…) et `src/lib/production/zones.ts`
(`ZONE_REGISTRY`). → fournis au lot 3.

---

## LOT 3 — Actions, accounting, analytics, IA, auth

| Fichier reçu | Destinataire | Statut |
|---|---|---|
| production `types.ts` (domain types) | `src/lib/production/types.ts` | ✅ |
| production `zones.ts` (`ZONE_REGISTRY`, 69 zones) | `src/lib/production/zones.ts` | ✅ |
| `accounting.ts` | `src/lib/accounting.ts` | ✅ |
| `actions.ts` (~60 actions) | `src/lib/actions.ts` | ✅ |
| `ai.ts` (6 agents) | `src/lib/ai.ts` | ✅ |
| `analytics.ts` | `src/lib/analytics.ts` | ✅ |
| `auth.ts` (hash **synchrone**) | `src/lib/auth.ts` | ✅ |

**Note 2 — doublon détecté.** Le contenu transmis sous le nom `production/types.ts`
était un **doublon de `engine/types.ts`** (BalanceRowInput, EngineContext, RULE…),
déjà en place depuis le lot 2. Le **nouveau** contenu (domain types `ZoneDef`,
`DataPoint`, `NoteResult`, `CompletenessScore`, `ProductionSession`) a bien été utilisé
pour `production/types.ts`, conformément au nom du fichier. Trace conservée ici.

---

## LOT 4 — Plan SYSCOHADA officiel, catalogue client, cross-check, déclarations

| Fichier reçu | Destinataire | Statut |
|---|---|---|
| Plan SYSCOHADA (classes 1→9) | `src/lib/chart.ts` | ✅ |
| Shim `chartOfAccounts` | `src/lib/chartOfAccounts.ts` | ✅ |
| Catalogue des demandes client (21 actes) | `src/lib/clientCatalog.ts` | ✅ |
| Barrel types portail | `src/lib/clientCatalogTypes.ts` | ✅ (doublon dédupliqué) |
| Cross-check engine (7 contrôles) | `src/lib/crossCheck.ts` | ✅ |
| Declaration engine + data lineage | `src/lib/declarationEngine.ts` | ✅ |
| Registre mémoire des `File` | `src/lib/documentStore.ts` | ✅ |
| Shim `editions` | `src/lib/editions.ts` | ✅ |

**Nouvelles dépendances révélées par le lot 4** (modules pas encore reçus) :

| Importé par | Module attendu | Symboles nécessaires |
|---|---|---|
| `crossCheck.ts` | `src/lib/regulatory-extensions.ts` | `reconcileVAT` → `{ caComptable, caTva, ecartCa, anomalies }` |
| `declarationEngine.ts` | `src/lib/regulatory-engine.ts` | `calculateIRPP`, `calculateCNSS` + types `SocialRule`, `TaxBracket` |
| `editions.ts` | `src/lib/ledger.ts` | `auxiliaryLedger`, `agedBalance`, `echeancier`, `exportFEC`, `JLIB` |
| `chart.ts` | `src/lib/types.ts` | `Account` (`type`, `depth`, `nature`, `keywords`), `AccountClass` |

---

## État d'avancement à la fin du lot 4

### En place (37 fichiers de code + 8 artefacts)
- `src/components/` — `ui`, `AppLayout` + shim `Layout`, `charts`, `GlobalSearch`,
  `DocumentViewer`, `EntryEditor`, `AccountInquiry`
- `src/lib/` — `accounting`, `actions`, `ai`, `analytics`, `auth`, `chart`,
  `chartOfAccounts`, `clientCatalog`, `clientCatalogTypes`, `crossCheck`,
  `declarationEngine`, `documentStore`, `editions`
- `src/lib/engine/` — 7 modules
- `src/lib/production/` — 6 modules
- Hors app — `backend/` (3), `docs/` (4 avec celui-ci), `scripts/` (3)

### Toujours attendus (17 modules `lib`)
```
types.ts              store.ts            format.ts          hash.ts
permissions.ts        ocr.ts              tax.ts             ledger.ts
liasse.ts             liasseEngine.ts     regulatory-engine.ts
regulatory-extensions.ts                  seed.ts
journals.ts           entryTemplates.ts   notes.ts           liasseFiller.ts
```

### Toujours attendus (pages + entrée)
```
App.tsx (HashRouter, Require, homeFor, /extractor)
src/pages/… (Dashboard, Companies, CompanyDetail, Accounting, Documents, Tax,
Banque, Immobilisations, Stocks, Paie, Missions, Obligations, AtelierEtats,
AtelierConformite, Liasse, EtatsFinanciers, Conformite, Rapports, Demandes,
IAAssistant, Facturation, Settings, Portal, Admin/AdminPages, Login,
WorkbookExtractor, Landing…)
```

### Erreurs TS attendues (non bloquantes, rien à corriger)
Toutes les erreurs actuelles proviennent de modules non encore retransmis — c'est la
conséquence normale d'un assemblage par lots. Elles disparaîtront à l'arrivée des
modules listés ci-dessus. Exemples connus :
- `src/lib/types.ts` manquant → cascade de `TS7006` (paramètres implicites) dans
  `actions.ts`, `analytics.ts`, `accounting.ts`, `GlobalSearch.tsx`, `AppLayout.tsx`…
- `DocumentViewer.tsx:94` — `Type 'unknown' is not assignable to type 'ReactNode'`
  → se résoudra au typage de `DocumentItem.extraction.fields` dans `types.ts`.
- `liasse.ts` / `liasseEngine.ts` manquants → bloque `production/types.ts`,
  `analytics.ts` (audit B3 : c'est cette chaîne qui tire ExcelJS dans le bundle initial).

---

## Journal des lots à venir

| Lot | Fichiers reçus | Statut |
|---|---|---|
| 1 | socle backend · docs · scripts · `AccountInquiry` · `Layout` (impl) | ✅ intégré |
| 2 | design system · graphiques · viewer · éditeur · recherche · moteur `engine/` · production partielle | ✅ intégré |
| 3 | production types/zones · `accounting` · `actions` · `ai` · `analytics` · `auth` | ✅ intégré |
| 4 | plan SYSCOHADA · catalogue client · cross-check · déclarations · `documentStore` · shims | ✅ intégré |
| 5 | `journals` · `entryTemplates` · `format` · `hash` · `financialStatements` · `formulaRegistry` · `importers` · `importer` (shim) · `ledger` · `excelAudit` (shim) | ✅ intégré |
| 6 | `liasse` · `liasseEngine` · `liasseFiller` · `liveCoherence` · `normative` · `ocr` · `permissions` (v1) | ✅ intégré |
| 7 | `notes` (38 modules) · `obligations` (14) · `ocr` · `permissions` (v2 — **remplace la v1**) · `reconstitution` (shim) · `regulatory-engine` · `regulatory-extensions` | ✅ intégré |
| 8 | `regulatory-extensions` (**remplace**) · `reports` · `seed` · `store` · `tax` · `types` · `universalImport` (shim) · `xlsx-filler` · `xlsx-sanitizer` · `Account.tsx` (shim) | ✅ intégré |
| 9 | `Accounting` · `Admin` (shim) · `AdminPages` (6 écrans) · `AIAssistant` · `Auth` (Login+Register) · `Companies` + `CompanyDetail` · `ConformityWorkshop` · `Dashboard` | ✅ intégré |
| 10 | `Documents` · `Financials` + `Reports` + `Compliance` · `Landing` · `Liasse` (8 onglets) · `Missions` | ✅ intégré |
| 11 | `Obligations` (matrice+calendrier) · `Operations` (Bank+FixedAssets+Inventory+Payroll) · `Portal` (5 routes) · `Reporting` (shim) · `Requests` (4 onglets) · `Settings` (Settings+Billing) · `StatementsWorkshop` · `Tax` (4 onglets) | ✅ intégré |
| 12 | _en attente_ — **dernier lot attendu** | ⏳ |

---

## LOT 11 — intégration détaillée

| Fichier reçu | Destinataire | Contenu |
|---|---|---|
| Centre des obligations | `src/pages/Obligations.tsx` | **Vue unifiée** : 5 sources agrégées (échéances fiscales, demandes doc., déclarations, paiements fiscaux, tâches), `normalizeStatus` (11 statuts), filtres catégorie+statut, 5 KPI, **matrice par catégorie** avec compteurs J-n/retard + montants, **calendrier mensuel** (lundi→dimanche, pastilles colorées par urgence, légende) |
| Opérations | `src/pages/Operations.tsx` | 4 composants : **`Bank`** (pointage manuel/auto, règles par mot-clé, état de rapprochement 521↔relevé avec calcul d'écart), **`FixedAssets`** (amortissement linéaire avec tableau annuel VNC + génération dotation), **`Inventory`** (valorisation stock, ajustement ±), **`Payroll`** (CNSS 4%/17,5% plafonnées, ITS, génération bulletins + écriture de paie équilibrée, taux éditables) |
| Portail client | `src/pages/Portal.tsx` | **5 routes** : `PortalHome` (4 KPI + bannière), `PortalDocuments` (dropzone), `PortalRequests` (3 onglets : demandes du cabinet avec upload, mes demandes, catalogue 8 familles × 21 actes avec formulaires dynamiques), `PortalStatements`, `PortalInvoices` + `DetailModal` (historique, discussion, pièces) |
| Shim Reporting | `src/pages/Reporting.tsx` | → `./Financials` |
| Demandes & modèles | `src/pages/Requests.tsx` | **4 onglets** : demandes documentaires (9 catégories, récurrence), modèles d'écritures (lignes débit/crédit, exécution), paiements fiscaux (TVA/IS/TPA/TSPP/TFE), demandes clients reçues (changement de statut) |
| Paramètres | `src/pages/Settings.tsx` | **`Settings`** (3 onglets : profil avec Avatar + rôle, organisation, données avec export/import JSON + reset) et **`Billing`** (abonnement courant, 4 plans, factures avec paiement simulé) — débloque `Account.tsx` |
| Atelier états | `src/pages/StatementsWorkshop.tsx` | Sessions par entreprise × exercice, 4 KPI, progression 6 statuts (5→100%), éditeur modal 4 onglets (balances via import universel, modèle audit+patch non destructif, contrôles + export liasse, journal) |
| Fiscalité | `src/pages/Tax.tsx` | **4 onglets** : Calculs (TVA + IS avec breakdown explicite et traçabilité), Grille TVA (base HT déduite, collectée 433, récupérable 435), Moteur réglementaire (règles éditables + workflow publication), Échéances & déclarations (calendrier + statuts) |

---

## État d'avancement à la fin du LOT 11

### ✅ En place
| Couche | Fichiers |
|---|---|
| `src/lib` | 45 modules — COMPLETE |
| `src/lib/engine` | 7 modules |
| `src/lib/production` | 6 modules |
| `src/components` | 9 fichiers |
| `src/pages` | **21 fichiers** |

### ✅ RÉSOLU au LOT 11
`src/components/Account.tsx` → `Settings` + `Billing` disponibles dans `./Settings`. **Toutes les erreurs TS sont éliminées.**

## 🏁 LOT 12 — reçu et intégré · BUILD FINAL RÉALISÉ

| Fichier reçu | Destinataire | Remarques |
|---|---|---|
| Extracteur GUDEF public | `src/pages/WorkbookExtractor.tsx` | Route `/extractor` sans authentification — classification 6 types de cellules, vue d'ensemble ou feuille unique, dump markdown copiable |
| Routeur officiel | `src/App.tsx` | `HashRouter` · `Require` + `homeFor` · `Root` (Landing si non connecté) · **24 routes** |
| Styles globaux | `src/index.css` | `@theme` fonts (Sora/Inter/JetBrains Mono) + `.aurora` (2 animations) + `.live-dot` (**2 mécanismes coexistants**) + `.shimmer` + `.ring-gradient` + `@media print` |
| Entrée | `src/main.tsx` · `index.html` | Titre + description + fonts Google |
| Config | `package.json` · `tsconfig.json` · `vite.config.ts` | **Non modifiés** — versions installées déjà compatibles (lucide 1.80 ≥ 1.74, router 7.18.7 ≥ 7.18.5) |

### ⚠️ Conflit de shims résolu
- LOT 8 avait créé `src/components/Account.tsx` → `./Settings` (supposait un Settings dans `components/`)
- LOT 11 a livré `src/pages/Settings.tsx` (Settings + Billing)
- LOT 12 `App.tsx` importe depuis `./pages/Account`

**Résolution** : création de `src/pages/Account.tsx` (shim → `./Settings`) et **suppression** de `src/components/Account.tsx` devenu obsolète.

### ✅ Résultat du build final

| Métrique | Valeur |
|---|---|
| Modules transformés | **2 675** |
| Taille du bundle | **2 131,65 kB** (601,60 kB gzip) |
| Erreurs `tsc --noEmit` | **0** |
| Temps de build | 15,44 s |
| Fichiers TS/TSX | **90** |
| Modules `lib/` | 43 + 7 engine + 6 production |
| Pages | 23 |
| Composants | 8 |
| Routes | 24 |

### Comptes de démonstration
| E-mail | Rôle | Route |
|---|---|---|
| `fimaac@gmail.com` / `Fimaac@2000` | super_admin | `/admin` |
| `compta@cabinet.demo` / `Cabinet@2026` | cabinet_admin | `/app` |
| `assistant@cabinet.demo` / `Cabinet@2026` | accountant | `/app` |
| `client@distgolfe.demo` / `Client@2026` | client_admin | `/portail` |

`/extractor` est accessible sans authentification.

---

## FEUILLE DE ROUTE (maintenue à jour à chaque fin de lot)

### ✅ Fait
| Travaux | Journal |
|---|---|
| Assemblage des 12 lots (90 fichiers TS/TSX · 24 routes) | ce document |
| Audit Phase 0 re-vérifié + 13 corrections (B1, B2, B4, M2, M3, M4, M7, M9, M10, M13, m5, m7, m13) | `JOURNAL_CORRECTIONS.md` |
| Correctif UI hero Landing (mots collés — `inline-block` avalait l'espace) | `JOURNAL_CORRECTIONS.md` |

### 🔄 Liaison cabinets ↔ entreprises — **TERMINÉE** (8 lots)
| Livraison | Journal |
|---|---|
| LOT 1 fondation (types · DB v3 + backfill · `scope.ts` · 9 fichiers branchés) · LOT 2 identifiants générés par le cabinet · LOT 3 carte « Accès & identifiants » (régénérer / modifier e-mail / créer l'accès) · LOT 4 inscription entreprise avec **choix du cabinet** · LOT 5 self-service Sécurité + écran bloquant de première connexion · LOT 6 Dashboard nettoyé (bloc « Travail à faire » supprimé → tuile vers le Centre des obligations) · LOT 7 journaux · LOT 8 scénarios S1→S7 | `JOURNAL_LIAISON.md` · `DECISIONS.md` |

### ⏳ À faire (backlog)
| Élément | Source |
|---|---|
| M5, M6, M11 — taux IS / minimum de perception / vatRate (attendre validation CGI togolais) | audit, Q1 |
| M1, m4 — modales accessibles + toasts (34 `alert()`) | audit, Q5 |
| m14 — remapper AG/AH/TG/TK/TM/RN | audit, Q6 |
| m9 — tests unitaires moteurs (vitest ou harnais) | audit, Q7 |
| M8, m1, m2, m3, m6, m8, m10, m11, m12 | audit, phase 8 |
| Flux de validation de rattachement · révocation d'accès portail · multi-cabinet | liaison, backlog |

---

## LOT 10 — intégration détaillée

| Fichier reçu | Destinataire | Contenu |
|---|---|---|
| Page Documents | `src/pages/Documents.tsx` | **Arborescence exercice › mois › catégorie** (13 dossiers), badge « À classer », diagnostic d'extraction (readable/unreadable), éditeur de complétion manuelle (10 champs OCR avec statut Lu/Saisi/Illisible/Absent), téléversement multiple + lecture, reclassification, comptabilisation d'une facture d'achat |
| États financiers | `src/pages/Financials.tsx` | 3 composants exportés : `Financials` (CR, bilan synthétique, régularisations CCA/PCA/CAP/PAR, assistant de clôture 13 étapes), `Reports` (5 onglets : aperçu, grand livre auxiliaire, balance âgée 4 tranches, échéancier à payer/à recevoir, FEC), `Compliance` (Donut score, 6 catégories, anomalies résolubles) |
| Page publique | `src/pages/Landing.tsx` | Nav sticky, hero avec bento flottant animé, compteurs, 8 modules, 6 features, pays OHADA, 4 tarifs (Essai/Starter/Pro/Enterprise), CTA, footer |
| Page Liasse | `src/pages/Liasse.tsx` | **8 onglets** : Import universel (détection colonnes + mapping éditable), Audit & reconstitution (radiographie + patch non destructif), Génération mode A, Balance 6 colonnes, État fourni mode B (diagnostic des balances avant remplissage), Contrôles de base, Cohérence SYSCOHADA (C1→C9), Plan & écritures (normatif) |
| Page Missions | `src/pages/Missions.tsx` | 4 KPI, missions avec ProgressBar, tâches avec toggle done, création mission/tâche |

---

## État d'avancement à la fin du LOT 10

### ✅ En place
| Couche | Fichiers |
|---|---|
| `src/lib` | 45 modules — COMPLETE |
| `src/lib/engine` | 7 modules |
| `src/lib/production` | 6 modules |
| `src/components` | 9 fichiers |
| `src/pages` | **13 fichiers** |

### ⏳ Toujours attendus (pages) — ~12
```
Tax (Fiscalité : calculs TVA/IS, grille, moteur réglementaire, échéances)
Requests (Demandes & modèles : 4 onglets)
Bank (Banque & rapprochement)
Assets (Immobilisations) · Stocks · Payroll (Paie)
Obligations (Centre des obligations)
StatementsWorkshop (Atelier états financiers)
WorkbookExtractor (/extractor public)
Billing (Facturation & plans)
Settings (Paramètres)
Portal (Portail client : 5 routes)
```
### ⏳ Toujours attendus (composant)
```
src/components/Settings.tsx  →  exporte Settings + Billing (débloque Account.tsx)
```
### ⏳ Assemblage final
```
App.tsx (HashRouter · Require · homeFor · /extractor public)
main.tsx · index.html (titre) · index.css (@theme fonts)
```

### Erreurs TS résiduelles — 1 seule
`src/components/Account.tsx:3` — `Cannot find module './Settings'`

---

## LOT 9 — intégration détaillée (première tranche de pages)

| Fichier reçu | Destinataire | Contenu |
|---|---|---|
| Page Comptabilité | `src/pages/Accounting.tsx` | **8 onglets** : plan comptable (8 classes dépliables, double-clic → consultation), tiers (fiches + soldes), journaux, écritures (filtres, dépliage lignes, **pièces jointes**, édition, contrepassation), grand livre, balance (contrôle d'équilibre + ProgressBar), lettrage (manuel + auto, écart nul requis), clôture (workflow Sage) + saisie guidée de règlement |
| Shim Admin | `src/pages/Admin.tsx` | → `./AdminPages` |
| Console admin | `src/pages/AdminPages.tsx` | 6 écrans : `AdminOverview`, `AdminCabinets`, `AdminUsers`, `AdminRegulatory`, `AdminAudit`, `AdminBilling` |
| Assistant IA | `src/pages/AIAssistant.tsx` | 6 agents sélectionnables, garde « jamais de taux inventé », badges de vérifiabilité, sources |
| Authentification | `src/pages/Auth.tsx` | `AuthShell` (split-screen), `Login` (3 comptes de démo cliquables), `Register` (cabinet/client), `routeFor` |
| Entreprises | `src/pages/Companies.tsx` | `Companies` (grille + recherche + création) et `CompanyDetail` (fiche + KPI + dossier permanent) |
| Atelier conformité | `src/pages/ConformityWorkshop.tsx` | Portefeuille + détail par entreprise — `usePortfolioCoherence` / `useLiveCoherence` (cohérence en direct) |
| Tableau de bord | `src/pages/Dashboard.tsx` | Sélecteur de périmètre, 4 KPI avec sparklines + deltas, jauge de santé + RadialRings, **travail à faire priorisé** (4 sévérités, filtres, compteurs J-n), 13 graphiques, ratios, widgets échéances/missions/activité, CTA IA |

---

## État d'avancement à la fin du LOT 9

### ✅ En place
| Couche | Fichiers |
|---|---|
| `src/lib` | **45 modules** — COMPLETE |
| `src/lib/engine` | 7 modules |
| `src/lib/production` | 6 modules |
| `src/components` | 9 fichiers |
| `src/pages` | **8 fichiers** |

### ⏳ Toujours attendus (pages)
```
Documents · Fiscalité(Tax) · Banque(Bank) · Immobilisations(Assets) · Stocks
Paie(Payroll) · Missions · Obligations(Obligations) · AtelierEtats(StatementsWorkshop)
Liasse(Liasse) · EtatsFinanciers(Financials) · Conformite(Compliance)
Rapports(Reports) · Demandes(Requests) · Facturation(Billing)
Settings · Portal · WorkbookExtractor · Landing
```
### ⏳ Toujours attendus (composant)
```
src/components/Settings.tsx  →  exporte Settings + Billing (débloque Account.tsx)
```
### ⏳ Toujours attendus (assemblage final)
```
App.tsx (HashRouter · Require · homeFor · /extractor public)
main.tsx · index.html (titre) · index.css (@theme fonts Sora/Inter/JetBrains Mono)
```

### Erreurs TS résiduelles — 1 seule
`src/components/Account.tsx:3` — `Cannot find module './Settings'`
→ se résoudra à l'arrivée de `src/components/Settings.tsx`. **Tout le reste compile.**

---

## LOT 8 — intégration détaillée

| Fichier reçu | Destinataire | Remarques |
|---|---|---|
| Extensions Regulatory Engine | `src/lib/regulatory-extensions.ts` | **remplace** la version du LOT 7 (superset : ajoute `TAX_REGIMES`, `TVM_CATEGORIES`, `TPU_ACTIVITIES`, `IRPP_CATEGORIES`, `clientCheckUp`, `controlPayrollVsCNSS`, `calculateFiscalResult`, `canEditDeclaration`) |
| Rapports & audit classeur | `src/lib/reports.ts` | `auditWorkbook`, `patchWorkbook`, `patchWorkbookByRef`, `cloneWorkbook`, `downloadWorkbookWb`, `workbookCoherenceChecks`, `coherenceScore`, `KEY_SHEETS` |
| Seed | `src/lib/seed.ts` | 4 users · 2 entreprises · journaux depuis catalogue · **12 mois d'historique équilibré** ( générateur déterministe mulberry) · Regulatory v2 complet |
| Store | `src/lib/store.ts` | `useSyncExternalStore`, `mutate` (structuredClone + persist), `resetDB`, `exportDB`, `importDB` |
| Moteur fiscal | `src/lib/tax.ts` | `computeTVA`, `computeIS`, `computeTax` |
| Types | `src/lib/types.ts` | **53 interfaces + 21 unions** — résout la cascade `TS7006` sur tous les modules |
| Shim universalImport | `src/lib/universalImport.ts` | → `./importer` |
| Remplisseur XML | `src/lib/xlsx-filler.ts` | `fillStateTemplateZip` — **sans ExcelJS ni DOMParser**, regex pur + JSZip |
| Sanitiseur | `src/lib/xlsx-sanitizer.ts` | `sanitizeSharedFormulas`, `loadXlsxSafe` (fast path + retry), `listSheetNames`, `countFormulas` |
| Shim Account | `src/components/Account.tsx` | → `Settings` / `Billing` depuis `./Settings` |

**Dépendances installées** (via npm) : `exceljs` (LOT 6), `jszip` (LOT 8).

---

## État d'avancement à la fin du LOT 8

### ✅ Couche `src/lib` COMPLETE — 43 modules
```
accounting · actions · ai · analytics · auth · chart · chartOfAccounts
clientCatalog · clientCatalogTypes · crossCheck · declarationEngine
documentStore · editions(shim) · entryTemplates · excelAudit(shim)
financialStatements · format · formulaRegistry · hash · importer(shim)
importers · journals · ledger · liasse · liasseEngine · liasseFiller
liveCoherence · normative · notes · obligations · ocr · permissions
reconstitution(shim) · regulatory-engine · regulatory-extensions · reports
seed · store · tax · types · universalImport(shim) · xlsx-filler
xlsx-sanitizer
```
+ `src/lib/engine/` (7 modules) · `src/lib/production/` (6 modules)

### ✅ Couche `src/components` — 9 fichiers
`ui · AppLayout (+shim Layout) · charts · GlobalSearch · DocumentViewer · EntryEditor · AccountInquiry · Account(shim)`

### ⏳ Toujours attendus
| Type | Éléments |
|---|---|
| **Composant** | `src/components/Settings.tsx` (exporte `Settings` + `Billing`) — attendu par `Account.tsx` |
| **Pages** | `src/pages/` — toutes (Dashboard, Companies, CompanyDetail, Accounting, Documents, Tax, Banque, Immobilisations, Stocks, Paie, Missions, Obligations, AtelierEtats, AtelierConformite, Liasse, EtatsFinanciers, Conformite, Rapports, Demandes, IAAssistant, Facturation, Settings, Portal, Admin, AdminPages, Login, WorkbookExtractor, Landing…) |
| **Routeur** | `App.tsx` (HashRouter, `Require`, `homeFor`, `/extractor` public) |
| **Entrée** | `main.tsx`, `index.html`, `index.css` (avec `@theme` fonts) |

### Erreurs TS résiduelles — 1 seule
`src/components/Account.tsx:3` — `Cannot find module './Settings'`
→ se résoudra à l'arrivée de `Settings.tsx`. **Toute la couche `lib` compile.**
