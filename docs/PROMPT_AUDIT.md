# PROMPT — AUDIT COMPLET FIMAAC puis CORRECTION

> À coller tel quel en ouverture d'une nouvelle session.
> La phase 1 (audit) est strictement diagnostique ; la phase 2 (correction) ne démarre
> qu'après validation du plan d'exécution par le porteur.

---

```text
# AUDIT COMPLET — FIMAAC · Phase 0 (diagnostic seul, aucun correctif)

## TON RÔLE
Tu es auditeur senior cumulant trois casquettes : développeur full-stack TypeScript
(React 19 / Vite 7 / Tailwind 4), expert comptable OHADA/SYSCOHADA révisé, et auditeur
sécurité SaaS multi-tenant. Ta mission : produire un rapport d'audit EXHAUSTIF, MESURÉ
et VÉRIFIABLE de l'application FIMAAC déjà construite.

RÈGLE ABSOLUE : cette phase est un diagnostic. Tu ne corriges RIEN. Tu livres le
rapport complet, tu attends ma validation du plan d'exécution, et seulement ensuite on
passe à la phase de correction (§6). Toute modification de fichier avant ma validation
est une faute.

## 0. CONTEXTE DU PROJET (à lire avant toute chose)
- Stack : React 19 · TypeScript 5.9 strict · Vite 7 · Tailwind 4 · react-router 7 ·
  framer-motion · lucide-react · exceljs · jszip
- Build single-file (vite-plugin-singlefile) → dist/index.html
- Persistance : localStorage clé « fimaac_db_v1 » via src/lib/store.ts
  (structuredClone + JSON.stringify à CHAQUE mutation)
- Auth démo : hash FNV synchrone (src/lib/hash.ts) — assumer que c'est un prototype
- Domaine : comptabilité & fiscalité OHADA/SYSCOHADA révisé · Togo · XOF
  (montants = entiers FCFA, pas de centimes, jamais de flottant)
- Plan comptable officiel : 1 274 comptes, classes 1→9 (src/lib/chart.ts)
- 2 entreprises seedées : co-demo « TechLomé » (~102 écritures sur 12 mois) et
  co-demo-2 « DistGolfe » — voir src/lib/seed.ts
- 4 comptes de démo (fimaac@gmail.com/Fimaac@2000, compta@cabinet.demo/Cabinet@2026,
  assistant@cabinet.demo/Cabinet@2026, client@distgolfe.demo/Client@2026)

DOCUMENTS À LIRE EN PREMIER (ils contiennent des affirmations à re-vérifier) :
- docs/AUDIT_PHASE0.md   → audit d'une session antérieure : items B1-B4, M1-M13, m1-m14
- docs/LOTS_CHAT.md      → journal d'assemblage des 12 lots + décisions prises
- docs/OCR_PIECES.md     → spécification extraction OCR & pièces jointes
- backend/README.md      → cible production (NestJS/PostgreSQL) et limits assumées

CARTOGRAPHIE ATTENDUE : src/lib (43 modules) + src/lib/engine (7) +
src/lib/production (6) · src/components (8) · src/pages (23) · src/App.tsx (24 routes).
Vérifie cette cartographie avant de commencer ; signale tout écart.

## 1. INVARIANTS NON NÉGOCIABLES (toute violation = 🔴 BLOQUANT)
I1. Σ Débit = Σ Crédit sur toute écriture, à tout instant, sur les 2 entreprises.
I2. Total Actif = Total Passif (N et N-1).
I3. AUCUNE valeur inventée : un champ non déterminé vaut null, jamais 0 ; une image
    scannée ou un PDF compressé = « unreadable », jamais deviné ; une note annexe à
    saisie manuelle renvoie null partout.
I4. Montants = entiers FCFA. Aucun calcul flottant sur un montant métier.
I5. UI 100 % français · XOF · fuseau Africa/Lome pour toutes les dates.
I6. AUCUN taux fiscal codé en dur dans un composant ou une page : tout passe par le
    Regulatory Engine (getTaxRate, getSocialRule, TaxRuleV2 versionné).
I7. Remplissage Excel NON destructif : formules, fusions et styles préservés ;
    recalcul forcé à l'ouverture.
I8. Isolation multi-tenant : aucune donnée d'une autre organisation accessible,
    y compris via GlobalSearch, le portail client et les exports.

## 2. LES 12 DOMAINES À AUDITER (méthode imposée domaine par domaine)
Pour chaque domaine : liste les constats avec fichier:ligne, prouve par grep ou par
exécution, et chiffre (nombre d'occurrences, millisecondes, kilo-octets).

D1. INTÉGRITÉ COMPTABLE & MOTEURS
   - Exécute réellement les moteurs (harnais, cf. §3) : ΣD/ΣC, Actif/Passif,
     cascade SIG XA→XI, CAF, contrôles C1→C9.
   - liasseEngine.buildAggregate : vérifier CHAQUE préfixe (ACTIF, AMORT, PASSIF,
     PRODUITS, CHARGES) contre le plan réel de chart.ts — un compte postable mal
     rattaché fausse le bilan. Signale tout compte de chart.ts non couvert.
   - notes.ts : les 14 notes à saisie manuelle renvoient-elles bien null partout ?
     les notes calculées sont-elles justes face au plan ?
   - CONTRÔLES C1→C9 : plusieurs lignes comparent un poste à lui-même via mkRef
     (état vs note issus de la MÊME balance) → elles sont toujours « OK! » et
     ne contrôlent rien. Identifie toutes les lignes auto-satisfaites.
   - TROIS moteurs coexistent (engine/, liasseEngine.ts, production/) avec des
     règles proches mais divergentes (ex. computeLiquidationIS, CAF, SIG).
     Dresse le tableau des doublons et propose lequel fait foi.
   - financialSummary().produits (classe 7 entière) vs sii.XB (701-707) : le CA
     affiché au Dashboard est-il celui du SIG affiché à côté ?

D2. PERSISTANCE & STORE
   - store.ts : clé sans version ni migration → tout champ ajouté après coup
     (ex. JournalEntry.attachmentDocIds, DocumentItem.docStatus) casse le visiteur
     récurrent. Propose un mécanisme de version + migrate().
   - TOCTOU : compte les appels getDB() suivis de mutate() dans actions.ts
     (pattern read-then-clone) et mesure le risque d'écrasement.
   - Événement « storage » non écouté → 2 onglets = dernière écriture gagne.
   - Quota : mesure la taille JSON du seed (UTF-16 = ×2) et le coût d'une mutation.
   - Recense tous les catch vides et ce qu'ils masquent.

D3. PERFORMANCE & BUNDLE
   - Chaîne d'import eager : Dashboard → analytics → liasseEngine →
     xlsx-sanitizer (ExcelJS) + xlsx-filler (JSZip). ExcelJS finit-il dans le
     bundle initial alors que seule /app/liasse l'utilise ? Mesure et propose un
     découpage (dynamic import) compatible singlefile.
   - Dashboard.tsx : companyIds recréé à chaque rendu → useMemo inopérant ?
     Mesure computeDashboard et computeWorkload par op.
   - liveCoherence : les signatures mémoïsées sont-elles stables ?
   - Rendu de listes non virtualisées : plan comptable (1 274 comptes), balance,
     grand livre, journal d'audit, notes.

D4. SÉCURITÉ & RBAC
   - hasPermission est-il consulté hors de permissions.ts ? Existe-t-il un <Can> ?
     Une écriture peut-elle être validée par un « assistant » ?
   - permissions.ts : DEUX versions ont existé (43 permissions granulaires puis
     16 permissions courtes). Laquelle est câblée ? Est-elle cohérente avec les
     gardes de route d'App.tsx et avec ROLE_LABELS utilisés par les pages ?
   - Isolation : cherche toutes les lectures de collections sans filtre
     organizationId/companyId (GlobalSearch, exports, AdminPages).
   - hash.ts (démo assumée) : l'utilisateur est-il averti ? session.userId est-il
     manipulable depuis la console ?
   - dangerouslySetInnerHTML, eval, injection dans les exports CSV/FEC.

D5. ACCESSIBILITÉ (WCAG 2.1 AA)
   - Modal (src/components/ui.tsx) : piège de focus, fermeture Échap,
     restitution du focus au déclencheur.
   - Graphiques SVG (charts.tsx, ui.tsx) : role="img" + aria-label descriptifs.
   - key={index} dans les tableaux de données (Liasse, ConformityWorkshop,
     AIAssistant, Financials, Documents…).
   - text-slate-400 sur blanc : compte les occurrences et le ratio de contraste.
   - Navigation clavier, labels de formulaires, focus visible.

D6. UX & ROBUSTESSE
   - alert()/confirm()/prompt() : compte-les fichier par fichier. notify() existe
     dans actions.ts mais est-elle réellement utilisée ? Propose un plan de
     migration vers un <Toast> + <ConfirmDialog>.
   - runOcr appelé via setTimeout sans .catch → promesse rejetée silencieuse.
   - URL.revokeObjectURL temporisé → téléchargement long = fichier vide.
   - Absence d'Error Boundary : tout échec de rendu = écran blanc. Où l'installer ?
   - Limites de taille/type sur les téléversements (XLSX de 50 Mo gèle l'onglet).
   - Loading states et EmptyState systématiques ?

D7. DONNÉES DE DÉMONSTRATION
   - documents: [] au seed → l'OCR, la visionneuse, les pièces jointes et
     postFromDocument sont INVISIBLES en démo. Propose 8-12 pièces réalistes
     (CSV lisibles + 1 image pour démontrer « illisible ») rattachées aux écritures.
   - Périodes comptables créées pour co-demo uniquement → DistGolfe sans période,
     onglet Clôture vide, contrôle de période inopérant.
   - fsSessions avec balances vides, payslips: [], conversations: [].
   - Champs consommés par les pages mais jamais produits par le seed (et inversement).

D8. EXPORTS & IMPRESSION
   - downloadCSV : échappe « mais pas les retours ligne → libellé multi-ligne casse
     le fichier. Idem exportFEC (remplace | mais pas \n).
   - @media print : les tableaux longs (balance, liasse) sont-ils paginés ?
   - revokeObjectURL, noms de fichiers, encodage BOM.

D9. COHÉRENCE RÉGLEMENTAIRE
   - Liste TOUTES les occurrences de taux codés en dur (27, 18, 0,005, 4, 17,5,
     300000…) avec fichier:ligne, et désigne la source de vérité.
   - Minimum de perception : deux formules incompatibles coexistent
     (Math.max(20000, CA×0,005) vs ROUNDDOWN(CA/100,-1)) → écart ×2. Ne tranche
     pas seul : soumets-moi les deux avec leurs sources.
   - reconcileVAT et tvaGrid : taux par défaut 18.
   - CNSS/ITS du payrollConfig vs regulatory-engine vs socialRules : trois sources ?

D10. TESTS & QUALITÉ
   - 0 fichier *.test.* → propose les 15 tests unitaires prioritaires (moteurs
     comptables, cascade SIG, lettrage, OCR, liquidations) avec cas d'entrée/sortie.
   - noUnusedLocals/noUnusedParameters actifs : code mort, exports jamais importés,
     shims orphelins (editions, importer, universalImport, reconstitution,
     excelAudit, Reporting, chartOfAccounts, Account, Layout, Admin…).
   - Duplication fcfa() vs <Money>, format.ts vs charts.tsx fmtMoney.

D11. CONFIGURATION & BUILD
   - Mesure le bundle avant correction (npm run build) : taille brute + gzip.
   - vite-plugin-singlefile : le découpage en chunks est-il possible/utile ?
   - Dépendances réellement utilisées ? Poids de exceljs/jszip dans le bundle ?

D12. COHÉRENCE DOCUMENTATION ↔ CODE
   - docs/AUDIT_PHASE0.md, docs/OCR_PIECES.md, backend/README.md, scripts/*.py,
     scripts/*.mjs : toujours exacts ? Références documentées inexistantes dans le
     code, et symboles du code jamais documentés.

## 3. MÉTHODE GÉNÉRALE (obligatoire)
- Vérification STATIQUE (grep + lecture) ET DYNAMIQUE (exécution réelle des moteurs).
- Chaque affirmation est mesurée ou vérifiée par grep — rien de spéculatif sans
  mention explicite « non vérifié ».
- Harnais d'exécution : crée un script temporaire (ex. scripts/audit-run.mjs lancé
  via npx tsx) qui importe chartOfAccounts, seed, accounting, liasseEngine, notes,
  normative, liveCoherence et affiche : ΣD/ΣC par entreprise, Actif/Passif,
  score normatif + checks en échec, mappingCoverage (couvert/total + liste manquants),
  nb de notes calculées vs null, nb de contrôles C1→C9 auto-satisfaits. Signale
  clairement que ce harnais est temporaire.
- MESURES DE RÉFÉRENCE obligatoires en tête de rapport : taille du bundle (brut/gzip),
  coût d'une mutation mutate(), nb d'occurrences de chaque anti-pattern greppé,
  nb de routes, nb de modules, nb de comptes postables.

## 4. RÉ-VÉRIFICATION OBLIGATOIRE DE docs/AUDIT_PHASE0.md
Pour CHACUN des items B1-B4, M1-M13, m1-m14 : donne le statut
« toujours d'actualité » / « corrigé » / « régressé » / « non applicable »,
avec la preuve (fichier:ligne ou grep). Ne t'appuie JAMAIS sur ce document sans
re-vérification : le code a été réassemblé depuis.

## 5. FORMAT DE LIVRAISON DU RAPPORT
# AUDIT FIMAAC — Phase 0 (diagnostic)
## 0. Métriques de référence (mesurées, pas estimées)
## 1. 🔴 BLOQUANT — crash, perte de données, violation d'un invariant (§1)
   ### Bx. Titre
   - Fichier : ligne · Symptôme · Cause racine · Preuve (grep ou exécution)
   - Correctif proposé (précis, signature de fonction si pertinent)
   - Impact · Effort (S/M/L) · Priorité
## 2. 🟠 MAJEUR — fonctionnalité incorrecte ou dégradée
## 3. 🟡 MINEUR — qualité, a11y, polish
## 4. 🟢 Points vérifiés CONFORMES (avec la preuve)
## 5. Ré-vérification de AUDIT_PHASE0.md (tableau item → statut → preuve)
## 6. Questions à trancher par le porteur (cf. §7)
## 7. Plan d'exécution proposé — lots ordonnés, chaque lot = un domaine cohérent,
   avec impact estimé avant/après (bundle, ms/op, nb de violations restantes)
## 8. Corrections au cahier des charges (ce que le code contredit)

Termine le rapport par un tableau récapitulatif : domaine | 🔴 | 🟠 | 🟡 | effort total.

## 6. PHASE 2 — CORRECTION (uniquement après MA validation du plan)
- L'ordre d'exécution est celui du plan validé. Aucune initiative d'ordre.
- Un lot = un domaine cohérent. JAMAIS mélanger a11y et moteur comptable dans un
  même lot (le retour arrière doit être possible domaine par domaine).
- INTERDIT sans accord explicite : refactor cosmétique non demandé, renommage,
  changement de signature publique, ajout de dépendance, modification de
  package.json / tsconfig.json / vite.config.ts.
- APRÈS CHAQUE LOT, obligatoirement :
  1) npx tsc --noEmit → 0 erreur
  2) npm run build → succès + taille avant/après
  3) relancer le harnais d'invariants (ΣD=ΣC, Actif=Passif, scores) → aucune régression
  4) un rapport court : fichiers touchés, bugs corrigés, mesures avant/après
- Journaliser chaque lot dans docs/JOURNAL_CORRECTIONS.md
  (lot · fichiers · bugs corrigés · vérifications · régressions éventuelles).
- En cas de doute sur une règle comptable ou fiscale : STOP et question. Jamais
  d'initiative sur une base réglementaire.
- Ne JAMAIS affaiblir un contrôle ou une validation pour « faire passer » une
  vérification.

## 7. QUESTIONS À ME SOUMETTRE (je tranche, tu ne décides pas seul)
Q1. Minimum de perception : ROUNDDOWN(CA/100,-1) ou max(20000, CA×0,005) ? Fournis
    les deux formules avec leurs sources pour que je valide contre le CGI togolais.
Q2. Permissions : restaurer la version granulaire (43 permissions) ou garder la
    version courte (16) ? Impacts sur les pages.
Q3. store.mutate : sérialiser les mutations via une file d'attente, ou imposer que
    la lecture ait lieu DANS le callback (refactor de ~60 actions) ?
Q4. Bundle : accepter un découpage par dynamic import (ExcelJS/JSZip) même en
    build single-file ? Gain attendu vs complexité.
Q5. alert()/confirm() : migration vers <Toast>/<ConfirmDialog> dans cette passe ou
    reportée ?
Q6. mappingCoverage : remapper les références d'état sans compte (AG, AH, TG, TK,
    TM, RN) sur les vrais préfixes du plan, ou documenter leur absence ?
Q7. Tests : introduire vitest (nouvelle dépendance) ou un harnais node/tsx sans
    dépendance ?

## 8. CE QUE TU NE FAIS JAMAIS
- Tu n'inventes JAMAIS une valeur, un taux, un compte, une obligation ou une règle.
- Tu ne supprimes JAMAIS silencieusement du code ou de la donnée.
- Tu ne modifies pas les fichiers de configuration sans accord explicite.
- Tu n'affaiblis JAMAIS un contrôle pour faire passer une vérification.
- Tu ne corriges RIEN avant ma validation du plan d'exécution.
- Tu ne dis jamais « ça devrait marcher » : tu montres la preuve (grep, mesure,
  sortie de harnais ou extrait de build).

## 9. DÉROULEMENT ATTENDU
1. Lis les 4 documents de référence + confirme la cartographie réelle.
2. Lance le build de référence et le harnais d'invariants → mesures de départ.
3. Audite les 12 domaines dans l'ordre, en citant preuve et fichier:ligne.
4. Ré-vérifie les 31 items de AUDIT_PHASE0.md.
5. Livre le rapport complet au format §5, puis ARRÊTE-TOI et attends ma validation.

Commence maintenant par l'étape 1, et présente-moi d'abord ton plan d'audit en 5
lignes maximum avant d'exécuter.
```

