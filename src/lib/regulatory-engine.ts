// ============================================================================
// FIMAAC — REGULATORY ENGINE v2 (Togo)
// Moteur réglementaire versionné. Aucun taux n'est codé en dur dans les composants.
// Tout passe par getTaxRate(), getSocialRule(), calculateIRPP(), calculateCNSS().
// Source de vérité : regulatoryVersions → taxRulesV2 → socialRules → taxBrackets.
// ============================================================================
import type {
  RegulatoryVersion, TaxRuleV2, TaxBracket, SocialRule,
  DeclarationTemplate, PayrollComponent,
} from "./types";

/** Version active pour une date donnée. */
export function getActiveVersion(
  versions: RegulatoryVersion[],
  date: string = new Date().toISOString(),
): RegulatoryVersion | null {
  const d = new Date(date).getTime();
  return versions.find((v) =>
    v.status === "active" &&
    new Date(v.effectiveFrom).getTime() <= d &&
    (!v.effectiveTo || new Date(v.effectiveTo).getTime() >= d),
  ) || versions.find((v) => v.status === "active") || null;
}

/** Récupère un taux fiscal versionné. */
export function getTaxRate(
  rules: TaxRuleV2[],
  versionId: string,
  code: string,
): number {
  const rule = rules.find((r) => r.versionId === versionId && r.code === code && r.active);
  if (!rule) {
    console.warn(`[RegulatoryEngine] Règle fiscale "${code}" introuvable pour la version ${versionId}`);
    return 0;
  }
  return rule.rate;
}

/** Récupère une règle sociale versionnée (CNSS ou AMU). */
export function getSocialRule(
  rules: SocialRule[],
  versionId: string,
  organism: "CNSS" | "AMU",
  code: string,
): SocialRule | null {
  return rules.find((r) =>
    r.versionId === versionId && r.organism === organism && r.code === code && r.active,
  ) || null;
}

/** Récupère les tranches d'impôt progressif pour un code (IRPP). */
export function getTaxBrackets(
  brackets: TaxBracket[],
  versionId: string,
  taxCode: string,
): TaxBracket[] {
  return brackets
    .filter((b) => b.versionId === versionId && b.taxCode === taxCode)
    .sort((a, b) => a.order - b.order);
}

// ==================== CALCULS ====================

/** TVA collectée = Base HT × Taux TVA. */
export function calculateVAT(ht: number, rate: number): number {
  return Math.round(ht * rate / 100);
}

/** Base HT depuis un montant TTC. */
export function htFromTtc(ttc: number, rate: number): number {
  return Math.round(ttc / (1 + rate / 100));
}

/** TVA depuis un montant TTC. */
export function vatFromTtc(ttc: number, rate: number): number {
  return ttc - htFromTtc(ttc, rate);
}

/** TVA nette = collectée − récupérable. */
export function calculateVatNet(collected: number, deductible: number): number {
  return Math.max(0, collected - deductible);
}

/**
 * Calcul IRPP progressif par tranches.
 *
 * @param revenuImposable Revenu annuel imposable (après CNSS et abattements)
 * @param brackets Tranches du barème (triées par ordre)
 * @returns { annualImpot, monthlyImpot, details }
 */
export function calculateIRPP(
  revenuImposable: number,
  brackets: TaxBracket[],
): { annualImpot: number; monthlyImpot: number; details: { min: number; max: number | null; rate: number; base: number; impot: number }[] } {
  let impot = 0;
  const details: { min: number; max: number | null; rate: number; base: number; impot: number }[] = [];
  const sorted = [...brackets].sort((a, b) => a.order - b.order);
  for (const bracket of sorted) {
    if (revenuImposable <= bracket.bracketMin) {
      details.push({ min: bracket.bracketMin, max: bracket.bracketMax, rate: bracket.rate, base: 0, impot: 0 });
      continue;
    }
    const plafond = bracket.bracketMax ?? Infinity;
    const baseTranche = Math.min(revenuImposable, plafond) - bracket.bracketMin;
    const impotTranche = Math.round(baseTranche * bracket.rate / 100);
    impot += impotTranche;
    details.push({ min: bracket.bracketMin, max: bracket.bracketMax, rate: bracket.rate, base: baseTranche, impot: impotTranche });
  }
  return {
    annualImpot: impot,
    monthlyImpot: Math.round(impot / 12),
    details,
  };
}

/**
 * Calcul CNSS — cotisations salariale et patronale.
 *
 * @param baseCNSS Base de calcul (salaire brut assujetti)
 * @param rule Règle CNSS active
 * @returns { employee, employer, total, base }
 */
