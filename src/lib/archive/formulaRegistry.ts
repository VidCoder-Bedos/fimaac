// ============================================================================
// ARCHIVÉ — formulaRegistry.ts
//
// Ce module n'est importé par AUCUN code de l'application (vérifié par
// `src/lib/__tests__/archive.test.ts`). Il est conservé tel quel pour mémoire :
// il documente registre documentaire des formules Excel.
//
// Pourquoi il n'est pas branché : il ferait doublon avec aucun remplaçant : c'est une documentation, pas un moteur — elle n'a jamais été branchée.
// Deux moteurs qui calculent la même chose finissent par diverger — et c'est
// toujours l'écran qui a tort le dernier.
//
// Pour le réactiver : décider explicitement de remplacer le moteur en place,
// puis supprimer cet en-tête et retirer le fichier de `ARCHIVED_MODULES`.
// ============================================================================
// ============================================================================
// FIMAAC — Registre formel DOCUMENT 4 (8 764 formules × 97 feuilles)
// Chaque entrée relie une formule Excel à son implémentation TypeScript.
// La formule Excel originale est conservée pour audit (@formula).
// ============================================================================
export interface FormulaEntry {
  sheet: string;
  cell: string;
  formula: string;         // Formule Excel exacte (DOCUMENT 4)
  type: "input" | "calc" | "ref" | "agg" | "cond" | "lookup";
  deps?: string[];         // Dépendances inter-feuilles
  status: "MATCH" | "DIFF" | "NON_IMPLÉMENTÉ" | "HYPOTHÈSE";
  impl?: string;           // Fonction TS qui implémente cette formule
  note?: string;           // Note d'audit / écart
}

// ============================================================================
// BALANCE N / N-1 — 116 + 90 formules (patron identique)
// ============================================================================
// @formula G{r} = IF((C{r}+E{r})>(D{r}+F{r}),(C{r}+E{r})-(D{r}+F{r}),0) → solde débiteur
// @formula H{r} = IF((D{r}+F{r})>(C{r}+E{r}),(D{r}+F{r})-(C{r}+E{r}),0) → solde créditeur
// ✅ MATCH — Implémenté dans liasse.ts: parseBalance → computeLedger
//    TS: net = openingDebit + debit - openingCredit - credit
//    closingDebit = max(net, 0); closingCredit = max(-net, 0)
// ============================================================================

// ============================================================================
// BILAN ACTIF — 61 formules
// ============================================================================
// Structure : F=Brut(N), G=Amort(N), H=Net=F-G(N), I=N-1
// @formula F12 = F13+F14+F15+F16       → total immo incorporelles brut
// @formula G12 = G13+G14+G15+G16       → total amortissements
// @formula H12 = F12-G12               → net immo incorporelles
// @formula F17 = F18+F19+F20+F21+F22   → total corporel brut
// @formula H17 = F17-G17               → net corporel
// @formula F27 = F24+F23+F17+F12       → TOTAL ACTIF IMMOBILISÉ
// @formula F40 = F39+F38+F34+F27       → GRAND TOTAL ACTIF
// @formula I40 = I39+I38+I34+I27       → GRAND TOTAL N-1
// ⚠️ DIFF — liasseEngine.buildAggregate calcule par référence (AE, AF…) mais
//    ne reproduit pas la cascade exacte F12→F40. La logique est équivalente :
//    actifTotalN = immoNet + stocks + créances + tréso.
//    Voir liasseEngine.ts: buildAggregate → actifTotalN
// ============================================================================

// ============================================================================
// BILAN PASSIF — 22 formules
// ============================================================================
// @formula G18 = 'COMPTE DE RESULTAT'!I51   → résultat de l'exercice (CR)
// @formula G21 = SUM(G11:G20)               → capitaux propres
// @formula G26 = G25+G21                     → capitaux + dettes fin
// @formula G38 = G37+G36+G33+G26            → GRAND TOTAL PASSIF
// ⚠️ DIFF — liasseEngine.buildAggregate → passifTotalN équivalent
// ============================================================================

// ============================================================================
// COMPTE DE RESULTAT — 55 formules (SIG cascade)
// ============================================================================
// @formula I17 = I10+I14+I15+I16            → chiffre d'affaires
// @formula I13 = SUM(I10:I12)               → variation stocks
// @formula I31 = (I17+I11+I12)+SUM(I18:I30) → total charges d'exploitation
// @formula I33 = I31+I32                     → résultat exploitation
// @formula I36 = I33+I34+I35                 → résultat fin. intégré
// @formula I43 = I36+I42                     → résultat ordinaire
// @formula I48 = SUM(I44:I47)               → charges HAO
// @formula I51 = I43+I48+I49+I50            → RÉSULTAT NET
// ⚠️ DIFF — liasseEngine.buildAggregate calcule les SIG (XA→XI) directement
//    depuis la balance par mapping de préfixes. Logique équivalente.
// ============================================================================

