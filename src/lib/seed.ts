import type {
  DBState,
  Account,
  Organization,
  User,
  Company,
  Journal,
  FiscalYear,
  AccountingPeriod,
  JournalEntry,
  JournalEntryLine,
  TaxRuleRef,
  TaxDeadline,
  TaxDeclaration,
  Mission,
  Task,
  Notification,
  AuditLog,
  Subscription,
  Invoice,
  ComplianceIssue,
  Employee,
  ThirdParty,
  DocumentItem,
  DocFolder,
  DocStatus,
} from "./types";
import { CHART_OF_ACCOUNTS } from "./chartOfAccounts";
import { JOURNAL_CATALOG } from "./journals";
import { TEMPLATE_CATALOG } from "./entryTemplates";
import { hashPassword } from "./hash";
import { uid } from "./format";

const NOW = () => new Date().toISOString();
const YEAR = new Date().getFullYear();

function line(accountId: string, label: string, debit = 0, credit = 0): JournalEntryLine {
  return { id: uid(), accountId, label, debit, credit, taxCode: null, thirdPartyId: null, analytic: null };
}

export function seedDatabase(): DBState {
  const accounts: Account[] = CHART_OF_ACCOUNTS.map((a) => ({ ...a }));

  // ---- Organizations ----
  const platform: Organization = {
    id: "org-platform",
    name: "FIMAAC",
    type: "platform",
    email: "fimaac.africa@gmail.com",
    country: "TG",
    logoColor: "#4f46e5",
    plan: "enterprise",
    createdAt: NOW(),
  };
  const cabinet: Organization = {
    id: "org-cabinet-demo",
    name: "Cabinet FIMAAC Démo",
    type: "cabinet",
    legalForm: "SARL",
    nif: "TG-DEMO-001",
    email: "cabinet@fimaac.demo",
    phone: "+228 90 00 00 00",
    city: "Lomé",
    country: "TG",
    logoColor: "#0ea5e9",
    plan: "pro",
    createdAt: NOW(),
  };
  const organizations = [platform, cabinet];

  // ---- Users ----
  const admin: User = {
    id: "user-admin",
    email: "fimaac.africa@gmail.com",
    passwordHash: hashPassword("Fimaac@2026"),
    firstName: "Administrateur",
    lastName: "FIMAAC",
    role: "super_admin",
    userType: "admin",
    organizationId: platform.id,
    companyId: null,
    avatarColor: "#4f46e5",
    twoFactorEnabled: false,
    mustChangePassword: false,
    active: true,
    createdAt: NOW(),
    lastLoginAt: null,
  };
  const cabinetAdmin: User = {
    id: "user-cabinet",
    email: "compta@cabinet.demo",
    passwordHash: hashPassword("Cabinet@2026"),
    firstName: "Afi",
    lastName: "AGBO",
    role: "cabinet_admin",
    userType: "cabinet",
    organizationId: cabinet.id,
    companyId: null,
    avatarColor: "#0ea5e9",
    twoFactorEnabled: false,
    mustChangePassword: false,
    active: true,
    createdAt: NOW(),
    lastLoginAt: null,
  };
  const accountant: User = {
    id: "user-accountant",
    email: "assistant@cabinet.demo",
    passwordHash: hashPassword("Cabinet@2026"),
    firstName: "Kossi",
    lastName: "DODJI",
    role: "accountant",
    userType: "cabinet",
    organizationId: cabinet.id,
    companyId: null,
    avatarColor: "#10b981",
    twoFactorEnabled: false,
    mustChangePassword: false,
    active: true,
    createdAt: NOW(),
    lastLoginAt: null,
  };
  const users = [admin, cabinetAdmin, accountant];

  // ---- Company (client) ----
  const company: Company = {
    id: "co-demo",
    organizationId: cabinet.id,
    name: "SARL Technologie Lomé",
    tradeName: "TechLomé",
    legalForm: "SARL",
    nif: "1199887766554",
    rccm: "TG-LFE-2019-B-12345",
    sector: "Technologies de l'information",
    activity: "Développement logiciel et services numériques",
    address: "Avenue de la Marina, Lomé",
    city: "Lomé",
    region: "Maritime",
    phone: "+228 91 22 33 44",
    email: "contact@techlome.tg",
    website: "www.techlome.tg",
    capital: 5_000_000,
    taxRegime: "ri",
    vatPayer: true,
    currency: "XOF",
    fiscalYearStartMonth: 1,
    riskLevel: "low",
    cabinetOrganizationId: cabinet.id,
    createdAt: NOW(),
  };
  const company2: Company = {
    id: "co-demo-2",
    organizationId: cabinet.id,
    name: "Distribution Golfe SARL",
    tradeName: "DistGolfe",
    legalForm: "SARL",
    nif: "1199887766555",
    sector: "Commerce de gros",
    activity: "Distribution de matériel informatique",
    city: "Lomé",
    region: "Maritime",
    capital: 10_000_000,
    taxRegime: "rs",
    vatPayer: true,
    currency: "XOF",
    fiscalYearStartMonth: 1,
    riskLevel: "medium",
    cabinetOrganizationId: cabinet.id,
    createdAt: NOW(),
  };
  const companies = [company, company2];

  // ---- Client user for company2 portal ----
  const clientUser: User = {
    id: "user-client",
    email: "client@distgolfe.demo",
    passwordHash: hashPassword("Client@2026"),
    firstName: "Yawo",
    lastName: "MENSAN",
    role: "client_admin",
    userType: "client",
    organizationId: cabinet.id,
    companyId: company2.id,
    avatarColor: "#f59e0b",
    twoFactorEnabled: false,
    mustChangePassword: false,
    active: true,
    createdAt: NOW(),
    lastLoginAt: null,
  };
  users.push(clientUser);

  // ---- Journaux : générés depuis le catalogue (40 journaux) ----
  // Standards pour toutes les entreprises + journaux étendus pour co-demo.
  const journals: Journal[] = [];
  const journalIdByCode = new Map<string, string>();
  for (const co of companies) {
    for (const def of JOURNAL_CATALOG.filter((j) => j.standard || co.id === company.id)) {
      const jid = `j-${co.id === company.id ? "" : "2-"}${def.code.toLowerCase()}`;
      journals.push({ id: jid, companyId: co.id, code: def.code, name: def.name, type: def.type, createdAt: NOW() });
      if (co.id === company.id) journalIdByCode.set(def.code, jid);
    }
  }
  const jId = (code: string) => journalIdByCode.get(code) ?? journals.find((j) => j.companyId === company.id && j.code === code)?.id ?? journals[0].id;

  // ---- Fiscal year + periods ----
  const fy: FiscalYear = {
    id: "fy-demo",
    companyId: company.id,
    label: `Exercice ${YEAR}`,
    startDate: `${YEAR}-01-01`,
    endDate: `${YEAR}-12-31`,
    status: "open",
  };
  const periods: AccountingPeriod[] = [];
  for (let m = 1; m <= 12; m++) {
    periods.push({
      id: `per-${company.id}-${m}`,
      fiscalYearId: fy.id,
      companyId: company.id,
      label: new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date(YEAR, m - 1, 1)),
      month: m,
      year: YEAR,
      startDate: `${YEAR}-${String(m).padStart(2, "0")}-01`,
      endDate: `${YEAR}-${String(m).padStart(2, "0")}-28`,
      status: "open",
    });
  }

  // M9 — les périodes existaient uniquement pour `company` : toute écriture sur
  // `company2` tombait en `periodId: ""`, l'onglet Clôture était vide pour cette
  // entreprise et le contrôle de période clôturée ne s'appliquait pas.
  const fy2: FiscalYear = {
    id: "fy-demo-2",
    companyId: company2.id,
    label: `Exercice ${YEAR}`,
    startDate: `${YEAR}-01-01`,
    endDate: `${YEAR}-12-31`,
    status: "open",
  };
  for (let m = 1; m <= 12; m++) {
    periods.push({
      id: `per-${company2.id}-${m}`,
      fiscalYearId: fy2.id,
      companyId: company2.id,
      label: new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date(YEAR, m - 1, 1)),
      month: m,
      year: YEAR,
      startDate: `${YEAR}-${String(m).padStart(2, "0")}-01`,
      endDate: `${YEAR}-${String(m).padStart(2, "0")}-28`,
      status: "open",
    });
  }

  // ---- Sample validated entries (balanced) ----
  const mkEntry = (
    id: string,
    journalId: string,
    number: string,
    date: string,
    label: string,
    reference: string,
    lines: JournalEntryLine[],
  ): JournalEntry => ({
    id,
    companyId: company.id,
    fiscalYearId: fy.id,
    periodId: periods[0].id,
    journalId,
    number,
    date,
    reference,
    label,
    sourceDocumentId: null,
    authorId: accountant.id,
    validatorId: cabinetAdmin.id,
    status: "validated",
    lines,
    attachmentDocIds: [],
    createdAt: NOW(),
    updatedAt: NOW(),
  });

  const entries: JournalEntry[] = [
    mkEntry("e1", jId("ODV"), "OD-0001", `${YEAR}-01-05`, "Constitution du capital social", "STAT-001", [
      line("5211", "Banques locales", 5_000_000, 0),
      line("1013", "Capital souscrit, appelé, versé, non amorti", 0, 5_000_000),
    ]),
    mkEntry("e2", jId("VTE"), "VT-0001", `${YEAR}-01-15`, "Facture client FAC-1001 (prestation)", "FAC-1001", [
      line("4111", "Clients", 1_180_000, 0),
      line("7061", "Services vendus - dans la Région", 0, 1_000_000),
      line("4431", "État, TVA facturée sur ventes (18%)", 0, 180_000),
    ]),
    mkEntry("e3", jId("ACH"), "AC-0001", `${YEAR}-01-18`, "Facture fournisseur matériel", "FF-5050", [
      line("6021", "Achats de matières premières - dans la Région", 500_000, 0),
      line("4452", "État, TVA récupérable sur achats (18%)", 90_000, 0),
      line("4011", "Fournisseurs", 0, 590_000),
    ]),
    mkEntry("e4", jId("BAQ"), "BQ-0001", `${YEAR}-01-25`, "Règlement fournisseur FF-5050", "VIR-20251", [
      line("4011", "Fournisseurs", 590_000, 0),
      line("5211", "Banques locales", 0, 590_000),
    ]),
    mkEntry("e5", jId("BAQ"), "BQ-0002", `${YEAR}-01-28`, "Encaissement client FAC-1001", "VIR-20252", [
      line("5211", "Banques locales", 1_180_000, 0),
      line("4111", "Clients", 0, 1_180_000),
    ]),
    mkEntry("e6", jId("PAI"), "SN-0001", `${YEAR}-01-31`, "Paie janvier", "PAYE-01", [
      line("6611", "Appointements, salaires et commissions", 800_000, 0),
      line("422", "Personnel, rémunérations dues", 0, 800_000),
    ]),
    mkEntry("e7", jId("ACH"), "AC-0002", `${YEAR}-01-20`, "Loyer bureau janvier", "LOY-2025-01", [
      line("6222", "Locations de bâtiments", 250_000, 0),
      line("4011", "Fournisseurs", 0, 250_000),
    ]),
  ];

  // ---- Tiers (clients/fournisseurs) + rattachement des écritures ----
  const tiers: ThirdParty[] = [
    { id: "tier-client-1", organizationId: cabinet.id, companyId: company.id, code: "CLI001", collective: "4111", type: "customer", name: "Société Alpha SARL", address: "Rue des Commerces", city: "Lomé", nif: "1199000111", contact: "M. Kossi", phone: "+228 90 11 11 11", vatRegime: "TVA 18%", paymentTerms: "30 jours", creditLimit: 5_000_000, createdAt: NOW() },
    { id: "tier-fourn-1", organizationId: cabinet.id, companyId: company.id, code: "FOU001", collective: "4011", type: "supplier", name: "MatInfo SARL", address: "Bd. du Mono", city: "Lomé", nif: "1199000222", contact: "Mme Awa", phone: "+228 90 22 22 22", paymentTerms: "Comptant", createdAt: NOW() },
    { id: "tier-fourn-2", organizationId: cabinet.id, companyId: company.id, code: "FOU002", collective: "4011", type: "supplier", name: "Bailleur Marina", city: "Lomé", paymentTerms: "Mensuel", createdAt: NOW() },
  ];

  entries[1].lines[0].thirdPartyId = "tier-client-1"; // vente FAC-1001
  entries[4].lines[1].thirdPartyId = "tier-client-1"; // encaissement FAC-1001
  entries[2].lines[2].thirdPartyId = "tier-fourn-1"; // achat FF-5050
  entries[3].lines[0].thirdPartyId = "tier-fourn-1"; // règlement FF-5050
  entries[6].lines[1].thirdPartyId = "tier-fourn-2"; // loyer

  // ---- Tax rules (Togo) — ALL flagged "à vérifier" per integrity rules ----
  const taxRules: TaxRuleRef[] = [
    {
      id: "rule-tva",
      code: "TVA",
      name: "TVA — Taxe sur la valeur ajoutée (taux normal)",
      rate: 18,
      base: "excl_tax",
      country: "TG",
      source: "Cahier fiscal / Code général des impôts — Office Togolais des Recettes (OTR)",
      version: String(YEAR),
      verified: false,
      note: "Taux indicatif. À vérifier et à paramétrer dans le Regulatory Engine à partir du texte officiel applicable à l'exercice.",
    },
    {
      id: "rule-is",
      code: "IS",
      name: "Impôt sur les bénéfices (IB)",
      rate: 27,
      base: "amount",
      country: "TG",
      source: "Code général des impôts — OTR",
      version: String(YEAR),
      verified: false,
      note: "Taux indicatif et paramétrable. Applique un barème + minimum de perception à confirmer sur le texte officiel.",
    },
    {
      id: "rule-tss",
      code: "TSS",
      name: "Taxe / cotisations sur salaires",
      rate: 0,
      base: "amount",
      country: "TG",
      source: "CNSS / OTR",
      version: String(YEAR),
      verified: false,
      note: "À paramétrer à partir des taux officiels CNSS et de la réglementation sociale en vigueur.",
    },
  ];

  // ---- Tax deadlines ----
  const taxDeadlines: TaxDeadline[] = [
    { id: "td1", companyId: company.id, taxCode: "TVA", label: "Déclaration & paiement TVA — mois précédent", dueDate: `${YEAR}-${String(new Date().getMonth() + 2).padStart(2, "0")}-15`, status: "pending", assigneeId: accountant.id },
    { id: "td2", companyId: company.id, taxCode: "IS", label: "Acompte IS (1er trimestre)", dueDate: `${YEAR}-03-31`, status: "pending", assigneeId: cabinetAdmin.id },
    { id: "td3", companyId: company2.id, taxCode: "TVA", label: "Déclaration TVA en retard", dueDate: `${YEAR}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`, status: "overdue", assigneeId: accountant.id },
  ];

  // ---- A ready TVA declaration derived from entries (explainable) ----
  const taxDeclarations: TaxDeclaration[] = [
    {
      id: "dec1",
      companyId: company.id,
      taxCode: "TVA",
      periodLabel: `${new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date())}`,
      base: 1_000_000,
      amount: 90_000, // 180 000 collectée - 90 000 récupérable
      breakdown: [
        { label: "TVA collectée (compte 443)", amount: 180_000, rule: "TVA", source: "rule-tva" },
        { label: "TVA récupérable (compte 445)", amount: -90_000, rule: "TVA", source: "rule-tva" },
        { label: "TVA nette à payer", amount: 90_000, rule: "TVA", source: "rule-tva" },
      ],
      status: "ready",
      dueDate: `${YEAR}-${String(new Date().getMonth() + 2).padStart(2, "0")}-15`,
      createdAt: NOW(),
    },
  ];

  // ---- Missions & tasks ----
  const missions: Mission[] = [
    { id: "m1", organizationId: cabinet.id, companyId: company.id, title: "Clôture annuelle", type: "clôture", status: "in_progress", assigneeId: cabinetAdmin.id, dueDate: `${YEAR}-03-15`, progress: 60 },
    { id: "m2", organizationId: cabinet.id, companyId: company2.id, title: "Révision comptable T1", type: "révision", status: "todo", assigneeId: accountant.id, dueDate: `${YEAR}-04-15`, progress: 10 },
    { id: "m3", organizationId: cabinet.id, companyId: company.id, title: "Déclarations fiscales mensuelles", type: "fiscal", status: "in_progress", assigneeId: accountant.id, dueDate: `${YEAR}-${String(new Date().getMonth() + 2).padStart(2, "0")}-15`, progress: 40 },
  ];
  const tasks: Task[] = [
    { id: "t1", companyId: company.id, organizationId: cabinet.id, missionId: "m1", title: "Rapprochement bancaire janvier", status: "in_progress", priority: "high", dueDate: `${YEAR}-02-20`, assigneeId: accountant.id },
    { id: "t2", companyId: company2.id, organizationId: cabinet.id, missionId: "m2", title: "Collecter pièces justificatives Q1", status: "todo", priority: "medium", dueDate: `${YEAR}-03-30`, assigneeId: accountant.id },
    { id: "t3", companyId: company.id, organizationId: cabinet.id, missionId: "m3", title: "Téléverser relevés bancaires", status: "todo", priority: "high", dueDate: `${YEAR}-02-18`, assigneeId: null },
  ];

  // ---- Notifications ----
  const notifications: Notification[] = [
    { id: "n1", userId: null, organizationId: cabinet.id, title: "Échéance TVA imminente", body: "La déclaration TVA de Technologie Lomé arrive à échéance sous 15 jours.", type: "warning", read: false, createdAt: NOW() },
    { id: "n2", userId: null, organizationId: cabinet.id, title: "Documents manquants", body: "Distribution Golfe SARL n'a pas fourni ses relevés du mois.", type: "danger", read: false, createdAt: NOW() },
    { id: "n3", userId: null, organizationId: cabinet.id, title: "Mission en cours", body: "Clôture annuelle Technologie Lomé — 60 % achevé.", type: "info", read: true, createdAt: NOW() },
  ];

  // ---- Compliance issues ----
  const complianceIssues: ComplianceIssue[] = [
    { id: "ci1", companyId: company2.id, category: "documents", severity: "warning", title: "Relevés bancaires manquants", recommendation: "Demander les relevés du mois courant au client via le portail.", resolved: false },
    { id: "ci2", companyId: company2.id, category: "deadlines", severity: "critical", title: "Déclaration TVA en retard", recommendation: "Régulariser et déposer la TVA en retard immédiatement.", resolved: false },
    { id: "ci3", companyId: company.id, category: "accounting", severity: "info", title: "Période non clôturée", recommendation: "Procéder au rapprochement puis clôturer la période.", resolved: false },
  ];

  // ---- Subscription / invoices ----
  const subscription: Subscription = {
    id: "sub-demo",
    organizationId: cabinet.id,
    plan: "pro",
    status: "trialing",
    seats: 5,
    startedAt: NOW(),
    renewsAt: new Date(Date.now() + 14 * 86400000).toISOString(),
    monthlyAmount: 75_000,
  };
  const invoices: Invoice[] = [
    { id: "inv1", organizationId: cabinet.id, number: `FAC-${YEAR}-0001`, amount: 75_000, status: "draft", issuedAt: NOW(), dueAt: new Date(Date.now() + 14 * 86400000).toISOString(), plan: "Pro mensuel" },
  ];

  // ---- Employees ----
  const employees: Employee[] = [
    { id: "emp1", companyId: company.id, firstName: "Kossi", lastName: "AGBO", position: "Développeur", grossSalary: 450_000, contractType: "cdi", startDate: `${YEAR - 1}-03-01` },
    { id: "emp2", companyId: company.id, firstName: "Awa", lastName: "LAWSON", position: "Comptable", grossSalary: 350_000, contractType: "cdi", startDate: `${YEAR - 2}-06-01` },
  ];

  // ---- Audit log ----
  const auditLogs: AuditLog[] = [
    { id: uid(), userId: cabinetAdmin.id, organizationId: cabinet.id, action: "VALIDATE_ENTRY", entity: "JournalEntry", entityId: "e2", before: JSON.stringify({ status: "in_review" }), after: JSON.stringify({ status: "validated" }), ip: "127.0.0.1", createdAt: NOW() },
    { id: uid(), userId: admin.id, organizationId: platform.id, action: "PLATFORM_SEED", entity: "System", entityId: "boot", before: null, after: "FIMAAC V0.1 initialized", ip: "127.0.0.1", createdAt: NOW() },
  ];

  // ============================================================================
  // HISTORIQUE DE DÉMONSTRATION — 12 mois d'exploitation réelle simulée
  // Chaque écriture est ÉQUILIBRÉE (Σ débit = Σ crédit). Ces données alimentent
  // le reporting du tableau de bord. Elles restent strictement démonstratives.
  // ============================================================================
  /** Générateur pseudo-aléatoire déterministe (même seed → même jeu de données). */
  function mulberry(seed: number) {
    return () => {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function buildHistory(): JournalEntry[] {
    const out: JournalEntry[] = [];
    const rnd = mulberry(20260215);
    let seq = 100;
    const nid = () => uid();

    const mk = (journalId: string, date: string, label: string, reference: string, raw: { accountId: string; label: string; debit?: number; credit?: number }[]): JournalEntry => {
      seq += 1;
      // Détection du code de journal depuis l'ID (format : j-vte, j-ach, j-baq…)
      const code = journalId.includes("-vte") ? "VTE" : journalId.includes("-ach") ? "ACH"
        : journalId.includes("-baq") ? "BAQ" : journalId.includes("-pai") ? "PAI"
        : journalId.includes("-imm") ? "IMM" : journalId.includes("-ces") ? "CES"
        : journalId.includes("-prv") ? "PRV" : journalId.includes("-amo") ? "AMO"
        : journalId.includes("-tva") ? "TVA" : journalId.includes("-imp") ? "IMP"
        : journalId.includes("-reg") ? "REG" : journalId.includes("-cap") ? "CAP"
        : journalId.includes("-emp") ? "EMP" : journalId.includes("-ass") ? "ASS"
        : journalId.includes("-stk") ? "STK" : journalId.includes("-ran") ? "RAN"
        : journalId.includes("-trc") ? "TRC" : journalId.includes("-hao") ? "HAO"
        : "ODV";
      return {
        id: nid(), companyId: company.id, fiscalYearId: fy.id, periodId: periods[0].id,
        journalId, number: `${code}-${String(seq).padStart(4, "0")}`,
        date, reference, label, sourceDocumentId: null,
        authorId: accountant.id, validatorId: cabinetAdmin.id, status: "validated",
        attachmentDocIds: [],
        lines: raw.map((l) => line(l.accountId, l.label, l.debit ?? 0, l.credit ?? 0)),
        createdAt: NOW(), updatedAt: NOW(),
      };
    };

    /** Équilibre automatiquement la dernière ligne (reçoit l'écart restant). */
    const bal = (parts: { accountId: string; label: string; amount: number; side: "d" | "c" }[]) => {
      const d = parts.filter((p) => p.side === "d").reduce((s, p) => s + p.amount, 0);
      const c = parts.filter((p) => p.side === "c").reduce((s, p) => s + p.amount, 0);
      const diff = d - c;
      if (diff !== 0) {
        const last = parts[parts.length - 1];
        last.amount += last.side === "d" ? -diff : diff;
      }
      return parts.map((p) => ({ accountId: p.accountId, label: p.label, debit: p.side === "d" ? Math.round(p.amount) : 0, credit: p.side === "c" ? Math.round(p.amount) : 0 }));
    };

    const MONTH_FR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
    let ca = 1_150_000;
    let masse = 880_000;

    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, "0");
      const d = (day: number) => `${YEAR}-${mm}-${String(day).padStart(2, "0")}`;

      // ---- Ventes : croissance + variation saisonnière ----
      const season = 1 + 0.12 * Math.sin((m / 12) * Math.PI * 2) + (m >= 7 && m <= 8 ? -0.18 : 0) + (m === 12 ? 0.25 : 0);
      ca = Math.round(ca * (1 + 0.045 + (rnd() - 0.5) * 0.06));
      const caMois = Math.round((ca * season) / 10000) * 10000;
      const tvaCol = Math.round(caMois * 0.18);
      out.push(mk(jId("VTE"), d(12), `Facturation services — ${MONTH_FR[m - 1]}`, `FAC-${YEAR}${mm}-VT`, bal([
        { accountId: "4111", label: "Clients", amount: caMois + tvaCol, side: "d" },
        { accountId: "7061", label: "Services vendus — dans la Région", amount: caMois, side: "c" },
        { accountId: "4431", label: "TVA facturée sur ventes (18 %)", amount: tvaCol, side: "c" },
      ])));

      // ---- Encaissements clients (~78 % du CA du mois) ----
      const encaisse = Math.round(caMois * (0.72 + rnd() * 0.14));
      out.push(mk(jId("BAQ"), d(24), `Encaissements clients — ${MONTH_FR[m - 1]}`, `REM-${YEAR}${mm}`, bal([
        { accountId: "5211", label: "Banques locales", amount: encaisse, side: "d" },
        { accountId: "4111", label: "Clients", amount: encaisse, side: "c" },
      ])));

      // ---- Paie : masse salariale + charges sociales ----
      masse = Math.round(masse * (1 + 0.012 + (rnd() - 0.5) * 0.02));
      const cnssSal = Math.round(Math.min(masse, 300_000) * 0.04);
      const cnssPat = Math.round(Math.min(masse, 300_000) * 0.175);
      const its = Math.round(masse * 0.05);
      const net = masse - cnssSal - its;
      out.push(mk(jId("PAI"), d(28), `Paie ${MONTH_FR[m - 1]} ${YEAR}`, `PAYE-${YEAR}${mm}`, bal([
        { accountId: "6611", label: "Appointements, salaires et commissions", amount: masse, side: "d" },
        { accountId: "6641", label: "Charges sociales patronales (CNSS)", amount: cnssPat, side: "d" },
        { accountId: "4311", label: "Sécurité sociale — cotisations (CNSS)", amount: cnssSal + cnssPat, side: "c" },
        { accountId: "4472", label: "Impôts sur salaires (retenue à la source)", amount: its, side: "c" },
        { accountId: "422", label: "Personnel, rémunérations dues", amount: net, side: "c" },
      ])));

      // ---- Charges d'exploitation : loyer + fournitures + sous-traitance ----
      const loyer = 250_000;
      const fournitures = Math.round(55_000 + rnd() * 45_000);
      const soustraitance = Math.round(90_000 + rnd() * 110_000);
      out.push(mk(jId("ACH"), d(5), `Loyer bureaux — ${MONTH_FR[m - 1]}`, `LOY-${YEAR}${mm}`, bal([
        { accountId: "6222", label: "Locations de bâtiments", amount: loyer, side: "d" },
        { accountId: "4011", label: "Fournisseurs (bailleur)", amount: loyer, side: "c" },
      ])));
      const achTva = Math.round((fournitures + soustraitance) * 0.18);
      out.push(mk(jId("ACH"), d(8), `Fournitures & sous-traitance — ${MONTH_FR[m - 1]}`, `ACH-${YEAR}${mm}`, bal([
        { accountId: "6052", label: "Fournitures non stockables — Électricité", amount: fournitures, side: "d" },
        { accountId: "621", label: "Sous-traitance générale", amount: soustraitance, side: "d" },
        { accountId: "4452", label: "TVA récupérable sur achats", amount: achTva, side: "d" },
        { accountId: "4011", label: "Fournisseurs", amount: fournitures + soustraitance + achTva, side: "c" },
      ])));

      // ---- Paiement fournisseurs (~70 % des dettes du mois) ----
      const payFourn = Math.round((loyer + fournitures + soustraitance + achTva) * (0.6 + rnd() * 0.25));
      out.push(mk(jId("BAQ"), d(20), `Règlements fournisseurs — ${MONTH_FR[m - 1]}`, `VIR-${YEAR}${mm}`, bal([
        { accountId: "4011", label: "Fournisseurs", amount: payFourn, side: "d" },
        { accountId: "5211", label: "Banques locales", amount: payFourn, side: "c" },
      ])));

      // ---- Impôts & taxes : TPA/TSPP mensuel ----
      const tpa = Math.round(28_000 + rnd() * 9_000);
      out.push(mk(jId("ODV"), d(15), `Impôts sur salaires — ${MONTH_FR[m - 1]}`, `TPA-${YEAR}${mm}`, bal([
        { accountId: "6413", label: "Taxes sur appointements et salaires", amount: tpa, side: "d" },
        { accountId: "4472", label: "Impôts retenus à la source", amount: tpa, side: "c" },
      ])));

      // ---- Événements ponctuels (investissements, emprunt, cession, provision) ----
      if (m === 3) {
        // Acquisition d'une immobilisation
        out.push(mk(jId("IMM"), d(10), "Acquisition serveur de production", `IMM-${YEAR}-01`, bal([
          { accountId: "2442", label: "Matériel informatique", amount: 3_200_000, side: "d" },
          { accountId: "4451", label: "TVA récupérable sur immobilisations", amount: 576_000, side: "d" },
          { accountId: "5211", label: "Banques locales", amount: 3_776_000, side: "c" },
        ])));
      }
      if (m === 4) {
        // Emprunt bancaire
        out.push(mk(jId("BAQ"), d(6), "Emprunt bancaire — investissement", `EMP-${YEAR}-01`, bal([
          { accountId: "5211", label: "Banques locales", amount: 4_000_000, side: "d" },
          { accountId: "162", label: "Emprunts auprès des établissements de crédit", amount: 4_000_000, side: "c" },
        ])));
        // Dotation amortissement (10 ans → 320 000/an)
        out.push(mk(jId("IMM"), d(28), "Dotation aux amortissements — serveur", `AMO-${YEAR}-01`, bal([
          { accountId: "6813", label: "Dotations aux amortissements des immobilisations corporelles", amount: 320_000, side: "d" },
          { accountId: "2842", label: "Amortissements du matériel informatique", amount: 320_000, side: "c" },
        ])));
      }
      if (m === 6) {
        // Créance douteuse — dépréciation
        out.push(mk(jId("ODV"), d(22), "Provision dépréciation créance client", `PROV-${YEAR}-01`, bal([
          { accountId: "6594", label: "Charges provisionnées sur créances", amount: 180_000, side: "d" },
          { accountId: "4912", label: "Dépréciations des créances douteuses", amount: 180_000, side: "c" },
        ])));
      }
      if (m === 2) {
        // Acquisition du mobilier cédé plus tard dans l'année
        out.push(mk(jId("IMM"), d(9), "Acquisition mobilier de bureau", `IMM-${YEAR}-02`, bal([
          { accountId: "2444", label: "Mobilier de bureau", amount: 380_000, side: "d" },
          { accountId: "5211", label: "Banques locales", amount: 380_000, side: "c" },
        ])));
      }
      if (m === 9) {
        // Amortissement du mobilier cédé (10 % — 1 an d'utilisation)
        out.push(mk(jId("IMM"), d(12), "Dotation amortissement — mobilier", `AMO-${YEAR}-02`, bal([
          { accountId: "6813", label: "Dotations aux amortissements des immobilisations corporelles", amount: 38_000, side: "d" },
          { accountId: "2844", label: "Amortissements du mobilier de bureau", amount: 38_000, side: "c" },
        ])));
        // Cession : sortie de l'actif (brut + amortissement cumulé) + produit de cession
        out.push(mk(jId("ODV"), d(14), "Sortie du bilan — mobilier cédé", `CESS-${YEAR}-01A`, bal([
          { accountId: "2844", label: "Amortissements du mobilier (sortie)", amount: 38_000, side: "d" },
          { accountId: "812", label: "Valeurs comptables des cessions — immobilisations corporelles", amount: 342_000, side: "d" },
          { accountId: "2444", label: "Mobilier de bureau (sortie)", amount: 380_000, side: "c" },
        ])));
        out.push(mk(jId("BAQ"), d(14), "Cession matériel bureautique — encaissement", `CESS-${YEAR}-01B`, bal([
          { accountId: "5211", label: "Banques locales", amount: 450_000, side: "d" },
          { accountId: "822", label: "Produits des cessions d'immobilisations corporelles", amount: 450_000, side: "c" },
        ])));
      }
      if (m === 11) {
        // Paiement acompte IS
        out.push(mk(jId("BAQ"), d(18), "Acompte IS — 1re tranche", `IS-${YEAR}-Q4`, bal([
          { accountId: "441", label: "État, impôt sur les bénéfices", amount: 520_000, side: "d" },
          { accountId: "5211", label: "Banques locales", amount: 520_000, side: "c" },
        ])));
        // Abonnement logiciel
        out.push(mk(jId("ACH"), d(9), "Abonnements logiciels & cloud", `ABS-${YEAR}${mm}`, bal([
          { accountId: "6343", label: "Redevances pour logiciels", amount: 145_000, side: "d" },
          { accountId: "4011", label: "Fournisseurs", amount: 145_000, side: "c" },
        ])));
      }
      if (m === 12) {
        // Honoraires + formation
        out.push(mk(jId("ACH"), d(11), "Honoraires experts-comptables & formation", `HON-${YEAR}${mm}`, bal([
          { accountId: "6324", label: "Honoraires", amount: 210_000, side: "d" },
          { accountId: "633", label: "Frais de formation du personnel", amount: 130_000, side: "d" },
          { accountId: "4011", label: "Fournisseurs", amount: 340_000, side: "c" },
        ])));
      }
    }
    return out;
  }

  const historyEntries = buildHistory();

  // ---- Écritures officielles du seed + historique 12 mois ----
  const allEntries = [...entries, ...historyEntries];

  // ============================================================================
  // M10 — DOCUMENTS DE DÉMONSTRATION
  // Sans données, la visionneuse, l'extraction OCR, le classement et le
  // rattachement aux écritures sont invisibles en démo. Les métadonnées
  // reproduisent ce que l'extracteur aurait lu : les champs non lus restent
  // absents (règle : ne rien inventer) et une image scannée est « illisible ».
  // ============================================================================
  const ocrCSV = (fields: Record<string, string>, conf = 82): DocumentItem["extraction"] => ({
    confidence: conf,
    ocrSimulated: true,
    fields,
    engine: "csv",
    readable: true,
    readability: Object.fromEntries(
      Object.entries(fields).map(([k, v]) => [k, { status: "read" as const, confidence: Math.min(90, conf + v.length), note: "Lu depuis le CSV" }]),
    ),
    warnings: [],
  });
  const ocrUnreadable: DocumentItem["extraction"] = {
    confidence: 0,
    ocrSimulated: true,
    fields: {},
    engine: "image",
    readable: false,
    readability: Object.fromEntries(
      (["numero", "date", "fournisseur", "client", "designation", "ht", "tva", "taux_tva", "ttc", "devise"] as const).map((k) => [
        k,
        { status: "unreadable" as const, confidence: 0, note: "Image scannée — lecture indisponible dans le navigateur" },
      ]),
    ),
    warnings: ["Les images scannées nécessitent un service OCR externe.", "Aucune valeur n'a été déduite."],
  };
  const mkDoc = (
    id: string,
    name: string,
    folder: DocFolder,
    month: number,
    size: number,
    extraction: DocumentItem["extraction"],
    docStatus: DocStatus,
    uploadedBy = "Afi AGBO",
  ): DocumentItem => ({
    id,
    companyId: company.id,
    name,
    category: folder === "banque" ? "bank" : folder === "paie" || folder === "social" ? "social" : folder === "juridique" ? "legal" : folder === "fiscal" ? "tax" : "invoice",
    status: docStatus === "comptabilise" ? "validated" : "extracted",
    size,
    uploadedAt: new Date(YEAR, month - 1, 12, 10, 30).toISOString(),
    uploadedById: accountant.id,
    tags: [],
    extraction,
    exercise: String(YEAR),
    month,
    folder,
    docStatus,
    uploadSource: "cabinet",
    uploadedBy,
    tierId: null,
    linkedEntryId: null,
  });
  const documents: DocumentItem[] = [
    mkDoc("doc1", "FACTURE_FAC-1001_Alpha.csv", "vente", 1, 1420, ocrCSV({ numero: "FAC-1001", date: `${YEAR}-01-15`, client: "Société Alpha SARL", ht: "1000000", tva: "180000", ttc: "1180000", devise: "XOF" }), "comptabilise"),
    mkDoc("doc2", "FF-5050_MatInfo.csv", "achat", 1, 1180, ocrCSV({ numero: "FF-5050", date: `${YEAR}-01-18`, fournisseur: "MatInfo SARL", designation: "Lot de matériel réseau", ht: "500000", tva: "90000", ttc: "590000", devise: "XOF" }), "comptabilise"),
    mkDoc("doc3", "Releve_Ecobank_01.csv", "banque", 1, 2360, ocrCSV({ date: `${YEAR}-01-31`, fournisseur: "Ecobank Lomé", designation: "Relevé de compte janvier", ht: "590000" }, 74), "traite"),
    mkDoc("doc4", "LOYER_JANVIER.csv", "achat", 1, 640, ocrCSV({ numero: "LOY-2025-01", date: `${YEAR}-01-20`, fournisseur: "Bailleur Marina", designation: "Loyer bureaux janvier", ht: "250000" }, 78), "comptabilise"),
    mkDoc("doc5", "BULLETIN_K_AGBO.csv", "paie", 2, 890, ocrCSV({ numero: `PAYE-${YEAR}02`, date: `${YEAR}-02-28`, client: "Kossi AGBO", designation: "Salaire février", ht: "450000", devise: "XOF" }, 71), "traite"),
    mkDoc("doc6", "SCANN_FACTURE_0392.jpg", "achat", 2, 1_840_000, ocrUnreadable, "a_traiter"),
    mkDoc("doc7", "FACTURE_FAC-1002_Alpha.csv", "vente", 2, 1510, ocrCSV({ numero: "FAC-1002", date: `${YEAR}-02-14`, client: "Société Alpha SARL", ht: "1200000", tva: "216000", ttc: "1416000", devise: "XOF" }), "a_traiter"),
    mkDoc("doc8", "STATUTS_SARL.pdf", "juridique", 1, 320_000, null, "archive", "Administrateur FIMAAC"),
  ];
  // Rattachement bidirectionnel aux écritures officielles déjà seedées
  if (entries[1]) { entries[1].attachmentDocIds.push("doc1"); documents[0].linkedEntryId = entries[1].id; }
  if (entries[2]) { entries[2].attachmentDocIds.push("doc2"); documents[1].linkedEntryId = entries[2].id; }
  if (entries[4]) { entries[4].attachmentDocIds.push("doc7"); documents[6].linkedEntryId = entries[4].id; }

  return {
    version: 1,
    booted: true,
    accounts,
    organizations,
    users,
    companies,
    journals,
    fiscalYears: [fy, fy2],
    periods,
    entries: allEntries,
    documents,
    bankAccounts: [
      { id: "ba1", companyId: company.id, bankName: "Ecobank Lomé", iban: "TG00 ECOB 0000 1112 2233", currency: "XOF", openingBalance: 5_410_000 },
    ],
    bankTransactions: [
      { id: "bt1", bankAccountId: "ba1", companyId: company.id, date: `${YEAR}-01-25`, label: "Virement fournisseur FF-5050", amount: -590_000, reconciled: true, matchedEntryId: "e4" },
      { id: "bt2", bankAccountId: "ba1", companyId: company.id, date: `${YEAR}-01-28`, label: "Encaissement client FAC-1001", amount: 1_180_000, reconciled: true, matchedEntryId: "e5" },
      { id: "bt3", bankAccountId: "ba1", companyId: company.id, date: `${YEAR}-02-02`, label: "Prélèvement SDE électricité", amount: -75_000, reconciled: false, matchedEntryId: null },
    ],
    fixedAssets: [
      { id: "fa1", companyId: company.id, name: "Ordinateurs portables", category: "Matériel informatique", accountCode: "218", acquisitionDate: `${YEAR - 1}-01-10`, cost: 3_000_000, residualValue: 0, usefulLifeYears: 3, method: "linear", status: "active" },
    ],
    taxProfiles: [
      { id: "tp1", companyId: company.id, regime: "ri", vatPayer: true, tfeLiable: true, obligations: ["TVA mensuelle", "IB annuel", "TSPP"] },
      { id: "tp2", companyId: company2.id, regime: "rs", vatPayer: true, tfeLiable: true, obligations: ["TVA mensuelle"] },
    ],
    taxRules,
    taxDeclarations,
    taxDeadlines,
    employees,
    missions,
    tasks,
    notifications,
    auditLogs,
    conversations: [],
    subscriptions: [subscription],
    invoices,
    clientRequests: [
      { id: "cr1", number: "DEM-0001", organizationId: cabinet.id, companyId: company2.id, direction: "client_to_cabinet", category: "comptable", acteType: "situation_fiscale", title: "Demande de situation fiscale", status: "en_traitement", fields: { exercice: String(YEAR) }, dueDate: null, attachments: [], messages: [{ id: "m1", author: "cabinet", authorId: cabinetAdmin.id, text: "Bien reçu, préparation en cours.", createdAt: NOW() }], history: [{ id: "h1", at: NOW(), label: "Demande soumise par le client", by: "client" }, { id: "h2", at: NOW(), label: "Prise en charge", by: "cabinet" }, { id: "h3", at: NOW(), label: "En traitement", by: "cabinet" }], createdAt: NOW(), updatedAt: NOW() },
      { id: "cr2", number: "DEM-0002", organizationId: cabinet.id, companyId: company2.id, direction: "client_to_cabinet", category: "cartes", acteType: "cif", title: "Carte d'immatriculation fiscale (CIF)", status: "soumise", fields: { annee1: String(YEAR - 1), annee2: String(YEAR) }, dueDate: null, attachments: [], messages: [], history: [{ id: "h4", at: NOW(), label: "Demande soumise par le client", by: "client" }], createdAt: NOW(), updatedAt: NOW() },
    ],
    complianceIssues,
    documentRequests: [
      { id: "dr1", organizationId: cabinet.id, companyId: company.id, category: "ventes", docType: "Factures de vente", periodLabel: `${YEAR}-02`, journalId: jId("VTE"), accountCode: "706", dueDate: `${YEAR}-03-05`, status: "sent", recurring: "monthly", message: "Merci de transmettre le carnet de factures de ventes du mois.", createdAt: NOW() },
      { id: "dr2", organizationId: cabinet.id, companyId: company.id, category: "banque", docType: "Relevés bancaires Ecobank", periodLabel: `${YEAR}-02`, journalId: jId("BAQ"), accountCode: "521", dueDate: `${YEAR}-03-05`, status: "received", recurring: "monthly", message: "Relevés de compte bancaire du mois.", createdAt: NOW() },
      { id: "dr3", organizationId: cabinet.id, companyId: company2.id, category: "achats", docType: "Factures d'achat fournisseurs", periodLabel: `${YEAR}-02`, journalId: jId("ODV"), accountCode: "401", dueDate: `${YEAR}-02-28`, status: "overdue", recurring: "monthly", message: "Factures fournisseurs du mois en attente.", createdAt: NOW() },
      { id: "dr4", organizationId: cabinet.id, companyId: company.id, category: "social", docType: "Bulletins de paie", periodLabel: `${YEAR}-02`, journalId: jId("PAI"), accountCode: "641", dueDate: `${YEAR}-03-10`, status: "to_request", recurring: "monthly", message: "Bulletins de paie du mois.", createdAt: NOW() },
    ],
    taxPaymentRequests: [
      { id: "tpr1", organizationId: cabinet.id, companyId: company.id, taxCode: "TVA", label: "TVA à payer — mensuelle", base: 1_000_000, amount: 90_000, dueDate: `${YEAR}-${String(new Date().getMonth() + 2).padStart(2, "0")}-15`, method: "virement", declarationId: "dec1", status: "to_pay", createdAt: NOW() },
      { id: "tpr2", organizationId: cabinet.id, companyId: company.id, taxCode: "IS", label: "Acompte IS — 1er trimestre", base: 4_000_000, amount: 270_000, dueDate: `${YEAR}-03-31`, method: "virement", declarationId: null, status: "to_pay", createdAt: NOW() },
    ],
    entryTemplates: TEMPLATE_CATALOG.map((t) => ({
      id: t.id,
      organizationId: cabinet.id,
      companyId: t.standard ? company.id : null,
      name: t.name,
      journalId: jId(t.journalCode) || null,
      recurring: t.recurring === "quarterly" ? "monthly" : t.recurring === "yearly" ? "yearly" : t.recurring === "monthly" ? "monthly" : "none",
      lines: t.lines.map((l) => ({ accountId: l.accountId, label: l.label, debit: l.debit, credit: l.credit })),
      lastRun: null,
      createdAt: NOW(),
    })),
    stockItems: [
      { id: "st1", companyId: company.id, name: "Cartouche imprimante", category: "Fournitures", qty: 24, unitPrice: 15000, warehouse: "Lomé", updatedAt: NOW() },
      { id: "st2", companyId: company.id, name: "Ramette papier A4", category: "Fournitures", qty: 80, unitPrice: 3500, warehouse: "Lomé", updatedAt: NOW() },
      { id: "st3", companyId: company.id, name: "Clé USB 32 Go", category: "Matériel", qty: 15, unitPrice: 8000, warehouse: "Lomé", updatedAt: NOW() },
    ],
    payslips: [],
    payrollConfig: {
      cnssEmployeeRate: 4, cnssEmployerRate: 17.5, cnssPlafond: 300000,
      withholdingRate: 5, amuEmployeeRate: 5, amuEmployerRate: 5, amuPlafond: 300000,
      irppBrackets: [], verified: false,
    },
    reconRules: [
      { id: "rr1", organizationId: cabinet.id, label: "Prélèvement SDE (eau)", pattern: "SDE", accountId: "62", amount: 0 },
      { id: "rr2", organizationId: cabinet.id, label: "Frais bancaires", pattern: "commission", accountId: "63", amount: 0 },
    ],
    tiers,
    fsSessions: [
      { id: "fs1", organizationId: cabinet.id, companyId: company.id, exercise: String(YEAR), label: `${company.name} — Exercice ${YEAR}`, status: "controle", balanceN: [], balanceN1: [], auditSummary: null, patchResult: null, coherenceScore: 96, history: [{ id: "fsh1", at: NOW(), label: "Session créée" }, { id: "fsh2", at: NOW(), label: "Contrôles de cohérence lancés (96%)" }], createdAt: NOW(), updatedAt: NOW() },
      { id: "fs2", organizationId: cabinet.id, companyId: company2.id, exercise: String(YEAR), label: `${company2.name} — Exercice ${YEAR}`, status: "a_demarrer", balanceN: [], balanceN1: [], auditSummary: null, patchResult: null, coherenceScore: null, history: [{ id: "fsh3", at: NOW(), label: "Session créée" }], createdAt: NOW(), updatedAt: NOW() },
    ],
    permanentDocs: [
      { id: "pd1", companyId: company.id, name: "Statuts de la société", category: "juridique", date: `${YEAR - 6}-05-10`, note: "Statuts consolidés" },
      { id: "pd2", companyId: company.id, name: "Extrait RCCM", category: "juridique", date: `${YEAR - 6}-05-20`, note: "TG-LFE-2019-B-12345" },
      { id: "pd3", companyId: company.id, name: "Carte NIF", category: "fiscal", date: `${YEAR - 6}-06-01`, note: "NIF 1199887766554" },
      { id: "pd4", companyId: company.id, name: "Convention bancaire Ecobank", category: "banque", date: `${YEAR - 5}-01-15`, note: "Compte courant" },
    ],
    // ---- Regulatory Engine v2 ----
    regulatoryVersions: [
      { id: "reg-togo-2026", country: "TG", year: YEAR, version: "TOGO_2026_REFERENCE", effectiveFrom: `${YEAR}-01-01`, effectiveTo: null, status: "active", officialSource: "OTR / CNSS — À VÉRIFIER", notes: "Taux indicatifs paramétrables" },
    ],
    taxRulesV2: [
      { id: uid(), versionId: "reg-togo-2026", code: "TVA_STANDARD", name: "TVA — Taux normal", type: "vat", rate: 18, base: "excl_tax", periodicity: "monthly", effectiveFrom: `${YEAR}-01-01`, active: true, source: "OTR", verified: false },
      { id: uid(), versionId: "reg-togo-2026", code: "IS_STANDARD", name: "Impôt sur les sociétés", type: "is", rate: 27, base: "amount", periodicity: "annual", effectiveFrom: `${YEAR}-01-01`, active: true, source: "OTR", verified: false },
      { id: uid(), versionId: "reg-togo-2026", code: "TSB", name: "Taxe sur salaires", type: "tsb", rate: 5, base: "salary", periodicity: "monthly", effectiveFrom: `${YEAR}-01-01`, active: true, source: "OTR", verified: false },
    ],
    taxBrackets: [
      { id: uid(), versionId: "reg-togo-2026", taxCode: "IRPP", bracketMin: 0, bracketMax: 900000, rate: 0, order: 1 },
      { id: uid(), versionId: "reg-togo-2026", taxCode: "IRPP", bracketMin: 900000, bracketMax: 3000000, rate: 11, order: 2 },
      { id: uid(), versionId: "reg-togo-2026", taxCode: "IRPP", bracketMin: 3000000, bracketMax: 6000000, rate: 17, order: 3 },
      { id: uid(), versionId: "reg-togo-2026", taxCode: "IRPP", bracketMin: 6000000, bracketMax: 9000000, rate: 23, order: 4 },
      { id: uid(), versionId: "reg-togo-2026", taxCode: "IRPP", bracketMin: 9000000, bracketMax: 12000000, rate: 29, order: 5 },
      { id: uid(), versionId: "reg-togo-2026", taxCode: "IRPP", bracketMin: 12000000, bracketMax: 15000000, rate: 33, order: 6 },
      { id: uid(), versionId: "reg-togo-2026", taxCode: "IRPP", bracketMin: 15000000, bracketMax: 20000000, rate: 37, order: 7 },
      { id: uid(), versionId: "reg-togo-2026", taxCode: "IRPP", bracketMin: 20000000, bracketMax: null, rate: 40, order: 8 },
    ],
    socialRules: [
      { id: uid(), versionId: "reg-togo-2026", organism: "CNSS", code: "CNSS_STANDARD", name: "CNSS standard", employeeRate: 4, employerRate: 17.5, ceiling: 300000, periodicity: "monthly", active: true, source: "CNSS — À VÉRIFIER" },
      { id: uid(), versionId: "reg-togo-2026", organism: "AMU", code: "AMU_STANDARD", name: "AMU standard", employeeRate: 5, employerRate: 5, ceiling: 300000, periodicity: "monthly", active: true, source: "AMU — 5 % salarié / 5 % employeur (taux arbitrés par le porteur le 28/11/2026)" },
    ],
    declarationTemplates: [
      { id: uid(), versionId: "reg-togo-2026", organism: "OTR", code: "TVA_MENSUELLE", name: "TVA mensuelle", periodicity: "monthly", requiredDocuments: ["Journal ventes", "Journal achats"], controls: ["TVA collectée − récupérable = nette"], portal: "DIMANA", active: true },
      { id: uid(), versionId: "reg-togo-2026", organism: "OTR", code: "TSB_MENSUEL", name: "IRPP sur salaires", periodicity: "monthly", requiredDocuments: ["Bulletins de paie"], controls: ["Base TSB = Σ salaires"], portal: "DIMANA", active: true },
      { id: uid(), versionId: "reg-togo-2026", organism: "CNSS", code: "CNSS_MENSUELLE", name: "CNSS mensuelle", periodicity: "monthly", requiredDocuments: ["État du personnel"], controls: ["Base CNSS = paie"], active: true },
      { id: uid(), versionId: "reg-togo-2026", organism: "AMU", code: "AMU_MENSUELLE", name: "AMU mensuelle", periodicity: "monthly", requiredDocuments: ["État du personnel"], controls: ["Base AMU = paie"], active: true },
      { id: uid(), versionId: "reg-togo-2026", organism: "OTR", code: "LIASSE_ANNUELLE", name: "Liasse fiscale GUDEF", periodicity: "annual", requiredDocuments: ["Balance N", "Balance N-1"], controls: ["Actif = Passif"], portal: "GUDEF", active: true },
    ],
    payrollComponents: [
      { id: uid(), code: "SALAIRE_BASE", label: "Salaire de base", type: "earning", cnssTaxable: true, irppTaxable: true, amuTaxable: true, deductible: true, accountingCode: "6611", active: true },
      { id: uid(), code: "PRIME", label: "Primes", type: "earning", cnssTaxable: true, irppTaxable: true, amuTaxable: true, deductible: true, accountingCode: "6612", active: true },
      { id: uid(), code: "INDEMNITE", label: "Indemnités", type: "earning", cnssTaxable: true, irppTaxable: true, amuTaxable: true, deductible: true, accountingCode: "663", active: true },
      { id: uid(), code: "FRAIS_PRO", label: "Frais professionnels", type: "earning", cnssTaxable: false, irppTaxable: false, amuTaxable: false, deductible: false, accountingCode: "625", active: true },
      { id: uid(), code: "AVANCE", label: "Avance sur salaire", type: "deduction", cnssTaxable: false, irppTaxable: false, amuTaxable: false, deductible: false, accountingCode: "421", active: true },
    ],
    declarationWorkflows: [],
    session: { userId: null },
  };
}
