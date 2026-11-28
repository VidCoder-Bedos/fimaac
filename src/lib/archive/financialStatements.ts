// ============================================================================
// ARCHIVÉ — financialStatements.ts
//
// Ce module n'est importé par AUCUN code de l'application (vérifié par
// `src/lib/__tests__/archive.test.ts`). Il est conservé tel quel pour mémoire :
// il documente bilan et compte de résultat.
//
// Pourquoi il n'est pas branché : il ferait doublon avec liasseEngine (moteur d'états) et lib/liasse (agrégats), seuls producteurs des montants affichés.
// Deux moteurs qui calculent la même chose finissent par diverger — et c'est
// toujours l'écran qui a tort le dernier.
//
// Pour le réactiver : décider explicitement de remplacer le moteur en place,
// puis supprimer cet en-tête et retirer le fichier de `ARCHIVED_MODULES`.
// ============================================================================
// ============================================================================
// FIMAAC — FINANCIAL STATEMENT ENGINE
// Couche structurée au-dessus du moteur factorisé (engine/).
// Concept → Mapping → Ligne d'état → Note → Contrôle → Anomalie.
//
// Architecture : Jamais de cellule Excel en dur.
//   COMPTE → FINANCIAL_CONCEPT → STATEMENT_LINE → OUTPUT (field code)
// ============================================================================
import type { NormalizedBalance, EngineContext } from "../engine/types";
import { createContext } from "../engine/soldes";

// ---- Types structurés ----
export type StatementType =
  | "BALANCE_SHEET_ASSET"
  | "BALANCE_SHEET_LIABILITY"
  | "INCOME_STATEMENT"
  | "CASH_FLOW"
  | "NOTE";

export interface FinancialConcept {
  code: string;
  name: string;
  category: "ACTIF" | "PASSIF" | "PRODUIT" | "CHARGE" | "TRESORERIE" | "CAPITAUX";
  accountPrefixes: string[];
  sign: "debit" | "credit" | "net";
  normalBalance: "debit" | "credit";
  description: string;
}

export interface StatementLine {
  statementType: StatementType;
  sectionCode: string;
  lineCode: string;
  label: string;
  conceptCode: string;
  sign: "debit" | "credit" | "net";
  displayOrder: number;
  isSubtotal?: boolean;
  formula?: (lines: Record<string, number>) => number;
  subtotalOf?: string[];
}

export interface StatementLineValue {
  lineCode: string;
  label: string;
  sectionCode: string;
  valueN: number;
  valueN1: number;
  variation: number;
  variationPercent: number | null;
  sources: { accountCode: string; debit: number; credit: number; solde: number }[];
  conceptCode: string;
  isSubtotal?: boolean;
  status: "calculated" | "manual" | "missing" | "validation_required";
  note?: string;
}

export interface BuiltStatement {
  type: StatementType;
  title: string;
  lines: StatementLineValue[];
  totalN: number;
  totalN1: number;
}

export interface Anomaly {
  code: string;
  type: "BALANCE_ERROR" | "UNUSUAL_VARIATION" | "MAPPING_ERROR" | "INCONSISTENCY" | "DATA_MISSING" | "ACCOUNT_ERROR";
  severity: "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  accountCode?: string;
  lineCode?: string;
  amount?: number;
  description: string;
  recommendedAction: string;
}

