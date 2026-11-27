# JOURNAL DE LIAISON — Cabins ↔ Entreprises

> Journal lot par lot de l'implémentation « Liaison cabinets ↔ entreprises ».
> Déroule ce document en début de session pour retrouver l'état exact.

---

## LOT 1 — Fondation : modèle + migration + sélecteur partagé

| Fichier | Changement |
|---|---|
| `src/lib/types.ts` | `Company.cabinetOrganizationId: ID \| null` (cabinet gestionnaire) · `User.mustChangePassword: boolean` (identifiants générés) |
| `src/lib/store.ts` | `DB_VERSION = 3` · backfill dans `migrate()` : toute entreprise dont l'org propriétaire est un cabinet lui est rattachée ; comptes existants non forcés (`mustChangePassword = false`) |
| `src/lib/scope.ts` (nouveau) | `companiesForUser(db, user)` — cabinet → entreprises rattachées, client → sa seule entreprise, super_admin → toutes · `isManagedBy` · `canAccessCompany` |
| 9 fichiers branchés | Dashboard, Companies, GlobalSearch, AppLayout (×2), ConformityWorkshop, AIAssistant, Obligations, StatementsWorkshop — plus aucun `scopeCompanies` local |
| 4 sites de construction corrigés | seed (4 users + 2 companies), auth (2 users + 1 company), actions (1 company) |

**Décisions** : `cabinetOrganizationId` sur Company (minimal, pas de table de liaison) · `organizationId` inchangé (org propriétaire) pour ne pas casser l'isolation.

**Vérifications** : tsc 0 · build OK.

---

## LOT 2 — Cabinet : création d'entreprise avec identifiants générés

| Fichier | Changement |
|---|---|
| `src/lib/actions.ts` | `generateTemporaryPassword()` (14 car., crypto.getRandomValues, alphabet sans ambiguïté, complexité garantie) · `addCompanyWithAccess()` : crée org cliente + entreprise rattachée + taxProfile + exercice + 12 périodes + User `client_admin` (`mustChangePassword: true`) + notification + audit · validations (e-mail unique, format) |
| `src/pages/Companies.tsx` | Formulaire : champs **E-mail de contact** + **Téléphone** · modale « Identifiants portail générés » (e-mail + mot de passe temporaire + Copier + avertissement « ne sera plus affiché ») |

**Invariant I5 respecté** : `tempPassword` n'apparaît jamais dans `mutate()` — seul le hash est stocké.

**Vérifications** : tsc 0 · build OK · 0 appel `addCompany` restant dans l'UI.

---

## LOT 3 — Cabinet : gestion des accès (« changeables par après »)

