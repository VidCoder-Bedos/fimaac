// ============================================================================
// FIMAAC — Extensions du Regulatory Engine (Référentiel Togo 2026)
// TVM, TPU, IRPP par catégorie, réconciliation TVA, CHECK-UP CLIENT.
// Chaque règle : source → article → date d'effet → taux → formule → régime.
// ============================================================================
import type { JournalEntry, Company, Employee } from "./types";
import { movementsByAccount, financialSummary } from "./accounting";

// ==================== RÉGIMES FISCAUX ====================
export interface CompanyProfile {
  legalForm: string;
  taxRegime: string;
  vatPayer: boolean;
  hasEmployees: boolean;
  sector: string;
  capital: number;
  isTransporter?: boolean;
  hasVehicles?: boolean;
  hasRealEstateIncome?: boolean;
}

export interface TaxRegimeDef {
  code: string;
  name: string;
  description: string;
  isApplicable: (profile: CompanyProfile) => boolean;
  /** Codes d'obligations déclenchées par ce régime. */
  obligations: string[];
}

export const TAX_REGIMES: TaxRegimeDef[] = [
  {
    code: "ri", name: "Régime de l'Impôt (Réal Normal)",
    description: "Régime normal avec comptabilité d'engagement. Soumis à l'IS.",
    isApplicable: (p) => p.taxRegime === "ri",
    obligations: ["TVA_MENSUELLE", "IS_ANNUEL", "LIASSE_ANNUELLE", "ETATS_FINANCIERS"],
  },
  {
    code: "rs", name: "Régime Simplifié",
    description: "Régime simplifié d'imposition.",
    isApplicable: (p) => p.taxRegime === "rs",
    obligations: ["TVA_MENSUELLE", "LIASSE_SIMPLIFIEE"],
  },
  {
    code: "rsmi", name: "RSMI",
    description: "Régime Sectoriel de la Micro-industrie.",
    isApplicable: (p) => p.taxRegime === "rsmi",
    obligations: ["TVA_MENSUELLE"],
  },
];

// ==================== TVM (Taxe sur Véhicules à Moteur) ====================
export interface VehicleCategory {
  code: string;
  label: string;
  /** Tarif de base FCFA — indicatif, paramétrable. */
  baseTariff: number;
  /** % de réduction pour transporteurs TPU. */
  tpuReduction?: number;
}

export const TVM_CATEGORIES: VehicleCategory[] = [
  { code: "MOTO", label: "Motocyclettes", baseTariff: 5000 },
  { code: "VP_PRIVE", label: "Véhicules particuliers (usage privé)", baseTariff: 20000 },
  { code: "VP_PUBLIC", label: "Véhicules particuliers (transport public)", baseTariff: 30000 },
  { code: "VTM_LEGER", label: "Véhicules transport marchandises ≤ 3,5T", baseTariff: 30000 },
  { code: "VTM_LOURD", label: "Véhicules transport marchandises > 3,5T", baseTariff: 60000 },
  { code: "AUTRES", label: "Autres véhicules", baseTariff: 15000 },
];

export function calculateTVM(categoryCode: string, isTPUTransporter: boolean = false): number {
  const cat = TVM_CATEGORIES.find((c) => c.code === categoryCode);
  if (!cat) return 0;
  let amount = cat.baseTariff;
  if (isTPUTransporter && cat.tpuReduction) {
    amount = Math.round(amount * (1 - cat.tpuReduction / 100));
  }
  return amount;
}

// ==================== TPU (Taxe Professionnelle Unique) ====================
export interface TPUActivity {
  code: string;
  sector: string;
  label: string;
  /** Le barème dépend de la zone et du CA — paramétrable via Regulatory Engine. */
  rateNote: string;
}

export const TPU_ACTIVITIES: TPUActivity[] = [
  { code: "COMMERCE", sector: "Commerce", label: "Activités commerciales", rateNote: "Barème par tranche de CA — paramétrable" },
  { code: "SERVICES", sector: "Services", label: "Prestation de services", rateNote: "Barème par tranche de CA — paramétrable" },
  { code: "TRANSPORT_ROUTIER", sector: "Transport", label: "Transport routier de voyageurs/marchandises", rateNote: "Tarif spécifique transporteurs — circulaire OTR" },
  { code: "ARTISANAT", sector: "Artisanat", label: "Activités artisanales", rateNote: "Barème spécifique — paramétrable" },
  { code: "LIBERAL", sector: "Libéral", label: "Professions libérales", rateNote: "Barème par tranche de CA — paramétrable" },
];

