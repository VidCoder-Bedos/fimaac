// ============================================================================
// FIMAAC — Catalogue des modèles d'écritures (SYSCOHADA révisé)
// Chaque modèle est équilibré (Σ débit = Σ crédit) et prêt à l'emploi.
// Les comptes renvoient au plan SYSCOHADA officiel (chart.ts).
//
// Usage : seed (modèles de démonstration) + création dans l'UI (bibliothèque).
// ============================================================================
import type { JournalType } from "./journals";

/** Ligne d'un modèle d'écriture. */
export interface TemplateLineDef {
  accountId: string;
  label: string;
  debit: number;
  credit: number;
  /** Le montant est-il variable à la saisie ? */
  variable?: boolean;
  /** Compte de tiers attendu (collectif) — pour l'assistant de saisie. */
  tierType?: "customer" | "supplier" | null;
}

export interface TemplateDef {
  id: string;
  name: string;
  /** Code de journal recommandé (cf. journals.ts). */
  journalCode: string;
  journalType: JournalType;
  category: string;
  description: string;
  lines: TemplateLineDef[];
  /** Récurrence recommandée pour la génération automatique. */
  recurring: "none" | "monthly" | "quarterly" | "yearly";
  /** Modèle standard (créé au seed). */
  standard: boolean;
  /** Référence réglementaire ou comptable (traçabilité). */
  ref?: string;
}

// ============================================================================
// CATEGORIES
// ============================================================================
export const TEMPLATE_CATEGORIES: { id: string; label: string; icon: string }[] = [
  { id: "ventes", label: "Ventes & clients", icon: "💵" },
  { id: "achats", label: "Achats & fournisseurs", icon: "🧾" },
  { id: "tresorerie", label: "Trésorerie & banque", icon: "🏦" },
  { id: "paie", label: "Paie & social", icon: "👥" },
  { id: "immobilisations", label: "Immobilisations", icon: "🏗️" },
  { id: "stocks", label: "Stocks & inventaire", icon: "📦" },
  { id: "fiscal", label: "Fiscalité & déclarations", icon: "📋" },
  { id: "cloture", label: "Clôture & régularisations", icon: "🔒" },
  { id: "financement", label: "Financement & capital", icon: "🤝" },
  { id: "divers", label: "Divers & corrections", icon: "📄" },
];

