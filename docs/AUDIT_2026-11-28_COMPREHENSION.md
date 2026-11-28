# FIMAAC — Audit d'exploration et de compréhension
**Date : 28 novembre 2026** · **Objet : comprendre avant de proposer** · **Version auditée : commit `6db2b62` (= code applicatif de `1c828db`), celui servi par Vercel**

---

## 0. Méthode, périmètre et limites

### 0.1 Ce qui a été fait

L'audit ne repose pas sur une visite de l'interface, mais sur **trois sources croisées** :

| Source | Ce qu'elle permet | Volume |
|---|---|---|
| Lecture intégrale du code source | règles de gestion réelles, chemins d'exécution, code mort | 21 019 lignes TS/TSX · 57 modules `lib` · 23 pages · 10 composants |
| **Exécution des moteurs** hors navigateur | vérifier les calculs sur le jeu de démonstration réel (102 écritures) | 4 harnais de test, sorties citées en §E |
| API GitHub du dépôt | état du déploiement, commits, statuts Vercel | commit `1c828db` → déploiement `success` |

Les tests exécutés portent sur : intégrité comptable du seed, TVA/IS, déclaration TVA, moteur d'états, cohérence liasse, contrôles croisés, obligations, IRPP/CNSS/TVA, IA, import Excel/CSV (fichiers générés puis relus), OCR (TXT/PDF/JPG/XLSX), paie de bout en bout, performance et quota de stockage.

### 0.2 Limites — à lire avant de contester un point

1. **Je n'ai pas accès au site en ligne depuis cet environnement** (réseau sortant limité à GitHub/npm). Je n'ai donc pas cliqué dans les 41 routes du site en production ; j'ai audité **le code exact qui produit ces écrans**, plus fiable pour les règles de gestion, moins pour le rendu visuel réel (alignements, débordements, contrastes).
2. **URL** : tu m'as donné `https://fimaac.vercel.app/#/`. Le dépôt, lui, pointe sur `https://fimaac-9f4v.vercel.app` (champ `homepage` + statut du déploiement Vercel). Si les deux répondent, il s'agit d'alias ; sinon le domaine à jour est `fimaac-9f4v.vercel.app`. À confirmer côté dashboard.
3. **Aucune règle fiscale n'est certifiée ici.** Les taux (TVA 18 %, IS 27 %, CNSS 4 %/17,5 %, plafond 300 000, barème IRPP à 8 tranches) sont ceux **codés dans l'application**, marqués `verified: false` par les développeurs eux-mêmes. Je ne fabrique aucune référence juridique : toute conformité doit être validée contre le texte officiel (CGI togolais / OTR, textes CNSS).
4. Les jugements de **positionnement marché** sont des analyses, pas des faits ; ils sont signalés comme tels.

Légende utilisée dans tout le document : **[E]** vérifié par exécution · **[L]** vérifié par lecture de code · **[H]** hypothèse à confirmer.

---

## A. Compréhension générale

### A.1 Nature exacte du produit

FIMAAC est une **application SaaS de gestion comptable, financière et fiscale pour l'espace OHADA**, aujourd'hui livrée sous forme de **SPA React entièrement autonome** :

- React 19 + Vite 7 + Tailwind 4, buildée en **un seul fichier `index.html` de 2,1 Mo** (615 ko gzip) via `vite-plugin-singlefile` ;
- **aucun backend**, **aucun appel réseau** : ni `fetch`, ni `/api`, ni variable d'environnement ; [L]
- **toutes les données vivent dans le `localStorage`** du navigateur, sous la clé `fimaac_db_v1` (40 collections, 441 Ko pour le jeu de démo) ; [E]
- authentification, mots de passe, rôles, audit : **exécutés côté client** ; [L]
- l'IA est un **moteur de règles déterministe** (correspondance par mots-clés), jamais un LLM. [E]

Ce n'est donc pas encore « un SaaS » au sens technique : c'est **un prototype produit très avancé, une démonstration fonctionnelle complète et une spécification exécutable** de ce que sera le SaaS. Cette distinction est capitale : elle explique 80 % des écarts constatés en §F.

### A.2 Vision portée par le produit

Trois doctrines traversent le code et donnent la vraie personnalité du projet :

1. **« Ne rien inventer »** — un champ non déterminé vaut `null`, jamais `0` ; un taux non vérifié porte un avertissement ; l'IA refuse explicitement de publier une règle non sourcée (`ai.ts`). C'est une doctrine rare et précieuse : elle positionne FIMAAC comme un outil **défendable devant un contrôleur fiscal**.
2. **« Tout montant est traçable »** — montant → formule → comptes → écritures → règle → version. Implémentée dans `declarationEngine` (dormant, cf. §D) et revendiquée sur la page publique.
3. **« Une seule plateforme, tout le cycle »** — de la pièce justificative à la liasse GUDEF, en passant par la paie et les obligations.

### A.3 Proposition de valeur observée

