# JOURNAL DE CORRECTIONS — Phase 1 (re-verification + priorites 1 a 7)

> Rapport source : docs/AUDIT_PHASE0.md (session anterieure) — re-verifie item par
> item contre le code actuel avant toute correction, conformement au protocole.

## Re-verification des 31 items
| Item | Statut | Preuve |
|---|---|---|
| B1 | toujours d'actualite → CORRIGE | store.ts:5 sans version ; grep `DB_VERSION` desormais present |
| B2 | toujours d'actualite → CORRIGE | store.ts:50 clone hors file ; file serialisee ajoutee |
| B3 | tranche (Q4) : non applicable | build singlefile : tout est inline, le dynamic import n'apporterait aucun gain — documente |
| B4 | toujours d'actualite → CORRIGE | actions.ts:508 ecrivait linkedEntryId sans entry.attachmentDocIds |
| M1 | reporte (Q5 — passe toasts/modales) | non traite dans cette passe |
| M2 | toujours d'actualite → CORRIGE (partiel) | 5 gardes `<Can>` : Valider/Rejeter/Contrepasser/Nouvelle ecriture/Reinitialiser |
| M3 | toujours d'actualite → CORRIGE | ErrorBoundary cree + installe dans AppLayout.tsx:253 |
| M4 | toujours d'actualite → CORRIGE | computeCA strict (70x) + champ `ca` + harmonisation Dashboard/SIG/health |
| M5 | reporte (Q1 a trancher) | les 3 sources de taux IS coexistent toujours |
| M6 | reporte (Q1 a trancher) | 2 formules de minimum de perception coexistent |
| M7 | toujours d'actualite → CORRIGE | parseFcfa : separateurs + suffixes M/k + parentheses |
| M8 | reporte | recherche etendue non traitee dans cette passe |
| M9 | toujours d'actualite → CORRIGE | fy2 + 12 periodes pour company2 |
| M10 | toujours d'actualite → CORRIGE | 8 documents de demo (7 CSV lus + 1 image illisible), 3 rattaches aux ecritures |
| M11 | reporte (Q1) | vatRate=18 par defaut |
| M12 | DEJA CORRIGE (LOT 10) | Documents.tsx:180 `d.docStatus ?? "non_classe"` |
| M13 | toujours d'actualite → CORRIGE | companies + companyIds memoises dans Dashboard.tsx |
| m1 | reporte (phase 8) | — |
| m2 | reporte (phase 8) | — |
| m3 | reporte (phase 8) | — |
| m4 | reporte (Q5) | — |
| m5 | toujours d'actualite → CORRIGE | runOcrSim capture la promesse |
| m6 | reporte (phase 8) | — |
| m7 | toujours d'actualite → CORRIGE | daysUntil sur bornes Africa/Lome (UTC) |
| m8 | reporte (phase 8) | — |
| m9 | reporte (Q7 — vitest a trancher) | 0 test unitaire |
| m10 | reporte (phase 8) | — |
| m11 | reporte (phase 8) | — |
| m12 | reporte (phase 8) | — |
| m13 | toujours d'actualite → CORRIGE | ecoute de l'evenement `storage` dans store.ts |
| m14 | reporte (Q6) | mappingCoverage 69/75 |

