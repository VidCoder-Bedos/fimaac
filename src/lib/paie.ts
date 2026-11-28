// ============================================================================
// FIMAAC — Source de vérité UNIQUE de la paie (P0-3)
//
// Constat d'audit (E.4) : `runPayroll` appliquait un forfait de 5 % au titre de
// l'IRPP alors que 8 tranches progressives existaient, et n'appliquait JAMAIS
// l'AMU (5 % salarié / 5 % patronal) pourtant déclarée dans `payrollConfig`
// ET dans `socialRules`. Sur le dossier de démonstration (2 salariés) :
// **49 500 FCFA/mois de retenues non collectées**, soit un risque de
// redressement à l'échelle d'un cabinet.
//
// Ce module ne dépend ni du store ni de React : il reçoit un brut et des
// paramètres, il rend un bulletin détaillé. `runPayroll`, la déclaration TSB
// et les contrôles croisés s'y raccordent.
// ============================================================================
import type { PayrollConfig, TaxBracket } from "./types";
import { calculateIRPP } from "./regulatory-engine";

export interface CotisationParams {
  employeeRate: number;
  employerRate: number;
  /** Plafond d'assiette mensuel (0 ou null = pas de plafond). */
  plafond: number | null;
}

export interface PaieParams {
  cnss: CotisationParams;
  amu: CotisationParams;
  /** Barème IRPP progressif (tranches annuelles). */
  irppBrackets: TaxBracket[];
  /** Taux de repli utilisé uniquement si aucun barème n'est disponible. */
  forfaitRate: number;
  /** Devise/version réglementaire, pour la traçabilité du bulletin. */
  ruleVersion?: string;
}

export type ModeIRPP = "bareme" | "forfait";

export interface BulletinCalcul {
  gross: number;
  /** Assiette plafonnée des cotisations sociales. */
  baseCNSS: number;
  baseAMU: number;
  cnssEmployee: number;
  cnssEmployer: number;
  amuEmployee: number;
  amuEmployer: number;
  /** Brut − cotisations salariales retenues de l'assiette (voir hypothèse). */
  assietteIRPP: number;
  irpp: number;
  modeIRPP: ModeIRPP;
  /** Total des retenues salariales : CNSS + AMU + IRPP. */
  totalRetenues: number;
  net: number;
  /** Coût employeur : brut + cotisations patronales. */
  coutEmployeur: number;
  /** Détail du barème, pour rendre le calcul explicable. */
  tranches: { min: number; max: number | null; rate: number; base: number; impot: number }[];
  /** Avertissements de calcul (barème absent, plafond non renseigné…). */
  alertes: string[];
}

const assiette = (brut: number, plafond: number | null | undefined): number =>
  plafond && plafond > 0 ? Math.min(brut, plafond) : brut;

/**
 * Construit les paramètres de paie à partir de la configuration du cabinet et
 * du barème réglementaire. Le barème saisi dans la configuration est
 * prioritaire ; sinon on utilise le barème versionné de la base ; sinon le
 * calcul retombe explicitement en mode forfait (et le signale).
 */
export function paieParamsFromConfig(cfg: PayrollConfig, brackets: TaxBracket[] = []): PaieParams {
  const configBrackets = (cfg.irppBrackets ?? []).filter((b) => !b.taxCode || b.taxCode === "IRPP");
  const dbBrackets = brackets.filter((b) => b.taxCode === "IRPP");
  return {
    cnss: { employeeRate: cfg.cnssEmployeeRate, employerRate: cfg.cnssEmployerRate, plafond: cfg.cnssPlafond },
    amu: { employeeRate: cfg.amuEmployeeRate, employerRate: cfg.amuEmployerRate, plafond: cfg.amuPlafond },
    irppBrackets: configBrackets.length ? configBrackets : dbBrackets,
    forfaitRate: cfg.withholdingRate,
    ruleVersion: "reg-togo-2026",
  };
}

/**
 * Calcule un bulletin de paie.
 *
 * Hypothèses explicites (à valider par un humain, jamais présentées comme
 * certifiées) :
 *  - assiette IRPP = brut − CNSS salariale − AMU salariale (art. 26 CGI) ;
 *  - IRPP progressif calculé sur 12 mois puis ramené au mois ;
 *  - CNSS et AMU plafonnées chacune à leur propre plafond d'assiette ;
 *  - aucun abattement forfaitaire ni charge de famille n'est appliqué.
 */