// ============================================================================
// CATALOGUE DES CONCEPTS FINANCIERS (SYSCOHADA)
// ============================================================================
export const FINANCIAL_CONCEPTS: FinancialConcept[] = [
  // ---- ACTIF IMMOBILISÉ ----
  { code: "FC_IMMO_INCORP", name: "Immobilisations incorporelles", category: "ACTIF", accountPrefixes: ["20", "21"], sign: "debit", normalBalance: "debit", description: "Frais d'établissement, brevets, licences, fonds commercial" },
  { code: "FC_AMORT_INCORP", name: "Amortissements incorporelles", category: "ACTIF", accountPrefixes: ["281"], sign: "credit", normalBalance: "credit", description: "Amortissements des immobilisations incorporelles" },
  { code: "FC_IMMO_CORP", name: "Immobilisations corporelles", category: "ACTIF", accountPrefixes: ["22", "23", "24"], sign: "debit", normalBalance: "debit", description: "Terrains, bâtiments, matériel" },
  { code: "FC_AMORT_CORP", name: "Amortissements corporelles", category: "ACTIF", accountPrefixes: ["282", "283", "284"], sign: "credit", normalBalance: "credit", description: "Amortissements des immobilisations corporelles" },
  { code: "FC_IMMO_FIN", name: "Immobilisations financières", category: "ACTIF", accountPrefixes: ["26", "27"], sign: "debit", normalBalance: "debit", description: "Titres, prêts, dépôts" },
  { code: "FC_DEPREC_IMMO", name: "Dépréciations immobilisations", category: "ACTIF", accountPrefixes: ["29"], sign: "credit", normalBalance: "credit", description: "Dépréciations des immobilisations" },
  // ---- ACTIF CIRCULANT ----
  { code: "FC_STOCKS", name: "Stocks", category: "ACTIF", accountPrefixes: ["3"], sign: "debit", normalBalance: "debit", description: "Marchandises, matières, produits" },
  { code: "FC_DEPREC_STOCKS", name: "Dépréciations stocks", category: "ACTIF", accountPrefixes: ["39"], sign: "credit", normalBalance: "credit", description: "Dépréciations des stocks" },
  { code: "FC_CLIENTS", name: "Clients et comptes rattachés", category: "ACTIF", accountPrefixes: ["411", "412", "414", "416", "417", "418"], sign: "debit", normalBalance: "debit", description: "Créances clients" },
  { code: "FC_DEPREC_CLIENTS", name: "Dépréciations clients", category: "ACTIF", accountPrefixes: ["491"], sign: "credit", normalBalance: "credit", description: "Dépréciations des créances clients" },
  { code: "FC_AUTRES_CREANCES", name: "Autres créances", category: "ACTIF", accountPrefixes: ["46"], sign: "debit", normalBalance: "debit", description: "Débiteurs divers" },
  { code: "FC_TRESORERIE_ACTIF", name: "Trésorerie-actif", category: "TRESORERIE", accountPrefixes: ["50", "51", "52", "53", "57", "58"], sign: "debit", normalBalance: "debit", description: "Banques, caisse, valeurs à encaisser" },
  // ---- CAPITAUX PROPRES ----
  { code: "FC_CAPITAL", name: "Capital social", category: "CAPITAUX", accountPrefixes: ["101"], sign: "credit", normalBalance: "credit", description: "Capital souscrit" },
  { code: "FC_RESERVES", name: "Réserves", category: "CAPITAUX", accountPrefixes: ["106", "11", "118"], sign: "credit", normalBalance: "credit", description: "Réserves légales, statutaires, facultatives" },
  { code: "FC_REPORT_NOUVEAU", name: "Report à nouveau", category: "CAPITAUX", accountPrefixes: ["12"], sign: "credit", normalBalance: "credit", description: "Report à nouveau créditeur ou débiteur" },
  { code: "FC_RESULTAT", name: "Résultat de l'exercice", category: "CAPITAUX", accountPrefixes: ["120", "121"], sign: "net", normalBalance: "credit", description: "Bénéfice ou perte" },
  // ---- DETTES ----
  { code: "FC_DETTES_FIN", name: "Emprunts et dettes financières", category: "PASSIF", accountPrefixes: ["16", "17"], sign: "credit", normalBalance: "credit", description: "Emprunts obligataires et auprès établissements" },
  { code: "FC_FOURNISSEURS", name: "Fournisseurs et comptes rattachés", category: "PASSIF", accountPrefixes: ["401", "402", "408", "409"], sign: "credit", normalBalance: "credit", description: "Dettes fournisseurs" },
  { code: "FC_DETTES_FISCALES", name: "Dettes fiscales", category: "PASSIF", accountPrefixes: ["442", "443", "444", "445", "446", "447", "449"], sign: "credit", normalBalance: "credit", description: "TVA, impôts sur bénéfices, autres impôts" },
  { code: "FC_DETTES_SOCIALES", name: "Dettes sociales", category: "PASSIF", accountPrefixes: ["42", "43"], sign: "credit", normalBalance: "credit", description: "Personnel, organismes sociaux" },
  { code: "FC_TRESORERIE_PASSIF", name: "Trésorerie-passif", category: "TRESORERIE", accountPrefixes: ["513", "516", "518", "519"], sign: "credit", normalBalance: "credit", description: "Crédits bancaires, découverts" },
  // ---- PRODUITS ----
  { code: "FC_VENTES", name: "Ventes (CA)", category: "PRODUIT", accountPrefixes: ["70"], sign: "credit", normalBalance: "credit", description: "Chiffre d'affaires" },
  { code: "FC_PRODUITS_ACC", name: "Produits accessoires", category: "PRODUIT", accountPrefixes: ["707"], sign: "credit", normalBalance: "credit", description: "Produits accessoires" },
  { code: "FC_PRODUITS_FIN", name: "Produits financiers", category: "PRODUIT", accountPrefixes: ["76", "77"], sign: "credit", normalBalance: "credit", description: "Revenus financiers" },
  // ---- CHARGES ----
  { code: "FC_ACHATS", name: "Achats", category: "CHARGE", accountPrefixes: ["60"], sign: "debit", normalBalance: "debit", description: "Achats marchandises, matières" },
  { code: "FC_TRANSPORTS", name: "Transports", category: "CHARGE", accountPrefixes: ["61"], sign: "debit", normalBalance: "debit", description: "Transports sur achats et ventes" },
  { code: "FC_SERVICES_EXT", name: "Services extérieurs", category: "CHARGE", accountPrefixes: ["62"], sign: "debit", normalBalance: "debit", description: "Locations, entretien, assurances" },
  { code: "FC_IMPOTS_TAXES", name: "Impôts et taxes", category: "CHARGE", accountPrefixes: ["63"], sign: "debit", normalBalance: "debit", description: "Patente, droits, taxes" },
  { code: "FC_CHARGES_PERSONNEL", name: "Charges de personnel", category: "CHARGE", accountPrefixes: ["64", "66"], sign: "debit", normalBalance: "debit", description: "Salaires, charges sociales" },
  { code: "FC_FRAIS_FIN", name: "Frais financiers", category: "CHARGE", accountPrefixes: ["66"], sign: "debit", normalBalance: "debit", description: "Intérêts, escomptes" },
  { code: "FC_DOTATIONS", name: "Dotations aux amortissements", category: "CHARGE", accountPrefixes: ["681", "682", "683"], sign: "debit", normalBalance: "debit", description: "Dotations" },
];

