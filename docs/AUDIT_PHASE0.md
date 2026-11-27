# AUDIT FIMAAC — Phase 0 (diagnostic seul)
> **Aucun correctif appliqué.** Ce rapport documente les problèmes trouvés avec
> leurs mesures. Chaque item indique : fichier, ligne, symptôme, cause racine,
> correctif proposé, impact. À valider avant la Phase 1.

---

## Méthode
Vérification statique (grep + lecture) et dynamique (esbuild + node, mesures
`performance.now()` sur 20 itérations). Chaque affirmation ci-dessous a été
**mesurée ou vérifiée par grep** — rien n'est spéculatif sans mention explicite.

### Mesures de référence (état actuel)
| Mesure | Valeur |
|---|---|
| Bundle `dist/index.html` | 2 102 kB (596 kB gzip) |
| Seed JSON (caractères) | **414 560 chars → 810 kB de quota localStorage en UTF-16** |
| `structuredClone(state)` | **3,43 ms/op** |
| `JSON.stringify + parse` | **5,24 ms/op** |
| **Total `mutate` (clone + stringify)** | **≈ 8,7 ms/op** |
| `computeDashboard` | 1,44 ms/op |
| `computeWorkload` | 0,21 ms/op |
| `runCoherenceChecks` (103 contrôles) | 0,15 ms/op |
| Erreurs `tsc --noEmit` | 0 |
| Tests unitaires | **0** |
| Error Boundary | **0** |
| `hasPermission` consulté hors `permissions.ts` | **0 occurrence** |

> ⚠️ Le cahier des charges annonçait « ~316 kB » et « 4,5 ms/op » : la réalité
> actuelle est **405 kB de JSON / 810 kB de quota UTF-16** et **8,7 ms/op**.
> Le problème est donc **≈ 2× pire** que documenté, suite à l'ajout de
> l'historique 12 mois au lot du dashboard.

---

## 🔴 BLOQUANT — crash ou perte de données

### B1. Migration de schéma manquante → crash garanti pour tout visiteur récurrent
- **Fichier** : `src/lib/store.ts:5,12`
- **Symptôme** : la clé localStorage `fimaac_db_v1` est lue sans vérification de
  version. Si `parsed.booted` est vrai, l'état stocké est retourné tel quel.
- **Cause racine** : le champ `JournalEntry.attachmentDocIds` a été ajouté au
  type (lot OCR) mais **aucune migration n'existe**. Tout visiteur ayant chargé
  l'application avant cet ajout a un `entries` **sans** ce champ.
