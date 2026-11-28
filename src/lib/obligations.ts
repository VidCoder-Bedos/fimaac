// ============================================================================
// FIMAAC — MOTEUR DES OBLIGATIONS (Togo 2026)
// Catalogue exhaustif + génération automatique du calendrier par profil.
// Chaque obligation : code → organisme → assujettissement → formule → échéance.
// ============================================================================
import type { CompanyProfile } from "./regulatory-extensions";

export type ObligationCategory = "FISCAL" | "SOCIAL" | "COMPTABLE" | "ANNUEL" | "EMPLOYEUR" | "SECTORIEL" | "PATRIMOINE";
export type ObligationOrganism = "OTR" | "CNSS" | "AMU" | "OHADA" | "DOUANES";
export type ObligationPeriodicity = "monthly" | "quarterly" | "annual" | "per_event";

export interface ObligationDef {
  code: string;
  name: string;
  organism: ObligationOrganism;
  category: ObligationCategory;
  description: string;
  periodicity: ObligationPeriodicity;
  /** Plateforme de dépôt (DIMANA, GUDEF…). */
  platform?: string;
  applicableIf: (profile: CompanyProfile) => boolean;
  applicableReason: (profile: CompanyProfile) => string;
  requiredDocuments: string[];
  requiredData: string[];
  preControls: string[];
  paymentRequired: boolean;
  proofRequired: boolean;
  /** Version du référentiel source (TOGO_2026_REFERENCE). */
  sourceVersion: string;
}

export type ObligationInstanceStatus =
  | "creee"
  | "donnees_collectees"
  | "calculee"
  | "controlee"
  | "anomalie"
  | "validee_collab"
  | "validee_resp"
  | "prete_depot"
  | "deposee"
  | "acceptee"
  | "rejetee"
  | "payee"
  | "archivee"
  | "en_retard";

export interface ObligationInstance {
  id: string;
  obligationCode: string;
  obligationName: string;
  organism: ObligationOrganism;
  category: ObligationCategory;
  companyId: string;
  companyName: string;
  periodLabel: string;
  dueDate: string;
  status: ObligationInstanceStatus;
  assignedTo: string | null;
  amount: number | null;
  calculatedAmount: number | null;
  declarationId: string | null;
  receiptNumber: string | null;
  proofDocId: string | null;
  paymentRef: string | null;
  createdAt: string;
  /** Date d'échéance légale avant report (week-end / jour férié), si reportée. */
  prorogatedFrom?: string | null;
}

