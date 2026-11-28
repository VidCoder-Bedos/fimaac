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

## P0-3c — Taux AMU arbitrés : 5 % salarié / 5 % employeur
| Point | Détail |
|---|---|
| Décision | Le porteur confirme les taux de l'Assurance Maladie Universelle : **5 % salarié et 5 % employeur** (le dossier portait 2 %/4 %, marqué « à vérifier »). |
| Correctif | `seed.ts` (`payrollConfig.amuEmployeeRate`/`amuEmployerRate` et règle `AMU_STANDARD`), `regulatory-engine.ts` (règle sociale de référence), libellés de `types.ts` et commentaire de `paie.ts`. |
| Valeurs mesurées (seed) | 450 000 → AMU 15 000, assiette IRPP 423 000, IRPP **48 660**, net 374 340 · 350 000 → AMU 15 000, assiette 323 000, IRPP **31 660**, net 291 340 · total retenues **134 320** |
| Contrôle | Un test vérifie que le paramétrage effectif du dossier vaut bien 5/5 après chargement du seed. |

## P2 — Contrôles croisés branchés + compteur `info` (PR #13)
| Point | Détail |
|---|---|
| Symptôme | `crossCheck` produisait des constats justes et chiffrés, affichés nulle part. En le branchant : le résumé ne comptait pas les constats `info` (4 comptés pour 5 contrôles). |
| Correctif | Carte « Contrôles croisés entre modules » dans le Centre de conformité (module, source A, source B, écart, niveau, constat) alimentée par les données réelles du dossier. Ajout de `infoCount` au rapport et au sous-titre. |
| Vérifications | `tsc` 0 erreur · `npm run build` 11,56 s · `vitest` 71/71 (6 nouveaux) · écriture déséquilibrée détectée (écart 100 000, statut critique) |

## P2 — Journal d'audit chaîné (PR #14)
| Point | Détail |
|---|---|
| Symptôme | Le produit annonçait un « journal inviolable » sans aucun mécanisme : traces éditables dans le localStorage, altération indétectable. |
| Correctif | `src/lib/auditChain.ts` : SHA-256 pur (vecteurs officiels vérifiés), scellement `hash = SHA-256(prevHash | contenu canonique)`, `verifyAuditChain` détectant modification / insertion / suppression / déplacement avec position. `audit()` scelle chaque trace ; page Journal d'audit dotée d'un bouton « Vérifier l'intégrité ». |
| Portée assumée | Détecte l'altération, ne l'empêche pas : l'inviolabilité réelle exige un ancrage serveur (lot P1 infrastructure). Écrit tel quel dans l'écran. |
| Vérifications | `tsc` 0 erreur · `npm run build` 11,66 s · `vitest` 83/83 (12 nouveaux, dont scellement réel par `runPayroll`) |

## P1b — Liasse fiscale imprimable GUDEF (PR #16)
| Point | Détail |
|---|---|
| Manque | Le XLSX de liasse existait ; aucun document remettable au client (page de garde, bilan, CR, contrôles). |
| Livré | `components/LiassePrint.tsx` : page de garde d'identification fiscale (NIF, RCCM, régime, devise), bilan actif/passif, compte de résultat AO/HAO, tableau des contrôles avec statut et détail, mentions de validation humaine. Bouton « Imprimer la liasse / PDF » sur la page Liasse. |
| Règle | Montants de `buildStatements`, contrôles de `runChecks` — aucun recalcul. Une liasse déséquilibrée s'écrit « NON déposable en l'état ». |
| Vérifications | `tsc` 0 erreur · `npm run build` 11,39 s · `vitest` 84/84 (test de contrat sur les colonnes des contrôles) |

