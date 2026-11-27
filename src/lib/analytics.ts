// ============================================================================
// FIMAAC — Moteur d'analyse financière pour le tableau de bord
// Calcule toutes les séries et indicateurs à partir des écritures validées.
// Chaque valeur est traçable jusqu'aux comptes SYSCOHADA.
// ============================================================================
import type { DBState, JournalEntry, ThirdParty, ComplianceIssue } from "./types";
import { movementsByAccount, financialSummary, computeRatios } from "./accounting";
import { buildAggregate, type StateAggregate } from "./liasseEngine";
import type { BalanceRow } from "./liasse";

/** Formateur compact partagé avec les graphiques. */
export { fmtMoney } from "../components/charts";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */
export interface MonthPoint {
  key: string;       // "2026-01"
  label: string;     // "janv."
  month: number;
  year: number;
  ca: number;
  produits: number;
  charges: number;
  resultat: number;
  treso: number;
  creances: number;
  dettes: number;
}

export interface CategorySlice {
  code: string;
  label: string;
  amount: number;
}

export interface WorkItem {
  id: string;
  severity: "bloquant" | "urgent" | "important" | "routine";
  category: string;
  title: string;
  detail: string;
  companyName: string;
  companyId: string;
  dueDate: string | null;
  days: number | null;
  actionLabel: string;
  route: string;
  amount?: number;
}

export interface HealthScore {
  global: number;
  liquidity: number;
  profitability: number;
  solvency: number;
  compliance: number;
  verdict: string;
  verdictTone: "emerald" | "amber" | "rose";
  details: { label: string; value: string; desc: string }[];
}

export interface DashboardData {
  months: MonthPoint[];
  labels: string[];
  aggregate: StateAggregate;
  chargesByCat: CategorySlice[];
  produitsByCat: CategorySlice[];
  tresoSeries: number[];
  caSeries: number[];
  resultatSeries: number[];
  chargesSeries: number[];
  topClients: { label: string; value: number }[];
  topFournisseurs: { label: string; value: number }[];
  ratios: ReturnType<typeof computeRatios>;
  summary: ReturnType<typeof financialSummary>;
  waterfall: { label: string; value: number; type: "start" | "minus" | "total" }[];
  companiesScatter: { x: number; y: number; label: string; size?: number }[];
  health: HealthScore;
}