export function calculateCNSS(
  baseCNSS: number,
  rule: SocialRule,
): { employee: number; employer: number; total: number; base: number } {
  const base = rule.ceiling ? Math.min(baseCNSS, rule.ceiling) : baseCNSS;
  const employee = Math.round(base * rule.employeeRate / 100);
  const employer = Math.round(base * rule.employerRate / 100);
  return { employee, employer, total: employee + employer, base };
}

/**
 * Calcul AMU — cotisations salariale et patronale.
 * Module totalement indépendant de la CNSS.
 */
export function calculateAMU(
  baseAMU: number,
  rule: SocialRule,
): { employee: number; employer: number; total: number; base: number } {
  const base = rule.ceiling ? Math.min(baseAMU, rule.ceiling) : baseAMU;
  const employee = Math.round(base * rule.employeeRate / 100);
  const employer = Math.round(base * rule.employerRate / 100);
  return { employee, employer, total: employee + employer, base };
}

/**
 * Calcul complet de la paie d'un salarié.
 *
 * @param gross Salaire brut
 * @param cnssRule Règle CNSS active
 * @param amuRule Règle AMU active (peut être null si non applicable)
 * @param irppBrackets Tranches IRPP
 */
export function calculatePaycheck(
  gross: number,
  cnssRule: SocialRule | null,
  amuRule: SocialRule | null,
  irppBrackets: TaxBracket[],
): {
  gross: number;
  cnssEmployee: number;
  cnssEmployer: number;
  amuEmployee: number;
  amuEmployer: number;
  revenuAfterCNSS: number;
  irppAnnual: number;
  irppMonthly: number;
  totalDeductions: number;
  net: number;
  costEmployer: number;
} {
  // CNSS
  const cnss = cnssRule ? calculateCNSS(gross, cnssRule) : { employee: 0, employer: 0, total: 0, base: 0 };
  // AMU
  const amu = amuRule ? calculateAMU(gross, amuRule) : { employee: 0, employer: 0, total: 0, base: 0 };
  // Revenu après CNSS salariale (base IRPP)
  const revenuAfterCNSS = gross - cnss.employee;
  const revenuAnnual = revenuAfterCNSS * 12;
  // IRPP progressif annuel
  const irppResult = calculateIRPP(revenuAnnual, irppBrackets);
  // Total retenues
  const totalDeductions = cnss.employee + amu.employee + irppResult.monthlyImpot;

  return {
    gross,
    cnssEmployee: cnss.employee,
    cnssEmployer: cnss.employer,
    amuEmployee: amu.employee,
    amuEmployer: amu.employer,
    revenuAfterCNSS,
    irppAnnual: irppResult.annualImpot,
    irppMonthly: irppResult.monthlyImpot,
    totalDeductions,
    net: gross - totalDeductions,
    costEmployer: gross + cnss.employer + amu.employer,
  };
}

// ==================== OBLIGATIONS ====================

export interface ObligationResult {
  code: string;
  name: string;
  organism: string;
  periodicity: string;
  applicable: boolean;
  reason?: string;
}

/** Détermine les obligations d'une entreprise à partir de son profil. */
export function determineObligations(profile: {
  taxRegime: string;
  vatPayer: boolean;
  hasEmployees: boolean;
  sector?: string;
}): ObligationResult[] {
  const obligations: ObligationResult[] = [];

  // TVA
  obligations.push({
    code: "TVA",
    name: "Déclaration TVA",
    organism: "OTR",
    periodicity: "monthly",
    applicable: profile.vatPayer,
    reason: profile.vatPayer ? undefined : "Entreprise non assujettie à la TVA",
  });

  // IS / IRPP sur bénéfices
  obligations.push({
    code: "IS",
    name: "Impôt sur les sociétés",
    organism: "OTR",
    periodicity: "annual",
    applicable: profile.taxRegime === "ri",
    reason: profile.taxRegime === "ri" ? undefined : "Régime non soumis à l'IS normal",
  });

  // CNSS
  obligations.push({
    code: "CNSS",
    name: "Déclaration CNSS",
    organism: "CNSS",
    periodicity: "monthly",
    applicable: profile.hasEmployees,
    reason: profile.hasEmployees ? undefined : "Aucun salarié déclaré",
  });

  // IRPP salaires (retenue à la source)
  obligations.push({
    code: "IRPP_SALAIRES",
    name: "IRPP sur salaires (TSB/TPA)",
    organism: "OTR",
    periodicity: "monthly",
    applicable: profile.hasEmployees,
    reason: profile.hasEmployees ? undefined : "Aucun salarié déclaré",
  });

  // AMU
  obligations.push({
    code: "AMU",
    name: "Assurance Maladie Universelle",
    organism: "AMU",
    periodicity: "monthly",
    applicable: profile.hasEmployees,
    reason: profile.hasEmployees ? undefined : "Aucun salarié déclaré",
  });

  // États financiers annuels
  obligations.push({
    code: "ETATS_FINANCIERS",
    name: "États financiers annuels",
    organism: "OTR",
    periodicity: "annual",
    applicable: true,
  });

  return obligations;
}