| Axe | Contenu réel dans le produit | Statut |
|---|---|---|
| Comptabilité SYSCOHADA | plan comptable **1 274 comptes** (classes 1→9), journaux, grand livre, balance, lettrage, clôture de période | ✅ opérationnel |
| Fiscalité explicable | TVA, IS, moteur réglementaire versionné, échéancier | 🟠 partiel, incohérences §E |
| Liasse & états financiers | import de balance, génération d'états, contrôles, export XLSX, remplissage d'un modèle GUDEF fourni | 🟠 partiel |
| Portail client | 5 écrans, 21 actes administratifs, dépôt de pièces | ✅ opérationnel (local) |
| Cabinet / multi-dossiers | entreprises, missions, obligations, demandes documentaires, modèles d'écritures | ✅ opérationnel (local) |
| Administration plateforme | cabinets, tarifs, MRR/ARR, branding, sauvegarde, journal d'audit | ✅ opérationnel (simulé) |
| IA assistée | 6 agents, réponses contextualisées sur les données réelles | 🟡 visible, déterministe |
| OCR / extraction de pièces | TXT/CSV/XLSX lus, images et PDF compressés explicitement non lisibles | 🟠 partiel |

**Le différenciateur réel** n'est pas la comptabilité (le marché en est saturé) : c'est le trio **« liasse GUDEF + obligations OTR/CNSS + portail client »** dans un même outil, pensé pour un cabinet de 5 à 50 collaborateurs en Afrique de l'Ouest.

### A.4 Utilisateurs cibles (déduits des rôles implémentés)

13 rôles et 3 types d'utilisateurs sont modélisés [L] :

- **Cabinet** : `cabinet_admin`, `partner` (associé), `director`, `manager` (chef de mission), `accountant`, `tax_specialist`, `payroll_manager`, `assistant`, `auditor` ;
- **Client** : `client_admin`, `client_accountant`, `client_user` ;
- **Plateforme** : `super_admin`.

Le modèle est **crédible et bien pensé** : la séparation *cabinet / client / plateforme* avec trois layouts distincts est exactement ce qu'exige un vrai cabinet. Mais l'application des droits est décorative (§F.3).

### A.5 Positionnement [analyse, pas fait]

Trois familles d'acteurs occupent l'espace : les ERP généralistes lourds (Sage 100, Odoo, Cegid), les outils de production comptable collaboratifs (Pennylane, Dext, Sage Espace collaborateurs), et les utilitaires GUDEF/liasse. Le créneau de FIMAAC — **« le poste de travail du cabinet OHADA, de la pièce à la liasse, avec portail client »** — est réel et mal couvert par les outils français, qui traitent mal le SYSCOHADA révisé, le GUDEF et les obligations propres à l'OTR/CNSS.

Le risque n'est pas le positionnement, c'est **la preuve** : un cabinet n'achète pas une démonstration, il achète un dossier qui passe un contrôle. Les défauts §E sont donc, à ce stade, plus stratégiques que techniques.

---

## B. Cartographie complète

### B.1 Trois espaces, 41 routes

| Espace | Préfixe | Routes | Contenu |
|---|---|---|---|
| Public | `/`, `/login`, `/register`, `/extractor` | 5 (+ wildcard) | landing, connexion, création de cabinet, extracteur GUDEF autonome |
| Cabinet / admin métier | `/app/*` | 22 | Dashboard, Entreprises (+ fiche), Comptabilité, Documents, Fiscalité, Banque, Demandes, Atelier états, Atelier conformité, Liasse, Immobilisations, Stocks, Paie, États financiers, Missions, Obligations, Conformité, Rapports, IA, Facturation, Paramètres |
| Administration plateforme | `/admin/*` | 8 | Vue d'ensemble, Cabinets, Utilisateurs, Réglementaire, Audit, Facturation, Annonces, Données |
| Portail client | `/portail/*` | 6 | Accueil, Documents, Demandes, États, Factures, Paramètres |

Routage par `HashRouter` (`/#/app/...`) : choix correct pour un hébergement statique sans réécriture serveur. [E]

### B.2 Modules et fonctions vérifiées

