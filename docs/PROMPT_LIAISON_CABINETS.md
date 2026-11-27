# PROMPT — LIAISON CABINETS ↔ ENTREPRISES + NETTOYAGE DASHBOARD

> À coller tel quel en ouverture d'une nouvelle session.
> Protocole identique à l'audit : **tu proposes d'abord, tu implémentes ensuite**,
> lot par lot, avec vérifications après chaque lot.

---

```text
# FIMAAC — LIAISON CABINET ↔ ENTREPRISE (identifiants portail) + NETTOYAGE DASHBOARD

## TON RÔLE
Tu es développeur senior full-stack TypeScript (React 19 / Vite 7 / Tailwind 4) et
product designer SaaS B2B multi-tenant. Tu implémentes une évolution structurante du
modèle de données et de deux parcours d'inscription, en respectant les invariants
comptables et d'isolation du projet.

RÈGLE ABSOLUE : tu commences par livrer un PLAN D'IMPLÉMENTATION en lots (max 15
lignes), tu attends ma validation, puis seulement tu codes — lot par lot, avec les
vérifications imposées (§7) après chaque lot. Aucune initiative hors périmètre.

## 0. CONTEXTE — À LIRE AVANT TOUT (continuité de session)
Ce projet est repris session après session. Lis ces documents AVANT de toucher au
code — ils contiennent les décisions déjà prises et les bugs déjà corrigés :
- docs/LOTS_CHAT.md            → journal d'assemblage des 12 lots (42+ modules lib, 23 pages, 24 routes)
- docs/JOURNAL_CORRECTIONS.md  → audit re-vérifié + 13 corrections déjà appliquées
                                 (B1 migration DB_VERSION=2, B2 file de mutations,
                                  B4, M2 gardes <Can>, M3 ErrorBoundary, M4 champ `ca`,
                                  M7 parseFcfa, M9 périodes company2, M10 documents de
                                  démo, M13, m5, m7, m13)
- docs/AUDIT_PHASE0.md         → audit initial (31 items) — 12 corrigés, 17 reportés
- docs/OCR_PIECES.md           → spécification extraction OCR / pièces jointes
- backend/README.md            → cible production NestJS/PostgreSQL (limites démo assumées)

ÉTAT TECHNIQUE ACTUEL (à re-confirmer avant de commencer) :
- Stack : React 19 · TS 5.9 strict · Vite 7 · Tailwind 4 · router 7 · framer-motion ·
  exceljs · jszip · build single-file
- Persistance : localStorage « fimaac_db_v1 », DB_VERSION = 2, migrate() normalisant
  (src/lib/store.ts) — TOUTE évolution du modèle exigera un bump de version + migration
- Auth démo : hash FNV synchrone (src/lib/hash.ts) — stocker JAMAIS de mot de passe
  en clair dans l'état, uniquement le hash
- Modèle : Company.organizationId = org propriétaire (cabinet si créée par le cabinet,
  propre org si auto-inscrite) · User.organizationId + User.companyId ·
  Organization.type = "cabinet" | "company_client" | "platform"
- INCOHÉRENCE ACTUELLE À RÉSOUDRE : une entreprise créée par un cabinet n'a AUCUN
  compte utilisateur → elle ne peut pas se connecter au portail ; et une entreprise
  auto-inscrite n'est rattachée à AUCUN cabinet → le cabinet ne la voit pas dans son
  portefeuille. C'est exactement ce que cette évolution corrige.
- Sélecteur de périmètre DUPLIQUÉ : `scopeCompanies` est défini localement dans
  Dashboard.tsx et Companies.tsx, et le filtre `organizationId === user.organizationId`
  est répété dans GlobalSearch.tsx, AppLayout.tsx (CompanyScopeProvider) et
  AdminPages.tsx → à extraire en UN sélecteur partagé.

## 1. INVARIANTS NON NÉGOCIABLES (violer = refaire le lot)
I1. Σ Débit = Σ Crédit · Actif = Passif — aucune modification des moteurs de calcul.
I2. Aucune valeur inventée : un champ non déterminé vaut null, jamais 0.
I3. Montants = entiers FCFA · UI 100 % français · XOF · Africa/Lome.
I4. Isolation multi-tenant : une entreprise cliente ne voit QUE ses propres données ;
    un cabinet ne voit que les entreprises qui lui sont rattachées ; aucune fuite
    cabinet→cabinet ni cabinet→client d'un autre cabinet.
I5. Sécurité des identifiants : le mot de passe en clair n'est JAMAIS stocké dans
    l'état ni persisté — uniquement le hash (hash.ts). Le mot de passe généré est
    affiché UNE SEULE fois au cabinet, jamais ré-affiché ensuite.
I6. Migration : tout champ/collection ajouté incrémente DB_VERSION (2 → 3) et est
    traité dans migrate() avec backfill — sinon le visiteur récurrent crashe (bug B1
    déjà corrigé, ne pas le réintroduire).
I7. Aucune modification de package.json / tsconfig.json / vite.config.ts sans accord.
I8. Aucune régression des fonctionnalités livrées : OCR, pièces jointes, lettrage,
    liasse GUDEF, Regulatory Engine, portail client existant.

## 2. CE QUI EST DEMANDÉ — 4 CHANTIERS

### CHANTIER 1 — Modèle de liaison cabinet ↔ entreprise (fondation)
Objectif : une entreprise est toujours rattachée à UN cabinet, quel que soit le
chemin d'entrée.

Modèle recommandé (à me confirmer, cf. Q-Modèle) :
- Ajouter sur `Company` : `cabinetOrganizationId: ID | null` (le cabinet qui gère le
  dossier) — null = entreprise sans cabinet.
- Ajouter sur `User` : `mustChangePassword: boolean` (première connexion).
- Conserver `Company.organizationId` tel quel (org propriétaire des données) pour ne
  pas casser l'isolation existante.
- Extraire UN sélecteur partagé (ex. `companiesForUser(db, user)` dans un module
  dédié, ex. src/lib/scope.ts) qui remplace tous les filtres dupliqués :
  - pour un cabinet : companies où `cabinetOrganizationId === orgId`
  - pour un client : companies où `id === user.companyId`
  - pour un super_admin : toutes
  Utilisé par Dashboard, Companies/CompanyDetail, GlobalSearch, CompanyScopeProvider
  (AppLayout), AdminCabinets.
- Migration DB_VERSION 2 → 3 : backfill `cabinetOrganizationId = organizationId`
  lorsque l'organisation propriétaire est de type "cabinet" (couvre co-demo et
  co-demo-2 du seed).

### CHANTIER 2 — Côté cabinet : création d'entreprise avec coordonnées générées
Objectif : quand un cabinet ajoute une entreprise, la plateforme génère les
identifiants de connexion de cette entreprise, modifiables ensuite.

À implémenter :
1. Le formulaire « Nouvelle entreprise » (Companies.tsx) gagne les champs
   `email` et `phone` (contact de l'entreprise) — absents aujourd'hui.
2. À la validation, `addCompany` (actions.ts) devient `addCompanyWithAccess` et :
   - crée la Company (comme aujourd'hui, + cabinetOrganizationId),
   - crée l'Organization de type "company_client" si elle n'existe pas,
   - crée le User de l'entreprise : role "client_admin", userType "client",
     companyId, email fourni,
   - GÉNÈRE un mot de passe temporaire aléatoire (crypto.getRandomValues, 12+
     caractères, complexité forte) — hashé via hashPassword avant stockage,
   - positionne `mustChangePassword: true`,
   - crée l'exercice + les 12 périodes + le taxProfile (aujourd'hui les périodes
     ne sont générées qu'au seed — sinon l'onglet Clôture sera vide),
   - consigne l'action dans l'audit trail,
   - RETOURNE { companyId, userId, email, tempPassword } (la signature actuelle
     retourne void — à changer).
3. L'UI affiche ensuite une MODALE « Identifiants générés » : e-mail, mot de passe
   temporaire, bouton Copier, avertissement « à transmettre de façon sécurisée —
   il ne sera plus affiché », et la mention que l'entreprise devra le changer à sa
   première connexion.
4. Sur CompanyDetail : nouvelle carte « Accès & identifiants » — état du compte
   (créé / non créé), e-mail, date de dernière connexion, et actions :
   « Régénérer le mot de passe » (nouveau temporaire + mustChangePassword) et
   « Modifier l'e-mail ». Chaque action est tracée (audit trail) et notifiée.
5. Validation : e-mail unique parmi les users ; format e-mail ; mot de passe
   généré conforme à la complexité.

### CHANTIER 3 — Côté entreprise : inscription avec CHOIX DU CABINET
Objectif : une entreprise qui crée son compte directement doit choisir son cabinet
parmi les cabinets inscrits sur la plateforme.

À implémenter :
1. `registerClient` (auth.ts) gagne le paramètre `cabinetOrganizationId` obligatoire
   et crée la Company avec `cabinetOrganizationId` + `organizationId` = propre org.
2. Le formulaire Register (Auth.tsx, onglet Client) gagne une rubrique
   « Choisir le cabinet » : select/recherche alimenté par
   `organizations.filter(type === "cabinet")`, affichant nom + ville (informations
   minimales — cf. Q-Vie privée). Sans cabinet inscrit : message explicite.
3. Notification au cabinet choisi : « Nouvelle entreprise rattachée » + elle
   apparaît immédiatement dans son portefeuille via le sélecteur partagé.
4. Le cabinet doit aussi pouvoir créer un accès pour une entreprise qui existe
   déjà sans compte (rattrapage) — bouton « Créer l'accès portail » sur
   CompanyDetail si aucun User n'est lié.
5. Self-service entreprise : Portail → Paramètres gagne un onglet « Sécurité »
   permettant de modifier son e-mail et son mot de passe (vérification de
   l'ancien mot de passe, confirmation, déconnexion des autres sessions non
   simulable en démo — à documenter).

### CHANTIER 4 — Dashboard : suppression du bloc « Travail à faire aujourd'hui »
Objectif : ce bloc duplique le Centre des obligations (page /app/obligations) qui
couvre déjà les 6 mêmes sources avec filtres, compteurs J-n et calendrier.

À implémenter :
1. Supprimer de Dashboard.tsx : le bloc « Travail à faire aujourd'hui », les états
   `workFilter` / `workExpanded`, les données `workload` / `filteredWork` /
   `workCounts`, la constante `SEV`, et les imports devenus inutiles.
2. Ajouter à la place un lien/contexte vers le Centre des obligations (ex. une
   tuile récapitulative compacte : nb en retard / urgents / à faire, avec bouton
   « Ouvrir le centre des obligations ») — léger, sans dupliquer la logique.
3. Vérifier si `computeWorkload` / `WorkItem` (analytics.ts) sont encore utilisés
   ailleurs : si non, supprimer (grep obligatoire avant suppression).
4. Vérifier que `Clock`, `CheckCircle2`, `ArrowRight` restent utilisés (widgets
   échéances/missions) — sinon retirer des imports (noUnusedLocals actif).

### CHANTIER 5 — Continuité de session (documentation vivante)
Objectif : toute session suivante doit retrouver l'état exact du projet.

À implémenter :
1. Créer docs/JOURNAL_LIAISON.md — journal lot par lot : fichiers touchés, décisions,
   bugs rencontrés, vérifications, ce qui reste à faire.
2. Mettre à jour docs/LOTS_CHAT.md (nouveau lot numéroté + renvoi vers le journal).
3. Créer docs/DECISIONS.md — journal des décisions de conception (format :
   décision · alternatives écartées · raison · date), en y consignant le choix du
   modèle de liaison et les réponses aux questions du §6.
4. Ajouter en tête de docs/LOTS_CHAT.md une section « FEUILLE DE ROUTE » qui liste :
   fait / en cours / à faire (acceptation de rattachement, révocation d'accès,
   multi-cabinet, changement d'e-mail côté cabinet, etc.) — maintenue à jour à
   chaque fin de lot.

## 3. MÉTHODE
- Lot 1 = modèle + migration + sélecteur partagé (fondation, seule, avant tout le
  reste) — sinon les lots suivants s'appuient sur du sable.
- Lots 2, 3, 4, 5 ensuite, dans cet ordre.
- Pour chaque lot : tsc --noEmit = 0 erreur · npm run build réussi (+ taille) ·
  grep de non-régression sur les invariants · journal mis à jour.
- Aucun refactor cosmétique hors périmètre · aucun changement de config ·
  aucune nouvelle dépendance.

## 4. SCÉNARIOS D'ACCEPTATION (à dérouler à la fin, en les décrivant pas à pas)
S1 — Le cabinet crée une entreprise avec coordonnées : login cabinet → Entreprises →
     Nouvelle entreprise (avec e-mail) → modale « Identifiants générés » avec mot de
     passe temporaire copiable → l'entreprise apparaît dans le portefeuille.
S2 — Première connexion de l'entreprise : login avec ces identifiants → /portail →
     modale bloquante de changement de mot de passe → accès normal ensuite.
S3 — L'entreprise s'inscrit seule : /register → onglet Client → champ « Choisir le
     cabinet » obligatoire → création → le cabinet voit l'entreprise + notification.
S4 — L'entreprise change ses identifiants : Portail → Paramètres → Sécurité →
     l'ancien mot de passe ne fonctionne plus, le nouveau oui.
S5 — Le cabinet régénère un mot de passe : CompanyDetail → Accès & identifiants →
     nouveau temporaire affiché une fois → première connexion exigée.
S6 — Isolation : l'entreprise A ne voit que ses données ; le cabinet X ne voit pas
     les entreprises du cabinet Y ; GlobalSearch et le portail respectent le périmètre.
S7 — Dashboard : plus de bloc « Travail à faire » · tuile récapitulative vers le
     Centre des obligations · tsc 0 erreur · aucune référence morte.

## 5. CE QUE TU NE FAIS JAMAIS
- Stocker un mot de passe en clair dans l'état ou ré-afficher un mot de passe généré.
- Casser l'isolation multi-tenant ou affaiblir un contrôle existant.
- Étendre le périmètre (acceptation de rattachement, révocation, multi-cabinet)
  sans mon accord — ce sont des propositions de backlog, pas du travail à faire.
- Modifier les moteurs comptables, les formules fiscales, ou la config sans accord.
- Dire « ça devrait marcher » : preuve par grep, extrait de build ou scénario déroulé.

## 6. QUESTIONS À ME SOUMETTRE (je tranche)
Q-Modèle — Pointer `cabinetOrganizationId` sur Company (recommandé, minimal) vs table
   de liaison dédiée (plus souple, plus lourd). Confirme le premier.
Q-Création — « Coordonnées » = identifiants de connexion (e-mail + mot de passe
   temporaire) — c'est mon interprétation. Si tu entendais les coordonnées de
   contact (adresse, téléphone), dis-le : le chantier 2 change alors de forme.
Q-Rattachement — Inscription entreprise : rattachement AUTO-ACCEPTÉ + notification
   (recommandé pour cette passe) ou flux de VALIDATION par le cabinet
   (en attente → accepté/refusé, plus réaliste mais plus lourd) ?
Q-Vie privée — La liste des cabinets exposée à l'inscription publique ne montre que
   nom + ville : suffisant ? Et si aucun cabinet n'est encore inscrit : champ
   optionnel avec « Sans cabinet (rejoindre plus tard) » ou inscription bloquée ?
Q-Email — E-mail absent lors de la création par le cabinet : générer un identifiant
   technique `slug-entreprise@fimaac.local`, ou rendre l'e-mail obligatoire ?
Q-Révocation — Pouvoir révoquer l'accès portail d'une entreprise : cette passe ou
   backlog ?

## 7. DÉROULEMENT ATTENDU
1. Lis les 5 documents de contexte + re-confirme l'état technique (grep sur
   DB_VERSION, scopeCompanies, addCompany, registerClient).
2. Présente ton PLAN D'IMPLÉMENTATION en lots (max 15 lignes) + tes réponses
   recommandées aux 6 questions.
3. ATTENDS ma validation.
4. Implémente lot par lot avec les vérifications du §3, en journalisant (§ Chantier 5).
5. Termine par les scénarios d'acceptation du §4, déroulés étape par étape.

Commence par l'étape 1, puis présente-moi le plan et tes recommandations.
```

