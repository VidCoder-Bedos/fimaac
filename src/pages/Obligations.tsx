import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarClock, AlertTriangle, CheckCircle2, Clock, FileText, Receipt,
  ChevronLeft, ChevronRight, Filter, LayoutGrid, CalendarDays,
} from "lucide-react";
import { companiesForUser } from "../lib/scope";
import { useDB } from "../lib/store";
import { useAuth } from "../lib/auth";
import { useCompanyScope, Page } from "../components/Layout";
import { Card, Badge, StatCard, EmptyState, Select, Tabs } from "../components/ui";
import { fcfa, formatDate, daysUntil } from "../lib/format";
import type { BadgeTone } from "../components/ui";

const STATUS_META: Record<string, { tone: BadgeTone; label: string; icon: React.ReactNode }> = {
  a_venir: { tone: "slate", label: "À venir", icon: <Clock size={12} /> },
  a_preparer: { tone: "sky", label: "À préparer", icon: <FileText size={12} /> },
  en_attente: { tone: "amber", label: "En attente de pièces", icon: <Clock size={12} /> },
  en_preparation: { tone: "violet", label: "En préparation", icon: <FileText size={12} /> },
  a_valider: { tone: "indigo", label: "À valider", icon: <CheckCircle2 size={12} /> },
  a_deposer: { tone: "amber", label: "À déposer", icon: <Receipt size={12} /> },
  depose: { tone: "sky", label: "Déposée", icon: <CheckCircle2 size={12} /> },
  a_payer: { tone: "rose", label: "À payer", icon: <Receipt size={12} /> },
  paye: { tone: "emerald", label: "Payée", icon: <CheckCircle2 size={12} /> },
  en_retard: { tone: "rose", label: "En retard", icon: <AlertTriangle size={12} /> },
  corrige: { tone: "violet", label: "Corrigée", icon: <CheckCircle2 size={12} /> },
  archive: { tone: "slate", label: "Archivée", icon: <CheckCircle2 size={12} /> },
};

interface UnifiedObligation {
  id: string;
  source: "fiscal" | "social" | "document" | "task" | "declaration" | "payment";
  companyId: string;
  companyName: string;
  category: string;
  label: string;
  dueDate: string;
  status: string;
  amount?: number;
  periodLabel?: string;
  assigneeId?: string | null;
}

function normalizeStatus(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes("overdue") || s.includes("retard") || s.includes("past")) return "en_retard";
  if (s.includes("paid") || s.includes("paye")) return "paye";
  if (s.includes("submit") || s.includes("depos")) return "depose";
  if (s.includes("ready") || s.includes("pret")) return "a_deposer";
  if (s.includes("review") || s.includes("valide")) return "a_valider";
  if (s.includes("progress") || s.includes("traitement")) return "en_preparation";
  if (s.includes("pending") || s.includes("attente") || s.includes("sent")) return "en_attente";
  if (s.includes("todo") || s.includes("faire")) return "a_preparer";
  if (s.includes("done") || s.includes("complete") || s.includes("received")) return "paye";
  return "a_venir";
}