## P3 — Export FEC conforme (PR #17)
| Point | Détail |
|---|---|
| Symptôme | `exportFEC` sortait 15 colonnes, montants à **virgule** décimale, `CompAuxNum` vide, pas de devise, `ValidDate` = date d'écriture, `EcritureNum` = numéro de pièce donc troué. Fichier inutilisable en contrôle. |
| Livré | `src/lib/fec.ts` : 18 colonnes de référence, `fecAmount` (point, 2 décimales, sans séparateur), `fecDate` (AAAAMMJJ ou vide), `CompAuxNum/Lib` résolus par ligne, `EcritureNum` = `JOURNAL-0001…` continue et chronologique (numéro de pièce déplacé dans `PieceRef`), neutralisation des `|`/tabulations, tri stable. |
| Écran | Onglet FEC : en-tête réel, compteurs (écritures, lignes, Σ débit/Σ crédit), 10 contrôles statués, aperçu tronqué, bandeau rouge si un contrôle est bloquant. |
| Mesures (seed) | 102 écritures, 281 lignes, **80 951 571,00 = 80 951 571,00**, écart 0, **0 bloquant**, 3 avertissements (exercice non filtré, lettrage non daté, `ValidDate` approximée, auxiliaires 5/67). |
| Limites assumées | Date de validation et date de lettrage non historisées : affichées, jamais inventées. Export mono-devise XOF. |
| Vérifications | `tsc` 0 erreur · `npm run build` vert · `vitest` 98/98 (14 nouveaux, dont déséquilibre → 2 bloquants et doublons de pièce) |

## P4 — Échéances légales et calendrier réglementaire (PR #18)
| Point | Détail |
|---|---|
| Symptôme | Moteur d'obligations (14 obligations, Togo 2026) **jamais appelé** ; trimestre T4 échu au 15 décembre au lieu du 15 janvier ; aucun jour férié, aucun report ; génération rétroactive de 12 mois produisant des dizaines de « en retard » fictifs. |
| Livré | `obligations.ts` : `easterSunday` (grégorien), `togoHolidays` (8 fériés fixes + lundi de Pâques, Ascension, Pentecôte), `nextBusinessDay` avec motif, `computeMonthly/Quarterly/AnnualDueDate` corrigées, génération **fenêtrée** (`from`/`until`/`today`, défaut 12 mois glissants, ancien appel par année conservé), `prorogatedFrom` exposé, `summarizeObligations`, `companyProfileFrom`. |
| Écran | Centre des Obligations → onglet **Calendrier légal** : 4 compteurs (échéances, retard, ≤ 30 j, reports), sélecteur 12/24 mois, tableau groupé par mois avec colonne report, carte des limites. |
| Mesures | Année 2026 pleine, dossier type : **92 échéances**, 29 reportées, 0 échéance générée un week-end ou un férié. |
| Limites affichées | Aïd el-Fitr / Aïd el-Adha (lunaire) non paramétrés ; dates légales indicatives à valider par un fiscaliste ; le statut « en retard » ignore les dépôts hors plateforme. |
| Vérifications | `tsc` 0 erreur · `npm run build` 12,13 s · `vitest` **115/115** (17 nouveaux) |

## P5 — Ventilation de la TVA par taux (PR #19)
| Point | Détail |
|---|---|
| Symptôme | Un seul taux (18 %) dans tout le moteur : une entreprise mixte (18 %, 9 %, export exonéré) déclarait un net faux et perdait son crédit. Le modèle portait pourtant `TaxRuleV2` et `taxCode` par ligne. |
| Livré | `src/lib/tvaVentilation.ts` : base = 70x, TVA = 443x, déductible = 445x (dont 4451) ; taux résolu par code taxe, sinon par taux effectif rattaché à 0,5 point, sinon exonération constatée ; 8 contrôles ; écran « Grille TVA » enrichi (tranches, totaux, contrôles, note déductible). |
| Mesures (seed) | Base **20 190 000** · collectée **3 634 200** · déductible **1 160 868** dont **576 000** d'immobilisations · net **2 473 332** — identiques au moteur fiscal existant, ce qui vaut contrôle croisé. |
| Limites affichées | Pas d'éclatement ligne à ligne d'une facture à deux taux (signalée) ; autoliquidation non traitée ; 13 écritures du seed sans code taxe (taux déduit, mentionné). |
| Vérifications | `tsc` 0 erreur · `npm run build` 11,27 s · `vitest` **127/127** (12 nouveaux) |