// ============================================================================
// CATALOGUE DES OBLIGATIONS — Togo 2026
// Chaque entrée détermine AUTOMATIQUEMENT si elle s'applique au profil.
// ============================================================================
export const OBLIGATION_CATALOG: ObligationDef[] = [
  // ---- TVA ----
  {
    code: "TVA_MENSUELLE", name: "Déclaration TVA mensuelle", organism: "OTR", category: "FISCAL",
    description: "TVA collectée − TVA récupérable = TVA nette à payer ou crédit.",
    periodicity: "monthly", platform: "DIMANA",
    applicableIf: (p) => p.vatPayer,
    applicableReason: (p) => p.vatPayer ? "" : "Entreprise non assujettie à la TVA",
    requiredDocuments: ["Journal des ventes", "Journal des achats", "Avoirs"],
    requiredData: ["tva_collectee", "tva_deductible", "credit_anterieur", "regularisations"],
    preControls: ["CA comptable ≈ CA TVA", "TVA collectée > 0 si ventes taxables"],
    paymentRequired: true, proofRequired: true,
    sourceVersion: "TOGO_2026_REFERENCE",
  },
  {
    code: "TVA_TIERS", name: "TVA pour compte de tiers / Autoliquidation", organism: "OTR", category: "FISCAL",
    description: "TVA collectée pour le compte de tiers (régime de l'autoliquidation).",
    periodicity: "monthly", platform: "DIMANA",
    applicableIf: (p) => p.vatPayer && p.taxRegime === "ri",
    applicableReason: (p) => (p.vatPayer && p.taxRegime === "ri") ? "" : "Non applicable (pas d'autoliquidation)",
    requiredDocuments: ["Opérations avec tiers"],
    requiredData: ["base_autoliquidation", "tva_autoliquidée"],
    preControls: ["Cohérence opérations tiers"],
    paymentRequired: true, proofRequired: true,
    sourceVersion: "TOGO_2026_REFERENCE",
  },
  // ---- Retenues à la source ----
  {
    code: "RETENUES_SOURCE", name: "Retenues à la source", organism: "OTR", category: "FISCAL",
    description: "Retenues opérées sur paiements à des tiers (prestataires, fournisseurs).",
    periodicity: "monthly", platform: "DIMANA",
    applicableIf: (p) => p.taxRegime === "ri" || p.taxRegime === "rs",
    applicableReason: () => "",
    requiredDocuments: ["Factures fournisseurs", "Paiements concernés"],
    requiredData: ["bases_retenue", "taux_retenue", "montant_retenue"],
    preControls: ["Tous les paiements > seuil ont une retenue"],
    paymentRequired: true, proofRequired: true,
    sourceVersion: "TOGO_2026_REFERENCE",
  },
  // ---- Acomptes ----
  {
    code: "ACOMPTES_IS", name: "Acomptes d'impôt (IS)", organism: "OTR", category: "FISCAL",
    description: "Acomptes trimestriels d'impôt sur les bénéfices.",
    periodicity: "quarterly", platform: "DIMANA",
    applicableIf: (p) => p.taxRegime === "ri",
    applicableReason: (p) => p.taxRegime === "ri" ? "" : "Régime non soumis à l'IS",
    requiredDocuments: ["Résultat fiscal de référence", "Acomptes antérieurs"],
    requiredData: ["resultat_fiscal_reference", "taux_acompte", "acomptes_payes"],
    preControls: ["Base acompte = résultat fiscal N-1"],
    paymentRequired: true, proofRequired: true,
    sourceVersion: "TOGO_2026_REFERENCE",
  },
  // ---- Impôt sur bénéfice ----
  {
    code: "IMPOT_BENEFICE", name: "Impôt sur le bénéfice (IB/IS)", organism: "OTR", category: "ANNUEL",
    description: "Détermination du résultat fiscal → calcul de l'impôt annuel.",
    periodicity: "annual", platform: "GUDEF",
    applicableIf: (p) => p.taxRegime === "ri",
    applicableReason: (p) => p.taxRegime === "ri" ? "" : "Régime non soumis à l'IS normal",
    requiredDocuments: ["Liasse fiscale", "Grand livre", "Balance", "Tableau des réintégrations"],
    requiredData: ["resultat_comptable", "reintegrations", "deductions", "deficits", "resultat_fiscal"],
    preControls: ["Résultat fiscal = résultat comptable + réintégrations − déductions", "Actif = Passif"],
    paymentRequired: true, proofRequired: true,
    sourceVersion: "TOGO_2026_REFERENCE",
  },
  // ---- Liasse fiscale ----
  {
    code: "LIASSE_FISCALE", name: "Liasse fiscale GUDEF", organism: "OTR", category: "ANNUEL",
    description: "États financiers + liasse fiscale (balance N/N-1 → Bilan, CR, notes).",
    periodicity: "annual", platform: "GUDEF",
    applicableIf: () => true,
    applicableReason: () => "",
    requiredDocuments: ["Balance N", "Balance N-1", "États financiers", "Notes annexes"],
    requiredData: ["balance_n", "balance_n1", "bilan", "compte_resultat", "notes"],
    preControls: ["Total Actif = Total Passif", "Résultat CR = Résultat passif", "Σ Débit = Σ Crédit"],
    paymentRequired: false, proofRequired: true,
    sourceVersion: "TOGO_2026_REFERENCE",
  },
  // ---- DAS ----
  {
    code: "DAS_ANNUELLE", name: "DAS — Déclaration Annuelle des Salaires", organism: "OTR", category: "ANNUEL",
    description: "Récapitulatif annuel des salaires versés (échéance : 31 janvier N+1).",
    periodicity: "annual", platform: "DIMANA",
    applicableIf: (p) => p.hasEmployees,
    applicableReason: (p) => p.hasEmployees ? "" : "Aucun salarié déclaré",
    requiredDocuments: ["Bulletins de paie (12 mois)", "État récapitulatif des salaires"],
    requiredData: ["salaries_annuel", "retenues_irpp", "cotisations_cnss", "total_net"],
    preControls: ["DAS = Σ paie annuelle", "DAS cohérente avec IRPP mensuel", "DAS cohérente avec CNSS"],
    paymentRequired: false, proofRequired: true,
    sourceVersion: "TOGO_2026_REFERENCE",
  },
  // ---- Paie mensuelle ----
  {
    code: "PAIE_MENSUELLE", name: "Paie mensuelle", organism: "OHADA", category: "EMPLOYEUR",
    description: "Calcul des bulletins de paie + écritures comptables + charges sociales.",
    periodicity: "monthly",
    applicableIf: (p) => p.hasEmployees,
    applicableReason: (p) => p.hasEmployees ? "" : "Aucun salarié déclaré",
    requiredDocuments: ["Tableau de pointage", "Données variables (heures, absences)"],
    requiredData: ["salaires_base", "primes", "retenues", "cnss", "irpp", "net_a_payer"],
    preControls: ["Σ brut = base CNSS + non assujetti", "Net = Brut − retenues"],
    paymentRequired: false, proofRequired: false,
    sourceVersion: "TOGO_2026_REFERENCE",
  },
  // ---- CNSS ----
  {
    code: "CNSS_MENSUELLE", name: "Déclaration CNSS mensuelle", organism: "CNSS", category: "SOCIAL",
    description: "Cotisations sociales (4% salarié + 17,5% employeur).",
    periodicity: "monthly",
    applicableIf: (p) => p.hasEmployees,
    applicableReason: (p) => p.hasEmployees ? "" : "Aucun salarié déclaré",
    requiredDocuments: ["État du personnel", "Bulletins de paie"],
    requiredData: ["base_cnss", "cotisation_salariale", "cotisation_patronale"],
    preControls: ["Base CNSS = base paie assujettie", "Effectif CNSS = effectif paie"],
    paymentRequired: true, proofRequired: true,
    sourceVersion: "TOGO_2026_REFERENCE",
  },
  // ---- AMU ----
  {
    code: "AMU_MENSUELLE", name: "Déclaration AMU mensuelle", organism: "AMU", category: "SOCIAL",
    description: "Cotisations Assurance Maladie Universelle (module séparé de la CNSS).",
    periodicity: "monthly",
    applicableIf: (p) => p.hasEmployees,
    applicableReason: (p) => p.hasEmployees ? "" : "Aucun salarié déclaré",
    requiredDocuments: ["État du personnel"],
    requiredData: ["base_amu", "cotisation_salariale_amu", "cotisation_patronale_amu"],
    preControls: ["Base AMU = base paie assujettie"],
    paymentRequired: true, proofRequired: true,
    sourceVersion: "TOGO_2026_REFERENCE",
  },
  // ---- TPU ----
  {
    code: "TPU", name: "Taxe Professionnelle Unique", organism: "OTR", category: "SECTORIEL",
    description: "Taxe professionnelle selon l'activité et le secteur.",
    periodicity: "annual",
    applicableIf: (p) => p.taxRegime === "rsmi" || p.taxRegime === "rs",
    applicableReason: (p) => (p.taxRegime === "rsmi" || p.taxRegime === "rs") ? "" : "Régime non soumis à la TPU",
    requiredDocuments: ["Déclaration d'activité", "Chiffre d'affaires"],
    requiredData: ["secteur", "ca_annuel", "zone"],
    preControls: ["CA cohérent avec comptabilité"],
    paymentRequired: true, proofRequired: true,
    sourceVersion: "TOGO_2026_REFERENCE",
  },
  // ---- TVM ----
  {
    code: "TVM", name: "Taxe sur les Véhicules à Moteur", organism: "OTR", category: "PATRIMOINE",
    description: "Taxe annuelle sur les véhicules (par catégorie).",
    periodicity: "annual",
    applicableIf: (p) => p.hasVehicles === true,
    applicableReason: (p) => p.hasVehicles ? "" : "Aucun véhicule déclaré",
    requiredDocuments: ["Cartes grises", "Liste des véhicules"],
    requiredData: ["vehicules", "categories"],
    preControls: ["Tous les véhicules ont une catégorie"],
    paymentRequired: true, proofRequired: true,
    sourceVersion: "TOGO_2026_REFERENCE",
  },
  // ---- Crédit TVA ----
  {
    code: "CREDIT_TVA", name: "Suivi crédit de TVA", organism: "OTR", category: "FISCAL",
    description: "Suivi du crédit de TVA reportable (déclarations antérieures).",
    periodicity: "monthly", platform: "DIMANA",
    applicableIf: (p) => p.vatPayer,
    applicableReason: (p) => p.vatPayer ? "" : "Non assujetti TVA",
    requiredDocuments: ["Déclarations TVA antérieures"],
    requiredData: ["credit_initial", "nouveau_credit", "credit_impute", "credit_restitue"],
    preControls: ["Crédit final = crédit initial + nouveau − imputations"],
    paymentRequired: false, proofRequired: false,
    sourceVersion: "TOGO_2026_REFERENCE",
  },
  // ---- États financiers ----
  {
    code: "ETATS_FINANCIERS", name: "États financiers annuels", organism: "OHADA", category: "ANNUEL",
    description: "Bilan + Compte de résultat + TFT + Notes annexes (SYSCOHADA révisé).",
    periodicity: "annual",
    applicableIf: () => true,
    applicableReason: () => "",
    requiredDocuments: ["Balance N", "Balance N-1", "Inventaire"],
    requiredData: ["bilan", "compte_resultat", "tft", "notes"],
    preControls: ["Total Actif = Total Passif", "Résultat CR = Résultat au passif", "Amortissements = immobilisations"],
    paymentRequired: false, proofRequired: true,
    sourceVersion: "TOGO_2026_REFERENCE",
  },
];