export function calculerBulletin(gross: number, params: PaieParams): BulletinCalcul {
  const alertes: string[] = [];
  const baseCNSS = assiette(gross, params.cnss.plafond);
  const baseAMU = assiette(gross, params.amu.plafond);

  const cnssEmployee = Math.round((baseCNSS * params.cnss.employeeRate) / 100);
  const cnssEmployer = Math.round((baseCNSS * params.cnss.employerRate) / 100);
  const amuEmployee = Math.round((baseAMU * params.amu.employeeRate) / 100);
  const amuEmployer = Math.round((baseAMU * params.amu.employerRate) / 100);

  if (!params.cnss.plafond) alertes.push("Plafond CNSS non renseigné : cotisations calculées sur le brut entier.");
  if (!params.amu.plafond) alertes.push("Plafond AMU non renseigné : cotisations calculées sur le brut entier.");

  // Assiette IRPP : brut − cotisations salariales d'assurances sociales et
  // d'assurance maladie obligatoire. Base juridique arbitrée (28/11/2026) :
  // article 26 du CGI togolais — « sont déduits du revenu brut imposable les
  // retenues pour pensions/retraites d'un régime obligatoire et les cotisations
  // salariales aux assurances sociales et assurances maladies obligatoires ».
  // Seule la part SALARIALE est déductible ; la part patronale est une charge
  // de l'employeur et n'entre jamais dans le revenu du salarié.
  const assietteIRPP = Math.max(0, gross - cnssEmployee - amuEmployee);
  const brackets = [...(params.irppBrackets ?? [])].sort((a, b) => a.order - b.order);

  let irpp = 0;
  let modeIRPP: ModeIRPP = "forfait";
  let tranches: BulletinCalcul["tranches"] = [];

  if (brackets.length > 0) {
    modeIRPP = "bareme";
    const r = calculateIRPP(assietteIRPP * 12, brackets);
    irpp = r.monthlyImpot;
    tranches = r.details;
  } else {
    irpp = Math.round((gross * params.forfaitRate) / 100);
    alertes.push(
      `Aucun barème IRPP disponible : retenue forfaitaire de ${params.forfaitRate} % appliquée. ` +
        "Chargez le barème pour un calcul conforme.",
    );
  }

  const totalRetenues = cnssEmployee + amuEmployee + irpp;
  return {
    gross,
    baseCNSS,
    baseAMU,
    cnssEmployee,
    cnssEmployer,
    amuEmployee,
    amuEmployer,
    assietteIRPP,
    irpp,
    modeIRPP,
    totalRetenues,
    net: gross - totalRetenues,
    coutEmployeur: gross + cnssEmployer + amuEmployer,
    tranches,
    alertes,
  };
}

/** Totalise des bulletins (masse salariale, cotisations, coût employeur). */
export function totaliserBulletins(bulletins: BulletinCalcul[]): {
  brut: number;
  cnssEmployee: number;
  cnssEmployer: number;
  amuEmployee: number;
  amuEmployer: number;
  irpp: number;
  retenues: number;
  net: number;
  coutEmployeur: number;
} {
  const t = {
    brut: 0, cnssEmployee: 0, cnssEmployer: 0, amuEmployee: 0, amuEmployer: 0,
    irpp: 0, retenues: 0, net: 0, coutEmployeur: 0,
  };
  for (const b of bulletins) {
    t.brut += b.gross;
    t.cnssEmployee += b.cnssEmployee;
    t.cnssEmployer += b.cnssEmployer;
    t.amuEmployee += b.amuEmployee;
    t.amuEmployer += b.amuEmployer;
    t.irpp += b.irpp;
    t.retenues += b.totalRetenues;
    t.net += b.net;
    t.coutEmployeur += b.coutEmployeur;
  }
  return t;
}

/** Écriture comptable de paie — équilibrée par construction. */
export function ecrituresPaie(t: ReturnType<typeof totaliserBulletins>): {
  lines: { accountId: string; label: string; debit: number; credit: number }[];
  totalDebit: number;
  totalCredit: number;
} {
  const lines = [
    { accountId: "6611", label: "Appointements et salaires (bruts)", debit: t.brut, credit: 0 },
    { accountId: "6641", label: "Charges sociales patronales (CNSS + AMU)", debit: t.cnssEmployer + t.amuEmployer, credit: 0 },
    { accountId: "4472", label: "Impôt sur les salaires (IRPP retenu à la source)", debit: 0, credit: t.irpp },
    { accountId: "4311", label: "Sécurité sociale — CNSS (salarié + patronal)", debit: 0, credit: t.cnssEmployee + t.cnssEmployer },
    { accountId: "4331", label: "Mutuelle — AMU (salarié + patronal)", debit: 0, credit: t.amuEmployee + t.amuEmployer },
    { accountId: "422", label: "Personnel, rémunérations dues (net à payer)", debit: 0, credit: t.net },
  ].filter((l) => l.debit || l.credit);
  return {
    lines,
    totalDebit: lines.reduce((s, l) => s + l.debit, 0),
    totalCredit: lines.reduce((s, l) => s + l.credit, 0),
  };
}
