import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Briefcase, ShieldCheck, TrendingUp, Clock, ArrowRight,
  Users, Wallet, Target, HeartPulse, TrendingDown,
} from "lucide-react";
import { companiesForUser } from "../lib/scope";
import { useDB } from "../lib/store";
import { useAuth } from "../lib/auth";
import { Page } from "../components/Layout";
import { Card, Badge, ProgressBar, SectionHeading, Button } from "../components/ui";
import { AreaTrend, GroupedBars, HBars, Gauge, RadialRings, ScatterPlot, Waterfall, StackedComposition, Sparkline, TrendDelta, fmtMoney } from "../components/charts";
import { computeDashboard } from "../lib/analytics";
import { fcfa, fcfaCompact, formatDate, daysUntil } from "../lib/format";

export default function Dashboard() {
  const db = useDB();
  const { user } = useAuth();
  // M13 — mémoïsé : `companies` et `companyIds` étaient recréés à chaque rendu,
  // ce qui invalidait les dépendances des useMemo (recalcul du dashboard à chaque
  // frappe/cliquer). Dépendances stables désormais.
  const companies = useMemo(() => companiesForUser(db, user), [db.companies, user]);
  const orgId = user?.organizationId;
  const companyIds = useMemo(() => companies.map((c) => c.id), [companies]);
  const [scope, setScope] = useState<string | null>(null); // null = portefeuille entier
  const companyName = (id: string) => {
    const c = companies.find((x) => x.id === id);
    return c?.tradeName || c?.name || "—";
  };
  const activeId = scope && companyIds.includes(scope) ? scope : null;
  const data = useMemo(
    () => computeDashboard(db, activeId, companyIds),
    [db, activeId, companyIds],
  );
  const { summary, health, aggregate } = data;
  const lastIdx = data.months.length - 1;
  const prevIdx = lastIdx > 0 ? lastIdx - 1 : -1;
  const caNow = data.caSeries[lastIdx] ?? 0;
  const caPrev = prevIdx >= 0 ? data.caSeries[prevIdx] : 0;
  const resNow = data.resultatSeries[lastIdx] ?? 0;
  const tresoNow = summary.tresorerie;
  const missions = db.missions.filter((m) => m.organizationId === orgId);
  const recent = [...db.auditLogs].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 5);

  return (
    <Page>
      {/* ---------- Greeting + scope ---------- */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Bonjour, {user?.firstName} 👋</p>
          <h2 className="text-2xl font-black tracking-tight text-slate-900">
            {activeId ? companyName(activeId) : "Vue d'ensemble du portefeuille"}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button onClick={() => setScope(null)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${!scope ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
            Portefeuille ({companies.length})
          </button>
          {companies.map((c) => (
            <button key={c.id} onClick={() => setScope(c.id)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${scope === c.id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              {(c.tradeName || c.name).slice(0, 14)}
            </button>
          ))}
        </div>
      </motion.div>

      {/* ---------- KPI ROW avec sparklines ---------- */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* M4 — la tuile CA affiche le CA strict (70x), cohérent avec le SIG ci-dessous */}
        <KpiTile title="Chiffre d'affaires" value={fcfaCompact(summary.ca)} icon={<TrendingUp size={20} />} tone="indigo" delta={<TrendDelta current={caNow} previous={caPrev} />} spark={data.caSeries} color="#6366f1" />
        <KpiTile title="Résultat" value={fcfaCompact(summary.resultat)} icon={<Target size={20} />} tone={summary.resultat >= 0 ? "emerald" : "rose"} delta={<TrendDelta current={resNow} previous={prevIdx >= 0 ? data.resultatSeries[prevIdx] : 0} />} spark={data.resultatSeries} color={summary.resultat >= 0 ? "#10b981" : "#ef4444"} />
        <KpiTile title="Trésorerie" value={fcfaCompact(tresoNow)} icon={<Wallet size={20} />} tone={tresoNow >= 0 ? "sky" : "rose"} spark={data.tresoSeries} color="#0ea5e9" />
        <KpiTile title="Charges" value={fcfaCompact(summary.charges)} icon={<TrendingDown size={20} />} tone="amber" delta={<TrendDelta current={data.chargesSeries[lastIdx] ?? 0} previous={prevIdx >= 0 ? data.chargesSeries[prevIdx] : 0} invert />} spark={data.chargesSeries} color="#f59e0b" />
      </div>

      {/* ---------- SANTÉ DE L'ENTREPRISE ---------- */}
      <Card className="mt-6 overflow-hidden p-0">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-white">
          <HeartPulse size={17} />
          <h3 className="font-bold">Santé de l'entreprise</h3>
          <Badge tone={health.verdictTone} className="ml-auto">{health.verdict}</Badge>
        </div>
        <div className="grid gap-6 p-5 lg:grid-cols-[200px_1fr_240px]">
          <div className="flex flex-col items-center justify-center">
            <Gauge value={health.global} size={180} label={String(health.global)} sublabel="/ 100" />
            <p className="mt-1 text-center text-xs text-slate-400">Score global pondéré</p>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {health.details.map((d) => (
                <div key={d.label} className="rounded-xl border border-slate-100 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{d.label}</p>
                  <p className="font-display mt-0.5 text-xl font-extrabold text-slate-900">{d.value}</p>
                  <p className="text-[10px] text-slate-400">{d.desc}</p>
                </div>
              ))}
            </div>
            <p className={`rounded-xl px-3 py-2 text-sm font-medium ${health.verdictTone === "emerald" ? "bg-emerald-50 text-emerald-700" : health.verdictTone === "amber" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}>
              {health.verdict}
            </p>
          </div>
          <div className="flex flex-col items-center justify-center gap-3">
            <RadialRings rings={[
              { label: "Santé", value: health.global, color: "#6366f1" },
              { label: "Liqu.", value: health.liquidity, color: "#0ea5e9" },
              { label: "Rent.", value: health.profitability, color: "#10b981" },
              { label: "Conf.", value: health.compliance, color: "#f59e0b" },
            ]} size={160} />
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-indigo-500" />Global</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-500" />Liquidité</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />Rentabilité</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" />Conformité</span>
            </div>
          </div>
        </div>
      </Card>

      {/* ---------- LOT 6 — Renvoi vers le Centre des obligations ---------- */}
      <Card className="mt-6 overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-slate-800 to-slate-900 px-5 py-3 text-white">
          <span className="flex items-center gap-2 font-bold"><Clock size={16} className="text-amber-400" /> Centre des obligations</span>
          <Link to="/app/obligations" className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20">Ouvrir <ArrowRight size={13} /></Link>
        </div>
        <div className="grid grid-cols-3 divide-x divide-slate-100">
          {(() => {
            const inScope = (companyId: string) => companyIds.includes(companyId);
            const late = db.taxDeadlines.filter((d) => inScope(d.companyId) && d.status === "overdue").length;
            const urgent = db.taxDeadlines.filter((d) => inScope(d.companyId) && d.status !== "paid" && daysUntil(d.dueDate) >= 0 && daysUntil(d.dueDate) <= 7).length;
            const pendingDocs = db.documentRequests.filter((r) => inScope(r.companyId) && r.status !== "received").length;
            const toPay = db.taxPaymentRequests.filter((p) => inScope(p.companyId) && p.status !== "paid").length;
            const items = [
              { label: "En retard", value: late, tone: "text-rose-600" },
              { label: "Urgents (≤ 7 j)", value: urgent, tone: "text-amber-600" },
              { label: "Pièces attendues", value: pendingDocs, tone: "text-sky-600" },
              { label: "Paiements à faire", value: toPay, tone: "text-indigo-600" },
            ];
            return items.map((x) => (
              <div key={x.label} className="p-4 text-center">
                <p className={`text-2xl font-black ${x.tone}`}>{x.value}</p>
                <p className="mt-0.5 text-xs text-slate-500">{x.label}</p>
              </div>
            ));
          })()}
        </div>
      </Card>
      {/* ---------- GRAPHIQUES ---------- */}
      {/* CA & Résultat */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <SectionHeading title="Évolution du CA & du résultat" subtitle="Sur les 12 derniers mois — écritures validées" action={<Badge tone="indigo">{data.months.length} mois</Badge>} />
          <AreaTrend
            labels={data.labels}
            series={[
              { name: "CA", data: data.caSeries, color: "#6366f1" },
              { name: "Résultat", data: data.resultatSeries, color: "#10b981" },
            ]}
            height={210}
            showValues={data.months.length <= 6}
          />
          <div className="mt-2 flex flex-wrap gap-4 text-xs">
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-indigo-500" /> Chiffre d'affaires</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-emerald-500" /> Résultat</span>
          </div>
        </Card>
        <Card className="p-5">
          <SectionHeading title="Produits vs Charges" subtitle="Comparaison mensuelle — classe 7 vs classe 6" />
          <GroupedBars
            labels={data.labels}
            series={[
              { name: "Produits", data: data.caSeries, color: "#10b981" },
              { name: "Charges", data: data.chargesSeries, color: "#ef4444" },
            ]}
            height={210}
          />
        </Card>
      </div>

      {/* Waterfall + SIG */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <SectionHeading title="Pont CA → Résultat" subtitle="Décomposition des charges principales (waterfall)" />
          <Waterfall steps={data.waterfall} height={210} />
        </Card>
        <Card className="p-5">
          <SectionHeading title="Soldes intermédiaires de gestion" subtitle="Cascade SYSCOHADA : de la marge au résultat net" />
          <HBars
            items={[
              { label: "Chiffre d'affaires (XB)", value: aggregate.sii.XB },
              { label: "Marge commerciale (XA)", value: aggregate.sii.XA },
              { label: "Valeur ajoutée (XC)", value: aggregate.sii.XC },
              { label: "EBE (XD)", value: aggregate.sii.XD },
              { label: "Rés. exploitation (XE)", value: aggregate.sii.XE },
              { label: "Rés. financier (XF)", value: aggregate.sii.XF },
              { label: "Rés. act. ordinaires (XG)", value: aggregate.sii.XG },
              { label: "Rés. HAO (XH)", value: aggregate.sii.XH },
              { label: "Résultat net (XI)", value: aggregate.sii.XI },
              { label: "CAF", value: aggregate.caf },
            ]}
            color="#6366f1"
            formatter={fmtMoney}
          />
        </Card>
      </div>

      {/* Composition des charges + Trésorerie */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="p-5">
          <SectionHeading title="Composition des charges" subtitle="Répartition par nature (classe 6)" />
          {data.chargesByCat.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">Aucune charge</p> : (
            <>
              <StackedComposition
                segments={data.chargesByCat.slice(0, 6).map((c) => ({ label: c.label, value: c.amount, color: ["#6366f1", "#8b5cf6", "#a78bfa", "#f59e0b", "#ef4444", "#ec4899"][Math.min(5, data.chargesByCat.indexOf(c))] }))}
              />
              <div className="mt-4">
                <HBars items={data.chargesByCat.slice(0, 6).map((c) => ({ label: c.label, value: c.amount }))} color="#ef4444" formatter={fmtMoney} />
              </div>
            </>
          )}
        </Card>
        <Card className="p-5">
          <SectionHeading title="Trésorerie" subtitle="Évolution du solde liquidités (classe 5)" />
          <AreaTrend labels={data.labels} series={[{ name: "Trésorerie", data: data.tresoSeries, color: "#0ea5e9" }]} height={180} />
          <div className="mt-3 flex items-center justify-between rounded-xl bg-sky-50 px-3 py-2">
            <span className="text-xs text-slate-500">Solde actuel</span>
            <span className="font-bold tabular-nums text-sky-700">{fcfa(tresoNow)}</span>
          </div>
        </Card>
        <Card className="p-5">
          <SectionHeading title="Composition des produits" subtitle="Répartition par nature (classe 7)" />
          {data.produitsByCat.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">Aucun produit</p> : (
            <>
              <StackedComposition
                segments={data.produitsByCat.map((c) => ({ label: c.label, value: c.amount, color: ["#10b981", "#34d399", "#6ee7b7", "#a3e635", "#84cc16"][Math.min(4, data.produitsByCat.indexOf(c))] }))}
              />
              <div className="mt-4">
                <HBars items={data.produitsByCat.map((c) => ({ label: c.label, value: c.amount }))} color="#10b981" formatter={fmtMoney} />
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Top tiers + Scatter */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="p-5">
          <SectionHeading title="Top clients" subtitle="Encours par tiers (compte 411)" />
          <HBars items={data.topClients} color="#6366f1" formatter={fmtMoney} />
        </Card>
        <Card className="p-5">
          <SectionHeading title="Top fournisseurs" subtitle="Dettes par tiers (compte 401)" />
          <HBars items={data.topFournisseurs} color="#f43f5e" formatter={fmtMoney} />
        </Card>
        <Card className="p-5">
          <SectionHeading title="Rentabilité vs CA" subtitle="Positionnement par entreprise (nuage de points)" />
          <ScatterPlot points={data.companiesScatter} xLabel="Chiffre d'affaires" yLabel="Résultat" height={180} />
        </Card>
      </div>

      {/* Ratios financiers */}
      <Card className="mt-6 p-5">
        <SectionHeading title="Ratios financiers" subtitle="Calculés en temps réel à partir des écritures validées" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {data.ratios.map((r) => (
            <div key={r.key} className="rounded-xl border border-slate-100 p-3 text-center">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{r.label}</p>
              <p className={`font-display mt-1 text-xl font-extrabold ${r.tone === "emerald" ? "text-emerald-600" : r.tone === "amber" ? "text-amber-600" : r.tone === "rose" ? "text-rose-500" : "text-indigo-600"}`}>{r.value}</p>
              <p className="mt-0.5 text-[9px] text-slate-400">{r.desc}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* ---------- Widgets resserrés ---------- */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-bold text-slate-800"><Clock size={16} className="text-amber-500" /> Échéances</h3>
            <Link to="/app/obligations" className="text-xs font-semibold text-indigo-600">Tout voir</Link>
          </div>
          <div className="space-y-2">
            {db.taxDeadlines.filter((d) => companyIds.includes(d.companyId) && d.status !== "paid").sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate)).slice(0, 3).map((d) => {
              const dd = daysUntil(d.dueDate);
              return (
                <div key={d.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-xs">
                  <span className="truncate font-medium text-slate-700">{d.taxCode} · {companyName(d.companyId)}</span>
                  {dd < 0 ? <Badge tone="rose">{Math.abs(dd)}j retard</Badge> : <Badge tone="slate">{dd}j</Badge>}
                </div>
              );
            })}
          </div>
        </Card>
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-bold text-slate-800"><Briefcase size={16} className="text-indigo-500" /> Missions</h3>
            <Link to="/app/missions" className="text-xs font-semibold text-indigo-600">Tout voir</Link>
          </div>
          <div className="space-y-2.5">
            {missions.slice(0, 3).map((m) => (
              <div key={m.id}>
                <div className="mb-0.5 flex justify-between text-xs"><span className="truncate text-slate-600">{m.title}</span><span className="font-semibold text-slate-400">{m.progress}%</span></div>
                <ProgressBar value={m.progress} tone="violet" />
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-bold text-slate-800"><ShieldCheck size={16} className="text-rose-500" /> Activité</h3>
          </div>
          <div className="space-y-2">
            {recent.map((a) => {
              const actor = db.users.find((u) => u.id === a.userId);
              return (
                <div key={a.id} className="flex gap-2 text-[11px]">
                  <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                  <div><p className="text-slate-700"><b>{actor?.firstName || "Système"}</b> · {a.action.replace(/_/g, " ").toLowerCase()}</p><p className="text-slate-400">{formatDate(a.createdAt)}</p></div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* CTA IA */}
      <Card className="mt-6 flex flex-col items-center justify-between gap-4 bg-gradient-to-br from-indigo-600 to-violet-600 p-5 text-white sm:flex-row">
        <div className="flex items-center gap-3"><Users size={24} /><div><p className="font-bold">Assistant IA FIMAAC</p><p className="text-sm text-indigo-100">Analysez vos données, détectez les anomalies, préparez vos déclarations.</p></div></div>
        <Link to="/app/ia"><Button variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20">Ouvrir l'assistant <ArrowRight size={15} /></Button></Link>
      </Card>
    </Page>
  );
}

/* ---- KPI tile avec sparkline ---- */
function KpiTile({ title, value, icon, tone, delta, spark, color }: {
  title: string; value: string; icon: React.ReactNode; tone: "indigo" | "emerald" | "sky" | "amber" | "rose"; delta?: React.ReactNode; spark: number[]; color: string;
}) {
  const tones: Record<string, string> = {
    indigo: "from-indigo-500 to-violet-600", emerald: "from-emerald-500 to-teal-600",
    sky: "from-sky-500 to-blue-600", amber: "from-amber-500 to-orange-600", rose: "from-rose-500 to-red-600",
  };
  return (
    <Card hover className="group p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-medium text-slate-500">{title}</p>
          <p className="font-display mt-1 text-2xl font-extrabold leading-none tracking-tight text-slate-900">{value}</p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md ${tones[tone]}`}>{icon}</div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        {delta}
        <div className="flex-1"><Sparkline data={spark} color={color} height={28} /></div>
      </div>
    </Card>
  );
}
