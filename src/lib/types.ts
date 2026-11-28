// FIMAAC — Domain types (TypeScript strict)
// OHADA / SYSCOHADA révisé — Togo 🇹🇬 (XOF)
export type ID = string;
export type CountryCode = "TG" | "BJ" | "CI" | "SN" | "BF";
export type AccountClass = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface Account {
  code: string; // e.g. "101", "1011"
  label: string;
  classNumber: AccountClass;
  parentCode: string | null;
  type: "class" | "account" | "subaccount";
  normalBalance: "debit" | "credit";
  postable: boolean; // can receive postings
  depth?: number; // 1=classe ... n=sous-compte
  nature?: "bilan" | "gestion"; // classes 1-5 vs 6-8
  keywords?: string; // libellé normalisé pour la recherche
}

export interface AccountingFramework {
  id: ID;
  name: string;
  version: string;
  country: CountryCode;
  isDefault: boolean;
}

export interface Organization {
  id: ID;
  name: string;
  type: "cabinet" | "company_client" | "platform";
  legalForm?: string;
  nif?: string;
  rccm?: string;
  email: string;
  phone?: string;
  city?: string;
  country: CountryCode;
  logoColor: string;
  /** LOT 12 — logo personnalisé (data URL) — plateforme ou cabinet. */
  logoDataUrl?: string;
  plan: "trial" | "starter" | "pro" | "enterprise";
  createdAt: string;
}

export type UserRole =
  | "super_admin"
  | "cabinet_admin"
  | "partner"
  | "director"
  | "manager"
  | "accountant"
  | "tax_specialist"
  | "payroll_manager"
  | "assistant"
  | "auditor"
  | "client_admin"
  | "client_accountant"
  | "client_user";

export type Permission =
  | "accounting.read"
  | "accounting.create"
  | "accounting.validate"
  | "accounting.close"
  | "tax.read"
  | "tax.create"
  | "tax.validate"
  | "tax.submit"
  | "documents.read"
  | "documents.upload"
  | "documents.delete"
  | "reports.read"
  | "reports.export"
  | "users.manage"
  | "settings.manage"
  | "admin.platform";