// ============================================================================
// MOTEUR D'ASSUJETTISSEMENT — Détermine quelles obligations s'appliquent
// ============================================================================
export interface AssujettissementResult {
  applicable: ObligationDef[];
  notApplicable: { obligation: ObligationDef; reason: string }[];
  total: number;
}

export function determineApplicableObligations(profile: CompanyProfile): AssujettissementResult {
  const applicable: ObligationDef[] = [];
  const notApplicable: { obligation: ObligationDef; reason: string }[] = [];
  for (const obl of OBLIGATION_CATALOG) {
    if (obl.applicableIf(profile)) {
      applicable.push(obl);
    } else {
      notApplicable.push({ obligation: obl, reason: obl.applicableReason(profile) });
    }
  }
  return { applicable, notApplicable, total: OBLIGATION_CATALOG.length };
}

// ============================================================================
// JOURS OUVRÉS ET JOURS FÉRIÉS (Togo)
// ============================================================================
// Fériés à date fixe. Les fêtes religieuses musulmanes (Aïd el-Fitr, Aïd
// el-Adha) suivent le calendrier lunaire : elles ne sont pas calculables ici et
// doivent être ajoutées chaque année par paramétrage — c'est écrit dans l'écran
// plutôt que deviné.
const FIXED_HOLIDAYS: [number, number, string][] = [
  [1, 1, "Nouvel An"],
  [1, 13, "Fête de la Libération"],
  [4, 27, "Fête de l'Indépendance"],
  [5, 1, "Fête du Travail"],
  [6, 21, "Journée des Martyrs"],
  [8, 15, "Assomption"],
  [11, 1, "Toussaint"],
  [12, 25, "Noël"],
];