// ============================================================================
// TFT — 28 formules
// ============================================================================
// @formula L11 = 'NOTE 34'!H36*1000         → CAF (issue de NOTE 34)
// @formula L17 = SUM(L11:L15)               → flux d'exploitation
// @formula L24 = SUM(L19:L23)               → flux d'investissement
// @formula L30 = SUM(L26:L29)               → flux de financement
// @formula L36 = L30+L35                     → total financement
// @formula L37 = L17+L24+L36                 → variation totale
// @formula L38 = L37+L9                       → trésorerie nette (L9=Δ bilan)
// @formula L39 = 'BILAN ACTIF'!H38-'BILAN PASSIF'!G36 → contrôle tréso
// ⚠️ DIFF — CAF maintenant calculé via liasseEngine.caf (RN + dotations - reprises)
//    L11 référence NOTE 34 mais le résultat est équivalent.
// ============================================================================

// Résultat fiscal — 12 formules  ✅ MATCH (Phase 2)
// ============================================================================
// @formula D6  = 'COMPTE DE RESULTAT'!I51   → résultat comptable
// @formula D32 = SUM(D9:D31)                → total réintégrations
// @formula D48 = SUM(D35:D47)               → total déductions
// @formula D51 = D6+D32-D48                 → RF avant déficits
// @formula D54 = D51-D52-D53                → RF net (déficits déduits)
// @formula D56 = ROUNDDOWN(D54-D55,-3)      → RF arrondi au millier
// ✅ MATCH — liasse.ts: computeResultatFiscal()
// ============================================================================

// Liquidation IS_IR_MP — 16 formules  ✅ MATCH (Phase 2)
// ============================================================================
// @formula H9  = 'COMPTE DE RESULTAT'!I17   → chiffre d'affaires
// @formula H12 = ROUNDDOWN(IF(H11<=2000000,20000,H11/100),-1) → minimum
// @formula H14 = IF(H13>0,ROUNDDOWN(H13*0.27,-1),0)          → IS 27%
// @formula H15 = MAX(H12,H14)               → IS dû
// @formula H29 = IF(SUM(H19:H20)>H28,SUM(H19:H20)-H28,0)     → reste à payer
// @formula H30 = IF(SUM(H19:H20)<H28,H28-SUM(H19:H20),0)     → crédit
// ✅ MATCH — liasse.ts: computeLiquidationIS(resultatFiscal, acomptes, CA)
// ============================================================================

// Liquidation DP — 4 018 formules  ✅ MATCH
// ============================================================================
// @formula G{r} = IF(OR(E="",F=""),"",IF(OR(E="COMMERCE",...),IF(F<=500M,0.55%,...)))
// Patron maître répété lignes 18→1019 (barème sectoriel par tranche de CA)
// ✅ MATCH — liasse.ts: computeLiquidationDP(secteur, ca) avec DP_RATES
// ============================================================================

// Contrôle de Cohérence — 292 formules
// ============================================================================
// @formula B12 = ROUND('BILAN ACTIF'!$H$40,-3)
// @formula C12 = ROUND('BILAN PASSIF'!$G$38,-3)
// @formula D12 = B12-C12
// @formula E12 = IF(D12=0,TRUE,FALSE)
// @formula C38 = IF(COUNTBLANK('FICHE IDENTIFICATION 1'!$L$48:$L$67)=20,FALSE,TRUE)
// @formula C47..C75 = ISNUMBER('BILAN ACTIF'!$H{r})  → 28 contrôles présence
// @formula C77..C104 = ISNUMBER('BILAN PASSIF'!$G{r})
// @formula C106..C147 = ISNUMBER('COMPTE DE RESULTAT'!$I{r})
// @formula C149..C175 = ISNUMBER(TFT!$L{r})
// ⚠️ DIFF — liasseEngine.runCoherenceChecks couvre C1-C9 (~60 lignes)
//    mais n'implémente pas les ISNUMBER ni les contrôles COUNTBLANK.
//    La logique d'équilibre (ROUND -3) est couverte par les contrôles C1/C2.
// ============================================================================