// ============================================================================
// STRUCTURE DES LIGNES D'ÉTATS FINANCIERS
// ============================================================================
export const BILAN_ACTIF_LINES: StatementLine[] = [
  // ACTIF IMMOBILISÉ
  { statementType: "BALANCE_SHEET_ASSET", sectionCode: "IMMO", lineCode: "AE_AF_AG_AH", label: "Immobilisations incorporelles (brut)", conceptCode: "FC_IMMO_INCORP", sign: "debit", displayOrder: 1 },
  { statementType: "BALANCE_SHEET_ASSET", sectionCode: "IMMO", lineCode: "AD_INCORP", label: "Amortissements incorporelles", conceptCode: "FC_AMORT_INCORP", sign: "credit", displayOrder: 2 },
  { statementType: "BALANCE_SHEET_ASSET", sectionCode: "IMMO", lineCode: "NET_INCORP", label: "Immobilisations incorporelles (net)", conceptCode: "", sign: "net", displayOrder: 3, isSubtotal: true, subtotalOf: ["AE_AF_AG_AH", "AD_INCORP"], formula: (l) => l["AE_AF_AG_AH"] - l["AD_INCORP"] },
  { statementType: "BALANCE_SHEET_ASSET", sectionCode: "IMMO", lineCode: "AJ_AK_AL_AM_AN", label: "Immobilisations corporelles (brut)", conceptCode: "FC_IMMO_CORP", sign: "debit", displayOrder: 4 },
  { statementType: "BALANCE_SHEET_ASSET", sectionCode: "IMMO", lineCode: "AD_CORP", label: "Amortissements corporelles", conceptCode: "FC_AMORT_CORP", sign: "credit", displayOrder: 5 },
  { statementType: "BALANCE_SHEET_ASSET", sectionCode: "IMMO", lineCode: "NET_CORP", label: "Immobilisations corporelles (net)", conceptCode: "", sign: "net", displayOrder: 6, isSubtotal: true, subtotalOf: ["AJ_AK_AL_AM_AN", "AD_CORP"], formula: (l) => l["AJ_AK_AL_AM_AN"] - l["AD_CORP"] },
  { statementType: "BALANCE_SHEET_ASSET", sectionCode: "IMMO", lineCode: "AR_AS", label: "Immobilisations financières (net)", conceptCode: "FC_IMMO_FIN", sign: "net", displayOrder: 7, formula: () => 0 }, // simplifié
  { statementType: "BALANCE_SHEET_ASSET", sectionCode: "IMMO", lineCode: "TOTAL_IMMO", label: "TOTAL ACTIF IMMOBILISÉ (net)", conceptCode: "", sign: "net", displayOrder: 8, isSubtotal: true, subtotalOf: ["NET_INCORP", "NET_CORP", "AR_AS"], formula: (l) => l["NET_INCORP"] + l["NET_CORP"] + l["AR_AS"] },
  // ACTIF CIRCULANT
  { statementType: "BALANCE_SHEET_ASSET", sectionCode: "CIRCULANT", lineCode: "BB", label: "Stocks et en cours (net)", conceptCode: "FC_STOCKS", sign: "debit", displayOrder: 10, formula: () => 0 },
  { statementType: "BALANCE_SHEET_ASSET", sectionCode: "CIRCULANT", lineCode: "BI", label: "Clients et comptes rattachés (net)", conceptCode: "FC_CLIENTS", sign: "debit", displayOrder: 11 },
  { statementType: "BALANCE_SHEET_ASSET", sectionCode: "CIRCULANT", lineCode: "BJ", label: "Autres créances", conceptCode: "FC_AUTRES_CREANCES", sign: "debit", displayOrder: 12 },
  { statementType: "BALANCE_SHEET_ASSET", sectionCode: "CIRCULANT", lineCode: "BS", label: "Trésorerie-actif", conceptCode: "FC_TRESORERIE_ACTIF", sign: "debit", displayOrder: 13 },
  // TOTAL
  { statementType: "BALANCE_SHEET_ASSET", sectionCode: "TOTAL", lineCode: "TOTAL_ACTIF", label: "GRAND TOTAL ACTIF", conceptCode: "", sign: "net", displayOrder: 99, isSubtotal: true, subtotalOf: ["TOTAL_IMMO", "BB", "BI", "BJ", "BS"], formula: (l) => l["TOTAL_IMMO"] + l["BB"] + l["BI"] + l["BJ"] + l["BS"] },
];

