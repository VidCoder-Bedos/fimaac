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