// ==================== DONNÉES DE RÉFÉRENCE ====================

/**
 * Version initiale TOGO_2026_REFERENCE.
 * ATTENTION : Tous les taux sont des VALEURS INDICATIVES paramétrables.
 * Ils DOIVENT être vérifiés contre les textes officiels avant utilisation.
 */
export const TOGO_2026_REFERENCE: RegulatoryVersion = {
  id: "reg-togo-2026",
  country: "TG",
  year: 2026,
  version: "TOGO_2026_REFERENCE",
  effectiveFrom: "2026-01-01",
  effectiveTo: null,
  status: "active",
  officialSource: "Office Togolais des Recettes (OTR) / CNSS — À VÉRIFIER contre textes officiels",
  notes: "Version de référence. Tous les taux sont INDICATIFS et PARAMÉTRABLES. Ne jamais utiliser sans vérification.",
};

/** Règles fiscales initiales (taux indicatifs, paramétrables). */
export const INITIAL_TAX_RULES: Omit<TaxRuleV2, "id">[] = [
  {
    versionId: "reg-togo-2026", code: "TVA_STANDARD", name: "TVA — Taux normal",
    type: "vat", rate: 18, base: "excl_tax", periodicity: "monthly",
    effectiveFrom: "2026-01-01", active: true,
    source: "Code général des impôts — OTR",
    verified: false,
    description: "Taux indicatif. À vérifier dans le Regulatory Engine.",
  },
  {
    versionId: "reg-togo-2026", code: "IS_STANDARD", name: "Impôt sur les sociétés — Taux normal",
    type: "is", rate: 27, base: "amount", periodicity: "annual",
    effectiveFrom: "2026-01-01", active: true,
    source: "Code général des impôts — OTR",
    verified: false,
  },
  {
    versionId: "reg-togo-2026", code: "TSB", name: "Taxe sur salaires (TSB/TPA)",
    type: "tsb", rate: 5, base: "salary", periodicity: "monthly",
    effectiveFrom: "2026-01-01", active: true,
    source: "Code général des impôts — OTR",
    verified: false,
    description: "Taux indicatif de retenue. Le barème progressif IRPP remplace ce taux simplifié.",
  },
];

/** Tranches IRPP (barème progressif indicatif — À VÉRIFIER). */
export const INITIAL_TAX_BRACKETS: Omit<TaxBracket, "id">[] = [
  { versionId: "reg-togo-2026", taxCode: "IRPP", bracketMin: 0, bracketMax: 900000, rate: 0, order: 1 },
  { versionId: "reg-togo-2026", taxCode: "IRPP", bracketMin: 900000, bracketMax: 3000000, rate: 11, order: 2 },
  { versionId: "reg-togo-2026", taxCode: "IRPP", bracketMin: 3000000, bracketMax: 6000000, rate: 17, order: 3 },
  { versionId: "reg-togo-2026", taxCode: "IRPP", bracketMin: 6000000, bracketMax: 9000000, rate: 23, order: 4 },
  { versionId: "reg-togo-2026", taxCode: "IRPP", bracketMin: 9000000, bracketMax: 12000000, rate: 29, order: 5 },
  { versionId: "reg-togo-2026", taxCode: "IRPP", bracketMin: 12000000, bracketMax: 15000000, rate: 33, order: 6 },
  { versionId: "reg-togo-2026", taxCode: "IRPP", bracketMin: 15000000, bracketMax: 20000000, rate: 37, order: 7 },
  { versionId: "reg-togo-2026", taxCode: "IRPP", bracketMin: 20000000, bracketMax: null, rate: 40, order: 8 },
];