// ==================== IRPP PAR CATÉGORIE ====================
export type IRPPCategory =
  | "traitements_salaires"
  | "bic"        // Bénéfices Industriels et Commerciaux
  | "bnc"        // Bénéfices Non Commerciaux
  | "foncier"    // Revenus fonciers
  | "agricole"   // Revenus agricoles
  | "capitaux"   // Capitaux mobiliers
  | "plus_values";

export interface IRPPCategoryDef {
  code: IRPPCategory;
  name: string;
  description: string;
  /** Les taux et abattements sont versionnés dans le Regulatory Engine (TaxBracket). */
  usesBrackets: boolean;
}

export const IRPP_CATEGORIES: IRPPCategoryDef[] = [
  { code: "traitements_salaires", name: "Traitements et salaires", description: "Salaires, appointements, pensions. Barème progressif annuel.", usesBrackets: true },
  { code: "bic", name: "BIC (Bénéfices Industriels et Commerciaux)", description: "Bénéfices des activités commerciales et industrielles.", usesBrackets: true },
  { code: "bnc", name: "BNC (Bénéfices Non Commerciaux)", description: "Bénéfices des professions libérales et occupations non commerciales.", usesBrackets: true },
  { code: "foncier", name: "Revenus fonciers", description: "Revenus de la location d'immeubles.", usesBrackets: true },
  { code: "agricole", name: "Revenus agricoles", description: "Bénéfices des exploitations agricoles.", usesBrackets: true },
  { code: "capitaux", name: "Capitaux mobiliers", description: "Dividendes, intérêts, obligations.", usesBrackets: false },
  { code: "plus_values", name: "Plus-values", description: "Plus-values de cession.", usesBrackets: false },
];

// ==================== RÉCONCILIATION TVA ====================
export interface VatAnomaly {
  code: string;
  level: "info" | "warning" | "critical";
  message: string;
  amount?: number;
}

export interface VatReconciliationResult {
  /** CA comptable (classe 7). */
  caComptable: number;
  /** CA théorique déduit de la TVA collectée. */
  caTva: number;
  ecartCa: number;
  /** TVA collectée (compte 443). */
  tvaCollecteeCompta: number;
  /** TVA récupérable (compte 445). */
  tvaDeductibleCompta: number;
  /** TVA nette calculée. */
  tvaNetteCalculee: number;
  status: "ok" | "warning" | "critical";
  anomalies: VatAnomaly[];
}

export function reconcileVAT(entries: JournalEntry[], vatRate: number = 18): VatReconciliationResult {
  const moves = movementsByAccount(entries);
  const sum = financialSummary(entries);

  // CA comptable = classe 7
  const caComptable = sum.produits;

  // TVA collectée = compte 443 (crédit - débit)
  let tvaCollectee = 0;
  let tvaDeductible = 0;
  for (const [code, m] of moves) {
    if (code.startsWith("443")) tvaCollectee += m.credit - m.debit;
    if (code.startsWith("445")) tvaDeductible += m.debit - m.credit;
  }
  const tvaNetteCalculee = Math.max(0, tvaCollectee - tvaDeductible);
  const caTvaTheorique = vatRate > 0 ? Math.round((tvaCollectee / vatRate) * 100) : 0;
  const ecartCa = caComptable - caTvaTheorique;

  const anomalies: VatAnomaly[] = [];

  // Écart CA
  if (Math.abs(ecartCa) > 100000) {
    anomalies.push({
      code: "ECART_CA_TVA",
      level: ecartCa > 1000000 ? "critical" : "warning",
      message: `Écart de ${Math.abs(ecartCa).toLocaleString("fr-FR")} FCFA entre le CA comptable et le CA TVA théorique.`,
      amount: ecartCa,
    });
  }

  // TVA collectée négative
  if (tvaCollectee < 0) {
    anomalies.push({
      code: "TVA_COLLECTEE_NEGATIVE",
      level: "critical",
      message: "TVA collectée négative — vérifiez les imputations au compte 443.",
      amount: tvaCollectee,
    });
  }

  // Crédit de TVA
  if (tvaDeductible > tvaCollectee) {
    anomalies.push({
      code: "CREDIT_TVA",
      level: "info",
      message: `Crédit de TVA de ${(tvaDeductible - tvaCollectee).toLocaleString("fr-FR")} FCFA — reportable.`,
      amount: tvaDeductible - tvaCollectee,
    });
  }

  const status = anomalies.some((a) => a.level === "critical") ? "critical"
    : anomalies.some((a) => a.level === "warning") ? "warning" : "ok";

  return {
    caComptable,
    caTva: caTvaTheorique,
    ecartCa,
    tvaCollecteeCompta: tvaCollectee,
    tvaDeductibleCompta: tvaDeductible,
    tvaNetteCalculee,
    status,
    anomalies,
  };
}

