// ============================================================================
// FIMAAC — DECLARATION ENGINE
// Transforme les données comptables → champs de déclarations fiscales/sociales.
// Chaque montant est traçable : Montant → Formule → Comptes → Écritures → Règle.
// ============================================================================
import type { JournalEntry, Employee, SocialRule, TaxBracket } from "./types";
import { movementsByAccount } from "./accounting";
import { calculateIRPP, calculateCNSS } from "./regulatory-engine";

// ---- Types ----
export type DeclarationType = "TVA" | "TSB" | "CNSS" | "AMU" | "DAS" | "IS" | "LIASSE";
export type FieldSourceType = "DIRECT_ACCOUNT" | "ACCOUNT_GROUP" | "CALCULATION" | "MANUAL" | "CROSS_CHECK";

export interface DeclarationFieldDef {
  code: string;
  label: string;
  section: string;
  sourceType: FieldSourceType;
  /** Pour DIRECT_ACCOUNT / ACCOUNT_GROUP : préfixes de comptes SYSCOHADA */
  sourceAccounts?: string[];
  /**
   * Préfixes explicitement exclus de ce champ, même s'ils sont couverts par
   * `sourceAccounts`. Évite les recouvrements : TVA_DEDUCTIBLE couvre 445 mais
   * délègue 4451/4452 à leurs propres lignes (sinon le déductible est compté
   * deux fois dans le total de section).
   */
  excludeAccounts?: string[];
  /** Signe : "debit" = solde débiteur, "credit" = solde créditeur, "net" = débit - crédit */
  sign?: "debit" | "credit" | "net";
  /** Formule de calcul si sourceType = CALCULATION (référence d'autres champs) */
  formula?: (fields: Record<string, number>) => number;
  /** Ordre d'affichage */
  order: number;
  /** Référence au champ officiel (bordereau OTR) */
  officialRef?: string;
}

export interface DeclarationFieldValue {
  code: string;
  label: string;
  value: number;
  section: string;
  /** Traçabilité : quels comptes ont produit ce montant */
  sources: AccountSource[];
  /** Référence à la règle fiscale utilisée */
  ruleCode?: string;
  ruleRate?: number;
  ruleVersion?: string;
}

export interface AccountSource {
  accountCode: string;
  debit: number;
  credit: number;
  solde: number;
}

export interface BuiltDeclaration {
  type: DeclarationType;
  periodLabel: string;
  companyName: string;
  fields: DeclarationFieldValue[];
  /** Total clé de la déclaration (TVA nette, cotisation totale, etc.) */
  total: number;
  /** Lignes de détail (par salarié, par facture, etc.) */
  detailLines?: DeclarationDetailLine[];
  /** Statut de la déclaration */
  status: "brouillon" | "prete" | "controlee";
  /** Anomalies détectées */
  anomalies: DeclarationAnomaly[];
  /** Date de génération */
  generatedAt: string;
}

export interface DeclarationDetailLine {
  label: string;
  base: number;
  rate: number;
  amount: number;
  ref?: string;
}

export interface DeclarationAnomaly {
  code: string;
  level: "info" | "warning" | "critical";
  message: string;
  amount?: number;
}

// ============================================================================
// DÉFINITIONS DES CHAMPS PAR TYPE DE DÉCLARATION
// ============================================================================