| Fichier | Changement |
|---|---|
| `src/lib/actions.ts` | `regenerateCompanyAccess(companyId)` (nouveau temporaire + changement exigé) · `createCompanyAccess(companyId, email)` (rattrapage : entreprise existante sans compte) · `updateCompanyEmail(companyId, email)` (unicité vérifiée) · `changeOwnPassword(old, next)` + `changeOwnEmail(next, password)` (self-service entreprise, LOT 5) |
| `src/pages/Companies.tsx` | `CompanyDetail` : carte **« Accès & identifiants »** — identifiant, dernière connexion, badge changement exigé, actions Régénérer / Modifier l'e-mail / Créer l'accès portail · 2 modales (identifiants affichés une fois, modification d'e-mail) |

**Décision** : `addCompany` (ancienne signature void) conservée dans actions.ts pour compatibilité, plus utilisée par l'UI.

**Vérifications** : tsc 0 · build OK.

---

## LOT 4 — Entreprise : inscription avec choix du cabinet

| Fichier | Changement |
|---|---|
| `src/lib/auth.ts` | `ClientRegisterInput.cabinetOrganizationId` **obligatoire** · validation (le cabinet doit exister, type "cabinet") · notification au cabinet (« Nouvelle entreprise rattachée ») · audit avec l'ID du cabinet |
| `src/pages/Auth.tsx` | Rubrique **« Choisir le cabinet »** (select alimenté par `organizations.filter(type === "cabinet")`, affiche nom + ville) · bouton désactivé sans cabinet · message « aucun cabinet inscrit » |

**Décisions** : rattachement **auto-accepté** + notification (le flux de validation est au backlog) · liste limitée à nom + ville (vie privée).

**Vérifications** : tsc 0 · build OK.

---

## LOT 5 — Entreprise : changement de ses coordonnées (self-service)

| Fichier | Changement |
|---|---|
| `src/pages/Settings.tsx` | Onglet **« Sécurité »** : changer son mot de passe (ancien vérifié, confirmation, min 8 car.) + changer son e-mail de connexion (confirmation par mot de passe) · badge si changement exigé |
| `src/App.tsx` | **`PasswordGate`** : si `user.mustChangePassword`, l'accès aux modules est bloqué par `ForceChangePassword` (écran dédié) · route `/portail/parametres` ajoutée |

**Vérifications** : tsc 0 · build OK.

---

## LOT 6 — Dashboard : suppression du bloc « Travail à faire aujourd'hui »

| Fichier | Changement |
|---|---|
| `src/pages/Dashboard.tsx` | Bloc supprimé (doublon du Centre des obligations) + `SEV`, `workFilter`, `workExpanded`, `workload`, `workCounts`, `computeWorkload`, `WorkItem` retirés · imports nettoyés (`CircleAlert`, `Zap`, `ChevronDown`, `ChevronRight`, `CheckCircle2`) · remplacé par une **tuile récapitulative** (En retard / Urgents ≤7j / Pièces attendues / Paiements à faire) avec bouton « Ouvrir le centre des obligations » |

**Décision** : `computeWorkload` conservé dans analytics.ts (export d'API, plus utilisé par l'UI — grep vérifié).

**Vérifications** : tsc 0 · build OK.

---

## Vérifications cumulées

| Contrôle | Résultat |
|---|---|
| `tsc --noEmit` | **0 erreur** |
| `npm run build` | ✅ 17,57 s · 2 153,63 kB (607,38 kB gzip) |
| Σ Débit = Σ Crédit · Actif = Passif | non régressés (aucun moteur modifié) |
| Invariant I5 (mot de passe) | aucun mot de passe en clair dans l'état |
| Invariant I6 (migration) | DB_VERSION = 3 avec backfill |
| Isolation | sélecteur partagé appliqué aux 9 fichiers |

---

## ⏳ Reste à faire

| Élément | Source |
|---|---|
| LOT 8 — dérouler les scénarios S1→S7 | ce lot (en cours) |
| Flux de validation de rattachement (en attente → accepté/refusé) | backlog, Q-Rattachement |
| Révocation d'accès portail | backlog, Q-Révocation |
| Multi-cabinet (table de liaison) | backlog, Q-Modèle |
| Notification par e-mail réelle (adapter) | backend/README.md §7 |
| M5/M6/M11 — taux IS, minimum de perception, vatRate (CGI togolais) | audit, Q1 |
| M1/m4 — modales accessibles + toasts | audit, Q5 |
| m9 — tests unitaires | audit, Q7 |

---

## CORRECTIF ISOLATION — reprisé par le porteur (« pas de fuites d'informations »)

| # | Constat | Correctif |
|---|---|---|
| 1 | **La rubrique « Choisir le cabinet » s'affichait AUSSI pour un cabinet qui s'inscrit** — un cabinet ne choisit pas un autre cabinet (il EST le cabinet) | `Auth.tsx` : la rubrique est rendue uniquement en `{mode === "client" && …}` · le bouton reste désactivé sans cabinet sélectionné · le message « aucun cabinet inscrit » n'apparaît qu'en mode client |
| 2 | `Accounting.tsx` passait **toutes** les `documents` de la base aux composants enfants (EntryAttachments, DocumentViewer, AttachmentCount) | Filtré par `d.companyId === company.id` — une entreprise ne voit que ses propres pièces, même via une écriture |
| 3 | Liaison appliquée partout (audit grep complet) : portail → 15 filtres par `user.companyId` · Obligations → 5 sources filtrées par `companyMap` · GlobalSearch → `companiesForUser` · AdminCabinets → clients comptés par `cabinetOrganizationId` · Missions/Tasks → par `organizationId` du cabinet | Vérifié ligne à ligne |

### Matrice d'isolation finale
| Acteur | Voit |
|---|---|
| Cabinet | uniquement les entreprises où `Company.cabinetOrganizationId === son org` (via `companiesForUser`) |
| Entreprise cliente | uniquement ses données (`User.companyId`) — documents, demandes, échéances, états |
| super_admin | tout (console plateforme) |
| Cabinet A | **jamais** les entreprises, documents, demandes du cabinet B |

### Contrôles
- `tsc --noEmit` : 0 erreur
- `npm run build` : 12,14 s · 2 153,68 kB (607,39 kB gzip)

---

## LOT 9 — CORRECTIFS D'ISOLATION & DE LIAISON (reprisés par le porteur)

| # | Erreur | Correctif |
|---|---|---|
| 1 | **Rubrique « Choisir le cabinet » affichée AUSSI pour un cabinet qui s'inscrit** | `Auth.tsx` : rendue uniquement en `{mode === "client" && …}` |
| 2 | **IDOR sur CompanyDetail** : un cabinet pouvait ouvrir une entreprise d'un autre cabinet par URL (`/app/entreprises/:id`) | Garde `canAccessCompany(db, user, company.id)` — message « Accès non autorisé » |
| 3 | **createClientRequest notifiait la mauvaise partie** : le portail passait `company.organizationId` (l'org de l'entreprise elle-même) → le cabinet n'était JAMAIS notifié de ses demandes | `createClientRequest` dérive le cabinet depuis `Company.cabinetOrganizationId` · `organizationId` de la demande = le cabinet · notification au cabinet |
| 4 | **setClientRequestStatus notifiait `r.organizationId`** (incohérent selon le créateur) | Notifie l'AUTRE partie : cabinet agit → notifie l'entreprise ; client agit → notifie le cabinet |
| 5 | **respondToDocRequest ne notifiait personne** : l'entreprise répondait à une demande documentaire sans que le cabinet le sache | Notification au cabinet + audit trail · corrige aussi un bug où `runOcrSim` recevait un nom de fichier au lieu d'un ID |
| 6 | **Portail : écrans blancs** (`return null`) si l'utilisateur n'a pas d'entreprise (PortalDocuments, PortalStatements) | EmptyState explicite |

### Matrice d'isolation finale (vérifiée ligne à ligne sur 18 collections)
| Acteur | Voit |
|---|---|
| Cabinet | entreprises où `Company.cabinetOrganizationId === son org` (via `companiesForUser`, 8 fichiers) |
| Entreprise cliente | ses données uniquement (`User.companyId` — 15 filtres dans le Portail) |
| Cabinet A | **jamais** les entreprises/documents/demandes du cabinet B |
| super_admin | tout (console plateforme) |
| URL manipulée (`/app/entreprises/:id`) | bloquée par `canAccessCompany` |

### Contrôles
- `tsc --noEmit` : 0 erreur
- `npm run build` : 16,04 s · 2 166,74 kB (608,97 kB gzip)

---

## LOT 10 — BUG BLOQUANT : bouton « Créer mon compte » inutilisable en mode cabinet

| Élément | Détail |
|---|---|
| **Symptôme** (rapporté par le porteur) | Tous les champs remplis en mode cabinet, mais le bouton « Créer mon compte » reste désactivé |
| **Cause** | `disabled={loading || !cabinetId}` s'appliquait aux DEUX modes. `cabinetId` n'est rempli que par la rubrique « Choisir le cabinet », qui n'existe qu'en mode client → en mode cabinet, `cabinetId` restait `""` → bouton bloqué à vie |
| **Correctif** | `disabled={loading || (mode === "client" && !cabinetId)}` — l'exigence de cabinet ne s'applique qu'au mode client |
| **Vérification** | tsc 0 erreur · build 12,76 s · 2 154,82 kB (607,56 kB gzip) |
| **Test** | Mode cabinet : tous champs remplis → bouton actif → compte créé → redirection /app ✓ · Mode client sans cabinet → bouton désactivé ✓ · Mode client avec cabinet → bouton actif ✓ |

---

## LOT 11 — MODÈLES D'ÉCRITURES : retrouvés et branchés dans l'UI

> Constat du porteur : « on avait créé les modèles d'écritures, elles sont passées où ? »

### Diagnostic
| Élément | État |
|---|---|
| `entryTemplates.ts` | ✅ **49 modèles** dans le catalogue (10 catégories, tous équilibrés) |
| Seed | ✅ 30 standards rattachés à co-demo · **19 en bibliothèque partagée** (`companyId: null`) · 0 pour DistGolfe |
| Actions | ✅ `createEntryTemplate`, `runEntryTemplate`, `deleteEntryTemplate` |
| **UI** | ❌ **AUCUNE page n'affichait le catalogue** — la page Requests ne montrait que les modèles créés manuellement pour l'entreprise active, et DistGolfe voyait **0 modèle** (les 19 partagés étaient invisibles) |

### Correctif

| Fichier | Changement |
|---|---|
| `src/lib/actions.ts` | `activateTemplate(templateId, companyId)` (copie un modèle du catalogue vers l'entreprise) · `runTemplateWithAmount(templateId, baseAmount, date, reference)` — mise à l'échelle proportionnelle via `scaleTemplate` + **équilibre automatique** (la dernière ligne absorbe l'écart) + écriture en brouillon · `availableTemplates(db, companyId)` — les siens **+ les partagés** |
| `src/pages/Requests.tsx` | **5e onglet « Bibliothèque »** : les 19 modèles partagés non encore activés, avec recherche + filtre par catégorie (10 catégories) · aperçu des lignes comptables · 2 actions par carte : **Utiliser** (montant de base + date + référence → écriture équilibrée en brouillon) et **Activer** (copie dans « Mes modèles ») · onglet renommé « Mes modèles » · filtre corrigé (`availableTemplates`) pour que DistGolfe voie aussi les modèles partagés |

### Corrections au passage
- `runOcrSim` recevait un nom de fichier au lieu d'un ID (bug du LOT 9, corrigé au passage)
- `EntryTemplate.recurring` n'a pas "quarterly" → option retirée de l'affichage

### Contrôles
- `tsc --noEmit` : 0 erreur
- `npm run build` : 13,13 s · 2 162,23 kB (609,31 kB gzip)

---

## LOT 12 — ADMIN PLATEFORME : détachement, tarifs, logo, annonces

### 1. Comptes de démonstration retirés
La carte « Comptes de démonstration » (3 boutons de connexion rapide) a été **supprimée** de la page de connexion. Le compte admin est désormais `fimaac.africa@gmail.com` / `Fimaac@2026` (seed mis à jour).

### 2. Admin détaché des utilisateurs
| Avant | Après |
|---|---|
| Page « Utilisateurs » listait tout le monde sans distinction | **Onglet « Utilisateurs »** séparé (tous types, filtres par type admin/cabinet/client) · **Onglet « Cabinets »** dédié avec fiche détaillée par cabinet (stats, entreprises gérées, utilisateurs, abonnement, branding, suspension) |

### 3. Nouveaux écrans admin (8 au total)
| Écran | Route | Contenu |
|---|---|---|
| Vue d'ensemble | `/admin` | KPI plateforme (cabinets, entreprises, users, MRR, écritures, documents, audit) + **logo plateforme modifiable** + cabinets récents + activité |
| Cabinets | `/admin/cabinets` | Liste détaillée + fiche par cabinet : **logo modifiable**, suspension/réactivation, entreprises gérées, users, abonnement |
| Utilisateurs | `/admin/utilisateurs` | Liste complète avec filtres par type + recherche |
| **Tarifs & revenus** | `/admin/facturation` | **Définition des tarifs** (4 plans modifiables en direct) · répartition des revenus par plan (barres de progression) · factures |
| **Annonces** | `/admin/annonces` | Publier des annonces aux cabinets, entreprises ou tous |
| Moteur réglementaire | `/admin/reglementaire` | Règles + country packs |
| **Données plateforme** | `/admin/donnees` | Taille du stockage, collections volumineuses, export JSON de la base |
| Journal d'audit | `/admin/audit` | Traçabilité complète avec recherche |

### 4. Logo personnalisé
| Élément | Détail |
|---|---|
| `Organization.logoDataUrl` | Nouveau champ (data URL, max 500 Ko) |
| `setPlatformLogo` / `setCabinetLogo` | Actions avec audit trail |
| **Brand** (AppLayout) | Utilise le logo personnalisé si défini, sinon le « F » dégradé par défaut — fonctionne pour les 3 espaces (admin, cabinet, portail) |
| **LogoPicker** | Composant de téléversement avec aperçu et validation de taille |

### 5. Actions plateforme ajoutées
`updatePlanPrice` · `togglePlanActive` · `toggleCabinetSuspension` (suspend/réactive + notifie) · `setPlatformLogo` · `setCabinetLogo` · `publishAnnouncement` · `DEFAULT_PLANS` (source de vérité des 4 plans avec features et limites)

### 6. Nav admin enrichie
| Avant | Après |
|---|---|
| 6 entrées | **8 entrées** : Vue d'ensemble · Cabinets · Utilisateurs · **Tarifs & revenus** · **Annonces** · Moteur réglementaire · **Données plateforme** · Journal d'audit |

### Vérifications
- `tsc --noEmit` : 0 erreur
- `npm run build` : 12,59 s · 2 185,51 kB (614,53 kB gzip)