| # | Module | Fonctions observées | Statut |
|---|---|---|---|
| 1 | **Dashboard** | KPI, 9 graphiques (CA vs résultat, pont CA→résultat, SIG, charges, trésorerie, top clients/fournisseurs, ratios), sélecteur de périmètre | ✅ calcule sur écritures **validées** uniquement [L] |
| 2 | **Entreprises** | création + génération d'identifiants portail, fiche, profil fiscal, dossier permanent | ✅ |
| 3 | **Comptabilité** | 8 onglets : plan comptable, tiers, journaux, écritures (éditeur équilibré), grand livre, balance, lettrage, clôture | ✅ contrôles de partie double réels [E] |
| 4 | **Documents** | 10 catégories de pièces, import, extraction OCR, liaison à une écriture, comptabilisation depuis la pièce | 🟠 aperçu perdu au rechargement (§E) |
| 5 | **Fiscalité** | calculs TVA/IS, grille TVA, moteur réglementaire éditable, échéances & déclarations | 🟠 deux « vérités » pour l'IS (§E) |
| 6 | **Banque** | relevé, pointage manuel/auto, règles par mot-clé, état de rapprochement 521 ↔ relevé | ✅ |
| 7 | **Immobilisations** | amortissement linéaire, tableau annuel, dotation comptable | ✅ |
| 8 | **Stocks** | articles, valorisation, ajustement | ✅ (simple) |
| 9 | **Paie** | bulletins, CNSS plafonnée, écriture de paie équilibrée | 🟠 barème IRPP non appliqué (§E) |
| 10 | **États financiers** | 9 onglets : CR, bilan, régularisations (CCA/PCA/CAP/PAR), assistant de clôture, grand livre auxiliaire, balance âgée, échéancier, **export FEC** | ✅ |
| 11 | **Liasse** | 7 onglets : import universel, audit/reconstitution, génération (mode A), balance 6 colonnes, état fourni (mode B), contrôles, cohérence SYSCOHADA | 🟠 déséquilibre de 108 000 (§E) |
| 12 | **Ateliers** | sessions d'états financiers (6 statuts), atelier de conformité avec score 0–100 par entreprise | ✅ |
| 13 | **Missions / Obligations** | missions, tâches ; centre unifié (fiscal, social, documentaire, tâches, déclarations, paiements) + calendrier | ✅ |
| 14 | **Demandes** | demandes documentaires, 49 modèles d'écritures, paiements fiscaux, demandes clients, bibliothèque | ✅ |
| 15 | **Portail client** | dépôt de pièces, 21 actes (8 familles de formulaires dynamiques), états, factures, messagerie | ✅ |
| 16 | **Administration** | cabinets, utilisateurs, tarifs & revenus (MRR/ARR), moteur réglementaire, audit, annonces, données | ✅ (facturation simulée) |
| 17 | **Paramètres** | profil, sécurité (mot de passe, e-mail), organisation, export/import JSON, réinitialisation | ✅ |
| 18 | **Extracteur GUDEF** | analyse structurelle de classeur, dump markdown copiable, **sans authentification** | ✅ |

### B.3 Modèle de données (40 collections)

`accounts` 1 274 · `organizations` 2 · `users` 4 · `companies` 2 · `journals` 48 · `fiscalYears` 2 · `periods` 24 · `entries` 102 · `documents` 8 · `tiers` 3 · `employees` 2 · `fixedAssets` 1 · `stockItems` 3 · `bankAccounts` 1 · `bankTransactions` 3 · `taxRules` 3 · `taxRulesV2` 3 · `taxBrackets` 8 · `socialRules` 2 · `taxDeclarations` 1 · `taxDeadlines` 3 · `taxProfiles` 2 · `entryTemplates` 49 · `clientRequests` 2 · `documentRequests` 4 · `taxPaymentRequests` 2 · `missions` 3 · `tasks` 3 · `notifications` 3 · `auditLogs` 2 · `subscriptions` 1 · `invoices` 1 · `complianceIssues` 3 · `payslips` 0 · `reconRules` 2 · `permanentDocs` 4 · `fsSessions` 2 · `regulatoryVersions` 1 · `payrollComponents` 5 · `declarationTemplates` 5. [E]

Deux réserves : `payrollConfig.irppBrackets` est **vide** alors que 8 tranches existent dans `taxBrackets`, et `declarationWorkflows`, `conversations` sont vides.

### B.4 Relations entre modules (les flux réels)

```
PIÈCE (Documents) ──OCR──> données extraites ──> ÉCRITURE (Comptabilité)
                                                    │
       ┌────────────────────────────────────────────┼─────────────────────────┐
       ▼                    ▼                       ▼                         ▼
   BALANCE           GRAND LIVRE            DÉCLARATIONS                ÉTATS FINANCIERS
       │                    │                (TVA/IS/CNSS)                    │
       ├──> LIASSE (GUDEF)  ├──> LETTRAGE         │                          ├──> Dashboard / ratios
       ├──> CONTRÔLES       └──> BALANCE ÂGÉE     │                          └──> Ateliers FS
       └──> OBLIGATIONS <── échéancier fisc. <────┘                                │
                                    │                                              ▼
                              PORTAIL CLIENT <── demandes / pièces / factures ── FACTURATION
```

Dépendances vérifiées [L] : `store` (21 importateurs) et `types` (32) sont les deux hubs ; `actions.ts` (1 668 lignes, **81 verbes métier**) est le point d'écriture unique — bonne décision d'architecture.

### B.5 Chaîne de build / déploiement

`npm run build` → Vite + singlefile → `dist/index.html` (2,1 Mo). Vercel détecte Vite, publie `dist`, branche de production `main`. Aucune variable d'environnement nécessaire. [E]

---

## C. Audit fonctionnel — ce qui marche, ce qui ment, ce qui dort

### C.1 Fonctionnalités opérationnelles **et vérifiées par exécution** [E]