/** Dimanche de Pâques (algorithme grégorien anonyme). */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

const isoOf = (d: Date): string => d.toISOString().slice(0, 10);

/** Jours fériés légaux d'une année, indexés par date ISO. */
export function togoHolidays(year: number): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [m, d, label] of FIXED_HOLIDAYS) {
    out[isoOf(new Date(Date.UTC(year, m - 1, d)))] = label;
  }
  const easter = easterSunday(year);
  const at = (offset: number) => isoOf(new Date(easter.getTime() + offset * 86400000));
  out[at(1)] = "Lundi de Pâques";
  out[at(39)] = "Ascension";
  out[at(50)] = "Lundi de Pentecôte";
  return out;
}

/** Vrai si la date (ISO) est un samedi, un dimanche ou un jour férié togolais. */
export function isNonWorkingDay(iso: string): boolean {
  const d = new Date(`${iso}T00:00:00Z`);
  const day = d.getUTCDay();
  if (day === 0 || day === 6) return true;
  return Boolean(togoHolidays(d.getUTCFullYear())[iso]);
}

/**
 * Report au jour ouvré suivant (règle de prorogation) : une échéance qui tombe
 * un samedi, un dimanche ou un jour férié est repoussée au premier jour ouvré.
 * Le motif est renvoyé pour être affiché, jamais silencieux.
 */