// ============================================================================
// CATALOGUE — ~40 modèles couvrant les opérations courantes OHADA
// ============================================================================
export const TEMPLATE_CATALOG: TemplateDef[] = [
  // ==========================================================================
  // VENTES & CLIENTS
  // ==========================================================================
  {
    id: "tpl-vente-services", name: "Facture de services (TVA 18 %)", journalCode: "VTE", journalType: "sales",
    category: "ventes", recurring: "monthly", standard: true,
    description: "Prestation de services vendue dans la Région, TVA 18 % au taux normal.",
    ref: "SYSCOHADA 706 + 4431 + 4111",
    lines: [
      { accountId: "4111", label: "Client (désignation)", debit: 1180000, credit: 0, variable: true, tierType: "customer" },
      { accountId: "7061", label: "Services vendus — dans la Région", debit: 0, credit: 1000000, variable: true },
      { accountId: "4431", label: "TVA facturée sur ventes (18 %)", debit: 0, credit: 180000, variable: true },
    ],
  },
  {
    id: "tpl-vente-marchandises", name: "Facture de marchandises (TVA 18 %)", journalCode: "VTE", journalType: "sales",
    category: "ventes", recurring: "none", standard: true,
    description: "Vente de marchandises dans la Région.",
    ref: "SYSCOHADA 701 + 4431 + 4111",
    lines: [
      { accountId: "4111", label: "Client", debit: 590000, credit: 0, variable: true, tierType: "customer" },
      { accountId: "7011", label: "Ventes de marchandises — dans la Région", debit: 0, credit: 500000, variable: true },
      { accountId: "4431", label: "TVA facturée sur ventes (18 %)", debit: 0, credit: 90000, variable: true },
    ],
  },
  {
    id: "tpl-avoir-client", name: "Avoir client (réduction)", journalCode: "VTE-AV", journalType: "sales",
    category: "ventes", recurring: "none", standard: true,
    description: "Avoir accordé au client — réduction ou retour de marchandise.",
    ref: "SYSCOHADA 709 / 4431 / 4111",
    lines: [
      { accountId: "709", label: "Réductions sur ventes / avoir", debit: 500000, credit: 0, variable: true },
      { accountId: "4431", label: "TVA facturée (contrepassation)", debit: 90000, credit: 0, variable: true },
      { accountId: "4111", label: "Client", debit: 0, credit: 590000, variable: true, tierType: "customer" },
    ],
  },
  {
    id: "tpl-vente-export", name: "Vente à l'export (TVA 0 %)", journalCode: "VTE-EX", journalType: "sales",
    category: "ventes", recurring: "none", standard: false,
    description: "Vente hors zone OHADA — TVA exonérée à l'export.",
    ref: "SYSCOHADA 7012 + 4115",
    lines: [
      { accountId: "4115", label: "Client hors Région / organisme international", debit: 1000000, credit: 0, variable: true, tierType: "customer" },
      { accountId: "7012", label: "Ventes de marchandises — hors Région", debit: 0, credit: 1000000, variable: true },
    ],
  },
  {
    id: "tpl-encaissement-client", name: "Encaissement client (virement)", journalCode: "BAQ", journalType: "bank",
    category: "tresorerie", recurring: "none", standard: true,
    description: "Encaissement d'une créance client par virement bancaire.",
    lines: [
      { accountId: "5211", label: "Banques locales", debit: 1180000, credit: 0, variable: true },
      { accountId: "4111", label: "Client (encaissement)", debit: 0, credit: 1180000, variable: true, tierType: "customer" },
    ],
  },
  {
    id: "tpl-imputation-avance", name: "Imputation d'une avance client sur facture", journalCode: "ODV", journalType: "misc",
    category: "ventes", recurring: "none", standard: false,
    description: "Compense une avance client (4191) avec une facture émise (4111) — lettrage inter-comptes clients.",
    ref: "SYSCOHADA 4191 + 4111",
    lines: [
      { accountId: "4191", label: "Clients, avances et acomptes reçus", debit: 590000, credit: 0, variable: true },
      { accountId: "4111", label: "Clients (facture à imputer)", debit: 0, credit: 590000, variable: true, tierType: "customer" },
    ],
  },
  // ==========================================================================
  // ACHATS & FOURNISSEURS
  // ==========================================================================
  {
    id: "tpl-achat-marchandises", name: "Achat de marchandises (TVA 18 %)", journalCode: "ACH", journalType: "purchases",
    category: "achats", recurring: "monthly", standard: true,
    description: "Achat de marchandises dans la Région avec TVA récupérable.",
    ref: "SYSCOHADA 6011 + 4452 + 4011",
    lines: [
      { accountId: "6011", label: "Achats de marchandises — dans la Région", debit: 500000, credit: 0, variable: true },
      { accountId: "4452", label: "TVA récupérable sur achats (18 %)", debit: 90000, credit: 0, variable: true },
      { accountId: "4011", label: "Fournisseur", debit: 0, credit: 590000, variable: true, tierType: "supplier" },
    ],
  },
  {
    id: "tpl-achat-services", name: "Achat de prestations (sous-traitance)", journalCode: "ACH", journalType: "purchases",
    category: "achats", recurring: "monthly", standard: true,
    description: "Achat de sous-traitance générale ou prestation intellectuelle.",
    ref: "SYSCOHADA 621 + 4452 + 4011",
    lines: [
      { accountId: "621", label: "Sous-traitance générale", debit: 300000, credit: 0, variable: true },
      { accountId: "4452", label: "TVA récupérable sur services (18 %)", debit: 54000, credit: 0, variable: true },
      { accountId: "4011", label: "Fournisseur", debit: 0, credit: 354000, variable: true, tierType: "supplier" },
    ],
  },
  {
    id: "tpl-achat-loyer", name: "Loyer des locaux", journalCode: "ACH", journalType: "purchases",
    category: "achats", recurring: "monthly", standard: true,
    description: "Loyer mensuel des bâtiments ou bureaux loués.",
    ref: "SYSCOHADA 6222",
    lines: [
      { accountId: "6222", label: "Locations de bâtiments", debit: 250000, credit: 0, variable: true },
      { accountId: "4011", label: "Fournisseur (bailleur)", debit: 0, credit: 250000, variable: true, tierType: "supplier" },
    ],
  },
  {
    id: "tpl-avoir-fournisseur", name: "Avoir fournisseur", journalCode: "ACH-AV", journalType: "purchases",
    category: "achats", recurring: "none", standard: true,
    description: "Avoir reçu du fournisseur — réduction ou retour.",
    lines: [
      { accountId: "4011", label: "Fournisseur", debit: 590000, credit: 0, variable: true, tierType: "supplier" },
      { accountId: "609", label: "Rabais, remises, ristournes obtenus", debit: 0, credit: 500000, variable: true },
      { accountId: "4452", label: "TVA récupérable (contrepassation)", debit: 0, credit: 90000, variable: true },
    ],
  },
  {
    id: "tpl-reglement-fournisseur", name: "Règlement fournisseur (virement)", journalCode: "BAQ", journalType: "bank",
    category: "tresorerie", recurring: "none", standard: true,
    description: "Paiement d'une dette fournisseur par virement bancaire.",
    lines: [
      { accountId: "4011", label: "Fournisseur (règlement)", debit: 590000, credit: 0, variable: true, tierType: "supplier" },
      { accountId: "5211", label: "Banques locales", debit: 0, credit: 590000, variable: true },
    ],
  },
  {
    id: "tpl-achat-impot", name: "Achat avec frais d'import (douane)", journalCode: "ACH-IM", journalType: "purchases",
    category: "achats", recurring: "none", standard: false,
    description: "Achat hors Région : marchandises + droits de douane + TVA.",
    ref: "SYSCOHADA 6012 + 4426 + 4452 + 4011",
    lines: [
      { accountId: "6012", label: "Achats de marchandises — hors Région", debit: 1000000, credit: 0, variable: true },
      { accountId: "4426", label: "Droits de douane", debit: 100000, credit: 0, variable: true },
      { accountId: "4452", label: "TVA récupérable sur achats", debit: 198000, credit: 0, variable: true },
      { accountId: "4011", label: "Fournisseur / transitaire", debit: 0, credit: 1298000, variable: true, tierType: "supplier" },
    ],
  },
  // ==========================================================================
  // TRÉSORERIE & BANQUE
  // ==========================================================================
  {
    id: "tpl-retrait-caisse", name: "Retrait d'espèces (banque → caisse)", journalCode: "BAQ", journalType: "bank",
    category: "tresorerie", recurring: "none", standard: true,
    description: "Alimentation de la petite caisse depuis le compte bancaire.",
    lines: [
      { accountId: "5711", label: "Caisse siège social (en unités monétaires légales)", debit: 200000, credit: 0, variable: true },
      { accountId: "5211", label: "Banques locales", debit: 0, credit: 200000, variable: true },
    ],
  },
  {
    id: "tpl-depot-banque", name: "Déposit d'espèces en banque", journalCode: "CAI", journalType: "cash",
    category: "tresorerie", recurring: "none", standard: false,
    description: "Dépose des espèces de caisse au compte bancaire.",
    lines: [
      { accountId: "5211", label: "Banques locales", debit: 200000, credit: 0, variable: true },
      { accountId: "5711", label: "Caisse siège social", debit: 0, credit: 200000, variable: true },
    ],
  },
  {
    id: "tpl-frais-bancaires", name: "Frais bancaires et commissions", journalCode: "BAQ", journalType: "bank",
    category: "tresorerie", recurring: "monthly", standard: true,
    description: "Commissions, frais de tenue de compte, frais sur effets.",
    ref: "SYSCOHADA 6311 + 6745",
    lines: [
      { accountId: "6318", label: "Autres frais bancaires", debit: 25000, credit: 0, variable: true },
      { accountId: "5211", label: "Banques locales", debit: 0, credit: 25000, variable: true },
    ],
  },
  {
    id: "tpl-virement-intern", name: "Virement interne entre comptes", journalCode: "TRF", journalType: "bank",
    category: "tresorerie", recurring: "none", standard: false,
    description: "Transfert de fonds entre deux comptes bancaires internes.",
    lines: [
      { accountId: "5212", label: "Banque B (débit)", debit: 500000, credit: 0, variable: true },
      { accountId: "5211", label: "Banque A (crédit)", debit: 0, credit: 500000, variable: true },
    ],
  },
  {
    id: "tpl-interets-bancaires", name: "Intérêts bancaires produits", journalCode: "BAQ", journalType: "bank",
    category: "tresorerie", recurring: "none", standard: false,
    description: "Intérêts créditeurs versés par la banque.",
    ref: "SYSCOHADA 774",
    lines: [
      { accountId: "5211", label: "Banques locales", debit: 15000, credit: 0, variable: true },
      { accountId: "774", label: "Revenus de titres de placement", debit: 0, credit: 15000, variable: true },
    ],
  },
  // ==========================================================================
  // PAIE & SOCIAL
  // ==========================================================================
  {
    id: "tpl-paie-complete", name: "Paie mensuelle complète", journalCode: "PAI", journalType: "wages",
    category: "paie", recurring: "monthly", standard: true,
    description: "Rémunérations + charges patronales + retenues + net à payer (CNSS 4 % / 17,5 % plafonnés à 300 000).",
    ref: "SYSCOHADA 6611 + 6641 + 4311 + 4472 + 422",
    lines: [
      { accountId: "6611", label: "Appointements, salaires et commissions", debit: 880000, credit: 0, variable: true },
      { accountId: "6641", label: "Charges sociales patronales (CNSS)", debit: 52500, credit: 0, variable: true },
      { accountId: "4311", label: "Sécurité sociale — cotisations (CNSS)", debit: 0, credit: 64500, variable: true },
      { accountId: "4472", label: "Impôts sur salaires (retenue à la source)", debit: 0, credit: 44000, variable: true },
      { accountId: "422", label: "Personnel, rémunérations dues (net)", debit: 0, credit: 824000, variable: true },
    ],
  },
  {
    id: "tpl-paiement-salaires", name: "Paiement des salaires (virement)", journalCode: "BAQ", journalType: "bank",
    category: "paie", recurring: "monthly", standard: true,
    description: "Versement du net au personnel par virement bancaire.",
    lines: [
      { accountId: "422", label: "Personnel, rémunérations dues", debit: 824000, credit: 0, variable: true },
      { accountId: "5211", label: "Banques locales", debit: 0, credit: 824000, variable: true },
    ],
  },
  {
    id: "tpl-cnss", name: "Déclaration & paiement CNSS", journalCode: "SOC", journalType: "social",
    category: "paie", recurring: "monthly", standard: true,
    description: "Versement des cotisations CNSS (salarié + patronal).",
    ref: "SYSCOHADA 4311",
    lines: [
      { accountId: "4311", label: "Sécurité sociale — cotisations (CNSS)", debit: 64500, credit: 0, variable: true },
      { accountId: "5211", label: "Banques locales", debit: 0, credit: 64500, variable: true },
    ],
  },
  {
    id: "tpl-its", name: "Paiement ITS / impôts sur salaires", journalCode: "SOC-ITS", journalType: "social",
    category: "paie", recurring: "monthly", standard: true,
    description: "Versement de la retenue à la source sur salaires (TPA/TSPP).",
    ref: "SYSCOHADA 4472",
    lines: [
      { accountId: "4472", label: "Impôts sur salaires (retenue à la source)", debit: 44000, credit: 0, variable: true },
      { accountId: "5211", label: "Banques locales", debit: 0, credit: 44000, variable: true },
    ],
  },
  {
    id: "tpl-avance-personnel", name: "Avance sur salaire", journalCode: "PAI-AV", journalType: "wages",
    category: "paie", recurring: "none", standard: false,
    description: "Avance ou acompte versé au personnel.",
    lines: [
      { accountId: "4211", label: "Personnel, avances", debit: 100000, credit: 0, variable: true },
      { accountId: "5211", label: "Banques locales", debit: 0, credit: 100000, variable: true },
    ],
  },
  // ==========================================================================
  // IMMOBILISATIONS
  // ==========================================================================
  {
    id: "tpl-acquisition-immo", name: "Acquisition d'immobilisation (TVA 18 %)", journalCode: "IMM", journalType: "fixed_assets",
    category: "immobilisations", recurring: "none", standard: true,
    description: "Acquisition d'une immobilisation corporelle avec TVA récupérable.",
    ref: "SYSCOHADA 24x + 4451 + 5211",
    lines: [
      { accountId: "2442", label: "Matériel informatique", debit: 3200000, credit: 0, variable: true },
      { accountId: "4451", label: "TVA récupérable sur immobilisations", debit: 576000, credit: 0, variable: true },
      { accountId: "4011", label: "Fournisseur d'investissements", debit: 0, credit: 3776000, variable: true, tierType: "supplier" },
    ],
  },
  {
    id: "tpl-amortissement", name: "Dotation aux amortissements", journalCode: "AMO", journalType: "fixed_assets",
    category: "immobilisations", recurring: "yearly", standard: true,
    description: "Dotation annuelle aux amortissements (linéaire).",
    ref: "SYSCOHADA 6813 + 284x",
    lines: [
      { accountId: "6813", label: "Dotations aux amortissements des immobilisations corporelles", debit: 320000, credit: 0, variable: true },
      { accountId: "2842", label: "Amortissements du matériel informatique", debit: 0, credit: 320000, variable: true },
    ],
  },
  {
    id: "tpl-cession-immo", name: "Cession d'immobilisation (sortie + produit)", journalCode: "CES", journalType: "cost",
    category: "immobilisations", recurring: "none", standard: true,
    description: "Sortie du bilan (VNC) + amortissement cumulé + produit de cession.",
    ref: "SYSCOHADA 812 + 284x + 244x + 822",
    lines: [
      { accountId: "2842", label: "Amortissements du matériel (sortie)", debit: 320000, credit: 0, variable: true },
      { accountId: "812", label: "Valeurs comptables des cessions — immobilisations corporelles", debit: 400000, credit: 0, variable: true },
      { accountId: "2442", label: "Matériel informatique (sortie)", debit: 0, credit: 720000, variable: true },
    ],
  },
  {
    id: "tpl-encaissement-cession", name: "Encaissement du produit de cession", journalCode: "BAQ", journalType: "bank",
    category: "immobilisations", recurring: "none", standard: false,
    description: "Encaissement du prix de cession d'une immobilisation.",
    lines: [
      { accountId: "5211", label: "Banques locales", debit: 450000, credit: 0, variable: true },
      { accountId: "822", label: "Produits des cessions d'immobilisations corporelles", debit: 0, credit: 450000, variable: true },
    ],
  },
  {
    id: "tpl-provision-creance", name: "Provision dépréciation créance", journalCode: "PRV", journalType: "provisions",
    category: "immobilisations", recurring: "yearly", standard: true,
    description: "Dépréciation d'une créance client douteuse.",
    ref: "SYSCOHADA 6594 + 4912",
    lines: [
      { accountId: "6594", label: "Charges provisionnées sur créances", debit: 180000, credit: 0, variable: true },
      { accountId: "4912", label: "Dépréciations des créances douteuses", debit: 0, credit: 180000, variable: true },
    ],
  },
  // ==========================================================================
  // STOCKS & INVENTAIRE
  // ==========================================================================
  {
    id: "tpl-entree-stock", name: "Entrée en stock (achats stockés)", journalCode: "STK", journalType: "stock",
    category: "stocks", recurring: "none", standard: false,
    description: "Entrée de marchandises en stock.",
    lines: [
      { accountId: "31", label: "Stocks de marchandises", debit: 500000, credit: 0, variable: true },
      { accountId: "6031", label: "Variations des stocks de marchandises", debit: 0, credit: 500000, variable: true },
    ],
  },
  {
    id: "tpl-sortie-stock", name: "Sortie de stock (coût d'achat vendu)", journalCode: "STK", journalType: "stock",
    category: "stocks", recurring: "none", standard: false,
    description: "Sortie de stock — coût d'achat des marchandises vendues.",
    lines: [
      { accountId: "6031", label: "Variations des stocks de marchandises", debit: 500000, credit: 0, variable: true },
      { accountId: "31", label: "Stocks de marchandises", debit: 0, credit: 500000, variable: true },
    ],
  },
  {
    id: "tpl-depreciation-stock", name: "Dépréciation des stocks", journalCode: "STK-INV", journalType: "stock",
    category: "stocks", recurring: "yearly", standard: false,
    description: "Dépréciation à l'inventaire (stocks périmés ou dévalorisés).",
    lines: [
      { accountId: "6593", label: "Charges provisionnées sur stocks", debit: 50000, credit: 0, variable: true },
      { accountId: "391", label: "Dépréciations des stocks de marchandises", debit: 0, credit: 50000, variable: true },
    ],
  },
  // ==========================================================================
  // FISCALITÉ
  // ==========================================================================
  {
    id: "tpl-tva-mensuelle", name: "Déclaration TVA mensuelle", journalCode: "TVA", journalType: "tax",
    category: "fiscal", recurring: "monthly", standard: true,
    description: "TVA collectée − TVA récupérable = TVA nette à payer.",
    ref: "SYSCOHADA 4431 + 4452 + 4441",
    lines: [
      { accountId: "4431", label: "TVA facturée sur ventes (collectée)", debit: 180000, credit: 0, variable: true },
      { accountId: "4452", label: "TVA récupérable sur achats", debit: 0, credit: 90000, variable: true },
      { accountId: "4441", label: "État, TVA due", debit: 0, credit: 90000, variable: true },
    ],
  },
  {
    id: "tpl-paiement-tva", name: "Paiement de la TVA due", journalCode: "BAQ", journalType: "bank",
    category: "fiscal", recurring: "monthly", standard: true,
    description: "Versement de la TVA nette à l'État.",
    lines: [
      { accountId: "4441", label: "État, TVA due", debit: 90000, credit: 0, variable: true },
      { accountId: "5211", label: "Banques locales", debit: 0, credit: 90000, variable: true },
    ],
  },
  {
    id: "tpl-acompte-is", name: "Acompte IS (trimestriel)", journalCode: "IMP", journalType: "tax",
    category: "fiscal", recurring: "quarterly", standard: true,
    description: "Acompte d'impôt sur les bénéfices versé à l'État.",
    lines: [
      { accountId: "441", label: "État, impôt sur les bénéfices", debit: 520000, credit: 0, variable: true },
      { accountId: "5211", label: "Banques locales", debit: 0, credit: 520000, variable: true },
    ],
  },
  {
    id: "tpl-impot-taxe", name: "Impôts et taxes (TPA / TFE)", journalCode: "IMP", journalType: "tax",
    category: "fiscal", recurring: "yearly", standard: false,
    description: "Impôts et taxes d'exploitation (patente, TFE, taxes diverses).",
    ref: "SYSCOHADA 6412",
    lines: [
      { accountId: "6412", label: "Patentes, licences et taxes annexes", debit: 150000, credit: 0, variable: true },
      { accountId: "4421", label: "Impôts et taxes d'État", debit: 0, credit: 150000, variable: true },
    ],
  },
  // ==========================================================================
  // CLÔTURE & RÉGULARISATIONS
  // ==========================================================================
  {
    id: "tpl-cca", name: "Charges constatées d'avance (CCA)", journalCode: "REG", journalType: "accruals",
    category: "cloture", recurring: "yearly", standard: true,
    description: "Charge payée d'avance — régularisation de clôture.",
    ref: "SYSCOHADA 476",
    lines: [
      { accountId: "476", label: "Charges constatées d'avance", debit: 125000, credit: 0, variable: true },
      { accountId: "6222", label: "Locations de bâtiments", debit: 0, credit: 125000, variable: true },
    ],
  },
  {
    id: "tpl-pca", name: "Produits constatés d'avance (PCA)", journalCode: "REG", journalType: "accruals",
    category: "cloture", recurring: "yearly", standard: true,
    description: "Produit reçu d'avance — régularisation de clôture.",
    ref: "SYSCOHADA 477",
    lines: [
      { accountId: "7061", label: "Services vendus", debit: 200000, credit: 0, variable: true },
      { accountId: "477", label: "Produits constatés d'avance", debit: 0, credit: 200000, variable: true },
    ],
  },
  {
    id: "tpl-cap", name: "Charges à payer (CAP)", journalCode: "REG", journalType: "accruals",
    category: "cloture", recurring: "yearly", standard: true,
    description: "Facture non parvenue — charge à payer à la clôture.",
    ref: "SYSCOHADA 4081",
    lines: [
      { accountId: "6222", label: "Locations de bâtiments", debit: 250000, credit: 0, variable: true },
      { accountId: "4081", label: "Fournisseurs, factures non parvenues", debit: 0, credit: 250000, variable: true },
    ],
  },
  {
    id: "tpl-par", name: "Produits à recevoir (PAR)", journalCode: "REG", journalType: "accruals",
    category: "cloture", recurring: "yearly", standard: true,
    description: "Produit acquis non facturé — produit à recevoir.",
    ref: "SYSCOHADA 4181",
    lines: [
      { accountId: "4181", label: "Clients, factures à établir", debit: 300000, credit: 0, variable: true },
      { accountId: "7061", label: "Services vendus", debit: 0, credit: 300000, variable: true },
    ],
  },
  {
    id: "tpl-cloture-resultat", name: "Clôture — virer le résultat au bilan", journalCode: "CLO", journalType: "closing",
    category: "cloture", recurring: "yearly", standard: true,
    description: "Soldes des comptes de gestion vers le compte de résultat (bénéfice).",
    ref: "SYSCOHADA 120 / 131",
    lines: [
      { accountId: "131", label: "Résultat net : Bénéfice", debit: 479805, credit: 0, variable: true },
      { accountId: "120", label: "Résultat en instance d'affectation", debit: 0, credit: 479805, variable: true },
    ],
  },
  {
    id: "tpl-reports-nouveau", name: "Reports à nouveau (ouverture)", journalCode: "RAN", journalType: "opening",
    category: "cloture", recurring: "yearly", standard: true,
    description: "Report du résultat de l'exercice précédent en début d'exercice.",
    ref: "SYSCOHADA 110 / 120",
    lines: [
      { accountId: "120", label: "Résultat en instance d'affectation (N-1)", debit: 479805, credit: 0, variable: true },
      { accountId: "110", label: "Report à nouveau (créditeur)", debit: 0, credit: 479805, variable: true },
    ],
  },
  // ==========================================================================
  // FINANCEMENT & CAPITAL
  // ==========================================================================
  {
    id: "tpl-capital-social", name: "Constitution du capital social", journalCode: "CAP", journalType: "capital",
    category: "financement", recurring: "none", standard: true,
    description: "Apport en numéraire à la constitution ou augmentation de capital.",
    ref: "SYSCOHADA 1013 + 5211",
    lines: [
      { accountId: "5211", label: "Banques locales", debit: 5000000, credit: 0, variable: true },
      { accountId: "1013", label: "Capital souscrit, appelé, versé, non amorti", debit: 0, credit: 5000000, variable: true },
    ],
  },
  {
    id: "tpl-emprunt", name: "Emprunt bancaire", journalCode: "EMP", journalType: "loans",
    category: "financement", recurring: "none", standard: true,
    description: "Réception du capital emprunté.",
    ref: "SYSCOHADA 162 + 5211",
    lines: [
      { accountId: "5211", label: "Banques locales", debit: 4000000, credit: 0, variable: true },
      { accountId: "162", label: "Emprunts auprès des établissements de crédit", debit: 0, credit: 4000000, variable: true },
    ],
  },
  {
    id: "tpl-remboursement-emprunt", name: "Remboursement d'emprunt (capital + intérêts)", journalCode: "BAQ", journalType: "bank",
    category: "financement", recurring: "monthly", standard: false,
    description: "Annuité d'emprunt : remboursement du capital + frais financiers.",
    ref: "SYSCOHADA 162 + 6712 + 5211",
    lines: [
      { accountId: "162", label: "Emprunts auprès des établissements de crédit", debit: 80000, credit: 0, variable: true },
      { accountId: "6712", label: "Intérêts des emprunts", debit: 40000, credit: 0, variable: true },
      { accountId: "5211", label: "Banques locales", debit: 0, credit: 120000, variable: true },
    ],
  },
  {
    id: "tpl-dividende", name: "Dividendes à payer", journalCode: "ASS", journalType: "capital",
    category: "financement", recurring: "yearly", standard: false,
    description: "Mise en paiement des dividendes aux associés.",
    ref: "SYSCOHADA 465",
    lines: [
      { accountId: "120", label: "Résultat en instance d'affectation", debit: 500000, credit: 0, variable: true },
      { accountId: "465", label: "Associés, dividendes à payer", debit: 0, credit: 500000, variable: true },
    ],
  },
  {
    id: "tpl-compte-courant-associe", name: "Apport en compte courant d'associé", journalCode: "ASS", journalType: "capital",
    category: "financement", recurring: "none", standard: false,
    description: "Avance en compte courant d'un associé.",
    ref: "SYSCOHADA 4621",
    lines: [
      { accountId: "5211", label: "Banques locales", debit: 1000000, credit: 0, variable: true },
      { accountId: "4621", label: "Associés, comptes courants (principal)", debit: 0, credit: 1000000, variable: true },
    ],
  },
  // ==========================================================================
  // DIVERS & CORRECTIONS
  // ==========================================================================
  {
    id: "tpl-ecart-attente", name: "Écriture de régularisation (compte d'attente)", journalCode: "ODV", journalType: "misc",
    category: "divers", recurring: "none", standard: false,
    description: "Régularisation d'un écart en compte d'attente (471).",
    lines: [
      { accountId: "4711", label: "Débiteurs divers (attente)", debit: 100000, credit: 0, variable: true },
      { accountId: "4712", label: "Créditeurs divers (attente)", debit: 0, credit: 100000, variable: true },
    ],
  },
  {
    id: "tpl-transfert-charges", name: "Transfert de charges", journalCode: "TRC", journalType: "expenses",
    category: "divers", recurring: "none", standard: false,
    description: "Transfert de charges d'exploitation vers un compte d'immobilisation ou de production.",
    ref: "SYSCOHADA 781 + 72",
    lines: [
      { accountId: "781", label: "Transferts de charges d'exploitation", debit: 200000, credit: 0, variable: true },
      { accountId: "722", label: "Immobilisations corporelles (production immobilisée)", debit: 0, credit: 200000, variable: true },
    ],
  },
  {
    id: "tpl-perte-change", name: "Perte de change", journalCode: "ECC", journalType: "misc",
    category: "divers", recurring: "none", standard: false,
    description: "Écart de conversion actif — perte latente sur créance en devises.",
    ref: "SYSCOHADA 4781 + 676",
    lines: [
      { accountId: "4781", label: "Écarts de conversion — Diminution des créances", debit: 50000, credit: 0, variable: true },
      { accountId: "676", label: "Pertes de change", debit: 0, credit: 50000, variable: true },
    ],
  },
  {
    id: "tpl-hao", name: "Élément hors activités ordinaires (HAO)", journalCode: "HAO", journalType: "misc",
    category: "divers", recurring: "none", standard: false,
    description: "Événement hors activités ordinaires (dons, sinistres, abandons).",
    ref: "SYSCOHADA 83 / 84",
    lines: [
      { accountId: "835", label: "Dons et libéralités accordés", debit: 100000, credit: 0, variable: true },
      { accountId: "5211", label: "Banques locales", debit: 0, credit: 100000, variable: true },
    ],
  },
];