| Fonction | Preuve |
|---|---|
| Partie double sur les 102 écritures de démo | 0 écriture déséquilibrée ; balance générale 80 951 571 = 80 951 571 |
| Rejet des comptes inexistants / non imputables | 0 ligne fautive sur 102 écritures |
| TVA = Σ443 − Σ445 | 3 634 200 − 1 160 868 = 2 473 332, cohérent avec 18 % de 20 190 000 |
| Conversion HT/TTC | 1 000 000 × 18 % = 180 000 ; 1 180 000 → HT 1 000 000 |
| IRPP progressif par tranches | 20 000 000 → 5 141 000 ; somme des tranches = impôt total |
| CNSS plafonnée | base 900 000 → plafonnée à 300 000 → 12 000 salarié / 52 500 patronal |
| Paie de bout en bout | 2 bulletins, écriture `PAI-0014` équilibrée (905 000 = 905 000) |
| Refus d'inventer (IA) | question sur un taux inconnu → refus explicite, `verified: false` |
| Refus d'inventer (OCR) | image JPG → 10 champs `null`, 0 valeur déduite |
| Import Excel simple | en-têtes `Compte/Libellé/Débit/Crédit` → 4 lignes + ligne de total bien détectées |
| OCR TXT | 10/10 champs lus (n° facture, date, fournisseur, client, HT, TVA, taux, TTC, devise) |
| Clôture de période | la saisie est **effectivement bloquée** dans une période close |

### C.2 Fonctionnalités visibles mais **non vérifiables ici**

Tout ce qui dépend du rendu : animations Framer Motion, comportement des modales, responsive réel, lisibilité des tableaux à l'écran, graphes SVG. Le code montre 170 variantes responsives et 23 tableaux à défilement horizontal — cohérent avec un travail soigné, mais je ne le certifie pas visuellement.

### C.3 Fonctionnalités **incomplètes ou incohérentes** (voir §E pour les preuves)

Bilan et états financiers · IS (deux moteurs) · base de TVA · libellés de comptes TVA · paie (IRPP + AMU) · import de balance à en-tête « Code » · déclaration TVA de démonstration · documents (persistance) · OCR XLSX (1 champ sur 10).

### C.4 Fonctionnalités **dormantes** : 4 945 lignes (23,5 % du code) jamais exécutées

Ces modules sont aboutis, documentés… et **importés par personne** [E] :

| Module | Lignes | Ce qu'il apporterait |
|---|---|---|
| `lib/engine/*` (bilan, CR, TFT, fiscalité, contrôles) | 848 | moteur factorisé avec traçabilité et 6 contrôles |
| `lib/production/*` (zones, scoring, graphe de dépendances) | 769 | complétude des liasses, propagation d'impact |
| `lib/notes.ts` (notes annexes) | 946 | notes fiscales et annexes de la liasse |
| `lib/regulatory-extensions.ts` (TVM, TPU, IRPP par catégorie) | 527 | extension fiscale véhicules / forfait |
| `lib/declarationEngine.ts` (TVA/CNSS/DAS traçables) | 432 | déclarations **explicables** (le cœur de la promesse) |
| `lib/obligations.ts` (catalogue de 14 obligations, échéancier) | 378 | centre d'obligations calculé, pas ressaisi |
| `lib/financialStatements.ts` | 369 | 3ᵉ construction des états financiers |
| `lib/liasseFiller.ts` | 267 | remplissage complet de la liasse |
| `lib/formulaRegistry.ts` + `lib/crossCheck.ts` | 409 | référentiel de formules, contrôles croisés |

**Lecture stratégique** : le produit n'a pas un déficit de fonctionnalités, il a un déficit de **câblage**. Une grande partie de la valeur est écrite mais non branchée — c'est une bonne nouvelle (le travail est fait) et un danger (trois implémentations parallèles du même calcul qui divergent déjà, cf. §E).

### C.5 Fonctionnalités absentes mais attendues d'un tel produit

Comptabilité analytique (axes/centres de coût) · gestion multi-devises réelle · TVA avec crédit reporté et régularisations · immobilisations par composant · rapprochement bancaire par import de relevé (OFX/CAMT/CSV) · signature électronique · coffre-fort de pièces · connecteur OTR/GUDEF (dépôt) · API publique · multi-pays réel · journal d'audit inviolable · SSO/2FA · gestion de la TVA sur encaissement.

---

## D. Audit UX / UI

### D.1 Points forts (réels, et rares pour un prototype)

1. **Identité visuelle cohérente** : palette indigo/violet + sémantique de statut (rose/ambre/émeraude), typographies Inter + Sora + JetBrains Mono, cartes arrondies, ombres douces. Le produit *fait* professionnel.
2. **Système de composants unique** (`components/ui.tsx`, 367 lignes) : `Card`, `Button`, `Badge`, `StatCard`, `Field`, `Tabs`, `Modal`, `EmptyState`, `Spinner`. 145 boutons consomment ce système → cohérence garantie.
3. **Hiérarchie de page homogène** : `<Page>` + titre + sous-titre + KPI + contenu, identique sur 20 pages. Un utilisateur apprend l'app une seule fois.
4. **Chargement et vide traités** : `EmptyState` avec action, `Spinner`, `ErrorBoundary` avec purge du store corrompu.
5. **Traçabilité affichée** : chaque montant fiscal renvoie à sa règle, son taux et son statut « à vérifier ». C'est un choix d'UX *et* de conformité.
6. **Français métier juste** : vocabulaire comptable OHADA correct (« lettrage », « à-nouveaux », « CCA/PCA/CAP/PAR », « liasse GUDEF »).