// ==================== RÉSULTAT FISCAL (IS) ====================
export interface Reintegration {
  code: string;
  label: string;
  amount: number;
  justification: string;
}

export interface Deduction {
  code: string;
  label: string;
  amount: number;
  justification: string;
}

export interface FiscalResult {
  resultatComptable: number;
  reintegrations: Reintegration[];
  deductions: Deduction[];
  deficitsReportables: number;
  resultatFiscal: number;
  isCalcule: number;
  minimumPerception: number;
  isDu: number;
}

export function calculateFiscalResult(
  resultatComptable: number,
  isRate: number,
  chiffreAffaires: number,
  opts: {
    reintegrations?: Reintegration[];
    deductions?: Deduction[];
    deficitsReportables?: number;
    ajustementManuel?: number;
  } = {},
): FiscalResult {
  const totalReintegrations = (opts.reintegrations || []).reduce((s, r) => s + r.amount, 0);
  const totalDeductions = (opts.deductions || []).reduce((s, d) => s + d.amount, 0);
  const deficits = opts.deficitsReportables || 0;
  const ajustement = opts.ajustementManuel || 0;

  const resultatFiscalBrut = resultatComptable + totalReintegrations - totalDeductions;
  const resultatFiscalNet = resultatFiscalBrut - deficits;

  const isCalcule = resultatFiscalNet > 0 ? Math.round(resultatFiscalNet * isRate / 100) : 0;

  // Minimum de perception — indicatif, À VÉRIFIER dans le référentiel
  // Ancien mécanisme : 0,5% du CA minimum 20 000 FCFA
  // ⚠️ HYPOTHÈSE — doit être validé contre le Cahier fiscal 2026
  const minimumPerception = Math.max(20000, Math.round(chiffreAffaires * 0.005));
  const isDu = Math.max(isCalcule, minimumPerception);

  return {
    resultatComptable,
    reintegrations: opts.reintegrations || [],
    deductions: opts.deductions || [],
    deficitsReportables: deficits,
    resultatFiscal: resultatFiscalNet - ajustement,
    isCalcule,
    minimumPerception,
    isDu,
  };
}

// ==================== CONTRÔLE PAIE ↔ CNSS ====================
export interface PayrollControlResult {
  totalBrutPaie: number;
  baseCNSSDeclaree: number;
  ecartBase: number;
  cnssCalculee: number;
  cnssDeclaree: number;
  ecartCNSS: number;
  anomalies: string[];
}

export function controlPayrollVsCNSS(
  employees: Employee[],
  cnssEmployeeRate: number,
  declaredBaseCNSS: number = 0,
  declaredCNSS: number = 0,
): PayrollControlResult {
  const totalBrutPaie = employees.reduce((s, e) => s + e.grossSalary, 0);
  const baseCNSSCalculee = totalBrutPaie; // simplifié — utiliser PayrollComponent pour la base réelle
  const cnssCalculee = Math.round(baseCNSSCalculee * cnssEmployeeRate / 100);
  const ecartBase = baseCNSSCalculee - declaredBaseCNSS;
  const ecartCNSS = cnssCalculee - declaredCNSS;

  const anomalies: string[] = [];
  if (Math.abs(ecartBase) > 1000) {
    anomalies.push(`Écart de base CNSS : ${Math.abs(ecartBase).toLocaleString("fr-FR")} FCFA (paie ${baseCNSSCalculee.toLocaleString("fr-FR")} vs déclaré ${declaredBaseCNSS.toLocaleString("fr-FR")}).`);
  }
  if (Math.abs(ecartCNSS) > 1000) {
    anomalies.push(`Écart de cotisation CNSS : ${Math.abs(ecartCNSS).toLocaleString("fr-FR")} FCFA.`);
  }

  return {
    totalBrutPaie,
    baseCNSSDeclaree: declaredBaseCNSS,
    ecartBase,
    cnssCalculee,
    cnssDeclaree: declaredCNSS,
    ecartCNSS,
    anomalies,
  };
}