## P6 — Numérotation des pièces (PR #20)
| Point | Détail |
|---|---|
| Symptôme | `addEntry` numérotait avec `nombre d'écritures du journal + 1` : une écriture supprimée libérait son numéro (réutilisation → doublon), et un historique importé (seed : 0104→195) rendait la suite inatteignable. Aucun contrôle n'existait. |
| Livré | `src/lib/entryNumbering.ts` : `parseEntryNumber`, `maxSequence`, `nextEntryNumber` (max + 1, saut des numéros pris), `auditNumbering` (doublons, trous par journal/année, numéros illisibles, séries). `addEntry` branché dessus. Carte « Numérotation des pièces » dans l'onglet Écritures. |
| Mesures (seed) | 102 écritures contrôlées, **0 doublon**, 0 numéro illisible, 7 séries, 348 trous d'import (conséquence de la numérotation manuelle du seed, désormais mesurée au lieu d'être invisible). |
| Règle | Un trou est une information (reprise d'historique) ; un doublon est une erreur. Les deux sont distingués à l'écran. |
| Vérifications | `tsc` 0 erreur · `npm run build` 12,03 s · `vitest` **139/139** (12 nouveaux) |

## P7 — TAFIRE (PR #21)
| Point | Détail |
|---|---|
| Manque | Le TAFIRE obligatoire du modèle GUDEF était absent de la liasse, alors que la balance N-1 est importée depuis la PR #16 et n'alimentait que le remplissage Excel. |
| Livré | `src/lib/tafire.ts` : CAFG (résultat + dotations nettes), BFR classé **par le sens du solde** (un préfixe « clients »/« fournisseurs » compte deux fois 419, 421, 443/445), investissement = variation des immobilisations brutes, financement = capitaux hors résultat + dettes 16/17, bouclage obligatoire. Diffusion : onglet TAFIRE, section du document imprimé, feuille XLSX — mêmes montants. |
| Mesures (jeu de test reconstitué pièce par pièce) | CAFG 600 000 · ΔBFR −450 000 · investissement −500 000 · financement −100 000 · trésorerie 500 000 → 950 000 · **écart 0**. |
| Refus explicite | Sans balance N-1 : `available: false` + motif, trésorerie de clôture affichée, **aucun zéro inventé**. Un flux manquant de 100 000 → écart −100 000 et contrôle bloquant. |
| Limite affichée | Cessions non isolées (aucun prix de cession dans une balance) : investissements présentés nets des cessions. |
| Vérifications | `tsc` 0 erreur · `npm run build` 12,48 s · `vitest` **150/150** (11 nouveaux) |

## P8 — Notes annexes (PR #22)
| Point | Détail |
|---|---|
| Manque | 38 modules de notes SYSCOHADA (règle « null, jamais 0 ») écrits mais **appelés par aucun écran** : la liasse remise au client n'avait aucune note annexe. |
| Livré | `src/lib/notesAnnex.ts` : `createProdContext` + `computeAllNotes`, tri du référentiel (A/B/C), séparation calculées / à saisir, variation N/N-1 seulement si les deux existent, comptage des valeurs indéterminées, 5 contrôles. Diffusion : onglet, document imprimé, feuille XLSX. |
| Mesures (seed) | **13 notes calculées** · **15 à compléter** · 38 au référentiel · 78 valeurs indéterminées · 0 bloquant. |
| Règle affichée | Une note manquante est une information, pas une erreur ; un total de note est la somme de ses lignes, pas un poste du bilan ; un vide s'imprime « — ». |
| Vérifications | `tsc` 0 erreur · `npm run build` 13,19 s · `vitest` **157/157** (7 nouveaux) |

## HOTFIX — marqueurs de conflit fusionnés dans `main` (PR #23)
| Point | Détail |
|---|---|
| Faute | En fusionnant `origin/main` pour la PR #22, trois fichiers (`Liasse.tsx`, `LiassePrint.tsx`, `liasse.ts`) ont été résolus puis commités **avec leurs marqueurs** ; le contrôle `check:conflicts` n'avait été lancé qu'**avant** la fusion. La PR a été fusionnée : `main` ne compilait plus. |
| Correctif | Fichiers restaurés depuis le commit de travail propre (contenu complet : TAFIRE + notes annexes). `tsc` 0, `vitest` 157/157, build vert. |
| Garde-fou | `npm run build` et `npm test` lancent désormais `check:conflicts` **en premier** : un marqueur fait échouer la CI Vercel au lieu de déployer. Hook `pre-commit` installé par `scripts/install-hooks.sh` (déclenché par `npm install`). |
| Règle | Le contrôle se lance **après chaque fusion**, jamais seulement avant. |

## P9 — Écriture hors exercice (PR #24)
| Point | Détail |
|---|---|
| Symptôme | `addEntry` prenait le **premier exercice** du dossier et, à défaut de période, la **première période** : une écriture antidatée était déplacée en silence, son `fiscalYearId` désignait le mauvais exercice, et le contrôle de clôture portait sur la mauvaise période (donc on pouvait saisir dans un exercice clos). `updateEntry` ne contrôlait que la période. |
| Livré | `src/lib/periods.ts` : `resolveAccountingDate` (date → exercice contenant → période), `fiscalYearFor`, `describeFiscalYears`, `auditFiscalYearPlacement`. `addEntry`/`updateEntry` branchés ; période mensuelle absente **créée et auditée** dans un exercice ouvert ; éditeur affichant la plage autorisée et **conservant la saisie** en cas de refus ; carte « Rattachement à l'exercice ». |
| Règle | Une date est acceptée pour ce qu'elle est, ou refusée en le disant. Déplacer une écriture est un acte comptable : le contrôle **liste**, il ne corrige pas. |
| Vérifications | `tsc` 0 erreur · `vitest` **170/170** (13 nouveaux) · build 11,44 s |

## P10 — Réintégrations et déductions fiscales (PR #25)
| Point | Détail |
|---|---|
| Symptôme | `computeIS` prenait le **résultat comptable pour le résultat fiscal** : aucune réintégration (amendes, dons, charges non justifiées) ni déduction n'entrait dans l'IS. Le moteur de liasse savait déjà le faire ; l'écran ne l'exposait pas. |
| Livré | `FiscalAdjustments` + `applyFiscalAdjustments` + `totalAdjustments` dans `fiscalite.ts` (montants négatifs ramenés à zéro, arrondi au franc) ; `computeIsFiscal(…, adjustments)` et détail enrichi (réintégrations, déductions, résultat fiscal avant arrondi) ; `computeIS`/`computeTax` propagent ; collection `taxAdjustments` (DB_VERSION 4, migrée à vide) ; `addTaxAdjustment`/`deleteTaxAdjustment` **scellés dans l'audit** ; carte de saisie dans Fiscalité. |
| Mesures | Seed : −479 805 + 1 000 000 → résultat fiscal 520 195 → arrondi 520 000 → IS 140 400 **et** minimum de perception 201 900 qui reste dû (le plus élevé des deux). |
| Limites affichées | Aucune réintégration n'est supposée sans saisie ; la déclaration IS générée ne reprend pas encore ces montants (inscrit au registre). |
| Vérifications | `tsc` 0 erreur · `vitest` **179/179** (9 nouveaux) · build 11,62 s |

## P11 — Classe 8, déclarations TVA ventilée et IS (PR #26)
| Point | Détail |
|---|---|
| Symptôme 1 (mesuré en écrivant les tests) | `fiscalBaseFromMoves` ne lisait que les classes 6 et 7 : la **classe 8** (opérations hors activités ordinaires) était absente de la base fiscale comme du Dashboard. Le même dossier affichait **−587 805** en Fiscalité et **−479 805** en liasse — **108 000 FCFA** d'écart, qui changeaient l'assiette de l'IS. |
| Symptôme 2 | `generateTvaDeclaration` produisait un décompte à **un seul taux**, sans la ventilation 18 / 9 / exonéré livrée en #19, et une échéance écrite en dur (15 du mois M+1) sans report au jour ouvré. |
| Symptôme 3 | **Aucune déclaration IS** : les réintégrations saisies n'avaient aucune traduction déclarative. |
| Livré | Base fiscale et `financialSummary` intègrent la classe 8 (solde créditeur = produit, débiteur = charge ; CA toujours strict sur 70x, sans double compte). Déclaration TVA : ventilation par taux + collectée/déductible/crédit/net, échéance **reportée** au jour ouvré. Nouvelle `generateIsDeclaration(companyId, exercise)` : résultat comptable → réintégrations → déductions → résultat fiscal → IS au taux → minimum de perception → impôt dû → échéance **31/03 N+1 reportée**, auditée. Bouton dans Fiscalité ; refus explicite si la règle fiscale manque. |
| Mesures | Seed : ventilation TVA 18 % (base 20 190 000, TVA 3 634 200), net **2 473 332** ; IS : résultat fiscal **−480 000**, impôt dû **201 900** (minimum), échéance `2027-03-31` ; avec réintégration 1 000 000 → résultat fiscal **520 195**, IS 140 400, impôt dû 201 900. |
| Vérifications | `tsc` 0 erreur · `vitest` **187/187** (8 nouveaux) |

## P12 — Dialogues accessibles et notifications non bloquantes (PR #27)
| Point | Détail |
|---|---|
| Symptôme | 41 `alert()` bloquants, non relisibles, invisibles pour un lecteur d'écran et pour un test ; une modale sans `role`, sans Échap, sans piège de focus, qui laissait le clavier repartir dans la page ; un `confirm()` natif pour une action destructrice ; des indications de champ jamais rattachées au contrôle. |
| Livré | `src/lib/toast.ts` (magasin pur : fusion des doublons avec compteur, pile plafonnée à 4, expiration vérifiée au rendu, ton déduit du message, repli « Action impossible ») ; `Toaster` global avec région `aria-live` et `role="alert"` pour les refus ; `focusTrap.ts` + `Modal` (rôle, nom, Échap, focus initial, cycle Tab/Maj+Tab, restitution du focus, défilement figé) ; `Field` (description liée, `aria-required`) ; réinitialisation passée en dialogue explicite. |
| Mesures | 205 tests (18 nouveaux) · `aria-*` : 1 → **15** · `role=` : 0 → **2** · `alert()`/`confirm()` : **0** |
| Vérifications | `tsc` 0 erreur · `vitest` **205/205** · build 11,53 s |

## P13 — FEC par exercice (PR #28)
| Point | Détail |
|---|---|
| Symptôme | `buildFec` exportait **toutes** les écritures validées, sans exercice, et le nom du fichier ne portait que la date du jour. Un dossier à deux exercices produisait un fichier mêlant N et N-1 : inrattachable à une liasse, refusé au contrôle, et l'écran ne disait rien du périmètre. |
| Livré | `FecScope` + `entriesInScope` (bornes incluses) + `fecScopeFromFiscalYear` ; `buildFec` expose `scope` et **`excludedCount`** ; nom de dépôt `FEC_AAAAMMJJ_raisonSociale_exercice.txt` (sans espace ni « & ») ; sélecteur d'exercice et 4ᵉ indicateur « hors exercice » dans l'onglet FEC. |
| Mesures | 2026 : 102 écritures, 281 lignes, Σ 80 951 571 / 80 951 571, 0 exclue · 2025 : 0 ligne, **102 exclues** · sans périmètre : comportement inchangé |
| Vérifications | `tsc` 0 erreur · `vitest` **211/211** (6 nouveaux) |

## P14 — Tiers manquants : rendre le contrôle actionnable (PR #29)
| Point | Détail |
|---|---|
| Symptôme | Le FEC annonçait « 5/67 lignes de tiers avec auxiliaire, 62 sans » ; **aucune action** ne permettait d'en rattacher un. Le contrôle était donc vrai et sans issue : ni balance âgée explicable, ni FEC complet possible. |
| Livré | `thirdParties.ts` : détection (comptes 40x/41x, lignes non nulles, sans tiers), regroupement par compte avec enjeu FCFA et nature attendue, propositions classant le tiers du bon collectif. Actions `assignThirdPartyToLine` et `assignThirdPartyToAccount` : **jamais d'écrasement** d'une ligne déjà rattachée, refus explicites (compte non-tiers, tiers d'une autre société), décompte établi avant la mutation, **audit scellé** (`AFFECT_TIER`, `AFFECT_TIER_MASSE`). Écran : carte « Tiers manquants » en tête de l'onglet Tiers (montant en jeu, sélecteur, détail des lignes, affectation ligne à ligne). |
| Mesures | Seed : **62** lignes à compléter sur **67** · `4011` 38 lignes / 11 157 286 FCFA · `4111` 24 lignes / 37 704 751 FCFA · affectation en masse `4011` : 38 lignes, clients intacts · seconde affectation : 0 |
| Vérifications | `tsc` 0 erreur · `vitest` **223/223** (12 nouveaux) |

## P15 — Le sens du solde décide du côté du bilan (PR #30)
| Point | Détail |
|---|---|
| Symptôme | Le compte **441 « État, impôt sur les bénéfices »** du dossier de démonstration est **débiteur de 520 000**. Présenté en diminution des dettes fiscales, il n'était **ni à l'actif** (créance sur l'État) **ni au passif** : 520 000 FCFA d'actif avaient disparu. Le bilan restait équilibré, ce qui rendait le défaut indétectable par un contrôle d'équilibre. |
| Livré | Poste d'actif `creancesFiscalesSociales` (42/43/44 hors 445/4492, solde débiteur) ; `dettesFiscalesSociales` restreint aux soldes créditeurs ; `actifTotal` intègre le poste ; côté moteur factorisé, `aggregateSigned` + `RULE_CREANCES_FISCALES_SOCIALES` et mise à jour de `RULE_TOTAL_ACTIF` ; ligne « Créances sociales et fiscales » à l'écran, à l'impression d'états et dans la liasse. |
| Mesures | Seed : dettes fiscales et sociales **16 889 734**, créances sociales et fiscales **520 000**, **actif = passif = 27 960 921** (27 440 921 auparavant) · `engine` ↔ `liasse` d'accord sur l'actif, le passif et les dettes · cas synthétique : 300 000 / 170 000 / total 300 000 des deux côtés |
| Vérifications | `tsc` 0 erreur · `vitest` **228/228** (5 nouveaux) |

## P16 — Notes 04 et 16A éclatées par compte (PR #31)
| Point | Détail |
|---|---|
| Symptôme | NOTE_04 affichait « Clients 15 167 298 » et NOTE_16A « Dettes fiscales et sociales 18 570 602 » sans indiquer **quels comptes** les composaient : le réviseur devait refaire la balance à la main pour vérifier une ligne, sans garantie qu'elle corresponde encore à la balance. |
| Livré | `NoteDetail` + `NoteRow.details` ; `detailOf` calcule le détail avec **les mêmes préfixes et le même sens** que la ligne (la somme des détails vaut la ligne) ; étiquetage par le plan comptable, repli « Compte {code} » ; sous-lignes indentées dans la liasse ; N-1 repris quand il existe. |
| Mesures | NOTE_04 **15 167 298**, NOTE_16A **18 570 602** (inchangés) · somme des détails = ligne · aucun détail à zéro · aucune duplication de compte · seules 04 et 16A éclatées · référentiel stable (13 / 15 / 38) |
| Vérifications | `tsc` 0 erreur · `vitest` **235/235** (7 nouveaux) |

## P17 — Notes manuelles : saisie, persistance et traçabilité (PR #32)
| Point | Détail |
|---|---|
| Symptôme | 15 notes du référentiel (dirigeants, engagements hors bilan, rémunérations, échéances, ventilation du CA, effectifs) ne se déduisent d'aucune balance et **aucun écran ne permettait de les renseigner** : la liasse ne pouvait jamais être déposée complète, alors que le cabinet détient l'information (statuts, bail, registre du personnel). |
| Livré | Collection `manualNotes` (DB_VERSION 5, migrée à vide), une entrée par société × exercice × note ; `manualNotes.ts` (normalisation « 1 250 000,4 » → 1 250 000, fusion avec les lignes attendues, complétude, totaux rendant `null` plutôt que 0) ; `buildNotesAnnex({ manualValues })` avec `entered` / `complete` / `enteredAt` ; actions `saveManualNote` / `clearManualNote` scellées (`SAISIE_NOTE`, `SUPPR_NOTE`) ; modale de saisie dans la liasse, avec effacement. |
| Mesures | NOTE_18 saisie (5 000 000 + 1 000 000) → total **6 000 000**, N-1 4 000 000, 2 lignes attendues laissées vides (pas à zéro) · deux saisies successives = **une** entrée · notes calculées inchangées (NOTE_04 15 167 298, 13 calculées) · exercices et sociétés étanches |
| Vérifications | `tsc` 0 erreur · `vitest` **249/249** (14 nouveaux) |

## P18 — Jours fériés exceptionnels et prorogations (PR #33)
| Point | Détail |
|---|---|
| Symptôme | Le moteur d'échéances ignorait les **fêtes musulmanes** et les **prorogations** administratives : une échéance tombant un de ces jours n'était pas reportée. Le registre portait « à paramétrer chaque année » sans aucun moyen de le faire. |
| Décision | Une date religieuse ne se calcule pas (observation du calendrier hégirien) et une prorogation est un acte administratif : le logiciel ne les devine pas, il les **déclare**. |
| Livré | Collection `holidays` (DB_VERSION 6, migrée à vide, seed vide) ; `holidaysWithExtras` + paramètre `extras` sur `isNonWorkingDay`, `nextBusinessDay`, `computeMonthly/Quarterly/AnnualDueDate`, `prorogationReason`, et `GenerationOptions.holidays` ; actions `addHoliday` / `removeHoliday` / `holidayMonthMap` (`ADD_HOLIDAY`, `REMOVE_HOLIDAY`) ; carte de déclaration dans le Calendrier légal ; déclarations TVA et IS générées sur le même calendrier. |
| Mesures | Aïd el-Fitr déclaré au 15/04/2026 → échéance **16/04** ; trois jours déclarés 15-17/04 → **20/04** (week-end) ; 31/03/2027 férié → IS au **01/04/2027** ; déclaration un samedi : aucun décalage supplémentaire ; doublon, date non ISO et libellé vide refusés |
| Vérifications | `tsc` 0 erreur · `vitest` **259/259** (10 nouveaux) |

## P19 — Palette de commandes ⌘K (PR #34)
| Point | Détail |
|---|---|
| Symptôme | `GlobalSearch` n'était accessible que par « / », sans bouton pour l'annoncer, **sans navigation clavier**, sans rôle ARIA, et ne cherchait que des pièces — jamais une page ni une action. Sur une vingtaine d'écrans, personne ne la trouvait. |
| Livré | `commands.ts` (normalisation sans accents, score exact/préfixe/début de mot/inclusion/sous-séquence, ET multi-mots, plafond par section, 14 navigations + 4 actions) ; `GlobalSearch` réécrit en palette : ⌘K / Ctrl+K, « / » conservé, ↑ ↓ + Entrée avec ligne active visible, `dialog` + `combobox` + `aria-activedescendant` + `listbox`/`option`, données cherchées à partir de 2 caractères dans le périmètre de l'utilisateur. |
| Mesures | « lia » → **Liasse fiscale** en tête · « liasse paie » → 0 · « liasse notes » → Liasse · « cnss » → Paie · 20 lignes « Écriture » → 3 avec plafond 3 · requête vide → commandes, « qqqqzzz » → vide |
| Vérifications | `tsc` 0 erreur · `vitest` **270/270** (11 nouveaux) |