// Contrôle (main) — 1 392 formules
// ============================================================================
// Sections principales :
// - C8-C18 : équilibre Bilan (Actif H40 = Passif G38)
// - C14-C18 : équilibre TFT (L38 vs L39)
// - E24-L35 : croisements immobilisations (BILAN ACTIF vs NOTE 3A/3B/3C)
// - E49-L75 : croisements notes passif (BILAN PASSIF vs NOTE 4-13)
// - E80-L95 : croisements notes (NOTE 14-20)
// - E96-L106 : croisements NOTE 28 (échéances)
// - E109-L111 : croisements NOTE 34
// - E116-L125 : croisements CR vs NOTE 21-22
// - E126-L133 : croisements CR vs NOTE 23-27
// - E134-L142 : croisements CR vs NOTE 29-31
// - E143-L158 : croisements CR vs NOTE 34
// - E163-L168 : croisements TFT vs NOTE 34
// - E173-L180 : croisements NOTE 26/29/30 vs NOTE 34
// - E185-L195 : croisements BILAN PASSIF vs P75
// - E196-L205 : croisements BILAN ACTIF vs Autres renseignements / P76-P78
// - E210-L227 : croisements CR vs P64-P67
// - E228-L242 : croisements CR vs P68-P69
// - E249-L258 : croisements Résultat fiscal vs détails
// ⚠️ DIFF — liasse.ts: runChecks couvre 7 contrôles de base (DC, AP, résultat)
//    liasseEngine.runCoherenceChecks ajoute ~60 contrôles dérivés
//    Les 1392 croisements poste-par-poste ne sont pas implémentés individuellement
//    mais la logique sous-jacente (comparer état vs note) est couverte
// ============================================================================

// NOTE 34 — 127 formules (HUB CENTRAL)
// ============================================================================
// @formula H11 = 'COMPTE DE RESULTAT'!I17/1000 → CA en milliers
// @formula H36 = CAF complexe (10+ cellules CR + NOTE 29/30)
// @formula H37 = TFT!L29/1000                 → variation tréso TFT
// @formula H40 = IFERROR((H15*0.73)/(ΣBILAN PASSIF!G21:G23/1000),0) → ratio
// ❌ NON_IMPLÉMENTÉ — NOTE 34 est le hub qui relie CR/TFT/BILAN/ratios
// ============================================================================

// NOTE 1-35 — ~600 formules (patrons récurrents)
// ============================================================================
// Patron variation % : =IF(G=0," ",(F-G)/G)
// Patron agrégation : =SUM(F10:F15), =F16+F22+F32
// Patron écart      : =ABS(C-D), =IFERROR((C-D)/D,0)
// ❌ NON_IMPLÉMENTÉ — les notes individuelles ne sont pas implémentées
//    mais les patrons de calcul sont triviaux et reproductibles
// ============================================================================

// FR 4 — 92 formules
// ============================================================================
// @formula H{r} = IF(OR('NOTE n'!cell<>0,...),"X","")  → présence d'écart
// @formula I{r} = IF(TRIM(H{r})="","X","")             → inverse
// ❌ NON_IMPLÉMENTÉ — formulaire de vérification de présence de données
// ============================================================================

// P64-P86 — ~500 formules (détails analytiques)
// ============================================================================
// Patrons : SUM de détails charges/produits, VLOOKUP de références
// ❌ NON_IMPLÉMENTÉ — annexes analytiques (extension future)
// ============================================================================

// ============================================================================
// GRAPHE DE DÉPENDANCES (DOCUMENT 2 §17)
// ============================================================================
export const DEPENDENCY_GRAPH: Record<string, string[]> = {
  "BALANCE N": [],
  "BALANCE N-1": [],
  "FICHE DEPOT": ["Page de garde"],
  "FICHE IDENTIFICATION 1": ["FICHE DEPOT"],
  "FICHE IDENTIFICATION 2": ["FICHE DEPOT", "FICHE IDENTIFICATION 1"],
  "BILAN ACTIF": ["FICHE DEPOT", "FICHE IDENTIFICATION 1", "BALANCE N"],
  "BILAN PASSIF": ["FICHE DEPOT", "FICHE IDENTIFICATION 1", "COMPTE DE RESULTAT"],
  "COMPTE DE RESULTAT": ["FICHE DEPOT", "FICHE IDENTIFICATION 1", "BILAN PASSIF", "BALANCE N"],
  "TFT": ["FICHE DEPOT", "FICHE IDENTIFICATION 1", "COMPTE DE RESULTAT", "BILAN ACTIF", "BILAN PASSIF", "NOTE 34"],
  "NOTE 34": ["COMPTE DE RESULTAT", "TFT", "NOTE 26", "NOTE 29", "NOTE 30", "BILAN ACTIF", "BILAN PASSIF"],
  "Résultat fiscal": ["COMPTE DE RESULTAT", "P82", "Détail Autres réintég.", "Détail Autres déductions", "Gestion déficits"],
  "Liquidation IS_IR_MP": ["COMPTE DE RESULTAT", "Résultat fiscal"],
  "Liquidation DP": ["COMPTE DE RESULTAT", "TABLE DES CODES"],
  "Contrôle de Cohérence": ["BILAN ACTIF", "BILAN PASSIF", "COMPTE DE RESULTAT", "TFT", "FICHE IDENTIFICATION 1", "Résultat fiscal", "Liquidation IS_IR_MP", "Liquidation DP"],
  "Contrôle": ["BILAN ACTIF", "BILAN PASSIF", "COMPTE DE RESULTAT", "TFT", "NOTE 1-35", "P64-P86", "P75", "Résultat fiscal"],
  "NOTE 1-35": ["BILAN ACTIF", "BILAN PASSIF", "COMPTE DE RESULTAT"],
};