### D.2 Points faibles

1. **Accessibilité quasi nulle** : 1 attribut `aria-*`, 0 `role`, 2 `htmlFor` pour des centaines de champs, 0 `tabIndex`. Les formulaires ne sont pas étiquetés programmatiquement, les modales ne piègent pas le focus. [E] C'est le point le plus faible du produit, et un critère d'exclusion sur certains appels d'offres.
2. **Densité excessive** : des écrans de 500 lignes avec jusqu'à 9 onglets (États financiers, Liasse) et 8 onglets (Comptabilité). Au-delà de 5 onglets, l'utilisateur ne trouve plus ; la charge cognitive est celle d'un logiciel des années 2000 alors que le design est moderne.
3. **Absence de recherche de premier niveau** (`GlobalSearch` existe mais n'est pas un point d'entrée évident) et pas de palette de commandes.
4. **Pas de parcours guidé « premier dossier »** : l'utilisateur arrive sur un dashboard rempli de données de démonstration sans signal « ceci est une démo ».
5. **Retour d'information hétérogène** : `alert()` natif encore présent dans certains flux (génération de déclaration, création de session) à côté de notifications propres.
6. **Mono-langue, mono-devise, mono-pays** dans l'interface (XOF + Togo), alors que la promesse est « espace OHADA ».
7. **États vides non pédagogiques** : « Sélectionnez une entreprise » n'aide pas un nouvel utilisateur à comprendre l'ordre des tâches.
8. **Aucune notion de sauvegarde perçue** : rien n'indique à l'utilisateur que ses données sont locales et volatiles — risque de perte silencieuse perçue comme une panne.

### D.3 Améliorations prioritaires (par impact/effort)

| Priorité | Action | Justification fonctionnelle |
|---|---|---|
| P0 | Étiquetage accessible systématique (`htmlFor`/`aria-labelledby`, focus trap, contrastes, navigation clavier) | condition d'accès aux marchés publics et aux DSI de cabinets |
| P0 | Bandeau « environnement de démonstration — données locales » + bouton d'export visible | évite la perte de confiance au premier rechargement |
| P1 | Réduire à ≤ 5 onglets par écran, transformer le reste en sous-navigation ou en panneaux | charge cognitive |
| P1 | Parcours d'amorçage en 6 étapes (cabinet → entreprise → exercice → balance → contrôles → liasse) | c'est le vrai chemin d'une mission |
| P2 | Palette de commandes (⌘K) et recherche globale dans l'en-tête | produit dense = navigation rapide obligatoire |
| P2 | Densité configurable des tableaux (compact/confort) + colonnes figées | 1 274 comptes, 100+ écritures |

---

## E. Analyse métier — cohérence comptable, financière, fiscale, sociale

> Tous les chiffres ci-dessous proviennent de l'exécution des moteurs sur les 102 écritures de démonstration, qui sont parfaitement équilibrées. Les écarts ne sont donc pas des artefacts de données : ce sont des **règles de calcul**.

### E.1 Comptabilité générale — solide

- Écritures : `entryTotals` + `isEntryValidatable` imposent ≥ 2 lignes, débit = crédit, comptes existants et imputables. **Testé, correct.**
- Plan comptable : 1 274 comptes couvrant classes 1→9, source déclarée « plan officiel SYSCOHADA » et marquée `verified: true`.
- Grand livre, balance, lettrage (manuel + automatique), à-nouveaux, clôture effective de période : présents et cohérents.
- Réserve : la numérotation des pièces est `count + 1` par journal ; après suppression ou import, des doublons de numéro sont possibles. [L]
- Réserve : une écriture datée hors exercice est rattachée **silencieusement** à la première période de l'entreprise (repli `periods[0]`), donc possiblement au mauvais exercice. [L]

### E.2 États financiers — **le défaut le plus grave du produit**

Trois moteurs construisent un bilan à partir de la même balance ; **aucun ne donne le même résultat, et aucun n'est équilibré** : [E]