- **Conséquence** : `entry.attachmentDocIds.map(...)` → **TypeError: Cannot read
  properties of undefined** au rendu de Comptabilité, DocumentViewer, Dashboard.
  Écran blanc (pas d'Error Boundary, cf. M3).
- **Vérifié** : le seed actuel contient bien le champ (0 entrée sans
  `attachmentDocIds`) — mais **le stockage des visiteurs récents non**.
- **Correctif** : bump de version (`fimaac_db_v2`) + fonction `migrate(parsed)`
  qui normalise les champs manquants, avec garde-fou `Array.isArray(e.attachmentDocIds)`.
- **Impact** : bloque tout visiteur récurrent. **Priorité 1 absolue.**

### B2. `store.mutate` — bug TOCTOU → perte de données silencieuse
- **Fichier** : `src/lib/store.ts:50`
- **Symptôme** : `mutate(fn)` clone l'état **capturé au moment de l'appel**.
  Toute action qui fait `getDB()` → calcule → `mutate()` travaille sur une
  capture obsolète si une autre mutation est survenue entre-temps.
- **Cause racine** : pattern « read-then-clone » dans ~60 actions
  (`actions.ts`), notamment `addEntry` (lit `db.periods`, `db.journals`,
  `db.entries` avant `mutate`), `runPayroll`, `autoReconcile`, `updateEntry`,
  `postRegularisation`.
- **Conséquence** : deux mutations rapides (ex. double-clic sur « Valider »,
  exécution de modèles récurrents) → la seconde écrase la première.
- **Correctif** : passer `fn(state)` **réellement courant** et faire la lecture
  DANS le callback, ou sérialiser les mutations via une file.
- **Impact** : perte de données silencieuse, indétectable par l'utilisateur.

### B3. ExcelJS + JSZip bundlés eagerly — ≈ 860 kB dans le bundle initial
- **Fichiers** : `src/lib/liasse.ts:1`, `src/lib/xlsx-sanitizer.ts:12` (ExcelJS),
  `src/lib/xlsx-filler.ts:3` (JSZip)
- **Chaîne d'import eager vérifiée** :
  `Dashboard.tsx → analytics.ts → liasseEngine.ts → xlsx-sanitizer.ts (ExcelJS)
   + xlsx-filler.ts (JSZip)`
  et `ConformityWorkshop.tsx → liveCoherence.ts → liasseEngine.ts → …`
- **Symptôme** : seuls `/app/liasse`, `/app/atelier-etats` et `/extractor`
  utilisent réellement ExcelJS. Or le **tableau de bord** (page d'accueil)
  tire la chaîne entière dans le bundle initial.
- **Correctif** : `import()` dynamique dans `liasse.ts`, `xlsx-sanitizer.ts`,
  `xlsx-filler.ts` + retirer l'import statique de `buildAggregate` dans
  `analytics.ts` (dupliquer la fonction légère ou l'extraire).
- **Impact** : gain estimé **60-70 % du bundle initial** (≈ 1,2-1,4 MB → ≈ 400-600 kB).
  **Priorité 2.**

### B4. `postFromDocument` casse la synchronisation bidirectionnelle des pièces jointes
- **Fichier** : `src/lib/actions.ts:512`
- **Symptôme** : `doc.linkedEntryId = entryId` est écrit **directement** dans le
  `mutate`, sans passer par `linkDocumentToEntry`. Le champ
  `entry.attachmentDocIds` n'est **pas** mis à jour.
- **Conséquence** : la pièce est comptabilisée mais **n'apparaît pas** comme
  pièce jointe de l'écriture — l'utilisateur ne peut ni la visualiser ni la
  télécharger depuis l'écriture, ce qui contredit la fonctionnalité livrée.
- **Correctif** : appeler la même logique que `linkDocumentToEntry` (ou
  extraire une fonction interne commune).
- **Impact** : fonctionnalité des pièces jointes **incomplète** sur le chemin
  le plus fréquent (comptabilisation d'une facture OCR).

---

## 🟠 MAJEUR — fonctionnalité incorrecte ou dégradée

### M1. `Modal` n'a ni piège de focus, ni fermeture Échap — **le cahier des charges était inexact**
- **Fichier** : `src/components/ui.tsx` (composant `Modal`)
- **Vérifié** : `grep onKeyDown|useRef|focus` dans le composant Modal → **0 occurrence**.
- **Correction au cahier des charges** : « Échap fonctionne » est **faux**. Aucune
  modale de l'application ne se ferme avec Échap, et le focus peut sortir de la
  modale vers l'arrière-plan (piège d'accessibilité WCAG 2.1 — critère 2.4.3).
- **Correctif** : focus trap (`useRef` + Tab cyclique) + `onKeyDown` Échap +
  restitution du focus à l'élément déclencheur.
- **Impact** : ~20 modales dans l'application, toutes concernées.

### M2. RBAC défini mais **jamais consulté** — 16 permissions mortes
- **Fichier** : `src/lib/permissions.ts` (16 permissions, `hasPermission`, `ROLE_PERMISSIONS`)
- **Vérifié** : `grep hasPermission|ROLE_PERMISSIONS` hors `permissions.ts` → **0 occurrence**.
- **Symptôme** : un `assistant` peut valider une écriture, modifier un taux
  fiscal, réinitialiser la base. Seules les **routes** sont gardées
  (`App.tsx:55,83,95` — 3 gardes par `userType`/`role`), pas les **actions**.
- **Correctif** : brancher `hasPermission` sur les actions sensibles + composant
  `<Can permission="…">` pour masquer les boutons.
- **Impact** : isolation fonctionnelle non appliquée côté front.

### M3. Aucun Error Boundary — tout échec de rendu = écran blanc
- **Vérifié** : `grep ErrorBoundary|componentDidCatch|getDerivedStateFromError` → **0 occurrence**.
- **Symptôme** : combiné à B1, un visiteur récurrent voit un **écran blanc** sans
  message ni moyen de se récupérer (le localStorage reste corrompu).
- **Correctif** : `<ErrorBoundary>` au niveau du `Layout` + une version par
  route + un bouton « Réinitialiser les données » dans le catch.
- **Impact** : expérience utilisateur catastrophique en cas d'erreur.

### M4. Deux calculs de CA contradictoires — le tableau de bord ment
- **Fichiers** : `src/lib/accounting.ts:137` vs `src/lib/liasseEngine.ts` (sii.XB)
- **Symptôme** : `financialSummary().produits` agrège **toute la classe 7**
  (701-707 **mais aussi** 71 subventions, 72 production immobilisée, 75 autres
  produits, 78 transferts de charges, 79 reprises de provisions) et l'appelle
  « Chiffre d'affaires » dans le Dashboard. Or `sii.XB` (SIG SYSCOHADA) ne prend
  que **701-707**.
- **Conséquence** : la tuile KPI « Chiffre d'affaires », le graphique
  « Évolution du CA » et le waterfall affichent un CA **≠** celui du SIG affiché
  à côté dans la même page.
- **Correctif** : extraire `computeCA()` unique (701-706+707) et réutiliser dans
  les deux. Les autres produits restent dans `sii.TH` (autres produits).
- **Impact** : correctitude du reporting — chiffre clé de direction.

### M5. Taux IS dupliqué en 3 endroits avec 3 formes différentes
- **Fichiers** :
  - `src/lib/tax.ts` — 27 % sur le résultat (IS simple)
  - `src/lib/liasse.ts:392` — `ROUNDDOWN(résultat × 0,27, -1)` (formule GUDEF)
  - `src/lib/regulatory-engine.ts:320` — `IS_STANDARD rate: 27` (versionné)
- **Symptôme** : trois implémentations, aucune ne consulte le Regulatory Engine
  alors que c'est sa raison d'être. Modifier le taux dans `/admin/reglementaire`
  ne change **rien** aux calculs.
- **Correctif** : `getTaxRate(rules, versionId, "IS_STANDARD")` unique, avec les
  variantes d'arrondi (`ROUNDDOWN -1`) documentées séparément de la base.
- **Impact** : incohérence fiscale selon la page consultée.

### M6. Minimum de perception — deux formules **incompatibles** donnant des écarts majeurs
- **Fichiers** : `src/lib/liasse.ts:390` vs `src/lib/regulatory-extensions.ts:273`
- **Comparaison sur CA = 20 190 000 FCFA** :
  - liasse.ts : `ROUNDDOWN(201 900 000/100 000 × 100, -1)` → **201 900 FCFA**
  - regulatory-extensions.ts : `max(20 000, 20 190 000 × 0,005)` → **100 950 FCFA**
- **Écart : 100 950 FCFA (× 2)** entre les deux moteurs, pour le même CA.
- **Correctif** : UNE fonction `computeMinimumPerception(ca, rule)` dans le
  Regulatory Engine, avec la formule sourcée. Laquelle est correcte doit être
  **validée contre le CGI togolais** — je ne peux pas trancher seul.

### M7. `parseFcfa` casse les montants avec séparateurs ou suffixes
- **Fichier** : `src/lib/format.ts:34`
- **Symptôme** : `input.replace(/[^\d-]/g, "")` → `« 1,5 M »` donne **15**,
  `« 1 250 000 »` donne **1250000** (correct par chance), `« -500 000 »` donne
  **-500000** (correct), mais `« 1.5 »` donne **15**.
- **Conséquence** : toutes les saisies de montant de l'application
  (écritures, immobilisations, stocks, régularisations, demandes de paiement)
  sont exposées à une erreur de ×10 si l'utilisateur tape une décimale.
- **Correctif** : parsing décimal réel avec heuristique de séparateur
  (réutiliser `parseAmount` de `importers.ts`, qui gère déjà ce cas correctement).

### M8. `GlobalSearch` ne couvre pas 8 entités créées depuis
- **Fichier** : `src/components/GlobalSearch.tsx`
- **Vérifié** : 0 référence à `fsSessions`, `taxDeclarations`,
  `bankTransactions`, `entryTemplates`, `payslips`, `fixedAssets`,
  `documentRequests`, `complianceIssues`.
- **Symptôme** : la recherche (`/`) ne trouve ni échéance fiscale, ni session
  d'états, ni immobilisation, ni bulletin, ni anomalie — alors que ces entités
  sont maintenant centrales dans le produit.
- **Correctif** : étendre les boucles de recherche + ajouter les types au mapping d'icônes.

### M9. `periods` créés uniquement pour `co-demo` — exercice de `co-demo-2` sans période
- **Fichier** : `src/lib/seed.ts:206` (`id: per-${company.id}-${m}`) — 12 périodes
  pour `company.id` uniquement ; `company2.id` n'en **aucune**.
- **Symptôme** : toute écriture sur `DistGolfe` a `periodId: ""` (fallback dans
  `addEntry`). L'onglet **Clôture** de Comptabilité est vide pour cette
  entreprise, et le contrôle de période clôturée ne s'applique pas.
- **Correctif** : générer les périodes pour chaque entreprise du seed.

### M10. `documents: []` — la fonctionnalité des pièces jointes n'a **aucune donnée de démonstration**
- **Fichier** : `src/lib/seed.ts`
- **Symptôme** : la visionneuse, le téléchargement, l'extraction OCR et le
  rattachement aux écritures sont **invisibles en démo** : l'onglet Documents
  affiche « Aucun exercice », aucune écriture n'a de compteur de pièces.
- **Conséquence** : impossible de démontrer la fonctionnalité livrée ni de la
  tester en conditions réelles.
- **Correctif** : ajouter 6-10 pièces de démonstration (CSV réels lisibles +
  une image scannée pour démontrer le message « illisible »), rattachées aux
  écritures existantes.

### M11. `reconcileVAT` — taux TVA `18` en valeur par défaut hardcodée
- **Fichier** : `src/lib/regulatory-extensions.ts:156` — `vatRate: number = 18`
- **Symptôme** : contredit le principe « aucun taux codé en dur dans les
  composants ». Le même 18 apparaît aussi dans `regulatory-engine.ts:312`.
- **Correctif** : exiger `vatRate` (pas de défaut) et l'injecter depuis
  `getTaxRate(rules, versionId, "TVA_STANDARD")`.

### M12. `STATUS_DOC[d.docStatus]` sans garde — crash si `docStatus` absent
- **Fichier** : `src/pages/Documents.tsx:194`
- **Symptôme** : `STATUS_DOC[d.docStatus].tone` lève une TypeError si
  `d.docStatus` est `undefined`. Le type le déclare obligatoire, mais un
  document créé hors `addDocument` (import, migration incomplète) peut ne pas
  l'avoir — même classe de risque que B1.
- **Correctif** : `STATUS_DOC[d.docStatus ?? "non_classe"] ?? STATUS_DOC.non_classe`.

### M13. `useMemo` du Dashboard ne mémoïse jamais — recalcul à chaque rendu
- **Fichier** : `src/pages/Dashboard.tsx:36,48-53`
- **Symptôme** : `const companyIds = companies.map(...)` crée un **nouveau
  tableau** à chaque rendu → les dépendances `[db, activeId, companyIds]` du
  `useMemo` changent toujours → `computeDashboard` (1,44 ms) est réexécuté à
  chaque frappe/cliquer.
- **Correctif** : mémoïser `companyIds` (ou passer une chaîne signée) — mesure
  avant/après nécessaire.
- **Impact** : performance, combiné à B3 et B2.

---

## 🟡 MINEUR — qualité, a11y, polish

### m1. `key={index}` dans les tableaux de données — 10+ occurrences
- `Liasse.tsx:196,228,286,316,471`, `ConformityWorkshop.tsx:81`,
  `AIAssistant.tsx:67`, `Financials.tsx` (plusieurs), `Documents.tsx`.
- Symptôme : sur tri/filtre/suppression, React réconcilie par position → état
  de composants non contrôlés mélangé, perte de focus.
- Correctif : clé stable (`l.ref`, `r.code`, `e.id`).

### m2. Contraste insuffisant — **240 occurrences** de `text-slate-400` sur blanc
- Ratio ≈ 3,0:1 — échec WCAG 2.1 AA (4,5:1 requis pour le texte normal).
- Affecte la lisibilité des montants secondaires, dates, descriptions.
- Correctif : `text-slate-500` (4,6:1) ou `slate-600` selon le rôle.

### m3. Graphiques SVG sans `aria-label` ni alternative — 0 occurrence
- Vérifié : `grep aria-label|role="img"` dans `charts.tsx` et `ui.tsx` → 0.
- Un lecteur d'écran ne reçoit **aucune information** des 9 graphiques du
  Dashboard, ni des 10 types de la bibliothèque.
- Correctif : `role="img"` + `aria-label` descriptif + `<caption>`/table
  alternative repliable.

### m4. `alert()` / `confirm()` / `prompt()` — **34 occurrences** réparties sur 10 fichiers
- `Liasse.tsx:15`, `StatementsWorkshop.tsx:6`, `Operations.tsx:3`,
  `Settings.tsx:2`, `Portal.tsx:2`, `Accounting.tsx:2`, `Financials.tsx:1`,
  `Documents.tsx:1`, `Tax.tsx:1`, `Requests.tsx:1`.
- **Incohérence relevée** : `actions.ts:28` définit déjà `notify()` non
  bloquante (utilisée uniquement par `addEntry`) — l'infrastructure existe, elle
  n'est pas réutilisée.
- Correctif : un composant `<Toast>` unique + `<ConfirmDialog>`, migrer les 34
  appels.

### m5. `runOcr` appelé via `setTimeout` sans `.catch`
- **Fichier** : `src/lib/actions.ts:735` — `setTimeout(() => runOcr(docId), 1500)`
- Une promesse rejetée (classeur corrompu) → `Unhandled promise rejection`.

### m6. `URL.revokeObjectURL` temporisé au lieu de garanti
- **Fichier** : `src/pages/Liasse.tsx` (`onFillState`) — `setTimeout(revoke, 2000)`.
- Sur un téléchargement lent (> 2 s) ou un onglet en arrière-plan, le blob est
  révoqué avant la fin du téléchargement → fichier vide.
- Correctif : révoquer sur l'événement `focus` suivant ou après un délai long.

### m7. `daysUntil` utilise minuit local, `formatDate` force `Africa/Lome`
- **Fichier** : `src/lib/format.ts:84` vs `:45,57`
- Africa/Lome est GMT+0, mais un navigateur en Europe/Paris (UTC+1/+2) décale
  les bornes de jour → une échéance « aujourd'hui » peut s'afficher « demain ».
- Correctif : unifier sur un seul fuseau (Africa/Lome) pour les deux.

### m8. `fcfa()` (format.ts) et `Money` (ui.tsx) — duplication
- Deux implémentations du même formatage, l'une avec signe `−` typographique,
  l'autre non. Risque d'incohérence visuelle.

### m9. Aucun test unitaire — **0 fichier** `*.test.*` / `*.spec.*`
- Aucune protection contre une régression des formules comptables (cascade SIG,
  liquidations, lettrage, OCR). Combiné à l'historique de 8 bugs de mapping
  corrigés, c'est le principal risque de qualité à long terme.

### m10. Aucun style d'impression pour les états financiers
- `index.css` a un bloc `@media print` minimal (masque `aside`, `header`,
  `.aurora`) — mais les tableaux longs (balance, grand livre, liasse) ne sont
  pas paginés, ni les bordures conservées.

### m11. Aucune limite de taille/type sur les téléversements
- `Documents.tsx` et `Portal.tsx` : un XLSX de 50 Mo gèle l'onglet (ExcelJS
  parse en mémoire). Aucun message d'erreur exploitable pour l'utilisateur.
- Correctif : validation MIME + taille max (ex. 10 Mo) + message explicite.

### m12. Exports CSV/FEC — échappement non vérifié
- `Financials.tsx:downloadCSV` échappe `"` mais pas les retours ligne dans les
  libellés ; `ledger.ts:exportFEC` remplace `|` mais pas les retours ligne.
- Un libellé multi-ligne casse la structure du fichier exporté.

### m13. Deux onglets ouverts = dernière écriture gagne
- `store.ts` ne surveille pas l'événement `storage` → aucune détection de
  conflit. Perte silencieuse.
- Correctif : écouter `storage` + avertir l'utilisateur.

### m14. `mappingCoverage` = 69/75 — 6 postes sans compte correspondant
- **Vérifié** : `AG (207)`, `AH (208)`, `TG (74)`, `TK (76)`, `TM (796)`, `RN (683)`
- Cause : ces préfixes n'existent pas dans le plan SYSCOHADA intégré (les
  comptes 207/208 sont des subdivisions de 21/215, 74 est une classe 71-73, etc.)
- Correctif : soit remapper sur les vrais préfixes du plan (ex. TG → `71`,
  TK → `76`), soit documenter que ces références GUDEF n'ont pas de
  contrepartie dans le plan de compte utilisé.

---

## 🟢 Points vérifiés CONFORMES (non régressés)
| Contrôle | Résultat |
|---|---|
| Σ Débit = Σ Crédit (2 entreprises) | ✅ écart 0 |
| Actif = Passif (2 entreprises) | ✅ écart 0 |
| Login 4 comptes + rejet mauvais mdp | ✅ |
| Contrôles normatifs (8/8) sur les 2 entreprises | ✅ score 88, seul `map.coverage` en Avertissement |
| DK inclut classe 42 · CJ depuis SIG · RM=67 · RK=66 · RI=64 | ✅ |
| Classe 24 dans AM · 49 dans AI · 82 dans TN | ✅ |
| regex `/<f\b/` (pas `/<\f\b/`) dans xlsx-filler.ts | ✅ |
| `hashPassword` synchrone | ✅ |
| OCR : image = 0 valeur déduite · CSV sans saut de ligne | ✅ |
| Modification d'écriture : 3 refus corrects | ✅ |
| `dangerouslySetInnerHTML` | ✅ 0 occurrence |
| `localStorage` indisponible → fallback silencieux | ✅ (4 `catch`) |

---

## Corrections au cahier des charges
| Affirmation du prompt | Réalité mesurée |
|---|---|
| « seed ~316 kB » | **405 kB de JSON → 810 kB de quota UTF-16** |
| « 4,5 ms par action » | **8,7 ms/op** (3,43 clone + 5,24 stringify) |
| « Échap fonctionne » (modales) | **Non** — 0 `onKeyDown` dans `Modal` |
| « 24 routes » | 37 déclarations de `path` dans `App.tsx` |
| « 102 écritures » | ✅ confirmé |
| « 46 collections » | ✅ confirmé |
| « 1 274 comptes » | ✅ confirmé |

---

## Plan d'exécution proposé (ordre de priorité)
| Ordre | Phase | Justification |
|---|---|---|
| 1 | **B1 + M3** (migration + Error Boundary) | Débloque tout visiteur récurrent, actuellement en écran blanc |
| 2 | **B3** (bundle lazy) | Gain le plus important et le plus mesurable |
| 3 | **B2** (TOCTOU) | Perte de données silencieuse |
| 4 | **M4, M5, M6, M11** (correctitude comptable) | Le reporting ment à la direction |
| 5 | **B4, M9, M10** (pièces jointes + données de démo) | Fonctionnalité livrée mais invisible |
| 6 | **M7, m4, M1** (montants + toasts + modales) | Fiabilité de saisie + UX |
| 7 | **M2, M8, M12, M13** (RBAC, recherche, gardes) | Sécurité et complétude |
| 8 | **m1-m14** (a11y, tests, impression, polish) | Qualité long terme |

---

## Estimation d'impact global
| Métrique | Avant | Après (estimé) |
|---|---|---|
| Bundle initial | 2 102 kB (596 kB gzip) | ≈ 500-700 kB (≈ 180-250 kB gzip) |
| Coût d'une mutation | 8,7 ms | < 1 ms (debounce + clonage ciblé) |
| localStorage écrit / action | 810 kB | idem mais débouncé (1×/2 s) |
| Visiteur récurrent | **écran blanc** | fonctionne |
| RBAC appliqué | non | oui (16 permissions) |
| Entités indexées par la recherche | 5 | 13 |
| Tests unitaires | 0 | ≥ 30 (moteurs comptables) |
| Modales accessibles | 0/20 | 20/20 |
| Graphiques accessibles | 0/10 | 10/10 |
| Erreurs `tsc` | 0 | 0 (non régression) |