export default function Obligations() {
  const db = useDB();
  const { user } = useAuth();
  const { id: scopeCompanyId } = useCompanyScope();
  const [tab, setTab] = useState("matrix");
  const [filterCat, setFilterCat] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [calMonth, setCalMonth] = useState(new Date());
  const companies = useMemo(() => {
    return user?.role === "super_admin"
      ? db.companies
      : companiesForUser(db, user);
  }, [db.companies, user]);

  // Aggréger TOUTES les obligations en une liste unifiée
  const allObligations = useMemo<UnifiedObligation[]>(() => {
    const out: UnifiedObligation[] = [];
    const companyMap = new Map(companies.map((c) => [c.id, c.name]));
    // Échéances fiscales
    for (const d of db.taxDeadlines) {
      if (!companyMap.has(d.companyId)) continue;
      if (scopeCompanyId && d.companyId !== scopeCompanyId) continue;
      out.push({
        id: d.id, source: "fiscal", companyId: d.companyId, companyName: companyMap.get(d.companyId) || "—",
        category: "Fiscal", label: d.label, dueDate: d.dueDate, status: normalizeStatus(d.status),
        assigneeId: d.assigneeId,
      });
    }
    // Demandes documentaires
    for (const r of db.documentRequests) {
      if (!companyMap.has(r.companyId)) continue;
      if (scopeCompanyId && r.companyId !== scopeCompanyId) continue;
      out.push({
        id: r.id, source: "document", companyId: r.companyId, companyName: companyMap.get(r.companyId) || "—",
        category: "Documentaire", label: `${r.docType} (${r.periodLabel})`, dueDate: r.dueDate,
        status: r.status === "received" ? "paye" : r.status === "overdue" ? "en_retard" : "en_attente",
        periodLabel: r.periodLabel,
      });
    }
    // Déclarations fiscales
    for (const d of db.taxDeclarations) {
      if (!companyMap.has(d.companyId)) continue;
      if (scopeCompanyId && d.companyId !== scopeCompanyId) continue;
      out.push({
        id: d.id, source: "declaration", companyId: d.companyId, companyName: companyMap.get(d.companyId) || "—",
        category: "Déclaration", label: `${d.taxCode} — ${d.periodLabel}`, dueDate: d.dueDate,
        status: normalizeStatus(d.status), amount: d.amount, periodLabel: d.periodLabel,
      });
    }
    // Demandes de paiement fiscal
    for (const p of db.taxPaymentRequests) {
      if (!companyMap.has(p.companyId)) continue;
      if (scopeCompanyId && p.companyId !== scopeCompanyId) continue;
      out.push({
        id: p.id, source: "payment", companyId: p.companyId, companyName: companyMap.get(p.companyId) || "—",
        category: "Paiement fiscal", label: p.label, dueDate: p.dueDate,
        status: p.status === "paid" ? "paye" : "a_payer", amount: p.amount,
      });
    }
    // Tâches
    for (const t of db.tasks) {
      if (t.status === "done") continue;
      if (!companyMap.has(t.companyId || "")) continue;
      if (scopeCompanyId && t.companyId !== scopeCompanyId) continue;
      out.push({
        id: t.id, source: "task", companyId: t.companyId || "", companyName: t.companyId ? companyMap.get(t.companyId) || "—" : "Cabinet",
        category: "Tâche", label: t.title, dueDate: t.dueDate, status: t.status === "in_progress" ? "en_preparation" : "a_preparer",
        assigneeId: t.assigneeId,
      });
    }
    // Trier par date d'échéance
    return out.sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate));
  }, [db, companies, scopeCompanyId]);

  // Filtres
  const filtered = useMemo(() => {
    let list = allObligations;
    if (filterCat !== "all") list = list.filter((o) => o.category === filterCat);
    if (filterStatus !== "all") list = list.filter((o) => o.status === filterStatus);
    return list;
  }, [allObligations, filterCat, filterStatus]);

  // Statistiques
  const stats = useMemo(() => {
    return {
      total: allObligations.length,
      enRetard: allObligations.filter((o) => o.status === "en_retard").length,
      urgent: allObligations.filter((o) => {
        const d = daysUntil(o.dueDate);
        return d >= 0 && d <= 7 && o.status !== "paye" && o.status !== "depose";
      }).length,
      aFaire: allObligations.filter((o) => o.status === "a_preparer" || o.status === "en_attente" || o.status === "a_valider").length,
      terminees: allObligations.filter((o) => o.status === "paye" || o.status === "depose").length,
    };
  }, [allObligations]);

  // Groupement par catégorie pour la matrice
  const byCategory = useMemo(() => {
    const m: Record<string, UnifiedObligation[]> = {};
    for (const o of filtered) {
      (m[o.category] = m[o.category] || []).push(o);
    }
    return m;
  }, [filtered]);

  // Données calendrier
  const calendarDays = useMemo(() => {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7; // Lundi = 0
    const days: { date: Date | null; obligations: UnifiedObligation[] }[] = [];
    for (let i = 0; i < startOffset; i++) days.push({ date: null, obligations: [] });
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      const iso = date.toISOString().slice(0, 10);
      const dayObs = allObligations.filter((o) => o.dueDate.slice(0, 10) === iso && o.status !== "paye" && o.status !== "depose");
      days.push({ date, obligations: dayObs });
    }
    while (days.length % 7 !== 0) days.push({ date: null, obligations: [] });
    return days;
  }, [calMonth, allObligations]);

  const categories = [...new Set(allObligations.map((o) => o.category))];

  return (
    <Page>
      <div className="mb-5">
        <h2 className="text-xl font-black tracking-tight text-slate-900">Centre des Obligations</h2>
        <p className="text-sm text-slate-500">Vue unifiée fiscal · social · documentaire · tâches — toutes les obligations de votre portefeuille</p>
      </div>
      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard title="Total" value={String(stats.total)} icon={<CalendarClock size={18} />} tone="indigo" />
        <StatCard title="🔴 En retard" value={String(stats.enRetard)} icon={<AlertTriangle size={18} />} tone="rose" />
        <StatCard title="🟠 Urgent (≤ 7j)" value={String(stats.urgent)} icon={<Clock size={18} />} tone="amber" />
        <StatCard title="🔵 À faire" value={String(stats.aFaire)} icon={<FileText size={18} />} tone="sky" />
        <StatCard title="🟢 Terminées" value={String(stats.terminees)} icon={<CheckCircle2 size={18} />} tone="emerald" />
      </div>
      <div className="mb-6">
        <Tabs active={tab} onChange={setTab} tabs={[
          { id: "matrix", label: "Matrice des obligations", icon: <LayoutGrid size={15} /> },
          { id: "calendar", label: "Calendrier", icon: <CalendarDays size={15} /> },
        ]} />
      </div>
      {/* Filtres */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Filter size={15} className="text-slate-400" />
        <Select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="h-9 w-48">
          <option value="all">Toutes catégories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="h-9 w-48">
          <option value="all">Tous statuts</option>
          {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
        <span className="text-xs text-slate-400">{filtered.length} obligation(s)</span>
      </div>
      {tab === "matrix" && (
        <div className="space-y-6">
          {filtered.length === 0 ? (
            <EmptyState icon={<CheckCircle2 />} title="Aucune obligation" description="Toutes les obligations sont à jour. 🎉" />
          ) : (
            Object.entries(byCategory).map(([cat, items]) => (
              <Card key={cat} className="overflow-hidden p-0">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-3">
                  <h3 className="font-bold text-slate-800">{cat}</h3>
                  <Badge tone="slate">{items.length}</Badge>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase text-slate-400">
                        <th className="px-4 py-2">Client</th>
                        <th className="px-4 py-2">Obligation</th>
                        <th className="px-4 py-2 text-right">Échéance</th>
                        <th className="px-4 py-2 text-center">J restants</th>
                        <th className="px-4 py-2 text-right">Montant</th>
                        <th className="px-4 py-2 text-center">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((o) => {
                        const days = daysUntil(o.dueDate);
                        const isLate = days < 0 && o.status !== "paye" && o.status !== "depose";
                        const meta = STATUS_META[o.status] || STATUS_META.a_venir;
                        return (
                          <tr key={o.id} className="border-b border-slate-50 hover:bg-indigo-50/30">
                            <td className="px-4 py-2.5 font-medium text-slate-700">{o.companyName}</td>
                            <td className="px-4 py-2.5 text-slate-600">{o.label}</td>
                            <td className="px-4 py-2.5 text-right text-slate-500">{formatDate(o.dueDate)}</td>
                            <td className="px-4 py-2.5 text-center">
                              <span className={`text-xs font-bold tabular-nums ${isLate ? "text-rose-600" : days <= 7 ? "text-amber-600" : "text-slate-400"}`}>
                                {isLate ? `${Math.abs(days)}j de retard` : days === 0 ? "Aujourd'hui" : `${days}j`}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{o.amount ? fcfa(o.amount) : "—"}</td>
                            <td className="px-4 py-2.5 text-center">
                              <Badge tone={meta.tone}>{meta.icon} {meta.label}</Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            ))
          )}
        </div>
      )}
      {tab === "calendar" && (
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))} className="rounded-lg p-2 hover:bg-slate-100"><ChevronLeft size={18} /></button>
            <h3 className="font-display text-lg font-bold text-slate-900">
              {new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(calMonth)}
            </h3>
            <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))} className="rounded-lg p-2 hover:bg-slate-100"><ChevronRight size={18} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-slate-400">
            {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => <div key={d} className="py-1">{d}</div>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {calendarDays.map((day, i) => {
              if (!day.date) return <div key={i} className="min-h-[80px] rounded-lg bg-slate-50/50" />;
              const isToday = day.date.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
              const hasLate = day.obligations.some((o) => daysUntil(o.dueDate) < 0);
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.005 }}
                  className={`min-h-[80px] rounded-lg border p-1.5 ${isToday ? "border-indigo-300 bg-indigo-50/40" : hasLate ? "border-rose-200 bg-rose-50/30" : "border-slate-100 bg-white"}`}
                >
                  <p className={`text-xs font-bold ${isToday ? "text-indigo-600" : "text-slate-400"}`}>{day.date.getDate()}</p>
                  <div className="mt-0.5 space-y-0.5">
                    {day.obligations.slice(0, 3).map((o) => {
                      const days = daysUntil(o.dueDate);
                      const tone = days < 0 ? "bg-rose-500" : days <= 3 ? "bg-amber-500" : days <= 7 ? "bg-sky-500" : "bg-slate-400";
                      return (
                        <div key={o.id} className={`truncate rounded px-1 py-0.5 text-[9px] font-semibold text-white ${tone}`} title={`${o.companyName} — ${o.label}`}>
                          {o.companyName.slice(0, 8)}…
                        </div>
                      );
                    })}
                    {day.obligations.length > 3 && <p className="text-[9px] text-slate-400">+{day.obligations.length - 3} autres</p>}
                  </div>
                </motion.div>
              );
            })}
          </div>
          {/* Légende */}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-rose-500" /> En retard</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-amber-500" /> ≤ 3 jours</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-sky-500" /> ≤ 7 jours</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-slate-400" /> Plus tard</span>
          </div>
        </Card>
      )}
    </Page>
  );
}