export const BILAN_PASSIF_LINES: StatementLine[] = [
  { statementType: "BALANCE_SHEET_LIABILITY", sectionCode: "CAPITAUX", lineCode: "CA", label: "Capital social", conceptCode: "FC_CAPITAL", sign: "credit", displayOrder: 1 },
  { statementType: "BALANCE_SHEET_LIABILITY", sectionCode: "CAPITAUX", lineCode: "RESERVES", label: "Réserves", conceptCode: "FC_RESERVES", sign: "credit", displayOrder: 2 },
  { statementType: "BALANCE_SHEET_LIABILITY", sectionCode: "CAPITAUX", lineCode: "REPORT", label: "Report à nouveau", conceptCode: "FC_REPORT_NOUVEAU", sign: "credit", displayOrder: 3 },
  { statementType: "BALANCE_SHEET_LIABILITY", sectionCode: "CAPITAUX", lineCode: "CJ", label: "Résultat de l'exercice", conceptCode: "FC_RESULTAT", sign: "net", displayOrder: 4 },
  { statementType: "BALANCE_SHEET_LIABILITY", sectionCode: "CAPITAUX", lineCode: "TOTAL_CAPITAUX", label: "CAPITAUX PROPRES", conceptCode: "", sign: "net", displayOrder: 5, isSubtotal: true, subtotalOf: ["CA", "RESERVES", "REPORT", "CJ"], formula: (l) => l["CA"] + l["RESERVES"] + l["REPORT"] + l["CJ"] },
  { statementType: "BALANCE_SHEET_LIABILITY", sectionCode: "DETTES", lineCode: "DA", label: "Emprunts et dettes financières", conceptCode: "FC_DETTES_FIN", sign: "credit", displayOrder: 10 },
  { statementType: "BALANCE_SHEET_LIABILITY", sectionCode: "DETTES", lineCode: "DJ", label: "Fournisseurs d'exploitation", conceptCode: "FC_FOURNISSEURS", sign: "credit", displayOrder: 11 },
  { statementType: "BALANCE_SHEET_LIABILITY", sectionCode: "DETTES", lineCode: "DK", label: "Dettes fiscales et sociales", conceptCode: "FC_DETTES_FISCALES", sign: "credit", displayOrder: 12, formula: () => 0 }, // combinaison
  { statementType: "BALANCE_SHEET_LIABILITY", sectionCode: "TOTAL", lineCode: "TOTAL_PASSIF", label: "GRAND TOTAL PASSIF", conceptCode: "", sign: "net", displayOrder: 99, isSubtotal: true, subtotalOf: ["TOTAL_CAPITAUX", "DA", "DJ", "DK"], formula: (l) => l["TOTAL_CAPITAUX"] + l["DA"] + l["DJ"] + l["DK"] },
];