## Corrections appliquees
| Fichier | Items | Contenu |
|---|---|---|
| src/lib/store.ts | B1, B2, m13 | DB_VERSION=2 + migrate() normalisant (34 collections + attachmentDocIds), file de mutations serialisee, ecoute `storage` |
| src/components/ErrorBoundary.tsx (nouveau) | M3 | getDerivedStateFromError + componentDidCatch + Reessayer + Reinitialiser |
| src/components/Can.tsx (nouveau) | M2 | garde d'action RBAC |
| src/components/AppLayout.tsx | M3 | Outlet enveloppe par ErrorBoundary |
| src/lib/format.ts | M7, m7 | parseFcfa robuste (M/k/parentheses/decimales), daysUntil sur Africa/Lome |
| src/lib/accounting.ts | M4 | champ `ca` strict (70x) dans FinancialSummary + computeRatios sur le CA |
| src/lib/analytics.ts | M4 | monthlySeries.ca = 70x, waterfall demarre du CA, marge sante sur le CA |
| src/pages/Dashboard.tsx | M13, M4 | companies/companyIds memoises, tuile CA sur summary.ca |
| src/lib/seed.ts | M9, M10 | fy2 + 12 periodes pour company2 ; 8 documents de demo rattaches |
| src/lib/actions.ts | B4, m5 | postFromDocument synchronise les 2 sens ; runOcrSim capture la promesse |
| src/pages/Accounting.tsx | M2 | 4 gardes `<Can>` (validate ×3, create ×1) |
| src/pages/Settings.tsx | M2 | garde `<Can settings.manage>` sur Reinitialiser |

## Verifications apres correction
| Controle | Resultat |
|---|---|
| tsc --noEmit | 0 erreur |
| npm run build | succes 13,40 s |
| Bundle avant | 2 131,65 kB (601,60 kB gzip) |
| Bundle apres | 2 141,22 kB (604,24 kB gzip) — +9,6 kB (ErrorBoundary, Can, migrate, 8 documents, fy2+periodes) |
| Σ Debit = Σ Credit | non regresse — aucune modification des moteurs de calcul |
| Actif = Passif | non regresse — M4 n'ajoute qu'un champ derive, ne change aucun solde |

## Reportes — decision attendue
- **Q1** (M5, M6, M11) : minimum de perception / taux IS / vatRate — trancher contre le CGI togolais
- **Q5** (M1, m4) : passe toasts + modales accessibles (34 alert, 20 modales)
- **Q6** (m14) : remapper AG/AH/TG/TK/TM/RN
- **Q7** (m9) : vitest ou harnais node
- **Phase 8** : m1 (keys), m2 (contraste), m3 (aria), m6 (revoke), m8 (fcfa/Money), m10 (impression), m11 (upload), m12 (exports CSV/FEC), M8 (recherche)

## Correctif UI additionnel — Landing (rapporté par le porteur)
| Élément | Détail |
|---|---|
| Symptôme | « Le**s**ystème » et « d'exploitation**du** » collés dans le titre du hero |
| Cause | Chaque mot était rendu dans un `<span className="inline-block">` : un élément inline-block **colle son espace final** (whitespace collapsing), donc l'espace entre `{w} ` et le span suivant disparaissait |
| Correctif | `inline-block whitespace-pre` + espace explicite après chaque mot sauf le dernier (`{i < 3 ? " " : ""}`) — le span dégradé « cabinet comptable » étant `block`, il repart sur sa propre ligne |
| Scan | Tous les autres titres et blocs de texte des 23 pages et 8 composants passés au crible (motifs `inline-block` portant du texte, `<h1-h3>` multi-expressions, `{a}{b}` adjacents, majuscules collées) : **aucun autre cas** — les motifs `{s.icon} {s.label}` préservent l'espace littéral |
| Verifications | tsc 0 erreur · build 11,27 s · bundle 2 141,28 kB (604,26 kB gzip) |

## P0-1 — Table de mapping unique et équilibre des états (PR #5, `1aae7a3`)
| Point | Détail |
|---|---|
| Symptôme | Bilan non équilibré (écart 108 000) ; quatre modules calculaient les postes différemment ; des comptes disparaissaient sans trace |
| Cause | Quatre tables de préfixes concurrentes : `liasse.ts` (boucles `startsWith` locales), `engine/agregateurs.ts`, `engine/etats.ts`, `liasseFiller.ts` |
| Correctif | `src/lib/etatsMapping.ts` = source de vérité unique (22 postes, préfixe le plus long gagnant, exclusions, filtre de signe). Chaque compte alimente **un seul** poste ; l'équilibre devient une conséquence de Σ soldes = 0. Contrôle `unmapped` bloquant. |
| Reclassements | Dépréciations de créances (49) déduites de l'actif (et non ajoutées aux dettes) · compte 42 Personnel dans « dettes fiscales et sociales » · totaux = somme exacte des composantes · classes 8/9 hors bilan |
| Vérifications | `tsc` 0 erreur · `vitest` 11/11 · seed 102 écritures : actif = passif = **27 440 921**, écart 0, aucun compte non mappé · accord exact `engine` ↔ `liasse` |