---

## Pourquoi ce prompt est structuré ainsi

| Levier | Ce qu'il apporte |
|---|---|
| **5 chantiers, pas 2** | Tu as demandé la liaison + le choix du cabinet + le Dashboard. J'ai ajouté la **continuité de session** (que tu as exigée) et la **fondation modèle/migration/sélecteur** en Lot 1 — sans elle, les deux parcours s'appuient sur des filtres dupliqués et cassent la migration B1 déjà corrigée |
| **Incohérence actuelle nommée** | Le prompt fait constater que les entreprises créées par un cabinet **n'ont aucun compte** et que les auto-inscrites **ne sont rattachées à rien** — c'est ça, le vrai problème |
| **Sélecteur partagé imposé** | `scopeCompanies` est dupliqué dans 5 fichiers : c'est LE point de refactor qui rendra la liaison cohérente partout (Dashboard, GlobalSearch, portail, admin) |
| **Invariants I5/I6 renforcés** | Jamais de mot de passe en clair dans l'état, jamais ré-affiché ; tout bump de `DB_VERSION` avec backfill (sinon on réintroduit le bug B1 corrigé) |
| **7 scénarios d'acceptation** | Des parcours testables pas à pas, pas un « ça marche » affirmé |
| **6 questions à trancher** | Dont une **ambiguïté sur « coordonnées »** (identifiants de connexion vs coordonnées de contact) — j'ai pris l'interprétation identifiants, à confirmer |

## 2 points à trancher avant de lancer

1. **« Coordonnées »** — j'ai interprété « identifiants de connexion (e-mail + mot de passe temporaire) », car c'est ce qui permet à l'entreprise de se connecter au portail. Si tu parlais des coordonnées de contact (adresse/téléphone), le chantier 2 change de forme — dis-le-moi et j'ajuste le prompt.
2. **Rattachement auto-accepté ou validé par le cabinet** — je recommande auto-accepté + notification pour cette passe, le flux de validation étant proposé au backlog.

Le prompt est enregistré dans `docs/PROMPT_LIAISON_CABINETS.md`, prêt à être collé dans une nouvelle session. Si tu veux que j'implémente directement ici (au lieu d'une nouvelle session), dis-le-moi et j'enchaîne selon ce plan 🚀