// ============================================================================
// MOTEUR DE CONSTRUCTION
// ============================================================================

/**
 * Calcule une valeur pour un concept financier sur une période donnée.
 */
function computeConceptValue(
  ctx: EngineContext,
  concept: FinancialConcept,
  period: "N" | "N-1",
): { value: number; sources: { accountCode: string; debit: number; credit: number; solde: number }[] } {
  const balance = period === "N" ? ctx.balanceN : ctx.balanceN1;
  let value = 0;
  const sources: { accountCode: string; debit: number; credit: number; solde: number }[] = [];
  for (const row of balance) {
    const matches = concept.accountPrefixes.some((p) => row.code === p || row.code.startsWith(p));
    if (!matches) continue;
    const solde = concept.sign === "debit" ? row.debit - row.credit : concept.sign === "credit" ? row.credit - row.debit : row.debit - row.credit;
    value += solde;
    sources.push({ accountCode: row.code, debit: row.debit, credit: row.credit, solde });
  }
  return { value: Math.round(value), sources };
}

/**
 * Construit un état financier complet (Bilan Actif, Passif, ou CR) à partir des balances.
 */
export function buildStatement(
  lines: StatementLine[],
  ctx: EngineContext,
): BuiltStatement {
  const lineValuesN: Record<string, number> = {};
  const lineValuesN1: Record<string, number> = {};
  const results: StatementLineValue[] = [];

  // Phase 1 : calculer les valeurs directes (par concept)
  for (const line of lines) {
    if (line.isSubtotal) continue;
    if (!line.conceptCode) {
      lineValuesN[line.lineCode] = 0;
      lineValuesN1[line.lineCode] = 0;
      continue;
    }
    const concept = FINANCIAL_CONCEPTS.find((c) => c.code === line.conceptCode);
    if (!concept) continue;
    const resN = computeConceptValue(ctx, concept, "N");
    const resN1 = computeConceptValue(ctx, concept, "N-1");
    lineValuesN[line.lineCode] = resN.value;
    lineValuesN1[line.lineCode] = resN1.value;
  }

  // Phase 2 : calculer les sous-totaux
  for (const line of lines) {
    if (!line.isSubtotal || !line.formula) continue;
    lineValuesN[line.lineCode] = line.formula(lineValuesN);
    lineValuesN1[line.lineCode] = line.formula(lineValuesN1);
  }

  // Phase 3 : assembler avec variations
  for (const line of lines) {
    const n = lineValuesN[line.lineCode] || 0;
    const n1 = lineValuesN1[line.lineCode] || 0;
    const variation = n - n1;
    const variationPercent = n1 !== 0 ? Math.round((variation / Math.abs(n1)) * 10000) / 100 : null;

    // Sources
    let sources: { accountCode: string; debit: number; credit: number; solde: number }[] = [];
    if (line.conceptCode) {
      const concept = FINANCIAL_CONCEPTS.find((c) => c.code === line.conceptCode);
      if (concept) sources = computeConceptValue(ctx, concept, "N").sources;
    }

    results.push({
      lineCode: line.lineCode,
      label: line.label,
      sectionCode: line.sectionCode,
      valueN: n,
      valueN1: n1,
      variation,
      variationPercent,
      sources,
      conceptCode: line.conceptCode,
      isSubtotal: line.isSubtotal,
      status: "calculated",
    });
  }

  const totalLine = lines.find((l) => l.lineCode.startsWith("TOTAL"));
  const totalN = totalLine ? lineValuesN[totalLine.lineCode] || 0 : 0;
  const totalN1 = totalLine ? lineValuesN1[totalLine.lineCode] || 0 : 0;

  return {
    type: lines[0].statementType,
    title: lines[0].statementType === "BALANCE_SHEET_ASSET" ? "BILAN ACTIF"
      : lines[0].statementType === "BALANCE_SHEET_LIABILITY" ? "BILAN PASSIF"
      : "COMPTE DE RÉSULTAT",
    lines: results,
    totalN,
    totalN1,
  };
}