/* ------------------------------------------------------------------ */
/* Sérié mensuelle                                                     */
/* ------------------------------------------------------------------ */
const MONTH_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** Construit la série mensuelle sur les N derniers mois avec données. */
export function monthlySeries(entries: JournalEntry[], months = 12): MonthPoint[] {
  const validated = entries.filter((e) => e.status === "validated");
  // Trouve la plage réelle des données
  const dates = validated.map((e) => e.date).sort();
  if (dates.length === 0) return [];
  const last = new Date(dates[dates.length - 1]);
  const first = new Date(dates[0]);
  // Normalise au 1er du mois
  first.setDate(1);
  last.setDate(1);
  const keys: string[] = [];
  const cursor = new Date(first);
  while (cursor <= last && keys.length < months) {
    keys.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  const map = new Map<string, MonthPoint>();
  for (const k of keys) {
    const [y, m] = k.split("-").map(Number);
    map.set(k, {
      key: k, label: MONTH_SHORT[m - 1], month: m, year: y,
      ca: 0, produits: 0, charges: 0, resultat: 0, treso: 0, creances: 0, dettes: 0,
    });
  }
  for (const e of validated) {
    const k = e.date.slice(0, 7);
    const point = map.get(k);
    if (!point) continue;
    for (const l of e.lines) {
      const net = l.debit - l.credit;
      const code = l.accountId;
      // M4 — le CA du graphique = comptes 70x uniquement, aligné sur sii.XB du SIG
      // (les produits de cession 82 restent dans `produits`, pas dans le CA).
      if (code.startsWith("70")) point.ca += -net;
      if (code.startsWith("7") || code.startsWith("82")) point.produits += -net;
      if (code.startsWith("6") || code.startsWith("81") || code.startsWith("83")) point.charges += net;
      if (code.startsWith("5") && !code.startsWith("56")) point.treso += net;
      if (code.startsWith("41") || code.startsWith("411") || code.startsWith("412")) point.creances += net;
      if (code.startsWith("40") || code.startsWith("42") || code.startsWith("43")) point.dettes += -net;
    }
  }
  return keys.map((k) => {
    const p = map.get(k)!;
    p.resultat = p.produits - p.charges;
    return p;
  });
}

/* ------------------------------------------------------------------ */
/* Répartition par catégorie (charges et produits)                     */
/* ------------------------------------------------------------------ */
const CHARGE_CATS: { prefix: string; label: string; color: string }[] = [
  { prefix: "60", label: "Achats", color: "#6366f1" },
  { prefix: "61", label: "Transports", color: "#8b5cf6" },
  { prefix: "62", label: "Services ext. A", color: "#a78bfa" },
  { prefix: "63", label: "Services ext. B", color: "#c084fc" },
  { prefix: "64", label: "Impôts & taxes", color: "#f59e0b" },
  { prefix: "65", label: "Autres charges", color: "#f97316" },
  { prefix: "66", label: "Charges de personnel", color: "#ef4444" },
  { prefix: "67", label: "Frais financiers", color: "#ec4899" },
  { prefix: "68", label: "Dotations", color: "#f43f5e" },
  { prefix: "81", label: "Valeurs cessions", color: "#fb7185" },
];

const PRODUIT_CATS: { prefix: string; label: string; color: string }[] = [
  { prefix: "70", label: "Ventes & services", color: "#10b981" },
  { prefix: "71", label: "Subventions", color: "#34d399" },
  { prefix: "72", label: "Prod. immobilisés", color: "#6ee7b7" },
  { prefix: "75", label: "Autres produits", color: "#a3e635" },
  { prefix: "77", label: "Revenus financiers", color: "#84cc16" },
  { prefix: "82", label: "Produits cessions", color: "#22c55e" },
];

function buildSlices(entries: JournalEntry[], cats: { prefix: string; label: string; color: string }[]): CategorySlice[] {
  const moves = movementsByAccount(entries.filter((e) => e.status === "validated"));
  const out: CategorySlice[] = [];
  for (const cat of cats) {
    let amount = 0;
    for (const [code, m] of moves) {
      if (code.startsWith(cat.prefix)) {
        amount += cat.prefix.startsWith("6") || cat.prefix === "81" ? m.debit - m.credit : m.credit - m.debit;
      }
    }
    if (Math.abs(amount) > 0) out.push({ code: cat.prefix, label: cat.label, amount: Math.round(amount) });
  }
  return out.sort((a, b) => b.amount - a.amount);
}

export function chargesByCategory(entries: JournalEntry[]): CategorySlice[] {
  return buildSlices(entries, CHARGE_CATS);
}

export function produitsByCategory(entries: JournalEntry[]): CategorySlice[] {
  return buildSlices(entries, PRODUIT_CATS);
}

/* ------------------------------------------------------------------ */
/* Top tiers (clients / fournisseurs) par solde                        */
/* ------------------------------------------------------------------ */
export function topTiers(entries: JournalEntry[], tiers: ThirdParty[], kind: "customer" | "supplier", limit = 6): { label: string; value: number }[] {
  const validated = entries.filter((e) => e.status === "validated");
  const byTier = new Map<string, number>();
  for (const t of tiers.filter((x) => x.type === kind)) {
    let balance = 0;
    for (const e of validated) {
      for (const l of e.lines) {
        if (l.accountId === t.collective && l.thirdPartyId === t.id) balance += l.debit - l.credit;
      }
    }
    if (balance !== 0) byTier.set(t.name, Math.round(Math.abs(balance)));
  }
  return [...byTier.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* Score de santé de l'entreprise                                      */
/* ------------------------------------------------------------------ */
export function computeHealth(
  summary: ReturnType<typeof financialSummary>,
  aggregate: StateAggregate,
  issues: ComplianceIssue[],
  overdueCount: number,
): HealthScore {
  const { creances, tresorerie, dettes, ca, resultat, capitaux, immobilisations } = summary;
  const dettesCT = dettes + aggregate.passif.DK || 0;

  // Liquidité : (créances + trésorerie) / dettes court terme
  const liqRatio = dettesCT > 0 ? (creances + tresorerie) / dettesCT : tresorerie > 0 ? 2 : 0;
  const liquidity = Math.round(Math.max(0, Math.min(100, liqRatio * 50)));

  // Rentabilité : marge nette — M4 : sur le CA strict, cohérent avec le SIG
  const margin = ca > 0 ? (resultat / ca) * 100 : 0;
  const profitability = Math.round(Math.max(0, Math.min(100, 50 + margin * 2.5)));

  // Solvabilité : capitaux propres / total actif
  const totalActif = immobilisations + creances + tresorerie;
  const solvRatio = totalActif > 0 ? capitaux / totalActif : 0;
  const solvency = Math.round(Math.max(0, Math.min(100, solvRatio * 120)));

  // Conformité
  const penalty = issues.filter((i) => !i.resolved).reduce((s, i) => s + (i.severity === "critical" ? 15 : i.severity === "warning" ? 7 : 3), 0);
  const overduePenalty = overdueCount * 5;
  const compliance = Math.max(0, Math.min(100, 100 - penalty - overduePenalty));

  const global = Math.round(liquidity * 0.25 + profitability * 0.25 + solvency * 0.2 + compliance * 0.3);
  const verdictTone: "emerald" | "amber" | "rose" = global >= 80 ? "emerald" : global >= 60 ? "amber" : "rose";
  const verdictText =
    global >= 85 ? "Santé financière solide — situation saine et conforme."
    : global >= 70 ? "Situation globalement satisfaisante — quelques points de vigilance."
    : global >= 55 ? "Situation fragile — des actions correctives sont recommandées."
    : global >= 35 ? "Situation préoccupante — une intervention rapide est nécessaire."
    : "Situation critique — un accompagnement urgent est requis.";

  return {
    global,
    liquidity,
    profitability,
    solvency,
    compliance,
    verdict: verdictText,
    verdictTone,
    details: [
      { label: "Liquidité", value: liqRatio > 0 ? `${liqRatio.toFixed(2)}×` : "—", desc: "(Créances + Tréso) / Dettes CT" },
      { label: "Marge nette", value: `${margin.toFixed(1)} %`, desc: "Résultat / CA" },
      { label: "Autonomie", value: `${(solvRatio * 100).toFixed(0)} %`, desc: "Capitaux / Total actif" },
      { label: "Conformité", value: `${compliance} %`, desc: `${issues.filter((i) => !i.resolved).length} anomalie(s) · ${overdueCount} retard(s)` },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Travail à faire — priorisation automatique                          */
/* ------------------------------------------------------------------ */
interface WorkloadInput {
  db: DBState;
  companyId: string | null;
  companyIds: string[];
  companyName: (id: string) => string;
}

const SEVERITY_ORDER: WorkItem["severity"][] = ["bloquant", "urgent", "important", "routine"];

/** Construit la liste priorisée du travail à faire aujourd'hui. */
export function computeWorkload({ db, companyId, companyIds, companyName }: WorkloadInput): WorkItem[] {
  const items: WorkItem[] = [];
  const now = new Date();
  const days = (iso: string) => Math.ceil((new Date(iso).getTime() - now.setHours(0, 0, 0, 0)) / 86400000);

  // ---- Échéances fiscales ----
  for (const d of db.taxDeadlines) {
    if (!companyIds.includes(d.companyId)) continue;
    if (companyId && d.companyId !== companyId) continue;
    const dd = days(d.dueDate);
    const late = dd < 0 && d.status !== "paid";
    items.push({
      id: `td-${d.id}`, severity: late ? "bloquant" : dd <= 7 ? "urgent" : "important",
      category: "Fiscal", title: d.label,
      detail: `${d.taxCode} · échéance ${d.dueDate.split("-").reverse().join("/")}`,
      companyName: companyName(d.companyId), companyId: d.companyId,
      dueDate: d.dueDate, days: dd, actionLabel: late ? "Régulariser" : "Préparer", route: "/app/fiscalite",
    });
  }

  // ---- Déclarations prêtes à déposer ----
  for (const d of db.taxDeclarations) {
    if (!companyIds.includes(d.companyId)) continue;
    if (companyId && d.companyId !== companyId) continue;
    if (d.status !== "ready") continue;
    const dd = days(d.dueDate);
    items.push({
      id: `dec-${d.id}`, severity: dd <= 7 ? "urgent" : "important",
      category: "Déclaration", title: `${d.taxCode} — ${d.periodLabel}`,
      detail: `Montant ${d.amount.toLocaleString("fr-FR")} FCFA · à déposer`,
      companyName: companyName(d.companyId), companyId: d.companyId,
      dueDate: d.dueDate, days: dd, actionLabel: "Déposer", route: "/app/fiscalite", amount: d.amount,
    });
  }

  // ---- Demandes documentaires en attente ----
  for (const r of db.documentRequests) {
    if (!companyIds.includes(r.companyId)) continue;
    if (companyId && r.companyId !== companyId) continue;
    if (r.status === "received") continue;
    const dd = days(r.dueDate);
    const late = r.status === "overdue" || dd < 0;
    items.push({
      id: `dr-${r.id}`, severity: late ? "bloquant" : dd <= 7 ? "urgent" : "routine",
      category: "Documentaire", title: `${r.docType} (${r.periodLabel})`,
      detail: late ? `Pièce non reçue — ${Math.abs(dd)} j de retard` : `Pièce attendue sous ${dd} j`,
      companyName: companyName(r.companyId), companyId: r.companyId,
      dueDate: r.dueDate, days: dd, actionLabel: "Relancer", route: "/app/demandes",
    });
  }

  // ---- Paiements fiscaux à effectuer ----
  for (const p of db.taxPaymentRequests) {
    if (!companyIds.includes(p.companyId)) continue;
    if (companyId && p.companyId !== companyId) continue;
    if (p.status === "paid") continue;
    const dd = days(p.dueDate);
    const late = dd < 0;
    items.push({
      id: `tpr-${p.id}`, severity: late ? "bloquant" : dd <= 7 ? "urgent" : "important",
      category: "Paiement", title: p.label,
      detail: `${p.taxCode} · ${p.amount.toLocaleString("fr-FR")} FCFA · mode ${p.method}`,
      companyName: companyName(p.companyId), companyId: p.companyId,
      dueDate: p.dueDate, days: dd, actionLabel: "Payer", route: "/app/fiscalite", amount: p.amount,
    });
  }

  // ---- Transactions bancaires non rapprochées ----
  for (const t of db.bankTransactions) {
    if (!companyIds.includes(t.companyId)) continue;
    if (companyId && t.companyId !== companyId) continue;
    if (t.reconciled) continue;
    const dd = days(t.date);
    items.push({
      id: `bt-${t.id}`, severity: Math.abs(dd) > 15 ? "important" : "routine",
      category: "Banque", title: t.label,
      detail: `${Math.abs(t.amount).toLocaleString("fr-FR")} FCFA · non rapprochée depuis ${Math.abs(dd)} j`,
      companyName: companyName(t.companyId), companyId: t.companyId,
      dueDate: t.date, days: dd, actionLabel: "Rapprocher", route: "/app/banque", amount: Math.abs(t.amount),
    });
  }

  // ---- Tâches ouvertes ----
  for (const t of db.tasks) {
    if (t.organizationId && !companyIds.includes(t.companyId || "")) continue;
    if (t.status === "done") continue;
    const dd = days(t.dueDate);
    items.push({
      id: `tk-${t.id}`, severity: t.priority === "high" && dd < 0 ? "urgent" : t.priority === "high" ? "important" : "routine",
      category: "Tâche", title: t.title,
      detail: `Priorité ${t.priority} · ${t.dueDate.split("-").reverse().join("/")}`,
      companyName: t.companyId ? companyName(t.companyId) : "Cabinet",
      companyId: t.companyId || "", dueDate: t.dueDate, days: dd,
      actionLabel: "Traiter", route: "/app/missions",
    });
  }

  // ---- Anomalies critiques non résolues ----
  for (const i of db.complianceIssues) {
    if (!companyIds.includes(i.companyId)) continue;
    if (companyId && i.companyId !== companyId) continue;
    if (i.resolved || i.severity !== "critical") continue;
    items.push({
      id: `ci-${i.id}`, severity: "bloquant",
      category: "Conformité", title: i.title,
      detail: i.recommendation || "Anomalie critique à corriger",
      companyName: companyName(i.companyId), companyId: i.companyId,
      dueDate: null, days: null, actionLabel: "Corriger", route: "/app/conformite",
    });
  }

  return items.sort((a, b) => {
    const si = SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
    if (si !== 0) return si;
    return (a.days ?? 9999) - (b.days ?? 9999);
  });
}

/* ------------------------------------------------------------------ */
/* Agrégateur principal                                                */
/* ------------------------------------------------------------------ */
export function computeDashboard(db: DBState, companyId: string | null, companyIds: string[]): DashboardData {
  const entries = companyId
    ? db.entries.filter((e) => e.companyId === companyId)
    : db.entries.filter((e) => companyIds.includes(e.companyId));

  const months = monthlySeries(entries, 12);
  const labels = months.map((m) => m.label);
  const caSeries = months.map((m) => m.ca);
  const chargesSeries = months.map((m) => m.charges);
  const resultatSeries = months.map((m) => m.resultat);
  const tresoSeries = months.map((m) => m.treso);

  // Agrégat SYSCOHADA (SIG complet)
  const synthetic: BalanceRow[] = [];
  const moves = movementsByAccount(entries);
  for (const [code, m] of [...moves.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    synthetic.push({ code, label: "", debit: m.debit, credit: m.credit });
  }
  const aggregate = buildAggregate([], synthetic);

  const summary = financialSummary(entries);
  const chargesByCat = chargesByCategory(entries);
  const produitsByCat = produitsByCategory(entries);

  const tiers = companyId ? db.tiers.filter((t) => t.companyId === companyId) : db.tiers.filter((t) => companyIds.includes(t.companyId));
  const topClients = topTiers(entries, tiers, "customer");
  const topFournisseurs = topTiers(entries, tiers, "supplier");
  const ratios = computeRatios(summary);

  // Waterfall : CA → principales charges → résultat
  const topCharges = chargesByCat.slice(0, 4);
  const waterfall: { label: string; value: number; type: "start" | "minus" | "total" }[] = [
    // M4 — le pont démarre du CA strict (70x), pas de la classe 7 entière
    { label: "CA", value: summary.ca, type: "start" },
    ...topCharges.map((c) => ({ label: c.label, value: -c.amount, type: "minus" as const })),
    { label: "Autres charges", value: -(summary.charges - topCharges.reduce((s, c) => s + c.amount, 0)), type: "minus" },
    { label: "Résultat", value: summary.resultat, type: "total" },
  ];

  // Scatter par entreprise
  const companiesScatter = companyIds.map((id) => {
    const co = db.companies.find((c) => c.id === id);
    const coEntries = db.entries.filter((e) => e.companyId === id);
    const coSummary = financialSummary(coEntries);
    return {
      x: coSummary.produits,
      y: coSummary.resultat,
      label: (co?.tradeName || co?.name || "?").slice(0, 14),
      size: Math.max(8, Math.min(16, coSummary.tresorerie / 500_000)),
    };
  }).filter((p) => p.x > 0 || p.y !== 0);

  // Santé
  const overdue = db.taxDeadlines.filter((d) => companyIds.includes(d.companyId) && d.status !== "paid" && new Date(d.dueDate) < new Date()).length;
  const issues = db.complianceIssues.filter((i) => companyIds.includes(i.companyId));
  const health = computeHealth(summary, aggregate, issues, overdue);

  return {
    months, labels, aggregate,
    chargesByCat, produitsByCat,
    tresoSeries, caSeries, resultatSeries, chargesSeries,
    topClients, topFournisseurs, ratios, summary, waterfall,
    companiesScatter, health,
  };
}