## P0-2 — Source de vérité fiscale unique (PR #6, `27b054d`)
| Point | Détail |
|---|---|
| Symptôme | Trois IS différents pour un même dossier (0 / 201 900) ; base TVA affichée = TVA collectée ; libellés 433/435 au lieu de 443/445 ; TVA déductible comptée deux fois dans les déclarations |
| Cause | Calculs dupliqués dans `tax.ts`, `engine/fiscalite.ts`, `actions.tvaGrid` ; recouvrement de préfixes dans `declarationEngine` |
| Correctif | `src/lib/fiscalite.ts` : `fiscalBaseFromMoves`, `computeTvaFiscal` (crédit reporté), `computeIsFiscal` (maximum entre taux et minimum de perception), `IS_PARAMS_DEFAUT` exporté. Les quatre appelants deviennent des adaptateurs. `excludeAccounts` dans `declarationEngine`. |
| Valeurs mesurées sur le seed | IS **201 900** (minimum de perception) · TVA collectée 3 634 200 · déductible 1 160 868 · à payer **2 473 332** · base **20 190 000** |
| Vérifications | `tsc` 0 erreur · `vitest` 24/24 · accord des trois implémentations sur le dossier réel |

## P0-3 — Paie conforme : barème IRPP + AMU (PR #7)
| Point | Détail |
|---|---|
| Symptôme | Retenue IRPP forfaitaire de 5 % au lieu du barème progressif ; AMU jamais retenue alors qu'elle est déclarée dans `payrollConfig` **et** `socialRules` |
| Cause | `runPayroll` (actions.ts) recalculait la paie lui-même et n'appelait jamais `calculatePaycheck` / `calculateIRPP` |
| Correctif | `src/lib/paie.ts` : `calculerBulletin`, `paieParamsFromConfig`, `totaliserBulletins`, `ecrituresPaie`. `runPayroll` délègue. Écriture enrichie : AMU sur le compte **4331** (mutuelle), IRPP sur 4472, CNSS sur 4311. |
| Valeurs mesurées (2 salariés du seed) | CNSS 24 000 · AMU **12 000** · IRPP **85 420** (51 210 + 34 210, barème 8 tranches) · retenues totales **121 420** contre 64 000 auparavant → **57 420 FCFA/mois non collectés** avant correction |
| Non-régression | Si aucun barème n'est chargé, repli forfaitaire explicite **et signalé** (`alertes`), jamais silencieux. Champs de bulletin ajoutés en optionnel. |
| Vérifications | `tsc` 0 erreur · `vitest` 36/36 · écriture de paie équilibrée par construction |

## P0-4 — Import de balance robuste (PR #8)
| Point | Détail |
|---|---|
| Symptôme | Une balance réelle (en-têtes « N° de compte / Intitulé / Mouvement débit », montants « 1 234 567 ») était importée **0 ligne sans un mot** ; le bilan vide était indistinguable d'un dossier sans activité |
| Cause | `parseBalance` : CSV découpé sur `[;,]` + `parseFloat` ; repli positionnel silencieux sur XLSX ; aucun chemin d'erreur |
| Correctif | `src/lib/balanceImport.ts` : délimiteur et guillemets détectés, en-têtes normalisés (sans accents), montants français (`1 234 567,89`, `(1 000)`, `12 000 FCFA`), détection par contenu de la colonne des comptes **retirée** des candidates aux montants, rapport complet (`signals` / `warnings` / `errors` / `rejected` / totaux). Refus explicite si aucun compte. |
| Interface | `Liasse.tsx` affiche un **rapport d'import** : comptes lus, Σ débit, Σ crédit, écart, hypothèses, avertissements, lignes écartées consultables |
| Vérifications | `tsc` 0 erreur · `vitest` 50/50 · aller-retour CSV 14 comptes → actif = passif = 13 200 000 |