// ============================================================================
// RAPPORT DE CONFORMITÉ SYNTHÉTIQUE
// ============================================================================
export const CONFORMITY_REPORT: Record<string, { status: FormulaEntry["status"]; count: number; impl?: string; note?: string }> = {
  "BALANCE N": { status: "MATCH", count: 116, impl: "parseBalance → computeLedger" },
  "BALANCE N-1": { status: "MATCH", count: 90, impl: "parseBalance → computeLedger" },
  "FICHE DEPOT": { status: "MATCH", count: 6, impl: "exportLiasseXlsx (identification)" },
  "FICHE IDENTIFICATION 1": { status: "MATCH", count: 7, impl: "exportLiasseXlsx (identification)" },
  "FICHE IDENTIFICATION 2": { status: "MATCH", count: 22, impl: "exportLiasseXlsx (identification)" },
  "FICHE DIRIGEANTS": { status: "MATCH", count: 6, impl: "exportLiasseXlsx (identification)" },
  "BILAN ACTIF": { status: "DIFF", count: 61, impl: "liasseEngine.buildAggregate", note: "Logique équivalente, structure simplifiée" },
  "BILAN PASSIF": { status: "DIFF", count: 22, impl: "liasseEngine.buildAggregate", note: "Logique équivalente, structure simplifiée" },
  "COMPTE DE RESULTAT": { status: "DIFF", count: 55, impl: "liasseEngine.buildAggregate (sii)", note: "SIG calculés par préfixes, équivalent" },
  "TFT": { status: "DIFF", count: 28, impl: "liasseEngine.caf + buildAggregate", note: "CAF = RN + dotations - reprises" },
  "Résultat fiscal": { status: "MATCH", count: 12, impl: "liasse.computeResultatFiscal" },
  "Liquidation IS_IR_MP": { status: "MATCH", count: 16, impl: "liasse.computeLiquidationIS" },
  "Liquidation DP": { status: "MATCH", count: 4018, impl: "liasse.computeLiquidationDP" },
  "Contrôle de Cohérence": { status: "DIFF", count: 292, impl: "liasseEngine.runCoherenceChecks", note: "C1-C9 couverts, ISNUMBER manquants" },
  "Contrôle": { status: "DIFF", count: 1392, impl: "liasse.runChecks (7) + liasseEngine (60)", note: "Croisements poste-par-poste non individuels" },
  "NOTE 34": { status: "NON_IMPLÉMENTÉ", count: 127, note: "Hub central — extension future" },
  "NOTE 1-35": { status: "NON_IMPLÉMENTÉ", count: 600, note: "Patrons récurrents triviaux" },
  "FR 4": { status: "NON_IMPLÉMENTÉ", count: 92, note: "Vérification présence" },
  "P64-P86": { status: "NON_IMPLÉMENTÉ", count: 500, note: "Annexes analytiques" },
  "Pages de garde/référentiels": { status: "MATCH", count: 0, impl: "Saisie pure" },
};

/** Calcule le taux de couverture global du dictionnaire. */
export function getCoverageStats(): { total: number; match: number; diff: number; missing: number; pct: number } {
  const entries = Object.values(CONFORMITY_REPORT);
  const total = entries.reduce((s, e) => s + e.count, 0);
  const match = entries.filter((e) => e.status === "MATCH").reduce((s, e) => s + e.count, 0);
  const diff = entries.filter((e) => e.status === "DIFF").reduce((s, e) => s + e.count, 0);
  const missing = entries.filter((e) => e.status === "NON_IMPLÉMENTÉ").reduce((s, e) => s + e.count, 0);
  return { total, match, diff, missing, pct: total ? Math.round((match / total) * 100) : 0 };
}