export const TVA_FIELDS: DeclarationFieldDef[] = [
  // CA
  { code: "CA_TOTAL", label: "Chiffre d'affaires total", section: "CA", sourceType: "ACCOUNT_GROUP", sourceAccounts: ["70"], sign: "credit", order: 1, officialRef: "CA" },
  { code: "CA_TAXABLE", label: "CA taxable (TVA)", section: "CA", sourceType: "CALCULATION", order: 2, officialRef: "CA_TAX", formula: (f) => f.CA_TOTAL - (f.CA_EXONERE || 0) },
  { code: "CA_EXONERE", label: "CA exonéré", section: "CA", sourceType: "MANUAL", order: 3, officialRef: "CA_EXO" },
  // TVA collectée
  { code: "TVA_COLLECTEE", label: "TVA collectée", section: "TVA_COLLECTEE", sourceType: "ACCOUNT_GROUP", sourceAccounts: ["443"], sign: "credit", order: 10, officialRef: "TVA_COL" },
  // TVA déductible
  { code: "TVA_DEDUCTIBLE", label: "TVA récupérable déductible", section: "TVA_DEDUCTIBLE", sourceType: "ACCOUNT_GROUP", sourceAccounts: ["445"], excludeAccounts: ["4451", "4452"], sign: "debit", order: 20, officialRef: "TVA_DED" },
  { code: "TVA_IMMO", label: "TVA sur immobilisations", section: "TVA_DEDUCTIBLE", sourceType: "ACCOUNT_GROUP", sourceAccounts: ["4451"], sign: "debit", order: 21, officialRef: "TVA_IMMO" },
  { code: "TVA_ACHATS", label: "TVA sur achats biens et services", section: "TVA_DEDUCTIBLE", sourceType: "ACCOUNT_GROUP", sourceAccounts: ["4452"], sign: "debit", order: 22, officialRef: "TVA_ACH" },
  // Régularisations
  { code: "CREDIT_ANTERIEUR", label: "Crédit TVA antérieur reporté", section: "REGUL", sourceType: "MANUAL", order: 30, officialRef: "CRED_ANT" },
  // Résultat
  { code: "TVA_NETTE", label: "TVA nette à payer", section: "RESULTAT", sourceType: "CALCULATION", order: 40, officialRef: "TVA_NETTE", formula: (f) => Math.max(0, f.TVA_COLLECTEE - f.TVA_DEDUCTIBLE - (f.CREDIT_ANTERIEUR || 0)) },
  { code: "CREDIT_TVA", label: "Crédit de TVA reportable", section: "RESULTAT", sourceType: "CALCULATION", order: 41, officialRef: "CRED_TVA", formula: (f) => Math.max(0, f.TVA_DEDUCTIBLE + (f.CREDIT_ANTERIEUR || 0) - f.TVA_COLLECTEE) },
];

export const CNSS_FIELDS: DeclarationFieldDef[] = [
  { code: "EFFECTIF", label: "Effectif déclaré", section: "ENTREPRISE", sourceType: "MANUAL", order: 1 },
  { code: "MASSE_SALARIALE", label: "Masse salariale brute", section: "BASE", sourceType: "CALCULATION", order: 10, formula: (f) => f.BRUT_TOTAL },
  { code: "BRUT_TOTAL", label: "Total salaires bruts", section: "BASE", sourceType: "ACCOUNT_GROUP", sourceAccounts: ["661"], sign: "debit", order: 11 },
  { code: "BASE_CNSS", label: "Base CNSS (assujettie)", section: "BASE", sourceType: "CALCULATION", order: 12, formula: (f) => f.BRUT_TOTAL },
  { code: "COTISATION_SALARIALE", label: "Cotisation salariale (4%)", section: "COTISATIONS", sourceType: "CALCULATION", order: 20 },
  { code: "COTISATION_PATRONALE", label: "Cotisation patronale (17,5%)", section: "COTISATIONS", sourceType: "CALCULATION", order: 21 },
  { code: "COTISATION_TOTALE", label: "Cotisation totale", section: "RESULTAT", sourceType: "CALCULATION", order: 30, formula: (f) => f.COTISATION_SALARIALE + f.COTISATION_PATRONALE },
];

export const IS_FIELDS: DeclarationFieldDef[] = [
  { code: "RESULTAT_COMPTABLE", label: "Résultat comptable", section: "DEPART", sourceType: "ACCOUNT_GROUP", sourceAccounts: ["120", "121"], sign: "net", order: 1 },
  { code: "REINTEGRATIONS", label: "Total réintégrations", section: "REINTEGRATIONS", sourceType: "MANUAL", order: 10 },
  { code: "DEDUCTIONS", label: "Total déductions", section: "DEDUCTIONS", sourceType: "MANUAL", order: 20 },
  { code: "DEFICITS", label: "Déficits reportables imputés", section: "DEFICITS", sourceType: "MANUAL", order: 30 },
  { code: "RESULTAT_FISCAL", label: "Résultat fiscal", section: "RESULTAT", sourceType: "CALCULATION", order: 40, formula: (f) => f.RESULTAT_COMPTABLE + f.REINTEGRATIONS - f.DEDUCTIONS - f.DEFICITS },
  { code: "IMPOT_BRUT", label: "Impôt brut", section: "IMPOT", sourceType: "CALCULATION", order: 50 },
  { code: "MINIMUM_PERCEPTION", label: "Minimum de perception", section: "IMPOT", sourceType: "CALCULATION", order: 51 },
  { code: "IMPOT_DU", label: "Impôt dû", section: "RESULTAT", sourceType: "CALCULATION", order: 60, formula: (f) => Math.max(f.IMPOT_BRUT, f.MINIMUM_PERCEPTION) },
];