// ==================== FIMAAC CHECK-UP CLIENT ====================
export interface CheckUpAnomaly {
  code: string;
  category: string;
  level: "info" | "warning" | "critical";
  title: string;
  detail: string;
  amount?: number;
  recommendation?: string;
}

export interface CheckUpResult {
  companyName: string;
  modules: {
    name: string;
    status: "ok" | "warning" | "critical" | "info";
    detail: string;
    count?: number;
  }[];
  anomalies: CheckUpAnomaly[];
  scores: {
    comptabilite: number;
    fiscalite: number;
    social: number;
    documentaire: number;
    banque: number;
    global: number;
  };
  riskLevel: "faible" | "modere" | "important" | "eleve" | "critique";
}

export function clientCheckUp(data: {
  company: Company;
  entries: JournalEntry[];
  documents: { id: string; docStatus: string }[];
  bankTransactions: { id: string; reconciled: boolean }[];
  employees: Employee[];
  taxDeclarations: { id: string; status: string }[];
  complianceIssues: { id: string; severity: string; resolved: boolean }[];
  documentRequests: { id: string; status: string }[];
}): CheckUpResult {
  const anomalies: CheckUpAnomaly[] = [];
  const modules: CheckUpResult["modules"] = [];

  // ---- COMPTABILITÉ ----
  const validated = data.entries.filter((e) => e.status === "validated");
  const drafts = data.entries.filter((e) => e.status === "draft");
  const unbalanced = data.entries.filter((e) => {
    const d = e.lines.reduce((s, l) => s + l.debit, 0);
    const c = e.lines.reduce((s, l) => s + l.credit, 0);
    return d !== c;
  });
  if (unbalanced.length > 0) {
    anomalies.push({
      code: "ENTRIES_UNBALANCED", category: "Comptabilité", level: "critical",
      title: `${unbalanced.length} écriture(s) déséquilibrée(s)`,
      detail: "Σ Débit ≠ Σ Crédit — la double partie est obligatoire.",
      recommendation: "Corriger les écritures avant tout dépôt.",
    });
  }
  modules.push({
    name: "Comptabilité", status: unbalanced.length > 0 ? "critical" : drafts.length > 0 ? "warning" : "ok",
    detail: `${validated.length} validée(s) · ${drafts.length} brouillon(s) · ${unbalanced.length} déséquilibrée(s)`,
    count: data.entries.length,
  });

  // ---- FISCALITÉ ----
  const pendingDeclarations = data.taxDeclarations.filter((d) => d.status === "ready" || d.status === "in_progress");
  if (pendingDeclarations.length > 0) {
    anomalies.push({
      code: "DECLARATIONS_PENDING", category: "Fiscalité", level: "warning",
      title: `${pendingDeclarations.length} déclaration(s) en attente`,
      detail: "Des déclarations sont prêtes à déposer ou en cours de préparation.",
    });
  }
  modules.push({
    name: "Fiscalité", status: pendingDeclarations.length > 0 ? "warning" : "ok",
    detail: `${data.taxDeclarations.length} déclaration(s) · ${pendingDeclarations.length} en attente`,
  });

  // ---- TVA ----
  const vatRecon = reconcileVAT(data.entries);
  if (vatRecon.anomalies.length > 0) {
    for (const a of vatRecon.anomalies) {
      anomalies.push({
        code: a.code, category: "TVA", level: a.level,
        title: a.message, detail: a.message, amount: a.amount,
      });
    }
  }
  modules.push({
    name: "TVA", status: vatRecon.status === "critical" ? "critical" : vatRecon.status === "warning" ? "warning" : "ok",
    detail: `Collectée: ${vatRecon.tvaCollecteeCompta.toLocaleString("fr-FR")} · Récupérable: ${vatRecon.tvaDeductibleCompta.toLocaleString("fr-FR")} · Nette: ${vatRecon.tvaNetteCalculee.toLocaleString("fr-FR")}`,
  });

  // ---- CNSS / PAIE ----
  if (data.employees.length > 0) {
    modules.push({
      name: "CNSS / Paie", status: "ok",
      detail: `${data.employees.length} salarié(s) · ${(data.employees.reduce((s, e) => s + e.grossSalary, 0)).toLocaleString("fr-FR")} FCFA/mois`,
    });
  } else {
    modules.push({ name: "CNSS / Paie", status: "info", detail: "Aucun salarié" });
  }

  // ---- BANQUE ----
  const unreconciled = data.bankTransactions.filter((t) => !t.reconciled);
  if (unreconciled.length > 0) {
    anomalies.push({
      code: "BANK_UNRECONCILED", category: "Banque", level: "warning",
      title: `${unreconciled.length} opération(s) bancaire(s) non rapprochée(s)`,
      detail: "Des transactions ne sont pas encore lettrées avec la comptabilité.",
      recommendation: "Effectuer le rapprochement bancaire.",
    });
  }
  modules.push({
    name: "Banque", status: unreconciled.length > 5 ? "critical" : unreconciled.length > 0 ? "warning" : "ok",
    detail: `${data.bankTransactions.length} transaction(s) · ${unreconciled.length} non rapprochée(s)`,
  });

  // ---- DOCUMENTS ----
  const unclassified = data.documents.filter((d) => d.docStatus === "non_classe");
  const pendingDocReqs = data.documentRequests.filter((r) => r.status !== "received");
  if (unclassified.length > 0 || pendingDocReqs.length > 0) {
    anomalies.push({
      code: "DOCS_MISSING", category: "Documents", level: "warning",
      title: `${unclassified.length} non classé(s) · ${pendingDocReqs.length} demande(s) en attente`,
      detail: "Des pièces justificatives manquent ou ne sont pas classées.",
    });
  }
  modules.push({
    name: "Documents", status: unclassified.length > 10 ? "critical" : (unclassified.length > 0 || pendingDocReqs.length > 0) ? "warning" : "ok",
    detail: `${data.documents.length} document(s) · ${unclassified.length} non classé(s) · ${pendingDocReqs.length} en attente`,
  });

  // ---- CONFORMITÉ ----
  const openIssues = data.complianceIssues.filter((i) => !i.resolved);
  if (openIssues.length > 0) {
    for (const issue of openIssues.slice(0, 5)) {
      anomalies.push({
        code: "COMPLIANCE_ISSUE", category: "Conformité",
        level: issue.severity === "critical" ? "critical" : issue.severity === "warning" ? "warning" : "info",
        title: `Anomalie : ${issue.severity}`,
        detail: "Voir le centre de conformité pour le détail.",
      });
    }
  }
  modules.push({
    name: "Conformité", status: openIssues.some((i) => i.severity === "critical") ? "critical" : openIssues.length > 0 ? "warning" : "ok",
    detail: `${openIssues.length} anomalie(s) ouverte(s) sur ${data.complianceIssues.length}`,
  });

  // ---- SCORES ----
  const penalty = (level: string) => level === "critical" ? 15 : level === "warning" ? 7 : level === "info" ? 2 : 0;
  const calcScore = (cats: string[]) => {
    const items = anomalies.filter((a) => cats.includes(a.category));
    return Math.max(0, 100 - items.reduce((s, a) => s + penalty(a.level), 0));
  };
  const scores = {
    comptabilite: calcScore(["Comptabilité"]),
    fiscalite: calcScore(["Fiscalité", "TVA"]),
    social: calcScore(["CNSS", "Paie"]),
    documentaire: calcScore(["Documents"]),
    banque: calcScore(["Banque"]),
    global: 0,
  };
  scores.global = Math.round(Object.values(scores).reduce((s, v) => s + v, 0) / 5);

  const riskLevel: CheckUpResult["riskLevel"] =
    scores.global >= 85 ? "faible" :
    scores.global >= 65 ? "modere" :
    scores.global >= 45 ? "important" :
    scores.global >= 25 ? "eleve" : "critique";

  return {
    companyName: data.company.name,
    modules,
    anomalies,
    scores,
    riskLevel,
  };
}

// ==================== DÉCLARATIONS DIMANA / OTR ====================
export function getDeclarationNextAction(status: string): string {
  const map: Record<string, string> = {
    brouillon: "Compléter les données de la déclaration",
    en_preparation: "Finaliser la préparation",
    pieces_manquantes: "Demander les pièces manquantes au client",
    controle: "Lancer les contrôles automatiques",
    valide: "Préparer le dépôt sur le portail officiel",
    ready_to_file: "Effectuer la saisie sur DIMANA",
    submitted: "Télécharger et archiver le récépissé",
    accepted: "Procéder au paiement",
    rejected: "Corriger et redéposer",
    corrected: "Archiver la version corrigée",
    paid: "Archiver la preuve de paiement",
    archived: "Déclaration clôturée",
  };
  return map[status] || "Voir le détail";
}

export function canEditDeclaration(status: string): boolean {
  // Après validation définitive (submitted+), la déclaration n'est plus modifiable directement
  return !["submitted", "accepted", "paid", "archived"].includes(status);
}
