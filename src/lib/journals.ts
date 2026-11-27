// ============================================================================
// FIMAAC — Catalogue des journaux comptables (SYSCOHADA révisé)
// Codes normalisés 3 lettres, conformes à la pratique des cabinets OHADA.
//
// MODIFICATION DES CODES (demande utilisateur) :
//   AC → ACH (Achats)      VT → VTE (Ventes)       BQ → BAQ (Banque)
//   SN → PAI (Paie)        OD → ODV (Opérations diverses)
//   + CAI (Caisse), RAN (Reports à nouveau), et 20+ autres journaux.
// ============================================================================

/** Catégories fonctionnelles de journaux (étendues à toute la pratique OHADA). */
export type JournalType =
  | "sales"           // Ventes
  | "purchases"       // Achats
  | "bank"            // Banque
  | "cash"            // Caisse
  | "misc"            // Opérations diverses
  | "wages"           // Paie / salaires
  | "fixed_assets"    // Immobilisations
  | "opening"         // À nouveau / ouverture
  | "closing"         // Clôture / inventaire
  | "cost"            // Cessions d'immobilisations
  | "stock"           // Stocks / inventaire
  | "tax"             // Fiscalité / TVA / impôts
  | "social"          // Social / organismes sociaux
  | "capital"         // Capital / associés
  | "loans"           // Emprunts & dettes financières
  | "provisions"      // Provisions & dépréciations
  | "expenses"        // Charges spécifiques (transferts de charges)
  | "accruals";       // Régularisations (charges/produits constatés d'avance)

/** Libellés lisibles des types de journaux. */
export const JOURNAL_TYPE_LABELS: Record<JournalType, string> = {
  sales: "Ventes",
  purchases: "Achats",
  bank: "Banque",
  cash: "Caisse",
  misc: "Opérations diverses",
  wages: "Paie & salaires",
  fixed_assets: "Immobilisations",
  opening: "À nouveau / ouverture",
  closing: "Clôture & inventaire",
  cost: "Cessions d'immobilisations",
  stock: "Stocks & inventaire",
  tax: "Fiscalité & TVA",
  social: "Social & organismes",
  capital: "Capital & associés",
  loans: "Emprunts & dettes financières",
  provisions: "Provisions & dépréciations",
  expenses: "Charges spécifiques",
  accruals: "Régularisations",
};

/** Regroupement visuel des journaux (pour l'UI). */
export const JOURNAL_GROUPS: { id: string; label: string; types: JournalType[] }[] = [
  { id: "commercial", label: "Opérations commerciales", types: ["sales", "purchases", "stock"] },
  { id: "tresorerie", label: "Trésorerie", types: ["bank", "cash"] },
  { id: "personnel", label: "Personnel & social", types: ["wages", "social"] },
  { id: "patrimoine", label: "Patrimoine", types: ["fixed_assets", "cost", "provisions", "loans", "capital"] },
  { id: "fiscal", label: "Fiscalité & clôture", types: ["tax", "accruals", "closing"] },
  { id: "divers", label: "Divers & reports", types: ["misc", "opening", "expenses"] },
];

/** Couleur par type (cohérence UI). */
export const JOURNAL_TYPE_COLORS: Record<JournalType, string> = {
  sales: "#10b981", purchases: "#6366f1", bank: "#0ea5e9", cash: "#f59e0b",
  misc: "#64748b", wages: "#ef4444", fixed_assets: "#8b5cf6", opening: "#94a3b8",
  closing: "#a855f7", cost: "#ec4899", stock: "#14b8a6", tax: "#f97316",
  social: "#e11d48", capital: "#3b82f6", loans: "#6366f1", provisions: "#f43f5e",
  expenses: "#71717a", accruals: "#eab308",
};

// ============================================================================
// CATALOGUE DES JOURNAUX — codes 3 lettres normalisés
// ============================================================================
export interface JournalDef {
  code: string;
  name: string;
  type: JournalType;
  /** Compte de contrepartie par défaut (banque, caisse, tiers…) — pour la saisie assistée. */
  defaultAccount?: string;
  /** Description pédagogique (aide au choix dans l'UI). */
  desc: string;
  /** Journal standard créé automatiquement à l'installation. */
  standard: boolean;
}