export function nextBusinessDay(iso: string): { date: string; reason: string | null } {
  let current = iso;
  let reason: string | null = null;
  for (let guard = 0; guard < 15; guard++) {
    const d = new Date(`${current}T00:00:00Z`);
    const day = d.getUTCDay();
    if (day === 6) reason = reason ?? "samedi";
    else if (day === 0) reason = reason ?? "dimanche";
    const holiday = togoHolidays(d.getUTCFullYear())[current];
    if (!isNonWorkingDay(current)) return { date: current, reason };
    if (holiday && !reason) reason = holiday;
    if (holiday && reason && reason !== holiday && reason !== "samedi" && reason !== "dimanche") {
      reason = `${reason}, ${holiday}`;
    }
    d.setUTCDate(d.getUTCDate() + 1);
    current = isoOf(d);
  }
  return { date: current, reason };
}

const isoDate = (year: number, month1: number, day: number): string => {
  // month1 est 1-based et peut déborder (13 = janvier N+1).
  const d = new Date(Date.UTC(year, month1 - 1, day));
  return isoOf(d);
};

/** Échéance mensuelle légale : le 15 du mois suivant, reportée si non ouvré. */
export function computeMonthlyDueDate(year: number, month: number): string {
  return nextBusinessDay(isoDate(year, month + 2, 15)).date;
}

/** Échéance trimestrielle légale : le 15 du mois suivant la fin du trimestre. */
export function computeQuarterlyDueDate(year: number, quarter: number): string {
  return nextBusinessDay(isoDate(year, quarter * 3 + 1, 15)).date;
}

/** Échéance annuelle : règle par code, puis report au jour ouvré. */
export function computeAnnualDueDate(code: string, year: number): string {
  if (code === "DAS_ANNUELLE") return nextBusinessDay(`${year + 1}-01-31`).date;
  if (code === "TPU" || code === "TVM") return nextBusinessDay(`${year}-03-31`).date;
  return nextBusinessDay(`${year + 1}-03-31`).date;
}

/** Motif de report d'une échéance légale, ou null si déjà ouvrée. */
export function prorogationReason(rawDate: string, finalDate: string): string | null {
  if (rawDate === finalDate) return null;
  return nextBusinessDay(rawDate).reason;
}

export interface GenerationOptions {
  /** Premier jour couvert (ISO). Par défaut : 1er du mois courant. */
  from?: string;
  /** Dernier jour couvert (ISO). Par défaut : 12 mois après `from`. */
  until?: string;
  /** Date de référence pour statuer « en retard ». */
  today?: string;
}

/**
 * Génère le calendrier réglementaire sur une **fenêtre glissante**.
 *
 * L'ancienne version générait les 12 mois de l'année civile, y compris les
 * échéances déjà passées : un dossier neuf affichait des dizaines de « en
 * retard » qui n'avaient jamais été dus. On ne génère plus que la fenêtre
 * demandée (12 mois par défaut), et le statut « en_retard » n'est posé que pour
 * une échéance réellement dépassée dans cette fenêtre.
 */