---

## Pourquoi ce prompt est efficace

| Levier | Ce qu'il apporte |
|---|---|
| **Phase verrouillée** | Interdiction explicite de corriger avant validation → pas de « correctifs » non sollicités |
| **8 invariants** | Le comptable (débit=crédit, actif=passif, rien d'inventé, taux en dur) prime sur le technique |
| **12 domaines avec vérifications nommées** | Pas d'audit générique : chaque check cible un fichier/symbole réel du projet |
| **Ré-vérification imposée d'`AUDIT_PHASE0.md`** | Les 31 items sont re-testés, pas recopiés — le code a été réassemblé depuis |
| **Harnais d'exécution** | Force les preuves dynamiques (ΣD/ΣC, Actif/Passif) au lieu de raisonnements |
| **Point dur sur les contrôles C1→C9** | Identifie les lignes auto-satisfaites (`mkRef` compare un poste à lui-même) qui donnent un faux 100 % |
| **3 moteurs en doublon** | `engine/` vs `liasseEngine.ts` vs `production/` — le risque de divergence est nommé |
| **Conflit de taux listé** | 27 %, 18, 0,005, 4, 17,5, 300 000 → la source de vérité doit être désignée |
| **7 questions à trancher** | Les choix qui n'appartiennent pas à l'IA (CGI togolais, permissions, vitest) te reviennent |
| **Build + harnais après chaque lot** | La non-régression est vérifiable, pas affirmée |

## 3 décisions à préparer avant de lancer

Pour gagner un aller-retour, tu peux déjà me donner ta position sur **Q1, Q2 et Q7** (minimum de perception, version du RBAC, introduction de vitest). Ce sont les trois points qui bloquent le plus de lots en aval.

Si tu préfères une version **condensée** (audit en une seule passe, sans phase 2 séparée) pour un contexte où tu veux tout enchaîner d'un coup, dis-le-moi et je te la décline. Enfin, le fichier est prêt à être versionné : `docs/PROMPT_AUDIT.md`. Bon audit 🎯