| Moteur | Total actif | Total passif | Écart |
|---|---|---|---|
| `lib/engine` (bilan factorisé) | 25 820 053 | 15 233 349 | **10 586 704** |
| `lib/liasse` | 28 140 921 | 28 032 921 | **108 000** |
| `lib/financialStatements` | (dormant, non exécuté par l'UI) | — | — |

Écarts entre moteurs : **2 320 868** sur l'actif.

Causes identifiées par lecture du code [L] :
1. dans `engine`, le **résultat de l'exercice n'est pas repris au passif** (`resultat = 0` alors que le compte de résultat donne −587 805) ;
2. les **créditeurs de classe 4 autres que 401** (TVA collectée 3 634 200, CNSS 129 000, retenues 40 000, comptes 422/444…) ne sont mappés dans aucun poste : `autresDettes` reste à 0 ;
3. `totalPassif` n'est pas la somme de ses propres composantes (11 550 992 vs 15 233 349 → incohérence interne de 3 682 357) ;
4. le mapping de la liasse couvre 69 des 75 postes SYSCOHADA : **6 postes n'ont aucun préfixe de compte** (AG 207, AH 208, TG 74, TK 76, TM 796, RN 683) et ne peuvent donc jamais être alimentés.

Conséquence : **aucun état financier produit aujourd'hui n'est présentable à un client**. C'est le point à corriger avant tout le reste — un cabinet perd un client sur un bilan faux, pas sur un bouton mal placé.

### E.3 Fiscalité — deux vérités pour chaque impôt

**(a) IS : 0 ou 201 900 ?** [E]
- Page Fiscalité (`tax.computeIS`) : résultat comptable −587 805 → **IS = 0**, sans minimum de perception.
- Moteur `engine.fiscalite` (dormant) : même résultat, mais **minimum de perception = 201 900** (1 % du CA de 20 190 000) → **IS dû = 201 900**.
Les deux sont dans le code ; l'écran montre le moins prudent. Un cabinet qui s'appuie sur FIMAAC sous-estime l'impôt de 201 900 FCFA sur ce seul dossier.

**(b) TVA : la base affichée est fausse** [E]
- `tax.computeTVA` renvoie `base` = **TVA collectée** (3 634 200) et l'affiche comme « base ».
- L'onglet « Grille TVA » calcule, lui, `baseHT` = **20 190 000** (le bon chiffre).
Deux bases différentes pour la même déclaration, dans le même écran.

**(c) Libellés de comptes erronés** [E] — 433 et 435 au lieu de 443 et 445 :
- le plan comptable embarqué dit : `433 = Autres organismes sociaux` (compte social !) et **435 n'existe pas** ;
- pourtant `tax.ts`, `Tax.tsx`, `ai.ts` et `seed.ts` affichent « TVA collectée (compte 433) » et « TVA récupérable (compte 435) » ;
- le calcul, lui, utilise correctement les préfixes 443/445. C'est donc une **erreur d'affichage systématique** sur le module le plus sensible du produit.

**(d) Déclaration de démonstration incohérente** [E] : la déclaration TVA pré-remplie du seed affiche **90 000** ; recalculée par le moteur, elle vaut **2 473 332**.

**(e) Recouvrement de préfixes dans `declarationEngine`** [E] : `TVA_DEDUCTIBLE` (préfixe 445) inclut `TVA_IMMO` (4451) et `TVA_ACHATS` (4452) :
1 160 868 = 576 000 + 584 868. Tout affichage qui somme la section compte **le double** du déductible.

**(f) Taux** : TVA 18 %, IS 27 %, CNSS 4 %/17,5 % plafond 300 000, AMU 2 %/4 %, barème IRPP 8 tranches — **tous marqués `verified: false`** par le produit. Rien à redire sur la prudence : c'est exactement la bonne posture, à condition qu'un humain valide (le workflow de publication existe).

### E.4 Paie et social — sous-déclaration structurelle

Test de bout en bout sur les 2 salariés de démonstration [E] :

| Salarié | Brut | Retenue appliquée (5 % forfaitaire) | IRPP par barème | Écart mensuel |
|---|---|---|---|---|
| Kossi AGBO | 450 000 | 22 500 | 53 250 | **−30 750** |
| Awa LAWSON | 350 000 | 17 500 | 36 250 | **−18 750** |

- `payrollConfig.withholdingRate = 5` (forfait) est utilisé, alors que 8 tranches IRPP existent et que `calculateIRPP` est implémenté et testé. `payrollConfig.irppBrackets` est **vide**.
- **AMU jamais retenue** : 2 % salarié / 4 % patronal sont déclarés dans `payrollConfig` *et* dans `socialRules`, mais `runPayroll` ne les applique pas (6 000 FCFA/mois/salarié manquants).
- L'écriture de paie générée est en revanche **équilibrée et correctement ventilée** (6611, 6641, 4472, 4311, 422) : la mécanique comptable est bonne, seule la règle fiscale est simplifiée.

Impact : sur ce seul dossier de 2 salariés, **49 500 FCFA/mois de retenue non collectée**. À l'échelle d'un cabinet, c'est un risque de redressement, pas une imperfection.

### E.5 Obligations et échéances

- `generateObligationInstances` (dormant) produit **63 instances** pour 2026, dont **50 « en retard »**, parce que la génération est rétroactive depuis janvier. [E]
- Le Centre des obligations affiché, lui, agrège 5 sources réelles (échéances, demandes, déclarations, paiements, tâches) et ne dépend pas de ce moteur. [L]
- Manque : règles de report (jour férié, week-end), prorogation, périodicité trimestrielle réelle, gestion des régimes (réel / forfait).

### E.6 Contrôles croisés — utiles mais inexploités

`crossCheck` produit des constats justes sur les données de démo [E] : *Paie ↔ Compta : 12 872 643 vs 800 000* (avertissement), *CNSS ↔ Paie : 774 000 vs 32 000*, *1 transaction non rapprochée*. Ces alertes sont exactement ce qu'un chef de mission veut voir… et **le module n'est branché nulle part**.

### E.7 Production documentaire

- Export **XLSX** de liasse : fonctionnel (ExcelJS).
- Mode B (remplir un état officiel fourni) : nécessite que **l'utilisateur téléverse le modèle** ; aucun modèle GUDEF n'est embarqué. [L]
- Export **FEC** : 15 colonnes, sans colonne devise, `DateRglt` toujours vide → utilisable en interne, **non conforme** au format FEC complet attendu par un outil de contrôle.
- PDF : aucune génération (ni bilan PDF, ni facture PDF, ni liasse PDF).

---

## F. Analyse technologique

### F.1 Architecture observable

```
index.html → main.tsx → App.tsx (41 routes, 3 layouts, gardes de rôle)
                             │
                  pages/* (23) ── components/* (10, ui.tsx = design system)
                             │
        actions.ts (81 verbes métier) ──► store.ts (useSyncExternalStore)
                             │                 │
                    moteurs lib/* (57)     localStorage (JSON complet)
                             │
                   ExcelJS · JSZip · Framer Motion · Lucide · Recharts-like SVG maison
```

Forces réelles :
- **point d'écriture unique** (`actions.ts`) → auditabilité et cohérence ;
- **store réactif correct** : file de mutations sérialisée (anti-TOCTOU), `structuredClone`, migration versionnée (`DB_VERSION = 3`) avec normalisation des collections manquantes, synchronisation multi-onglets par événement `storage`, `ErrorBoundary` réparateur ;
- **moteurs purs** (entrée/sortie sans effet de bord) → testables, ce qui m'a permis de les exécuter ici ;
- doctrine « null plutôt que 0 » appliquée avec rigueur dans l'OCR et les déclarations.

### F.2 Risques techniques, par ordre de gravité

| # | Risque | Preuve | Impact |
|---|---|---|---|
| 1 | **Sécurité nulle par conception** : authentification client, hash non cryptographique (FNV-like salé), rôles non vérifiés dans `actions.ts` (0 appel à `hasPermission`), toutes les données de tous les cabinets dans un seul JSON lisible en console | [E] | Rédhibitoire pour un vrai déploiement ; en contradiction frontale avec la promesse publique « isolation stricte entre cabinets » |
| 2 | **Perte de données** : quota `localStorage` ≈ 5 Mo → saturation vers **~1 160 écritures** (441 Ko pour 102 écritures) ; au-delà, les écritures ne sont plus persistées silencieusement (le `catch` avale l'erreur de quota) | [E] | Un dossier réel = milliers d'écritures → perte silencieuse |
| 3 | **Performance** : chaque action clone et sérialise **tout** l'état — 5,2 ms à 102 écritures, 18 ms à 1 000, 75 ms à 5 000, 323 ms à 20 000 | [E] | Gel perceptible dès quelques milliers d'écritures |
| 4 | **Trois moteurs d'états divergents** + 4 945 lignes dormantes | §C.4, §E.2 | Dette de cohérence ; risque de « corriger » le mauvais moteur |
| 5 | **Import de balance fragile** : en-tête « Code » → **0 ligne importée silencieusement** ; colonne « N° » captée comme montant → montants 1 et 2 au lieu de 1 250 000 et 2 400 000 | [E] | C'est la porte d'entrée du produit ; un échec silencieux tue la confiance |
| 6 | **Aucune persistance des pièces** : seules les métadonnées survivent au rechargement | [L] | Promesse « coffre-fort documentaire » non tenue |
| 7 | **Journal d'audit non probant** : `ip` figée à `127.0.0.1`, `before` toujours `null`, aucune chaînage cryptographique | [L] | Inutilisable comme preuve |
| 8 | **Pas de tests automatisés** dans le dépôt (aucun runner, aucun fichier de test) | [L] | Chaque correction risque une régression silencieuse |

### F.3 Opportunités (technologies justifiées par un besoin, pas par la mode)

| Besoin réel | Réponse technique minimale | Pourquoi pas autre chose |
|---|---|---|
| Persistance > 5 Mo, multi-postes, isolation cabinet | backend (Postgres + API) ou BaaS avec RLS ; le schéma Prisma existe déjà et décrit 40 entités | une simple migration IndexedDB ne règle pas l'isolation ni le partage entre collaborateurs |
| Authentification crédible | Argon2/bcrypt côté serveur, sessions httpOnly, 2FA TOTP | le hash actuel est irréversible mais trivial à casser hors ligne |
| Conformité « tout montant traçable » | brancher `declarationEngine` + `notes` + contrôles croisés, **après** avoir unifié le moteur d'états | la valeur est déjà écrite, il manque le câblage |
| Productivité de saisie | import de relevés bancaires (CSV/CAMT.053) + règles de rapprochement par apprentissage | gain immédiat mesurable en heures/cabinet |
| IA réellement utile | LLM en **RAG** sur les textes fiscaux validés + appels d'outils vers les moteurs existants (jamais de calcul par le LLM) | la doctrine « ne rien inventer » impose que le LLM ne calcule pas, il explique |
| OCR des pièces | service OCR serveur (Tesseract ou API) + file de traitement, avec revue humaine obligatoire | le navigateur ne peut pas lire un scan |
| Multi-pays | « country packs » versionnés : taux, comptes, formulaires, obligations par pays | les badges pays actuels sont décoratifs |

---

## G. Feuille de route stratégique

Priorisation par **risque de perte de client**, pas par esthétique.

### P0 — Fiabiliser le socle (bloquant pour toute démonstration client)

1. **Unifier le moteur d'états financiers** : un seul calcul, testé, équilibré, résultat repris au passif, classe 4 complète. Supprimer ou archiver les deux autres implémentations.
2. **Une seule source de vérité fiscale** : IS avec minimum de perception, TVA avec crédit reporté, base = CA HT, libellés 443/444/445 corrigés partout.
3. **Paie conforme** : barème IRPP progressif + AMU + composants de paie (`payrollComponents` existe déjà).
4. **Import de balance robuste** : tolérance d'en-têtes (« Code », « N° de compte », « Intitulé »), détection de la colonne de montant par contenu, **refus explicite** plutôt que 0 ligne.
5. **Signal de démonstration + garde-fou quota** : bandeau, compteur d'occupation, alerte à 80 %, export automatique proposé.
6. **Tests de non-régression sur les moteurs** (les fonctions sont pures : c'est facile et à fort rendement).

### P1 — Rendre le produit réellement utilisable en cabinet

7. **Backend + persistance** (le `schema.prisma` est déjà écrit : 40 entités, à confronter au modèle client).
8. **Authentification et RBAC serveur** : les 16 permissions et 13 rôles sont déjà définis — les faire respecter par l'API.
9. **Pièces justificatives persistées** (stockage objet + métadonnées), avec version et empreinte.
10. **Journal d'audit inviolable** (chaînage de hachages, acteur, IP réelle).
11. **États financiers en PDF** et liasse GUDEF pré-remplie sans téléversement manuel de modèle.

### P2 — Le différenciateur

12. **Brancher les moteurs dormants** : déclarations explicables, obligations calculées, contrôles croisés, notes annexes.
13. **Import bancaire + rapprochement assisté**.
14. **OCR serveur** avec revue humaine et score de confiance.
15. **IA RAG sourcée** : explication, jamais calcul.
16. **Multi-pays / multi-devise** via country packs.
17. **Accessibilité AA** et réduction de la densité des écrans.

### P3 — Innovations à fort potentiel

18. Détection d'anomalies apprenante sur les écritures (les contrôles croisés en sont le squelette).
19. Génération automatique du dossier de contrôle fiscal (pièces + déclarations + liasses + journal).
20. API publique + connecteurs (banques, OTR, paie externe).
21. Mode « révision collaborative » : préparation → contrôle → validation, avec fil de discussion par écriture.
22. Benchmark sectoriel anonymisé (masse salariale, délais clients) — valeur rare pour un cabinet.

---

## H. Référentiel de compréhension

Le référentiel stable — à réutiliser tel quel dans les prochaines conversations et pour la rédaction des prompts — est dans **`docs/REFERENTIEL_FIMAAC.md`** : entités, routes, moteurs, conventions de code, registre des défauts (D-01 → D-26), et la méthode de rédaction des prompts.

### Règles de collaboration que j'appliquerai

1. Ne jamais détruire une fonctionnalité existante sans justification écrite et accord explicite.
2. Ne jamais modifier une règle métier sans citer sa source et son impact chiffré.
3. Ne jamais supposer le fonctionnement d'un module : vérifier dans le code, exécuter si possible.
4. Ne jamais inventer une fonctionnalité existante ni une référence juridique.
5. Toujours exposer les dépendances et les régressions possibles d'une modification.
6. Toujours distinguer **fait vérifié / lecture de code / hypothèse**.
7. Qualité avant quantité : une fonctionnalité fiable vaut dix fonctionnalités approximatives.

---

## Annexe — Pack de preuves (chiffres reproductibles)

| Mesure | Valeur |
|---|---|
| Écritures de démo / déséquilibrées | 102 / **0** |
| Balance générale | 80 951 571 = 80 951 571 |
| TVA collectée / récupérable / nette | 3 634 200 / 1 160 868 / 2 473 332 |
| TVA de la déclaration stockée | 90 000 (**incohérent**) |
| IS page Fiscalité / moteur dormant | 0 / **201 900** |
| Bilan : actif / passif (`engine`) | 25 820 053 / 15 233 349 (**écart 10 586 704**) |
| Bilan : actif / passif (`liasse`) | 28 140 921 / 28 032 921 (**écart 108 000**) |
| Écart entre les deux moteurs (actif) | 2 320 868 |
| Paie : sous-retenue (2 salariés) | 49 500 FCFA/mois + 12 000 AMU |
| Import : en-tête « Code » | 0 ligne importée, sans erreur affichée |
| Import : colonne « N° » | montants 1 et 2 au lieu de 1 250 000 et 2 400 000 |
| OCR TXT / XLSX / JPG | 10/10 · 1/10 · 0 valeur inventée |
| Coût d'une mutation | 5,2 ms (102 écr.) · 75 ms (5 000 écr.) |
| Saturation du stockage | ~1 160 écritures (5 Mo) |
| Code dormant | 4 945 lignes (23,5 %) |
| Bundle | 2,1 Mo / 615 ko gzip, fichier unique |