/** Index par identifiant — O(1). */
export const TEMPLATE_BY_ID: Map<string, TemplateDef> = new Map(
  TEMPLATE_CATALOG.map((t) => [t.id, t]),
);

/** Modèles standards (créés au seed). */
export const STANDARD_TEMPLATES = TEMPLATE_CATALOG.filter((t) => t.standard);

/** Modèles par catégorie. */
export function templatesByCategory(category: string): TemplateDef[] {
  return TEMPLATE_CATALOG.filter((t) => t.category === category);
}

/** Modèles par code de journal. */
export function templatesByJournal(journalCode: string): TemplateDef[] {
  return TEMPLATE_CATALOG.filter((t) => t.journalCode === journalCode.toUpperCase());
}

/**
 * Vérifie qu'un modèle est équilibré (Σ débit = Σ crédit).
 * Règle absolue — aucun modèle déséquilibré ne doit être créé.
 */
export function isTemplateBalanced(t: TemplateDef): boolean {
  const d = t.lines.reduce((s, l) => s + (l.debit || 0), 0);
  const c = t.lines.reduce((s, l) => s + (l.credit || 0), 0);
  return d === c && d > 0;
}

/**
 * Recalcule les lignes d'un modèle avec un montant de base.
 * Les lignes `variable: true` sont mises à l'échelle proportionnellement.
 */
export function scaleTemplate(t: TemplateDef, baseAmount: number): { accountId: string; label: string; debit: number; credit: number }[] {
  const base = t.lines.find((l) => l.variable && l.debit > 0)?.debit
    ?? t.lines.find((l) => l.variable && l.credit > 0)?.credit
    ?? 1;
  if (!base) return t.lines.map((l) => ({ accountId: l.accountId, label: l.label, debit: l.debit, credit: l.credit }));
  const factor = baseAmount / base;
  return t.lines.map((l) => ({
    accountId: l.accountId,
    label: l.label,
    debit: l.debit ? Math.round(l.debit * factor) : 0,
    credit: l.credit ? Math.round(l.credit * factor) : 0,
  }));
}

/** Liste des catégories utilisées dans le catalogue. */
export function usedTemplateCategories(): string[] {
  return [...new Set(TEMPLATE_CATALOG.map((t) => t.category))];
}