/** Règles sociales CNSS (taux indicatifs — À VÉRIFIER). */
export const INITIAL_SOCIAL_RULES: Omit<SocialRule, "id">[] = [
  {
    versionId: "reg-togo-2026", organism: "CNSS", code: "CNSS_STANDARD",
    name: "Cotisation CNSS standard",
    employeeRate: 4, employerRate: 17.5,
    ceiling: 300000, periodicity: "monthly",
    active: true,
    source: "Caisse Nationale de Sécurité Sociale — À VÉRIFIER",
  },
  {
    versionId: "reg-togo-2026", organism: "AMU", code: "AMU_STANDARD",
    name: "Cotisation AMU standard",
    employeeRate: 5, employerRate: 5,
    ceiling: 300000, periodicity: "monthly",
    active: true,
    source: "Assurance Maladie Universelle — 5 % salarié / 5 % employeur (taux arbitrés le 28/11/2026)",
  },
];

/** Modèles de déclarations. */
export const INITIAL_DECLARATION_TEMPLATES: Omit<DeclarationTemplate, "id">[] = [
  {
    versionId: "reg-togo-2026", organism: "OTR", code: "TVA_MENSUELLE",
    name: "Déclaration TVA mensuelle", periodicity: "monthly",
    requiredDocuments: ["Journal des ventes", "Journal des achats"],
    controls: ["Σ TVA collectée − TVA récupérable = TVA nette"],
    portal: "DIMANA", active: true,
  },
  {
    versionId: "reg-togo-2026", organism: "OTR", code: "TSB_MENSUEL",
    name: "Déclaration IRPP sur salaires (TSB)", periodicity: "monthly",
    requiredDocuments: ["Bulletins de paie", "État des salaires"],
    controls: ["Base TSB = Σ salaires bruts", "TSB = Base × taux"],
    portal: "DIMANA", active: true,
  },
  {
    versionId: "reg-togo-2026", organism: "CNSS", code: "CNSS_MENSUELLE",
    name: "Déclaration CNSS mensuelle", periodicity: "monthly",
    requiredDocuments: ["État du personnel", "Bulletins de paie"],
    controls: ["Base CNSS cohérente avec paie", "Effectif CNSS = effectif paie"],
    active: true,
  },
  {
    versionId: "reg-togo-2026", organism: "AMU", code: "AMU_MENSUELLE",
    name: "Déclaration AMU mensuelle", periodicity: "monthly",
    requiredDocuments: ["État du personnel"],
    controls: ["Base AMU cohérente avec paie"],
    active: true,
  },
  {
    versionId: "reg-togo-2026", organism: "OTR", code: "LIASSE_ANNUELLE",
    name: "Liasse fiscale annuelle (GUDEF)", periodicity: "annual",
    requiredDocuments: ["Balance N", "Balance N-1", "États financiers"],
    controls: ["Total Actif = Total Passif", "Résultat CR = Résultat passif"],
    portal: "GUDEF", active: true,
  },
];

/** Composants de paie standards. */
export const INITIAL_PAYROLL_COMPONENTS: Omit<PayrollComponent, "id">[] = [
  { code: "SALAIRE_BASE", label: "Salaire de base", type: "earning", cnssTaxable: true, irppTaxable: true, amuTaxable: true, deductible: true, accountingCode: "6611", active: true },
  { code: "PRIME", label: "Primes et gratifications", type: "earning", cnssTaxable: true, irppTaxable: true, amuTaxable: true, deductible: true, accountingCode: "6612", active: true },
  { code: "INDEMNITE", label: "Indemnités", type: "earning", cnssTaxable: true, irppTaxable: true, amuTaxable: true, deductible: true, accountingCode: "663", active: true },
  { code: "HEURES_SUP", label: "Heures supplémentaires", type: "earning", cnssTaxable: true, irppTaxable: true, amuTaxable: true, deductible: true, accountingCode: "6611", active: true },
  { code: "AVANTAGE_NATURE", label: "Avantages en nature", type: "earning", cnssTaxable: true, irppTaxable: true, amuTaxable: true, deductible: true, accountingCode: "6617", active: true },
  { code: "FRAIS_PRO", label: "Remboursement de frais professionnels", type: "earning", cnssTaxable: false, irppTaxable: false, amuTaxable: false, deductible: false, accountingCode: "625", active: true },
  { code: "AVANCE", label: "Avance sur salaire", type: "deduction", cnssTaxable: false, irppTaxable: false, amuTaxable: false, deductible: false, accountingCode: "421", active: true },
  { code: "PRET", label: "Remboursement de prêt", type: "deduction", cnssTaxable: false, irppTaxable: false, amuTaxable: false, deductible: false, accountingCode: "421", active: true },
];