// ============================================================================
// MOTEUR DE CONSTRUCTION DES DÉCLARATIONS
// ============================================================================

/**
 * Construit une déclaration TVA complète à partir des écritures comptables.
 *
 * @param entries Écritures validées de la période
 * @param vatRate Taux TVA (issu du Regulatory Engine, JAMAIS en dur)
 * @param companyName Nom de l'entreprise
 * @param periodLabel Libellé de la période (ex: "Janvier 2026")
 * @param manualValues Valeurs saisies manuellement (CA exonéré, crédit antérieur…)
 */
export function buildTvaDeclaration(
  entries: JournalEntry[],
  vatRate: number,
  companyName: string,
  periodLabel: string,
  manualValues: Record<string, number> = {},
): BuiltDeclaration {
  const moves = movementsByAccount(entries);
  const fieldValues: Record<string, number> = {};
  const fieldResults: DeclarationFieldValue[] = [];
  const anomalies: DeclarationAnomaly[] = [];

  // Phase 1 : calculer les champs par ordre
  for (const def of [...TVA_FIELDS].sort((a, b) => a.order - b.order)) {
    let value = 0;
    let sources: AccountSource[] = [];

    if (def.sourceType === "ACCOUNT_GROUP" || def.sourceType === "DIRECT_ACCOUNT") {
      // Extraire depuis les comptes
      const sign = def.sign || "net";
      for (const [code, m] of moves) {
        if (!def.sourceAccounts?.some((p) => code === p || code.startsWith(p))) continue;
        if (def.excludeAccounts?.some((p) => code === p || code.startsWith(p))) continue;
        const solde = sign === "debit" ? m.debit - m.credit : sign === "credit" ? m.credit - m.debit : m.debit - m.credit;
        value += solde;
        sources.push({ accountCode: code, debit: m.debit, credit: m.credit, solde });
      }
    } else if (def.sourceType === "MANUAL") {
      value = manualValues[def.code] || 0;
    } else if (def.sourceType === "CALCULATION" && def.formula) {
      value = def.formula(fieldValues);
    }

    fieldValues[def.code] = Math.round(value);
    fieldResults.push({
      code: def.code, label: def.label, value: Math.round(value),
      section: def.section, sources,
      ruleRate: def.code === "TVA_NETTE" ? vatRate : undefined,
      ruleCode: def.code === "TVA_NETTE" ? "TVA_STANDARD" : undefined,
      ruleVersion: "TOGO_2026_REFERENCE",
    });
  }

  // Phase 2 : contrôles
  const caTotal = fieldValues["CA_TOTAL"];
  const tvaCollectee = fieldValues["TVA_COLLECTEE"];
  const caTheorique = vatRate > 0 ? Math.round((tvaCollectee / vatRate) * 100) : 0;
  const ecartCA = caTotal - caTheorique;
  if (Math.abs(ecartCA) > 100000) {
    anomalies.push({
      code: "ECART_CA_TVA",
      level: ecartCA > 1000000 ? "critical" : "warning",
      message: `Écart de ${Math.abs(ecartCA).toLocaleString("fr-FR")} FCFA entre CA comptable (${caTotal.toLocaleString("fr-FR")}) et CA TVA théorique (${caTheorique.toLocaleString("fr-FR")}).`,
      amount: ecartCA,
    });
  }
  if (tvaCollectee < 0) {
    anomalies.push({
      code: "TVA_NEGATIVE",
      level: "critical",
      message: "TVA collectée négative — vérifiez les imputations (compte 443).",
      amount: tvaCollectee,
    });
  }

  return {
    type: "TVA",
    periodLabel,
    companyName,
    fields: fieldResults,
    total: fieldValues["TVA_NETTE"],
    status: anomalies.some((a) => a.level === "critical") ? "brouillon" : "prete",
    anomalies,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Construit une déclaration CNSS à partir des données de paie.
 */
export function buildCnssDeclaration(
  employees: Employee[],
  cnssRule: SocialRule,
  companyName: string,
  periodLabel: string,
): BuiltDeclaration {
  const fieldValues: Record<string, number> = {};
  const fieldResults: DeclarationFieldValue[] = [];
  const detailLines: DeclarationDetailLine[] = [];

  // Calculer par salarié
  let totalBase = 0;
  let totalSalariale = 0;
  let totalPatronale = 0;

  for (const emp of employees) {
    const base = Math.min(emp.grossSalary, cnssRule.ceiling || emp.grossSalary);
    const cnss = calculateCNSS(base, cnssRule);
    totalBase += base;
    totalSalariale += cnss.employee;
    totalPatronale += cnss.employer;
    detailLines.push({
      label: `${emp.firstName} ${emp.lastName}`,
      base, rate: cnssRule.employeeRate + cnssRule.employerRate,
      amount: cnss.total, ref: emp.id,
    });
  }

  fieldValues["EFFECTIF"] = employees.length;
  fieldValues["BRUT_TOTAL"] = employees.reduce((s, e) => s + e.grossSalary, 0);
  fieldValues["MASSE_SALARIALE"] = fieldValues["BRUT_TOTAL"];
  fieldValues["BASE_CNSS"] = totalBase;
  fieldValues["COTISATION_SALARIALE"] = totalSalariale;
  fieldValues["COTISATION_PATRONALE"] = totalPatronale;
  fieldValues["COTISATION_TOTALE"] = totalSalariale + totalPatronale;

  for (const def of [...CNSS_FIELDS].sort((a, b) => a.order - b.order)) {
    fieldResults.push({
      code: def.code, label: def.label, value: fieldValues[def.code] || 0,
      section: def.section, sources: [],
      ruleCode: cnssRule.code, ruleRate: cnssRule.employeeRate + cnssRule.employerRate,
      ruleVersion: cnssRule.versionId,
    });
  }

  return {
    type: "CNSS",
    periodLabel, companyName,
    fields: fieldResults,
    total: fieldValues["COTISATION_TOTALE"],
    detailLines,
    status: "prete",
    anomalies: [],
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Construit une DAS (Déclaration Annuelle des Salaires) à partir des salariés.
 */
export function buildDasDeclaration(
  employees: Employee[],
  cnssRule: SocialRule,
  _amuRule: SocialRule | null,
  irppBrackets: TaxBracket[],
  companyName: string,
  year: number,
): BuiltDeclaration {
  const detailLines: DeclarationDetailLine[] = [];
  let totalBrut = 0, totalCNSS = 0, totalIRPP = 0, totalNet = 0;

  for (const emp of employees) {
    const brutAnnuel = emp.grossSalary * 12;
    const cnss = calculateCNSS(Math.min(emp.grossSalary, cnssRule.ceiling || emp.grossSalary), cnssRule);
    const cnssAnnuel = cnss.employee * 12;
    const revenuAfterCNSS = brutAnnuel - cnssAnnuel;
    const irppResult = calculateIRPP(revenuAfterCNSS, irppBrackets);
    const netAnnuel = brutAnnuel - cnssAnnuel - irppResult.annualImpot;

    totalBrut += brutAnnuel;
    totalCNSS += cnssAnnuel;
    totalIRPP += irppResult.annualImpot;
    totalNet += netAnnuel;

    detailLines.push({
      label: `${emp.firstName} ${emp.lastName} (${emp.position})`,
      base: brutAnnuel,
      rate: 0,
      amount: netAnnuel,
      ref: emp.id,
    });
  }

  const fields: DeclarationFieldValue[] = [
    { code: "EFFECTIF", label: "Nombre de salariés", value: employees.length, section: "ENTREPRISE", sources: [] },
    { code: "TOTAL_BRUT", label: "Total rémunérations brutes annuelles", value: totalBrut, section: "TOTAUX", sources: [] },
    { code: "TOTAL_CNSS", label: "Total cotisations CNSS salariales", value: totalCNSS, section: "TOTAUX", sources: [], ruleCode: cnssRule.code, ruleVersion: cnssRule.versionId },
    { code: "TOTAL_IRPP", label: "Total IRPP retenu", value: totalIRPP, section: "TOTAUX", sources: [], ruleCode: "IRPP", ruleVersion: "TOGO_2026_REFERENCE" },
    { code: "TOTAL_NET", label: "Total net versé", value: totalNet, section: "TOTAUX", sources: [] },
  ];

  const anomalies: DeclarationAnomaly[] = [];
  // Contrôle DAS = Σ paie
  if (totalBrut !== employees.reduce((s, e) => s + e.grossSalary * 12, 0)) {
    anomalies.push({ code: "DAS_PAIE_ECART", level: "critical", message: "Écart entre DAS et total paie annuel." });
  }

  return {
    type: "DAS",
    periodLabel: `Exercice ${year}`,
    companyName,
    fields,
    total: totalBrut,
    detailLines,
    status: anomalies.length > 0 ? "brouillon" : "prete",
    anomalies,
    generatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// DATA LINEAGE — Traçabilité des montants
// ============================================================================

export interface TraceResult {
  amount: number;
  formula: string;
  ruleCode?: string;
  ruleRate?: number;
  ruleVersion?: string;
  accountSources: AccountSource[];
  entries: { entryId: string; entryNumber: string; date: string; debit: number; credit: number; label: string }[];
}

/**
 * Trace un montant jusqu'à sa source.
 *
 * Usage : traceAmount(declaration, "TVA_COLLECTEE", entries)
 * Retourne : "3 060 000 = Σ crédit comptes 443 (écritures VT-0001, VT-0002…)"
 */
export function traceAmount(
  declaration: BuiltDeclaration,
  fieldCode: string,
  entries: JournalEntry[],
): TraceResult | null {
  const field = declaration.fields.find((f) => f.code === fieldCode);
  if (!field) return null;

  // Si le champ a des sources comptables directes
  const entryDetails: TraceResult["entries"] = [];
  if (field.sources.length > 0) {
    const accountCodes = new Set(field.sources.map((s) => s.accountCode));
    for (const e of entries) {
      if (e.status !== "validated") continue;
      for (const l of e.lines) {
        if (accountCodes.has(l.accountId)) {
          entryDetails.push({
            entryId: e.id, entryNumber: e.number, date: e.date,
            debit: l.debit, credit: l.credit, label: l.label,
          });
        }
      }
    }
  }

  const formula = field.sources.length > 0
    ? `Σ soldes comptes ${field.sources.map((s) => s.accountCode).slice(0, 5).join(", ")}${field.sources.length > 5 ? "…" : ""}`
    : "Valeur calculée";

  return {
    amount: field.value,
    formula,
    ruleCode: field.ruleCode,
    ruleRate: field.ruleRate,
    ruleVersion: field.ruleVersion,
    accountSources: field.sources,
    entries: entryDetails,
  };
}

/**
 * Génère un rapport textuel de traçabilité pour un champ.
 */
export function formatTraceReport(trace: TraceResult): string {
  let report = `══════════════════════════════════════════\n`;
  report += `MONTANT : ${trace.amount.toLocaleString("fr-FR")} FCFA\n`;
  report += `══════════════════════════════════════════\n\n`;
  report += `FORMULE : ${trace.formula}\n`;

  if (trace.ruleCode) {
    report += `\nRÈGLE FISCALE :\n`;
    report += `  Code    : ${trace.ruleCode}\n`;
    if (trace.ruleRate !== undefined) report += `  Taux    : ${trace.ruleRate} %\n`;
    if (trace.ruleVersion) report += `  Version : ${trace.ruleVersion}\n`;
  }

  if (trace.accountSources.length > 0) {
    report += `\nCOMPTES SOURCES :\n`;
    for (const s of trace.accountSources.slice(0, 10)) {
      report += `  ${s.accountCode} → D: ${s.debit.toLocaleString("fr-FR")} · C: ${s.credit.toLocaleString("fr-FR")} · Solde: ${s.solde.toLocaleString("fr-FR")}\n`;
    }
    if (trace.accountSources.length > 10) report += `  ... et ${trace.accountSources.length - 10} autre(s)\n`;
  }

  if (trace.entries.length > 0) {
    report += `\nÉCRITURES SOURCES (${trace.entries.length}) :\n`;
    for (const e of trace.entries.slice(0, 10)) {
      report += `  ${e.entryNumber} (${e.date}) → D: ${e.debit.toLocaleString("fr-FR")} · C: ${e.credit.toLocaleString("fr-FR")} — ${e.label}\n`;
    }
    if (trace.entries.length > 10) report += `  ... et ${trace.entries.length - 10} autre(s)\n`;
  }

  report += `\n══════════════════════════════════════════\n`;
  return report;
}
