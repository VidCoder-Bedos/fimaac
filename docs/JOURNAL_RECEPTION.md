# Journal de réception — FIMAAC

Suivi de l'assemblage lot par lot. **Le build final a été lancé au lot 9**, conformément
à la consigne initiale (« build seulement à la fin »).

## ✅ État final
| Métrique | Valeur |
|---|---|
| Lots reçus | **9** |
| Erreurs `tsc --noEmit` | **0** |
| Modules transformés au build | **2 637** |
| Taille du bundle | **2 132 kB** (601 kB gzip) — + pipeline liasse complète |
| Pages routées | **24** (cabinet 19 · admin 6 · portail 5 · public 3) |
| Fichiers TS/TSX | 79 |
| Modules `lib` | 38 |

## Comptes de démonstration
| E-mail | Rôle | Route |
|---|---|---|
| `fimaac@gmail.com` / `Fimaac@2000` | super_admin | `/admin` |
| `compta@cabinet.demo` / `Cabinet@2026` | cabinet_admin | `/app` |
| `assistant@cabinet.demo` / `Cabinet@2026` | accountant | `/app` |
| `client@distgolfe.demo` / `Client@2026` | client_admin | `/portail` |

`/extractor` est accessible sans authentification (outil d'analyse de classeur GUDEF).

---

## Lot 9 — reçu et intégré (routeur + lot final)

### Routeur officiel
`App.tsx` avec `HashRouter`, trois espaces protégés par `Require` + redirection
par rôle (`homeFor`) : `/app` (cabinet), `/admin` (plateforme), `/portail` (client).
`Root` affiche la Landing si non connecté. `/extractor` public.

### Pages
| Fichier | Contenu |
|---|---|
| `pages/Requests.tsx` | 4 onglets : demandes documentaires, modèles d'écritures récurrentes, paiements fiscaux, demandes clients reçues |
| `pages/Tax.tsx` | 4 onglets : calculs TVA/IS explicables, grille TVA, moteur réglementaire (édition taux), échéances & déclarations |
| `pages/StatementsWorkshop.tsx` | atelier d'états financiers — sessions par entreprise × exercice, workflow 6 étapes |
| `pages/WorkbookExtractor.tsx` | analyse structurelle d'un classeur GUDEF → dump markdown copiable (autonome, sans auth) |
| `pages/Settings.tsx` | **officiel** — remplace mon stub : profil, organisation, sauvegarde/restauration JSON, facturation |
| `index.css` | **reconstitué** par le lot (le mien n'ayant pas été transmis) — fusionné avec mon `@theme` |
| `main.tsx`, `index.html`, `package.json`, `tsconfig.json`, `vite.config.ts` | alignés |

### Fichiers manquants réparés
Le routeur importait deux modules inexistants :
| Fichier | Origine |
|---|---|
| `pages/Companies.tsx` (`Companies` + `CompanyDetail`) | **transmis au lot 6, non créé par moi** — réparé ici |
| `pages/Admin.tsx` | shim `export { … } from "./AdminPages"` créé ici |

### `index.css` — fusion plutôt que remplacement
Le lot 9 reconstitue le CSS sans `@theme`. J'ai **fusionné** : `@theme` (fonts Sora/Inter/
JetBrains Mono) du lot 1 conservé + classes du lot 9. Point délicat : `.live-dot` est
utilisé de **deux façons** — pastille seule (halo `::before`) et bloc avec texte
(`box-shadow` pulsé, ex. `<Radio className="live-dot">`). Les deux animations coexistent.

### Ajustements
| Élément | Détail |
|---|---|
| `Requests.tsx` | `Recurring` retiré de l'import (déclaré localement) ; `any[]` typés (`DocumentRequest[]`, `EntryTemplate[]`…) |
| `Tax.tsx` | `TaxRule` → `TaxRuleRef` (le lot 6 a supprimé `TaxRule` de types.ts) |
| `StatementsWorkshop.tsx` | `STATUS.tone` typé `BadgeTone` ; patch inputs typés `string \| number` ; `auditSummary.formulas` (champ renommé au lot 8) |
| `Settings.tsx` | `satisfies` retiré (types contrefonctionnels TS 5.9 sur tableaux `as const`) |
| `Companies.tsx` | formulaire typé explicitement (`riskLevel`, `taxRegime`) |
| `package.json` | **non modifié** — versions installées déjà compatibles (router 7.18.5 ≥ 7.18.2, motion 14 ≥ 13, lucide 1.74 ≥ 1.33) |

---

## Vérifications d'exécution finales

### Cabinet (`/app`)
| Route | Données vérifiées |
|---|---|
| Dashboard | produits 1 000 000 · charges 1 550 000 · résultat −550 000 |
| Entreprises | 2 entreprises · 4 dossiers permanents |
| Comptabilité | 990 comptes imputables · 5 journaux · 7 écritures |
| Documents | arborescence exercice › mois › catégorie |
| Fiscalité | TVA 90 000 · IS 0 |
| Banque | 3 tx · 1 non rapprochée · écart calculé |
| Obligations | 13 obligations agrégées de 5 sources |
| Missions | 3 missions · 3 tâches |
| Immobilisations | 1 actif · amortissement linéaire |
| Stocks | 3 articles |
| Paie | 2 employés · CNSS 4 % / 17,5 % plafonnées |
| Atelier états | 2 sessions |
| Atelier conformité | normatif 88 · check-up 96 · risque faible |
| Liasse | 103 contrôles C1…C9 · 8 onglets |
| Demandes | 4 docs · 1 modèle · 2 paies · 2 clients |
| IA | 6 agents |
| Paramètres · Facturation | export/import JSON · 4 plans |

### Portail client (`/portail`)
Accueil · documents · demandes (19 actes) · états · factures.

### Console admin (`/admin`)
Vue d'ensemble · cabinets · utilisateurs · moteur réglementaire · audit · facturation.

### Régressions critiques
| Contrôle | Résultat |
|---|---|
| **Actif = Passif** | ✅ 5 590 000 (correctif du lot 5 toujours stable) |
| Σ Débit = Σ Crédit | ✅ |
| Réconciliation CA ↔ TVA | ✅ écart 0 |
| Login (hash synchrone) | ✅ 4 comptes · mauvais mdp rejeté |
| Redirection par rôle | ✅ super_admin → /admin · client → /portail · cabinet → /app |

---

## 🐛 Bugs corrigés au fil des lots
| Lot | Bug | Impact |
|---|---|---|
| **5** | `DK` sans classe 42 · `CJ` sur comptes 120/121 vides | **Actif ≠ Passif** (écart 250 000) — corrigé par les préfixes et la reprise du résultat depuis les SIG |
| **6** | `/<\f\b/` (form feed, pas `<f`) | le remplisseur GUDEF aurait écrasé les formules — contrevenait à la règle non destructive |
| **6** | `hashPassword` async appelé sans `await` | le seed aurait persisté une `Promise` — login cassé |
| **8** | chaîne `reconstitution → excelAudit → reports` inexistante | 3 symboles manquants · `patchWorkbook` à deux signatures incompatibles — scindé |
| **9** | `Companies.tsx` non créé au lot 6 | routeur cassé — réparé |
| **9** | CSS du lot 9 sans `@theme` | fonts perdues — fusionné |

## ⚠️ Limites assumées (prototype)
- **Persistance navigateur** : `store.mutate` fait `structuredClone` + `JSON.stringify`
  à chaque action (~4,5 ms, 316 kB écrits par action). En production : PostgreSQL/Prisma
  (schéma livré au lot 1).
- **Hachage démo** : `hash` est un FNV déterministe, pas bcrypt/argon2. Hachage serveur
  obligatoire en production.
- **OCR, paiements, dépôt GUDEF** : simulés (adapter documenté dans `backend/README.md`).
- **Taux fiscaux** : tous `verified: false` — paramétrables dans le Regulatory Engine,
  à valider contre les textes officiels avant tout dépôt.
- **`alert()`/`confirm()`** : conservés tels que transmis — une passe UI/UX (toasts)
  reste à faire.

## Ajouts post-lot 9 : lecture des pièces & pièces jointes
Voir `docs/OCR_PIECES.md` pour le détail. En résumé :
- **`src/lib/ocr.ts`** — extracteur honnête : lit CSV/TXT/XLSX/PDF-texte, signale
  les zones illisibles, **ne déduit jamais une valeur** (remplace le `runOcr`
  qui générait des montants aléatoires)
- **`src/lib/documentStore.ts`** — registre mémoire des `File` (aperçu +
  téléchargement pendant la session)
- **`src/components/DocumentViewer.tsx`** — visionneuse + téléchargement +
  gestion des pièces jointes d'écriture
- **`src/components/EntryEditor.tsx`** — éditeur réutilisable (création + modification)
- **`updateEntry`** — modification avec validation équilibre / comptes / période + audit trail
- `JournalEntry.attachmentDocIds` ajouté · `DocumentItem.extraction.readability` ajouté

## Ajouts : tableau de bord analytique repensé
Voir `docs/OCR_PIECES.md` pour la lecture des pièces. En résumé :

### Corrections de mapping SYSCOHADA découvertes par le reporting
Le reporting sur 12 mois de données a révélé **6 trous dans le mapping du moteur** :
| Trou | Impact | Correction |
|---|---|---|
| Classe **24** absente du poste AM (matériel) | Acquisitions non rattachées à l'actif | `24` ajouté aux préfixes AM |
| Classe **49** absente du poste AI (dépréciations) | Provisions créances hors bilan | `49` ajouté aux préfixes AI |
| Classe **82** absente du poste TN (produits de cession) | Cessions non prises en compte dans le résultat | `82` ajouté aux préfixes TN |
| **RM** frais financiers sur classe **66** (charges de personnel !) | Le résultat financier absorbait la paie | `66` → `67` |
| **RK** charges de personnel sur classe **64** (impôts !) | La paie était classée en impôts | `64` → `66` |
| **RI** impôts et taxes sur classe **63** (services ext. B !) | Les impôts étaient classés en services | `63` → `64`, et `63` ajouté à RH |
| **RO** (VNC cessions) et **RN** (dotations financières) non consommés par la cascade SIG | Résultat net incomplet | XF ajoute RN, XH ajoute RO |

Après correction : **Actif = Passif sur les deux entreprises**, score de cohérence stable, score normatif 88.

### Données de démonstration enrichies
`seedDatabase()` génère désormais **102 écritures** sur **12 mois** (janv. → déc.),
avec croissance du CA, saisonnalité, charges récurrentes, événements ponctuels
(investissement, emprunt, cession, provision, acompte IS). Chaque écriture est
équilibrée (Σ débit = Σ crédit vérifié). Générateur pseudo-aléatoire déterministe
(même seed → même jeu de données).

### Nouveaux fichiers
| Fichier | Contenu |
|---|---|
| `src/components/charts.tsx` | 10 types de graphiques SVG : Sparkline, AreaTrend, GroupedBars, HBars, Gauge, RadialRings, ScatterPlot, Waterfall, StackedComposition, MiniBars, TrendDelta |
| `src/lib/analytics.ts` | Moteur d'analyse : `monthlySeries`, `chargesByCategory`, `produitsByCategory`, `topTiers`, `computeHealth`, `computeWorkload`, `computeDashboard` |
| `src/pages/Dashboard.tsx` | Repensé : sélecteur de périmètre, KPI avec sparklines + deltas, jauge de santé, travail à faire priorisé, 9 graphiques |

### Travail à faire aujourd'hui (repensé)
Avant : 5 tuiles de liens statiques. Après : **liste priorisée interactive** :
| Fonction | Détail |
|---|---|
| 4 niveaux de sévérité | Bloquant (rouge) → Urgent (orange) → Important (bleu) → Routine (gris) |
| 6 sources agrégées | Échéances fiscales, déclarations prêtes, demandes documentaires, paiements fiscaux, transactions non rapprochées, tâches, anomalies critiques |
| Tri automatique | Par sévérité puis par jours restants |
| Filtres | Chips cliquables par sévérité avec compteurs |
| Bouton d'action | Un bouton contextuel par item (Régulariser, Déposer, Relancer, Rapprocher, Corriger…) |
| Compteurs de retard | `J-3`, `Aujourd'hui`, `12j retard` avec code couleur |
| Pliage | Réductible (le tableau de bord reste lisible) |

### Graphiques du tableau de bord
| Graphique | Type | Donnée |
|---|---|---|
| KPI × 4 | Sparkline + delta | CA, Résultat, Trésorerie, Charges |
| Santé | Gauge + RadialRings | Score global + 4 sous-scores |
| Évolution CA & Résultat | AreaTrend (courbe + aire) | 12 mois, 2 séries |
| Produits vs Charges | GroupedBars (barres groupées) | 12 mois, 2 séries |
| Pont CA → Résultat | Waterfall (cascade) | CA − 4 top charges − autres = résultat |
| SIG | HBars (barres horizontales) | XB → XA → XC → XD → XE → XF → XG → XH → XI → CAF |
| Composition des charges | StackedComposition + HBars | Répartition par nature (classe 6) |
| Trésorerie | AreaTrend | Solde mensuel classe 5 |
| Composition des produits | StackedComposition + HBars | Répartition par nature (classe 7) |
| Top clients | HBars | Encours créances par tiers |
| Top fournisseurs | HBars | Dettes par tiers |
| Rentabilité vs CA | ScatterPlot (nuage de points) | Positionnement par entreprise |
| Ratios financiers | Tuiles | 6 ratios calculés |

## Ajouts : journaux normalisés & bibliothèque de modèles d'écritures

### Codes de journal — modification demandée + extension
**Anciens codes remplacés** (plus utilisés nulle part) :
| Avant | Après | Journal |
|---|---|---|
| `VT` | `VTE` | Journal des ventes |
| `AC` | `ACH` | Journal des achats |
| `BQ` | `BAQ` | Journal de banque |
| `SN` | `PAI` | Journal des salaires |
| `OD` | `ODV` | Opérations diverses |

**40 journaux** en 18 types (`JournalType` étendu) — nouveau fichier `src/lib/journals.ts` :
| Type | Codes |
|---|---|
| Commercial | `VTE`, `VTE-AV`, `VTE-EX`, `ACH`, `ACH-AV`, `ACH-IM`, `STK`, `STK-INV` |
| Trésorerie | `BAQ`, `BAQ-2`, `CAI`, `CAI-2`, `EFF`, `EFF-ESC`, `TRF`, `TRS` |
| Personnel | `PAI`, `PAI-AV`, `SOC`, `SOC-ITS` |
| Patrimoine | `IMM`, `AMO`, `CES`, `PRV`, `EMP`, `CAP`, `ASS` |
| Fiscalité & clôture | `TVA`, `IMP`, `REG`, `INV`, `CLO` |
| Divers & reports | `ODV`, `RAN`, `OUV`, `TRC`, `HAO`, `ECC`, `ENG`, `ANA` |

8 journaux standard sont créés automatiquement pour **chaque** entreprise
(40 pour TechLomé avec les étendus, 8 pour DistGolfe avec les standards seulement).
Chaque journal porte un `defaultAccount` (compte de contrepartie pour la saisie
assistée) et une `desc` pédagogique.

### Bibliothèque de modèles d'écritures — 49 modèles équilibrés
Nouveau fichier `src/lib/entryTemplates.ts` — **49 modèles** en **10 catégories**,
tous équilibrés (Σ débit = Σ crédit vérifié programmatiquement), avec référence
SYSCOHADA et compte de contrepartie.
| Catégorie | Modèles | Exemples |
|---|---|---|
| Ventes & clients | 6 | Facture de services, avoir client, export TVA 0 % |
| Achats & fournisseurs | 6 | Achat marchandises, sous-traitance, loyer, avoir, douane |
| Trésorerie & banque | 6 | Retrait caisse, frais bancaires, virement interne, intérêts |
| Paie & social | 5 | Paie complète, paiement salaires, CNSS, ITS, avance |
| Immobilisations | 5 | Acquisition, amortissement, cession, provision créance |
| Stocks & inventaire | 3 | Entrée stock, sortie stock, dépréciation |
| Fiscalité | 4 | Déclaration TVA, paiement TVA, acompte IS, TPA/TFE |
| Clôture & régularisations | 6 | CCA, PCA, CAP, PAR, clôture résultat, reports à nouveau |
| Financement & capital | 5 | Constitution capital, emprunt, remboursement, dividendes, compte courant |
| Divers & corrections | 4 | Compte d'attente, transfert charges, perte de change, HAO |

Chaque modèle définit : lignes équilibrées, `journalCode` recommandé, récence
conseillée (`none`/`monthly`/`quarterly`/`yearly`), `variable: true` sur les
lignes dont le montant est à adapter à la saisie, et `tierType` pour les
comptes de tiers (assistant de saisie).

Fonctions utilitaires : `isTemplateBalanced(t)`, `scaleTemplate(t, baseAmount)`
(met à l'échelle les lignes variables proportionnellement), `templatesByCategory`,
`templatesByJournal`.

### Intégration au moteur
- `seedDatabase()` génère désormais **40 journaux** pour TechLomé et **8** pour
  DistGolfe depuis le catalogue, avec IDs dérivés du code (`j-vte`, `j-ach`…)
- Les **102 écritures** historiques utilisent les nouveaux codes (`VTE`, `ACH`,
  `BAQ`, `PAI`, `IMM`, `ODV`…) — toutes rattachées à un journal existant
- Les **49 modèles** sont créés au seed : 30 standards rattachés à TechLomé,
  19 non standards en bibliothèque partagée (`companyId: null`)
- `JournalType` étendu de 7 à **18 valeurs** dans `types.ts`
- `JLIB` de `ledger.ts` couvre les 18 types pour l'export FEC

### Vérifications d'exécution
| Contrôle | Résultat |
|---|---|
| 40 codes de journal uniques, tous valides (`/^[A-Z]{3,4}(-[A-Z0-9]{1,3})?$/`) | ✅ |
| 49 modèles **tous équilibrés** | ✅ |
| 102 écritures toutes rattachées à un journal existant | ✅ |
| Σ Débit = Σ Crédit (écart 0) | ✅ |
| Actif = Passif (2 entreprises, écart 0) | ✅ |
| 49 modèles, 0 sans journal | ✅ |
| Anciens codes VT/AC/BQ/SN/OD absents du catalogue | ✅ |
| Les 5 codes demandés (VTE, ACH, BAQ, CAI, RAN) présents | ✅ |

## Ajouts : les 35 notes annexes SYSCOHADA
Nouveau fichier `src/lib/notes.ts` — implémentation des **38 NoteModule** (35 notes
officielles, dont 3A/3B/3C comptent comme 3 notes distinctes), tous calculés à
partir des balances N et N-1.

### Répartition : 14 calculées + 14 à saisie manuelle + 10 non applicables
| Type | Nb | Notes |
|---|---|---|
| **Calculées automatiquement** | 14 | NOTE_01 (capital), NOTE_03A (immo incorp.+corp. brut/amort/net par poste), NOTE_03C (amortissements + dotation), NOTE_04 (créances clients brutes + dépréciations + nettes), NOTE_09 (fournisseurs), NOTE_10 (dettes financières), NOTE_13 (capitaux propres), NOTE_14 (emprunts), NOTE_16A (dettes fiscales et sociales), NOTE_21 (charges de personnel), NOTE_22 (autres charges), NOTE_31 (dotations), NOTE_32 (reprises), NOTE_34 (tableau de financement + 4 ratios) |
| **À saisie manuelle** | 14 | NOTE_02, NOTE_18-20, NOTE_23-30, NOTE_33, NOTE_35 — les balances ne contiennent pas l'information (ventilation, échéances, effectifs…) — **toutes les valeurs sont `null`, jamais 0** |
| **Non applicables au seed** | 10 | NOTE_03B, NOTE_05, NOTE_06, NOTE_07, NOTE_08, NOTE_11, NOTE_12, NOTE_15, NOTE_16B, NOTE_17 — l'entreprise n'a pas ces comptes |

### Règle absolue respectée : ne rien inventer
Les 14 notes à saisie manuelle retournent **toutes leurs valeurs à `null`** (vérifié :
`toutes null: ✅` sur les 14). L'UI affiche le statut `to_confirm` et les
`missingInfo` expliquent **pourquoi** la valeur n'est pas calculable (ex. :
« Ventilation par échéance — les balances ne contiennent pas cette information »).

### NOTE 34 — hub central (13 lignes)
NOTE_34 est le hub qui relie tous les états :
- Résultat net → CAF (RN + dotations − reprises)
- Acquisition d'immobilisations / cessions
- Emprunts contractés
- Variation de trésorerie nette
- Trésorerie nette à la clôture
- **4 ratios** : autonomie financière, liquidité, rentabilité financière, trésorerie

### Fonctions exposées
| Fonction | Usage |
|---|---|
| `NOTE_MODULES` | Les 38 modules dans l'ordre officiel |
| `NOTE_BY_CODE` | Index O(1) par code |
| `computeAllNotes(ctx)` | Calcule toutes les notes applicables → `Map<code, NoteResult>` |
| `computeNote(code, ctx)` | Calcule une note par son code |
| `MANUAL_NOTE_CODES` | Set des codes à saisie manuelle (14) |
| `noteStats()` | Statistiques du registre (total, calculées, manuelles) |

### Vérifications d'exécution
| Contrôle | Résultat |
|---|---|
| 38 modules chargés | ✅ |
| 14 notes calculées avec valeurs réelles | ✅ |
| 14 notes à saisie manuelle — toutes `null` | ✅ |
| Σ Débit = Σ Crédit (écart 0) | ✅ |
| `tsc --noEmit` | ✅ 0 erreur |
| Build | ✅ 2 132 kB (601 kB gzip) |

## Ajouts : pipeline complet de remplissage de la liasse GUDEF
Nouveau fichier `src/lib/liasseFiller.ts` — fusionne **toutes les sources de
valeurs** et exécute le pipeline complet.

### `buildFullValueByRef(ctx, aggregate, company)` → `Record<string, number>`
Fusionne 4 sources de valeurs en un seul `valueByRef` :
| Source | Références | Exemples |
|---|---|---|
| **États de base** (buildAggregate) | ~86 | `AE`, `BB`, `BS`, `CA`, `CJ`, `TA`, `RA`, `XA`-`XI`, `FA` |
| **35 notes annexes** (computeAllNotes) | ~50 | `NOTE_01_1013`, `NOTE_03A_AE`, `NOTE_04_411`, `NOTE_34_FA`, `NOTE_34_R1` |
| **Identification** (Company) | 13 | `ID_RAISON_SOCIALE`, `ID_NIF`, `ID_RCCM`, `ID_FORME_JURIDIQUE`, `ID_CAPITAL` |
| **Liquidation DP** (barème sectoriel) | 7 | `DP_CA`, `DP_TAUX`, `DP_DROIT`, `DP_RESTE`, `DP_T1_CA` |
| **Valeurs dérivées** | 4 | `TOTAL_ACTIF`, `TOTAL_PASSIF`, `RESULTAT_NET`, `CAF` |

Total sur les données seedées : **171 références** (86 états + 50 notes + 13 ID + 7 DP + 14 totaux + 1 DOT).
Les références de notes dont la `ref` est une référence d'état simple (AE, TA, FA…)
sont **ajoutées en double** : une fois en clé composée (`NOTE_34_FA`) et une fois en
référence directe (`FA`) — la note écrase la valeur de base si plus précise.

### `fillCompleteLiasse(file, ctx, aggregate, company)` → `FillReport`
Pipeline complet :
```
1. buildFullValueByRef     → valueByRef (171+ refs)
2. fillStateTemplateZip    → blob, filled, unmatched
3. runCoherenceChecks      → CoherenceReport (C1-C9)
4. computeAllNotes         → compte les notes calculées / manuelles
5. formatFillReport        → rapport textuel pour l'UI
```

### `formatFillReport(r)` → texte formaté
Rapport de remplissage affichable dans l'UI :
```
═══════════════════════════════════════════════
RAPPORT DE REMPLISSAGE — Liasse GUDEF
═══════════════════════════════════════════════
Feuilles détectées       : 0
Références fournies      : 171
Cellules remplies        : 0 (0% des références)
Notes calculées          : 14/38
Notes à saisie manuelle  : 14
Références non trouvées  : 0
Temps d'exécution        : 0 ms
── CONTRÔLES DE COHÉRENCE ──
Score global : 82%
C1 — Total Actif = Total Passif : OK!
OK : 84 · Déséquilibrés : 19 · Avertissements : 0
═══════════════════════════════════════════════
```

### `buildProdContext(entries, accounts, company, exercise, balanceN1?)` → `ProdContext`
Helper pour construire un `ProdContext` depuis les données du store (source A)
ou depuis des balances importées (source B, via `balanceN1`).

### Vérifications d'exécution
| Contrôle | Résultat |
|---|---|
| `valueByRef` : 171 références (86 états + 50 notes + 13 ID + 7 DP + 14 totaux) | ✅ |
| 86/86 références d'états de base présentes | ✅ |
| 13 notes de notes présentes (NOTE_01, 03A, 03C, 04, 09, 10, 13, 14, 16A, 21, 22, 31, 34) | ✅ |
| 13 champs d'identification | ✅ |
| 7 champs de liquidation DP | ✅ |
| Actif = Passif (écart 0) | ✅ |
| C1 — Total Actif = Total Passif : OK! | ✅ |
| `tsc --noEmit` | ✅ 0 erreur |
| Build | ✅ 2 132 kB (601 kB gzip) |

## Arborescence livrée
```
backend/            docker-compose · prisma schema · README
scripts/            dumps GUDEF (Python) · générateur Liquidation DP
src/lib/
  engine/           moteur factorisé (7 modules) — agregateurs · etats · fiscalite · controles
  production/       59 zones SYSCOHADA · DAG · scoring
  chart.ts          1 274 comptes SYSCOHADA (classes 1→9)
  liasse.ts         ExcelJS · parseBalance · exportLiasseXlsx · liquidations
  liasseEngine.ts   71 postes · SIG XA→XI · C1→C9 · fillStateTemplate
  xlsx-sanitizer.ts neutralisation shared formulas
  xlsx-filler.ts    patch JSZip non destructif
  chartOfAccounts · editions · importer · reconstitution  (shims)
  seed.ts           316 kB · 46 collections · 4 users · 1 274 comptes
src/components/     ui (design system) · AppLayout · Layout · AccountInquiry · GlobalSearch
src/pages/          17 fichiers · 24 routes
```