## P0-5 — Garde-fou de stockage et signal de démonstration (PR #9)
| Point | Détail |
|---|---|
| Symptôme | Aucune indication que les données vivent dans le navigateur ; `persist()` avalait l'erreur de quota → écritures affichées mais non sauvegardées, perdues au rechargement sans un mot |
| Cause | `try { localStorage.setItem } catch {}` vide dans `store.ts` ; pas de mesure d'occupation ; pas de signal de démonstration dans le shell |
| Correctif | `persistError` capturé et exposé · `storageSnapshot()` (octets réels + dernière écriture réussie) · `src/lib/storage.ts` (`measureUsage`, `humanBytes`, `backupFileName`, `storageMessage`, budget 5 Mio, seuils 80 %/95 %) · `StorageNotice.tsx` : bandeau avec jauge et export JSON en un clic, non refermable en cas d'incident |
| Vérifications | `tsc` 0 erreur · `npm run build` 12,55 s · `vitest` 63/63 · seed : occupation < budget, niveau `ok`, export relu à l'identique |

## P0-3b — Arbitrage AMU : déduction de l'assiette IRPP (art. 26 CGI)
| Point | Détail |
|---|---|
| Décision | Le porteur tranche : la cotisation salariale AMU est déductible de l'assiette IRPP sur traitements et salaires — **article 26 du CGI togolais** (retenues pour pensions d'un régime obligatoire ; cotisations salariales aux assurances sociales et assurances maladies obligatoires). Seule la part salariale ; la part patronale reste une charge de l'employeur. |
| Correctif | `paie.ts` : `assiette IRPP = brut − CNSS salariale − AMU salariale`. Commentaire de code portant la base juridique et la portée (part salariale uniquement). |
| Valeurs mesurées (seed) | 450 000 → assiette 432 000, IRPP **50 190** (au lieu de 51 210) · 350 000 → assiette 332 000, IRPP **33 190** (au lieu de 34 210) · total IRPP **83 380**, retenues totales **119 380** |
| Test dédié | La part patronale ne modifie jamais l'assiette ; une AMU salariale plus élevée réduit l'assiette ET l'IRPP |
| Point restant | Barème 2 %/4 % du dossier contre 5 %/5 % dans la référence communiquée : non modifié en silence, arbitrage demandé |

## P1 — Bilan unifié à l'écran + document imprimable (PR #11)
| Point | Détail |
|---|---|
| Symptôme | L'onglet « Bilan synthétique » utilisait `financialSummary` (créances = 411 seuls, dettes = 401 seuls, capitaux = toute la classe 1) : un second bilan, non équilibré, à côté du bilan unifié. Aucun PDF remettable au client. |
| Correctif | `Financials.tsx` affiche `buildStatements(trialBalance(...))` — source unique P0-1 — avec toutes les composantes, l'écart et les comptes non rattachés. `PrintSheet` (portail + `window.print`) et `StatementsPrint` (document A4 : en-tête société, actif, passif, compte de résultat, contrôles, mention de validation). CSS `@page A4`. |
| Non-régression | `financialSummary` et `computeRatios` inchangés ; aucune dépendance PDF ajoutée ; le document déclare lui-même un déséquilibre au lieu de le masquer. |
| Vérifications | `tsc` 0 erreur · `npm run build` 13,03 s · `vitest` 65/65 |