export interface User {
  id: ID;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  userType: "admin" | "cabinet" | "client";
  organizationId: ID | null;
  companyId: ID | null;
  avatarColor: string;
  twoFactorEnabled: boolean;
  active: boolean;
  /** Forcer le changement de mot de passe à la prochaine connexion
   *  (identifiants générés par le cabinet). */
  mustChangePassword: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export type TaxRegime = "rs" | "ri" | "rsmi" | "rnc" | "exempt";

export interface Company {
  id: ID;
  organizationId: ID;
  name: string;
  tradeName?: string;
  legalForm: string;
  nif: string;
  rccm?: string;
  sector: string;
  activity: string;
  address?: string;
  city?: string;
  region?: string;
  phone?: string;
  email?: string;
  website?: string;
  capital: number;
  taxRegime: TaxRegime;
  vatPayer: boolean;
  currency: "XOF";
  fiscalYearStartMonth: number;
  riskLevel: "low" | "medium" | "high";
  /** Liaison cabinet ↔ entreprise : le cabinet qui gère ce dossier.
   *  null = entreprise sans cabinet (non encore rattachée).
   *  `organizationId` reste l'organisation PROPRIÉTAIRE des données. */
  cabinetOrganizationId: ID | null;
  createdAt: string;
}

export type JournalType =
  | "sales"
  | "purchases"
  | "bank"
  | "cash"
  | "misc"
  | "wages"
  | "fixed_assets"
  | "opening"
  | "closing"
  | "cost"
  | "stock"
  | "tax"
  | "social"
  | "capital"
  | "loans"
  | "provisions"
  | "expenses"
  | "accruals";

export interface Journal {
  id: ID;
  companyId: ID;
  code: string;
  name: string;
  type: JournalType;
  createdAt: string;
}

export interface FiscalYear {
  id: ID;
  companyId: ID;
  label: string;
  startDate: string;
  endDate: string;
  status: "open" | "closed";
}

export interface AccountingPeriod {
  id: ID;
  fiscalYearId: ID;
  companyId: ID;
  label: string;
  month: number;
  year: number;
  startDate: string;
  endDate: string;
  status: "open" | "closed";
}

export interface JournalEntryLine {
  id: ID;
  accountId: string;
  label: string;
  debit: number;
  credit: number;
  taxCode: string | null;
  thirdPartyId: ID | null;
  analytic: string | null;
  letter?: string | null;
}

export interface StockItem {
  id: ID;
  companyId: ID;
  name: string;
  category: string;
  qty: number;
  unitPrice: number;
  warehouse: string;
  updatedAt: string;
}

export interface Payslip {
  id: ID;
  companyId: ID;
  periodLabel: string;
  employeeId: ID;
  gross: number;
  cnssEmployee: number;
  cnssEmployer: number;
  /** IRPP retenu (alias historique : withholding). */
  withholding: number;
  net: number;
  /** AMU salarié (5 % plafonné, taux arbitré le 28/11/2026). */
  amuEmployee?: number;
  /** AMU patronal (5 % plafonné, taux arbitré le 28/11/2026). */
  amuEmployer?: number;
  /** IRPP explicite, égal à `withholding` sur les bulletins récents. */
  irpp?: number;
  /** Mode de calcul appliqué : barème progressif ou forfait de repli. */
  modeIRPP?: "bareme" | "forfait";
  assietteIRPP?: number;
  totalRetenues?: number;
  coutEmployeur?: number;
  createdAt: string;
}

export interface PayrollConfig {
  cnssEmployeeRate: number;
  cnssEmployerRate: number;
  cnssPlafond: number;
  withholdingRate: number;
  amuEmployeeRate: number;
  amuEmployerRate: number;
  amuPlafond: number;
  irppBrackets: TaxBracket[];
  verified: boolean;
}

// ============================================================================
// REGULATORY ENGINE v2 — Moteur réglementaire versionné (Togo)
// ============================================================================
export interface RegulatoryVersion {
  id: ID;
  country: string;
  year: number;
  version: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: "draft" | "active" | "archived";
  officialSource: string;
  notes?: string;
}

export interface TaxRuleV2 {
  id: ID;
  versionId: ID;
  code: string;
  name: string;
  description?: string;
  type: "vat" | "is" | "irpp" | "withholding" | "tsb" | "other";
  rate: number;
  base: "amount" | "excl_tax" | "salary";
  formula?: string;
  ceiling?: number;
  floor?: number;
  periodicity: "monthly" | "quarterly" | "annual" | "per_transaction";
  effectiveFrom: string;
  active: boolean;
  source: string;
  verified: boolean;
}

export interface TaxBracket {
  id: ID;
  versionId: ID;
  taxCode: string;
  bracketMin: number;
  bracketMax: number | null;
  rate: number;
  order: number;
}

export interface SocialRule {
  id: ID;
  versionId: ID;
  organism: "CNSS" | "AMU";
  code: string;
  name: string;
  employeeRate: number;
  employerRate: number;
  ceiling?: number;
  floor?: number;
  periodicity: "monthly" | "quarterly";
  active: boolean;
  source: string;
}

export interface DeclarationTemplate {
  id: ID;
  versionId: ID;
  organism: "OTR" | "CNSS" | "AMU" | "OTHER";
  code: string;
  name: string;
  periodicity: "monthly" | "quarterly" | "annual";
  requiredDocuments: string[];
  controls: string[];
  portal?: string;
  active: boolean;
}

export interface PayrollComponent {
  id: ID;
  code: string;
  label: string;
  type: "earning" | "deduction" | "contribution";
  cnssTaxable: boolean;
  irppTaxable: boolean;
  amuTaxable: boolean;
  deductible: boolean;
  accountingCode?: string;
  active: boolean;
}

export interface DeclarationWorkflow {
  id: ID;
  companyId: ID;
  templateCode: string;
  periodLabel: string;
  calculatedAmount: number;
  declaredAmount: number | null;
  status: "brouillon" | "en_preparation" | "pieces_manquantes" | "controle" | "valide" | "depose" | "accepte" | "rejete" | "corrige" | "paye" | "archive";
  validatorId: ID | null;
  depositDate: string | null;
  receiptNumber: string | null;
  proofDocId: ID | null;
  paidAmount: number | null;
  paymentDate: string | null;
  paymentRef: string | null;
  observations: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReconRule {
  id: ID;
  organizationId: ID;
  label: string;
  pattern: string;
  accountId: string;
  amount: number;
}

export interface PermanentDoc {
  id: ID;
  companyId: ID;
  name: string;
  category: string;
  date: string;
  note: string;
}

export type EntryStatus =
  | "draft"
  | "in_review"
  | "validated"
  | "rejected"
  | "cancelled";

export interface JournalEntry {
  id: ID;
  companyId: ID;
  fiscalYearId: ID;
  periodId: ID;
  journalId: ID;
  number: string;
  date: string;
  reference: string;
  label: string;
  sourceDocumentId: ID | null;
  authorId: ID;
  validatorId: ID | null;
  status: EntryStatus;
  lines: JournalEntryLine[];
  /** Pièces justificatives rattachées (DocumentItem.id). */
  attachmentDocIds: ID[];
  createdAt: string;
  updatedAt: string;
}

export type DocFolder =
  | "achat"
  | "vente"
  | "banque"
  | "ccp"
  | "caisse"
  | "paie"
  | "social"
  | "fiscal"
  | "juridique"
  | "douane"
  | "stocks"
  | "immobilisations"
  | "autre";

export type DocStatus = "non_classe" | "a_traiter" | "traite" | "comptabilise" | "archive";

export interface DocumentItem {
  id: ID;
  companyId: ID;
  name: string;
  category:
    | "invoice"
    | "receipt"
    | "bank"
    | "contract"
    | "legal"
    | "tax"
    | "social"
    | "other";
  status: "uploaded" | "processing" | "extracted" | "validated" | "archived";
  size: number;
  uploadedAt: string;
  uploadedById: ID;
  tags: string[];
  extraction: {
    confidence: number;
    fields: Record<string, string>;
    ocrSimulated: boolean;
    /** Détail de lisibilité par champ — jamais de valeur inventée. */
    readability?: Record<
      string,
      { status: "read" | "manual" | "unreadable" | "missing"; confidence: number; note?: string }
    >;
    /** Moteur utilisé + diagnostic d'extraction. */
    engine?: "xlsx" | "csv" | "txt" | "pdf-text" | "image" | "binary";
    readable?: boolean;
    warnings?: string[];
  } | null;
  // V0.6 — classement arborescent
  exercise: string | null; // "2026"
  month: number | null; // 1-12
  folder: DocFolder | null;
  docStatus: DocStatus;
  uploadSource: "cabinet" | "client";
  uploadedBy: string;
  tierId: ID | null;
  linkedEntryId: ID | null;
}

export interface BankAccount {
  id: ID;
  companyId: ID;
  bankName: string;
  iban: string;
  currency: "XOF";
  openingBalance: number;
}

export interface BankTransaction {
  id: ID;
  bankAccountId: ID;
  companyId: ID;
  date: string;
  label: string;
  amount: number; // + credit / - debit
  reconciled: boolean;
  matchedEntryId: ID | null;
}

export interface FixedAsset {
  id: ID;
  companyId: ID;
  name: string;
  category: string;
  accountCode: string;
  acquisitionDate: string;
  cost: number;
  residualValue: number;
  usefulLifeYears: number;
  method: "linear" | "degressive";
  status: "active" | "disposed";
}

export interface TaxProfile {
  id: ID;
  companyId: ID;
  regime: TaxRegime;
  vatPayer: boolean;
  tfeLiable: boolean; // Taxe patronale
  obligations: string[];
}

export interface TaxRuleRef {
  id: string;
  code: string; // e.g. "VAT-STD"
  name: string;
  rate: number; // percentage
  base: "amount" | "excl_tax";
  country: CountryCode;
  source: string;
  version: string;
  verified: boolean; // false => "information non vérifiée"
  note?: string;
}

export type DeclarationStatus =
  | "pending"
  | "in_progress"
  | "ready"
  | "validated"
  | "submitted"
  | "paid"
  | "overdue"
  | "not_applicable";

export interface TaxDeclaration {
  id: ID;
  companyId: ID;
  taxCode: string; // refs a TaxRuleRef code or "TVA", "IS", "TPA", "TFE", "TSPP"
  periodLabel: string;
  base: number;
  amount: number;
  breakdown: { label: string; amount: number; rule: string; source: string }[];
  status: DeclarationStatus;
  dueDate: string;
  createdAt: string;
}

export interface TaxDeadline {
  id: ID;
  companyId: ID;
  taxCode: string;
  label: string;
  dueDate: string;
  status: DeclarationStatus;
  assigneeId: ID | null;
}

export interface Employee {
  id: ID;
  companyId: ID;
  firstName: string;
  lastName: string;
  position: string;
  grossSalary: number;
  contractType: "cdi" | "cdd" | "stage";
  startDate: string;
}

export interface Mission {
  id: ID;
  organizationId: ID;
  companyId: ID;
  title: string;
  type: string;
  status: "todo" | "in_progress" | "review" | "done";
  assigneeId: ID | null;
  dueDate: string;
  progress: number;
}

export interface Task {
  id: ID;
  companyId: ID | null;
  organizationId: ID;
  missionId: ID | null;
  title: string;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  dueDate: string;
  assigneeId: ID | null;
}

export interface Notification {
  id: ID;
  userId: ID | null;
  organizationId: ID;
  title: string;
  body: string;
  type: "info" | "success" | "warning" | "danger";
  read: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: ID;
  userId: ID;
  organizationId: ID;
  action: string;
  entity: string;
  entityId: ID;
  before: string | null;
  after: string | null;
  ip: string;
  createdAt: string;
  /** P2 — rang dans la chaîne d'audit (0 = première entrée scellée). */
  seq?: number;
  /** Empreinte de l'entrée précédente (GENESIS_HASH pour la première). */
  prevHash?: string;
  /** SHA-256(prevHash | contenu canonique) — détecte toute altération locale. */
  hash?: string;
}

export interface ChatMessage {
  id: ID;
  conversationId: ID;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  agent: string;
  sources: string[];
  verified: boolean;
}

export interface Conversation {
  id: ID;
  userId: ID;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
}

export interface Subscription {
  id: ID;
  organizationId: ID;
  plan: "trial" | "starter" | "pro" | "enterprise";
  status: "trialing" | "active" | "past_due" | "cancelled";
  seats: number;
  startedAt: string;
  renewsAt: string;
  monthlyAmount: number;
}

export interface Invoice {
  id: ID;
  organizationId: ID;
  number: string;
  amount: number;
  status: "draft" | "paid" | "overdue";
  issuedAt: string;
  dueAt: string;
  plan: string;
}

// (Ancienne interface ClientRequest remplacée par le modèle riche ci-dessous)
export interface ComplianceIssue {
  id: ID;
  companyId: ID;
  category: "accounting" | "tax" | "social" | "legal" | "documents" | "deadlines";
  severity: "info" | "warning" | "critical";
  title: string;
  recommendation: string;
  resolved: boolean;
}

export type RequestStatus = "to_request" | "sent" | "partial" | "received" | "overdue";

export interface DocumentRequest {
  id: ID;
  organizationId: ID;
  companyId: ID;
  category: string;
  docType: string;
  periodLabel: string;
  journalId: ID | null;
  accountCode: string | null;
  dueDate: string;
  status: RequestStatus;
  recurring: "none" | "monthly" | "quarterly" | "yearly";
  message: string;
  createdAt: string;
}

export interface TaxPaymentRequest {
  id: ID;
  organizationId: ID;
  companyId: ID;
  taxCode: string;
  label: string;
  base: number;
  amount: number;
  dueDate: string;
  method: string;
  declarationId: ID | null;
  status: "to_pay" | "paid" | "overdue";
  createdAt: string;
}

export interface RequestMessage {
  id: ID;
  author: "client" | "cabinet";
  authorId: ID;
  text: string;
  createdAt: string;
}

export type ClientRequestStatus =
  | "soumise"
  | "prise_en_charge"
  | "en_traitement"
  | "livree"
  | "archivee"
  | "rejetee";

export interface ClientRequest {
  id: ID;
  number: string; // DEM-0001
  organizationId: ID;
  companyId: ID;
  direction: "client_to_cabinet"; // demande émise par le client
  category: string; // famille (cartes, attestations, quitus, marchés, transfert, formalités, comptable, documents)
  acteType: string; // acte précis (CIF, CFE, quitus, transfert de fonds…)
  title: string;
  status: ClientRequestStatus;
  fields: Record<string, string>; // champs dynamiques (années, banques, montants…)
  dueDate: string | null;
  attachments: { id: ID; name: string; createdAt: string }[];
  messages: RequestMessage[];
  history: { id: ID; at: string; label: string; by: "client" | "cabinet" }[];
  createdAt: string;
  updatedAt: string;
}

export interface TemplateLine {
  accountId: string;
  label: string;
  debit: number;
  credit: number;
}

export interface EntryTemplate {
  id: ID;
  organizationId: ID;
  name: string;
  companyId: ID | null;
  journalId: ID | null;
  recurring: "none" | "monthly" | "yearly";
  lines: TemplateLine[];
  lastRun: string | null;
  createdAt: string;
}

export interface ThirdParty {
  id: ID;
  organizationId: ID;
  companyId: ID;
  code: string;
  collective: string;
  type: "customer" | "supplier";
  name: string;
  address?: string;
  city?: string;
  nif?: string;
  rc?: string;
  contact?: string;
  phone?: string;
  vatRegime?: string;
  paymentTerms?: string;
  creditLimit?: number;
  createdAt: string;
}

export type FSStatus = "a_demarrer" | "balances_importees" | "modele_analyse" | "etat_edite" | "controle" | "exporte";

export interface FSSession {
  id: ID;
  organizationId: ID;
  companyId: ID;
  exercise: string;
  label: string;
  status: FSStatus;
  balanceN: BalanceRowLite[];
  balanceN1: BalanceRowLite[];
  auditSummary: { fileName: string; sheets: number; formulas: number; matchedKeySheets: string[] } | null;
  patchResult: { patched: number; preserved: number; errors: string[] } | null;
  coherenceScore: number | null;
  history: { id: ID; at: string; label: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface BalanceRowLite { code: string; label: string; debit: number; credit: number; }

/**
 * P10 — Retraitement fiscal du résultat.
 * Une réintégration augmente le résultat imposable (amendes, dons non
 * déductibles, charges non justifiées), une déduction le diminue. Chaque ligne
 * est saisie, datée, attribuée et tracée : un retraitement fiscal sans trace
 * écrite ne vaut rien devant un vérificateur.
 */
export interface TaxAdjustment {
  id: ID;
  companyId: ID;
  /** Exercice concerné (AAAA). */
  exercise: string;
  type: "reintegration" | "deduction";
  label: string;
  amount: number;
  /** Référence justificative (pièce, article du CGI, note). */
  reference?: string;
  /**
   * P20 — Origine proposée (`penalites/2026`, `dons/2026`…). Renseigné quand le
   * retraitement a été repris d'une proposition : il évite de le proposer deux
   * fois et permet de retrouver d'où vient le montant.
   */
  suggestionId?: string;
  authorId: ID;
  createdAt: string;
}

/**
 * P17 — Ligne d'une note annexe saisie à la main.
 *
 * Les 15 notes « à confirmer » (dirigeants, engagements hors bilan, effectifs,
 * ventilation du CA…) ne se déduisent d'aucune balance. La règle du référentiel
 * interdit de les remplir de zéros : elles restent vides **jusqu'à ce qu'un
 * humain les saisisse** — et cette saisie est datée, attribuée et conservée.
 */
export interface ManualNoteRow {
  label: string;
  /** Valeur de l'exercice N. `null` = non saisi (jamais 0 par défaut). */
  n: number | null;
  n1: number | null;
}

export interface ManualNote {
  id: ID;
  companyId: ID;
  /** Exercice concerné (AAAA). */
  exercise: string;
  /** Code de la note, ex. NOTE_18. */
  code: string;
  rows: ManualNoteRow[];
  authorId: ID;
  createdAt: string;
  updatedAt: string;
}

/**
 * P18 — Jour férié exceptionnel ou prorogation décidée par l'administration.
 *
 * Les fêtes musulmanes (Aïd el-Fitr, Aïd el-Adha) et les prorogations ne se
 * calculent pas : leur date est annoncée puis **saisie**. Elle décale les
 * échéances légales exactement comme un jour férié fixe.
 */
export interface Holiday {
  id: ID;
  /** Date ISO (AAAA-MM-JJ). */
  date: string;
  label: string;
  /** Référence de l'annonce (communiqué OTR, arrêté…). */
  reference?: string;
  country: string;
  authorId: ID;
  createdAt: string;
}

export interface DBState {
  version: number;
  accounts: Account[];
  organizations: Organization[];
  users: User[];
  companies: Company[];
  journals: Journal[];
  fiscalYears: FiscalYear[];
  periods: AccountingPeriod[];
  entries: JournalEntry[];
  documents: DocumentItem[];
  bankAccounts: BankAccount[];
  bankTransactions: BankTransaction[];
  fixedAssets: FixedAsset[];
  taxProfiles: TaxProfile[];
  taxRules: TaxRuleRef[];
  taxDeclarations: TaxDeclaration[];
  taxDeadlines: TaxDeadline[];
  employees: Employee[];
  missions: Mission[];
  tasks: Task[];
  notifications: Notification[];
  auditLogs: AuditLog[];
  conversations: Conversation[];
  subscriptions: Subscription[];
  invoices: Invoice[];
  clientRequests: ClientRequest[];
  complianceIssues: ComplianceIssue[];
  documentRequests: DocumentRequest[];
  taxPaymentRequests: TaxPaymentRequest[];
  entryTemplates: EntryTemplate[];
  stockItems: StockItem[];
  payslips: Payslip[];
  payrollConfig: PayrollConfig;
  reconRules: ReconRule[];
  permanentDocs: PermanentDoc[];
  tiers: ThirdParty[];
  fsSessions: FSSession[];
  taxAdjustments: TaxAdjustment[];
  manualNotes: ManualNote[];
  holidays: Holiday[];
  regulatoryVersions: RegulatoryVersion[];
  taxRulesV2: TaxRuleV2[];
  taxBrackets: TaxBracket[];
  socialRules: SocialRule[];
  declarationTemplates: DeclarationTemplate[];
  payrollComponents: PayrollComponent[];
  declarationWorkflows: DeclarationWorkflow[];
  session: { userId: ID | null };
  booted: boolean;
}