export const JOURNAL_CATALOG: JournalDef[] = [
  // ---- COMMERCIAL ----
  { code: "VTE", name: "Journal des ventes", type: "sales", defaultAccount: "4111", desc: "Factures de ventes de biens et services (classe 70 + TVA + clients)", standard: true },
  { code: "VTE-AV", name: "Journal des avoirs sur ventes", type: "sales", defaultAccount: "4111", desc: "Avoirs accordés aux clients (réductions, retours, erreurs)", standard: false },
  { code: "VTE-EX", name: "Journal des ventes à l'export", type: "sales", defaultAccount: "4115", desc: "Ventes hors zone OHADA — régime de TVA à l'export", standard: false },
  { code: "ACH", name: "Journal des achats", type: "purchases", defaultAccount: "4011", desc: "Factures d'achats de biens et services (classe 60 + TVA + fournisseurs)", standard: true },
  { code: "ACH-AV", name: "Journal des avoirs sur achats", type: "purchases", defaultAccount: "4011", desc: "Avoirs reçus des fournisseurs (réductions, retours)", standard: false },
  { code: "ACH-IM", name: "Journal des achats import", type: "purchases", defaultAccount: "4011", desc: "Achats hors zone — douane, transit, frais d'importation", standard: false },
  { code: "STK", name: "Journal des stocks", type: "stock", defaultAccount: "31", desc: "Entrées / sorties de stock, variations, inventaire périodique", standard: false },
  { code: "STK-INV", name: "Journal d'inventaire des stocks", type: "stock", defaultAccount: "31", desc: "Ajustement de stock à l'inventaire (variation + dépréciation)", standard: false },
  // ---- TRÉSORERIE ----
  { code: "BAQ", name: "Journal de banque", type: "bank", defaultAccount: "5211", desc: "Opérations par compte bancaire : virements, chèques, prélèvements, cartes", standard: true },
  { code: "BAQ-2", name: "Journal de banque B", type: "bank", defaultAccount: "5212", desc: "Second compte bancaire (multi-banques)", standard: false },
  { code: "CAI", name: "Journal de caisse", type: "cash", defaultAccount: "5711", desc: "Recettes et dépenses en espèces (petite caisse)", standard: true },
  { code: "CAI-2", name: "Journal de caisse succursale", type: "cash", defaultAccount: "5721", desc: "Caisse d'une succursale ou agence", standard: false },
  { code: "EFF", name: "Journal des effets de commerce", type: "bank", defaultAccount: "511", desc: "Traittraite, lettre de change, billet à ordre — effets à encaisser / à payer", standard: false },
  { code: "EFF-ESC", name: "Journal d'escompte d'effets", type: "bank", defaultAccount: "565", desc: "Escompte d'effets de commerce auprès de la banque", standard: false },
  { code: "TRF", name: "Journal des virements internes", type: "bank", defaultAccount: "585", desc: "Virements de fonds entre établissements ou comptes internes", standard: false },
  { code: "TRS", name: "Journal des transferts de trésorerie", type: "bank", defaultAccount: "585", desc: "Mouvements entre banques internes (585 - virements de fonds)", standard: false },
  // ---- PERSONNEL & SOCIAL ----
  { code: "PAI", name: "Journal des salaires", type: "wages", defaultAccount: "422", desc: "Paie : rémunérations, charges sociales, retenues, net à payer", standard: true },
  { code: "PAI-AV", name: "Journal des avances au personnel", type: "wages", defaultAccount: "4211", desc: "Avances et acomptes versés au personnel", standard: false },
  { code: "SOC", name: "Journal des organismes sociaux", type: "social", defaultAccount: "431", desc: "Déclarations et paiements CNSS, AMU, retraite, mutuelle", standard: false },
  { code: "SOC-ITS", name: "Journal des impôts sur salaires", type: "social", defaultAccount: "4472", desc: "ITS / TPA / TSPP — retenues à la source sur salaires", standard: false },
  // ---- PATRIMOINE ----
  { code: "IMM", name: "Journal des immobilisations", type: "fixed_assets", defaultAccount: "24", desc: "Acquisitions, cessions, mises en service d'immobilisations", standard: true },
  { code: "AMO", name: "Journal des amortissements", type: "fixed_assets", defaultAccount: "28", desc: "Dotations aux amortissements (comptes 681, 281-289)", standard: false },
  { code: "CES", name: "Journal des cessions d'immobilisations", type: "cost", defaultAccount: "822", desc: "Sorties du bilan + produits de cession (81 / 82)", standard: false },
  { code: "PRV", name: "Journal des provisions", type: "provisions", defaultAccount: "691", desc: "Dotations aux provisions et dépréciations (691, 49x)", standard: false },
  { code: "EMP", name: "Journal des emprunts", type: "loans", defaultAccount: "162", desc: "Emprunts, remboursements, intérêts courus", standard: false },
  { code: "CAP", name: "Journal du capital", type: "capital", defaultAccount: "1013", desc: "Constitutions, augmentations, réductions de capital", standard: false },
  { code: "ASS", name: "Journal des associés", type: "capital", defaultAccount: "462", desc: "Comptes courants d'associés, apports, dividendes", standard: false },
  // ---- FISCALITÉ & CLÔTURE ----
  { code: "TVA", name: "Journal de TVA", type: "tax", defaultAccount: "4431", desc: "Déclaration de TVA : collectée, récupérable, nette à payer", standard: false },
  { code: "IMP", name: "Journal des impôts", type: "tax", defaultAccount: "441", desc: "Impôts sur les bénéfices, acomptes, IMF, dégrèvements", standard: false },
  { code: "REG", name: "Journal des régularisations", type: "accruals", defaultAccount: "476", desc: "CCA, PCA, CAP, PAR — charges et produits constatés d'avance", standard: false },
  { code: "INV", name: "Journal d'inventaire (clôture)", type: "closing", defaultAccount: "120", desc: "Écritures de clôture : soldes, résultat, réports", standard: false },
  { code: "CLO", name: "Journal de clôture des comptes", type: "closing", defaultAccount: "120", desc: "Solde des comptes de gestion vers le résultat (à nouveau)", standard: false },
  // ---- DIVERS & REPORTS ----
  { code: "ODV", name: "Journal des opérations diverses", type: "misc", defaultAccount: "471", desc: "Opérations non classées : écarts, corrections, divers", standard: true },
  { code: "RAN", name: "Journal des reports à nouveau", type: "opening", defaultAccount: "120", desc: "Reports des résultats et soldes d'ouverture d'exercice", standard: true },
  { code: "OUV", name: "Journal d'ouverture", type: "opening", defaultAccount: "5211", desc: "Réouverture des comptes de bilan en début d'exercice", standard: false },
  { code: "TRC", name: "Journal des transferts de charges", type: "expenses", defaultAccount: "781", desc: "Transferts de charges d'exploitation ou financières (78x)", standard: false },
  { code: "HAO", name: "Journal des opérations HAO", type: "misc", defaultAccount: "83", desc: "Éléments hors activités ordinaires (classes 8)", standard: false },
  { code: "ECC", name: "Journal des écarts de conversion", type: "misc", defaultAccount: "478", desc: "Écarts de conversion actif / passif (devises)", standard: false },
  { code: "ENG", name: "Journal des engagements hors bilan", type: "misc", defaultAccount: "901", desc: "Engagements hors bilan (classe 9 — CAGE)", standard: false },
  { code: "ANA", name: "Journal analytique", type: "misc", defaultAccount: "94", desc: "Comptabilité analytique d'exploitation (CAGE)", standard: false },
];

/** Index par code — O(1). */
export const JOURNAL_BY_CODE: Map<string, JournalDef> = new Map(
  JOURNAL_CATALOG.map((j) => [j.code, j]),
);

/** Journaux standards (créés automatiquement). */
export const STANDARD_JOURNAL_CODES = JOURNAL_CATALOG.filter((j) => j.standard).map((j) => j.code);

/** Retrouve une définition par code. */
export function journalByCode(code: string): JournalDef | undefined {
  return JOURNAL_BY_CODE.get(code.toUpperCase());
}

/** Vérifie qu'un code de journal est conforme (3 lettres majuscules ou 3+2 avec tiret). */
export function isValidJournalCode(code: string): boolean {
  return /^[A-Z]{3,4}(-[A-Z0-9]{1,3})?$/.test(code.toUpperCase());
}
