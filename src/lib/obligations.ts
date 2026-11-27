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
// GÉNÉRATION DU CALENDRIER — Crée les instances d'obligations
// ============================================================================
export function generateObligationInstances(
  companyId: string,
  companyName: string,
  profile: CompanyProfile,
  year: number = new Date().getFullYear(),
): ObligationInstance[] {
  const { applicable } = determineApplicableObligations(profile);
  const instances: ObligationInstance[] = [];
  const now = new Date().toISOString();
  const today = new Date();

  for (const obl of applicable) {
    if (obl.periodicity === "monthly") {
      for (let month = 0; month < 12; month++) {
        const dueDate = computeMonthlyDueDate(year, month);
        instances.push({
          id: `${obl.code}_${year}_${String(month + 1).padStart(2, "0")}_${companyId}`,
          obligationCode: obl.code,
          obligationName: obl.name,
          organism: obl.organism,
          category: obl.category,
          companyId,
          companyName,
          periodLabel: new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date(year, month, 1)),
          dueDate,
          status: new Date(dueDate) < today ? "en_retard" : "creee",
          assignedTo: null,
          amount: null,
          calculatedAmount: null,
          declarationId: null,
          receiptNumber: null,
          proofDocId: null,
          paymentRef: null,
          createdAt: now,
        });
      }
    } else if (obl.periodicity === "quarterly") {
      for (let q = 1; q <= 4; q++) {
        const dueMonth = q * 3; // Fin de trimestre + délai
        const dueDate = `${year}-${String(Math.min(dueMonth + 1, 12)).padStart(2, "0")}-15`;
        instances.push({
          id: `${obl.code}_${year}_Q${q}_${companyId}`,
          obligationCode: obl.code,
          obligationName: obl.name,
          organism: obl.organism,
          category: obl.category,
          companyId,
          companyName,
          periodLabel: `T${q} ${year}`,
          dueDate,
          status: new Date(dueDate) < today ? "en_retard" : "creee",
          assignedTo: null, amount: null, calculatedAmount: null,
          declarationId: null, receiptNumber: null, proofDocId: null, paymentRef: null,
          createdAt: now,
        });
      }
    } else if (obl.periodicity === "annual") {
      const dueDate = computeAnnualDueDate(obl.code, year);
      instances.push({
        id: `${obl.code}_${year}_${companyId}`,
        obligationCode: obl.code,
        obligationName: obl.name,
        organism: obl.organism,
        category: obl.category,
        companyId,
        companyName,
        periodLabel: `Exercice ${year}`,
        dueDate,
        status: new Date(dueDate) < today ? "en_retard" : "creee",
        assignedTo: null, amount: null, calculatedAmount: null,
        declarationId: null, receiptNumber: null, proofDocId: null, paymentRef: null,
        createdAt: now,
      });
    }
  }

  return instances.sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate));
}

/** Calcule la date d'échéance d'une obligation mensuelle. */
function computeMonthlyDueDate(year: number, month: number): string {
  // Règle générale : déclaration du mois M est due le 15 du mois M+1
  // ⚠️ Les dates exactes doivent être paramétrées dans le Regulatory Engine
  const nextMonth = month + 1;
  const dueYear = nextMonth > 11 ? year + 1 : year;
  const dueMonth = nextMonth > 11 ? 0 : nextMonth;
  return `${dueYear}-${String(dueMonth + 1).padStart(2, "0")}-15`;
}

/** Calcule la date d'échéance d'une obligation annuelle. */
function computeAnnualDueDate(code: string, year: number): string {
  // Règles indicatives — À VÉRIFIER dans le Cahier fiscal 2026
  if (code === "DAS_ANNUELLE") return `${year + 1}-01-31`; // 31 janvier N+1
  if (code === "LIASSE_FISCALE" || code === "IMPOT_BENEFICE" || code === "ETATS_FINANCIERS") return `${year + 1}-03-31`;
  if (code === "TPU" || code === "TVM") return `${year}-03-31`;
  return `${year + 1}-03-31`; // défaut
}