// ============================================================================
// DÉTECTION D'ANOMALIES
// ============================================================================
export function detectAnomalies(
  bilanActif: BuiltStatement,
  bilanPassif: BuiltStatement,
  ctx: EngineContext,
): Anomaly[] {
  const anomalies: Anomaly[] = [];

  // CHECK 001 : Balance équilibrée
  const sumDebitN = ctx.balanceN.reduce((s, r) => s + r.debit, 0);
  const sumCreditN = ctx.balanceN.reduce((s, r) => s + r.credit, 0);
  if (sumDebitN !== sumCreditN) {
    anomalies.push({
      code: "BALANCE_UNBALANCED",
      type: "BALANCE_ERROR",
      severity: "CRITICAL",
      amount: sumDebitN - sumCreditN,
      description: `Balance N déséquilibrée : Σ Débit ${sumDebitN.toLocaleString("fr-FR")} ≠ Σ Crédit ${sumCreditN.toLocaleString("fr-FR")}.`,
      recommendedAction: "Vérifier les écritures de la balance.",
    });
  }

  // CHECK 002 : Actif = Passif
  if (Math.abs(bilanActif.totalN - bilanPassif.totalN) > 1) {
    anomalies.push({
      code: "ACTIF_NE_PASSIF",
      type: "INCONSISTENCY",
      severity: "CRITICAL",
      amount: bilanActif.totalN - bilanPassif.totalN,
      description: `Total Actif (${bilanActif.totalN.toLocaleString("fr-FR")}) ≠ Total Passif (${bilanPassif.totalN.toLocaleString("fr-FR")}).`,
      recommendedAction: "Vérifier le mapping des comptes ou les écritures d'arrêté.",
    });
  }

  // CHECK 003 : Variations inhabituelles (> 50% sur postes matériels)
  for (const line of bilanActif.lines) {
    if (!line.isSubtotal && line.valueN > 1000000 && line.variationPercent !== null) {
      if (Math.abs(line.variationPercent) > 50) {
        anomalies.push({
          code: `VARIATION_${line.lineCode}`,
          type: "UNUSUAL_VARIATION",
          severity: Math.abs(line.variationPercent) > 100 ? "HIGH" : "MEDIUM",
          lineCode: line.lineCode,
          amount: line.variation,
          description: `${line.label} : variation de ${line.variationPercent > 0 ? "+" : ""}${line.variationPercent}% entre N-1 et N.`,
          recommendedAction: "Vérifier la cause de cette variation (acquisition, cession, erreur).",
        });
      }
    }
  }

  // CHECK 004 : Fournisseurs solde débiteur (anormal)
  const fourni = bilanPassif.lines.find((l) => l.lineCode === "DJ");
  if (fourni && fourni.valueN < 0) {
    anomalies.push({
      code: "FOURNISSEUR_DEBIT",
      type: "ACCOUNT_ERROR",
      severity: "HIGH",
      lineCode: "DJ",
      amount: fourni.valueN,
      description: `Fournisseurs présentent un solde débiteur de ${Math.abs(fourni.valueN).toLocaleString("fr-FR")} FCFA — inhabituel.`,
      recommendedAction: "Vérifier : avance fournisseur, avoir, erreur d'imputation ou lettrage.",
    });
  }

  return anomalies;
}

// ============================================================================
// PIPELINE COMPLET : BALANCE → ÉTATS → CONTRÔLES
// ============================================================================
export interface FullFinancialResult {
  bilanActif: BuiltStatement;
  bilanPassif: BuiltStatement;
  anomalies: Anomaly[];
  ctx: EngineContext;
  isBalanced: boolean;
  actifEqualsPassif: boolean;
}

/**
 * Pipeline complet : Balance N + N-1 → Bilan Actif + Passif + Anomalies.
 */
export function generateFinancialStatements(
  balanceN: NormalizedBalance[],
  balanceN1: NormalizedBalance[],
  accounts: { code: string; classNumber: number }[],
): FullFinancialResult {
  // 1. Créer le contexte
  const ctx = createContext(balanceN, balanceN1, accounts);

  // 2. Construire les états
  const bilanActif = buildStatement(BILAN_ACTIF_LINES, ctx);
  const bilanPassif = buildStatement(BILAN_PASSIF_LINES, ctx);

  // 3. Détecter les anomalies
  const anomalies = detectAnomalies(bilanActif, bilanPassif, ctx);

  // 4. Contrôles
  const sumDebitN = balanceN.reduce((s, r) => s + r.debit, 0);
  const sumCreditN = balanceN.reduce((s, r) => s + r.credit, 0);

  return {
    bilanActif,
    bilanPassif,
    anomalies,
    ctx,
    isBalanced: sumDebitN === sumCreditN,
    actifEqualsPassif: Math.abs(bilanActif.totalN - bilanPassif.totalN) < 1,
  };
}