export function generateObligationInstances(
  companyId: string,
  companyName: string,
  profile: CompanyProfile,
  options: GenerationOptions | number = {},
): ObligationInstance[] {
  const opts: GenerationOptions = typeof options === "number" ? { from: `${options}-01-01`, until: `${options}-12-31` } : options;
  const now = new Date().toISOString();
  const todayIso = opts.today ?? now.slice(0, 10);

  const start = opts.from ? new Date(`${opts.from}T00:00:00Z`) : (() => {
    const d = new Date(`${todayIso}T00:00:00Z`);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  })();
  const end = opts.until
    ? new Date(`${opts.until}T00:00:00Z`)
    : new Date(Date.UTC(start.getUTCFullYear() + 1, start.getUTCMonth(), 0));

  const { applicable } = determineApplicableObligations(profile);
  const instances: ObligationInstance[] = [];
  const inWindow = (iso: string) => iso >= isoOf(start) && iso <= isoOf(end);

  const make = (
    obl: ObligationDef,
    id: string,
    periodLabel: string,
    rawDue: string,
    due: string,
    createdAt = now,
  ): ObligationInstance => {
    const reason = prorogationReason(rawDue, due);
    return {
      id: `${id}_${companyId}`,
      obligationCode: obl.code,
      obligationName: obl.name,
      organism: obl.organism,
      category: obl.category,
      companyId,
      companyName,
      periodLabel,
      dueDate: due,
      status: due < todayIso ? "en_retard" : "creee",
      assignedTo: null,
      amount: null,
      calculatedAmount: null,
      declarationId: null,
      receiptNumber: null,
      proofDocId: null,
      paymentRef: null,
      createdAt,
      prorogatedFrom: reason ? rawDue : null,
    };
  };

  for (const obl of applicable) {
    if (obl.periodicity === "monthly") {
      // On parcourt les mois de la fenêtre, un mois avant le début pour couvrir
      // l'échéance du mois précédent tombant dans la fenêtre.
      const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1));
      for (let guard = 0; guard < 36; guard++) {
        const y = cursor.getUTCFullYear();
        const m = cursor.getUTCMonth();
        const due = computeMonthlyDueDate(y, m);
        if (due > isoOf(end)) break;
        if (inWindow(due)) {
          const label = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m, 1)));
          instances.push(make(obl, `${obl.code}_${y}_${String(m + 1).padStart(2, "0")}`, label, isoDate(y, m + 2, 15), due));
        }
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
      }
    } else if (obl.periodicity === "quarterly") {
      const firstYear = start.getUTCFullYear() - 1;
      for (let year = firstYear; year <= end.getUTCFullYear(); year++) {
        for (let q = 1; q <= 4; q++) {
          const due = computeQuarterlyDueDate(year, q);
          if (due > isoOf(end)) continue;
          if (!inWindow(due)) continue;
          const rawMonth = q * 3 + 1;
          const raw = isoDate(year, rawMonth, 15);
          instances.push(make(obl, `${obl.code}_${year}_Q${q}`, `T${q} ${year}`, raw, due));
        }
      }
    } else if (obl.periodicity === "annual") {
      for (let year = start.getUTCFullYear() - 1; year <= end.getUTCFullYear(); year++) {
        const due = computeAnnualDueDate(obl.code, year);
        if (due > isoOf(end)) continue;
        if (!inWindow(due)) continue;
        const raw = obl.code === "DAS_ANNUELLE" ? `${year + 1}-01-31`
          : obl.code === "TPU" || obl.code === "TVM" ? `${year}-03-31`
          : `${year + 1}-03-31`;
        instances.push(make(obl, `${obl.code}_${year}`, `Exercice ${year}`, raw, due));
      }
    }
  }

  return instances.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.obligationCode.localeCompare(b.obligationCode));
}

export interface ObligationSummary {
  total: number;
  overdue: number;
  next30: number;
  byOrganism: Record<string, number>;
  prorogated: number;
  window: { from: string; to: string };
  /** Limites connues du calendrier, affichées telles quelles. */
  limits: string[];
}

export function summarizeObligations(
  instances: ObligationInstance[],
  opts: { today?: string; from?: string; until?: string } = {},
): ObligationSummary {
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  const limit = new Date(`${today}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + 30);
  const limitIso = limit.toISOString().slice(0, 10);
  const byOrganism: Record<string, number> = {};
  for (const i of instances) byOrganism[i.organism] = (byOrganism[i.organism] || 0) + 1;
  return {
    total: instances.length,
    overdue: instances.filter((i) => i.status === "en_retard").length,
    next30: instances.filter((i) => i.dueDate >= today && i.dueDate <= limitIso).length,
    byOrganism,
    prorogated: instances.filter((i) => i.prorogatedFrom).length,
    window: { from: opts.from ?? "—", to: opts.until ?? "—" },
    limits: [
      "Fêtes religieuses musulmanes (Aïd el-Fitr, Aïd el-Adha) non paramétrées : à saisir chaque année.",
      "Dates légales indicatives (15 du mois suivant, 31 mars, 31 janvier) : source TOGO_2026_REFERENCE, à valider avec un fiscaliste.",
      "Le statut « en retard » ne connaît pas les dépôts effectués hors plateforme.",
    ],
  };
}

/** Profil réglementaire dérivé d'une entreprise (assujettissements). */
export function companyProfileFrom(
  company: { legalForm: string; taxRegime: string; vatPayer: boolean; sector: string; capital: number },
  extras: { hasEmployees?: boolean; isTransporter?: boolean; hasVehicles?: boolean; hasRealEstateIncome?: boolean } = {},
): CompanyProfile {
  return {
    legalForm: company.legalForm,
    taxRegime: company.taxRegime,
    vatPayer: company.vatPayer,
    sector: company.sector,
    capital: company.capital,
    hasEmployees: extras.hasEmployees ?? false,
    isTransporter: extras.isTransporter,
    hasVehicles: extras.hasVehicles,
    hasRealEstateIncome: extras.hasRealEstateIncome,
  };
}
