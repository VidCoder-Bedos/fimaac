import { useMemo, useState } from "react";
import { ShieldCheck, CheckCircle2, AlertTriangle, XCircle, Activity, ArrowLeft, Radio } from "lucide-react";
import { companiesForUser } from "../lib/scope";
import { useDB } from "../lib/store";
import { useAuth } from "../lib/auth";
import { Page } from "../components/Layout";
import { Card, Badge, EmptyState, StatCard, Tabs } from "../components/ui";
import { usePortfolioCoherence, useLiveCoherence } from "../lib/liveCoherence";

export default function ConformityWorkshop() {
  const db = useDB();
  const { user } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const portfolio = usePortfolioCoherence(user?.organizationId || "");
  const companies = companiesForUser(db, user);
  const avgScore = portfolio.length ? Math.round(portfolio.reduce((s, p) => s + p.score, 0) / portfolio.length) : 0;
  const conforme = portfolio.filter((p) => p.score >= 80 && p.issues === 0).length;
  const critiques = portfolio.reduce((s, p) => s + p.critical, 0);
  const current = companies.find((c) => c.id === selected);

  return (
    <Page>
      <div className="mb-5 flex items-center gap-2"><Radio size={16} className="text-emerald-500 live-dot" /><div><h2 className="text-xl font-black tracking-tight text-slate-900">Atelier de conformité & cohérence</h2><p className="text-sm text-slate-500">Évaluation découplée par entreprise · cohérence recalculée en direct</p></div></div>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Entreprises" value={String(portfolio.length)} icon={<ShieldCheck size={18} />} tone="indigo" />
        <StatCard title="Score moyen" value={`${avgScore}%`} icon={<Activity size={18} />} tone={avgScore >= 80 ? "emerald" : "amber"} />
        <StatCard title="Conformes" value={String(conforme)} icon={<CheckCircle2 size={18} />} tone="emerald" />
        <StatCard title="Anomalies critiques" value={String(critiques)} icon={<AlertTriangle size={18} />} tone={critiques ? "rose" : "emerald"} />
      </div>
      {!current ? (
        portfolio.length === 0 ? <EmptyState icon={<ShieldCheck />} title="Aucune entreprise" /> : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{portfolio.map((p) => {
            const tone = p.score >= 80 ? "#10b981" : p.score >= 60 ? "#f59e0b" : "#ef4444";
            return (
              <Card key={p.company.id} hover className="cursor-pointer p-5" onClick={() => setSelected(p.company.id)}>
                <div className="flex items-start justify-between"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white"><ShieldCheck size={18} /></div><div><p className="font-bold text-slate-800">{p.company.name}</p><p className="text-xs text-slate-400">{p.entries} écritures</p></div></div>{p.critical > 0 && <Badge tone="rose">{p.critical} critique</Badge>}</div>
                <div className="mt-4 flex items-center justify-between text-xs text-slate-500"><span>Score de conformité</span><span className="flex items-center gap-1 text-emerald-500"><span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-500" /> en direct</span></div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="relative flex h-12 w-12 items-center justify-center"><svg width={48} height={48} className="-rotate-90"><circle cx={24} cy={24} r={20} fill="none" stroke="#e2e8f0" strokeWidth={4} /><circle cx={24} cy={24} r={20} fill="none" stroke={tone} strokeWidth={4} strokeLinecap="round" strokeDasharray={125.6} strokeDashoffset={125.6 - (p.score / 100) * 125.6} /></svg><span className="absolute text-xs font-bold" style={{ color: tone }}>{p.score}</span></div>
                  <div className="flex-1 space-y-1 text-xs"><div className="flex justify-between"><span className="text-slate-400">Cohérence</span><span className="font-semibold text-slate-700">{p.coherence.score}% · {p.coherence.koCount} écarts</span></div><div className="flex justify-between"><span className="text-slate-400">Plan normatif</span><span className="font-semibold text-slate-700">{p.normative.score}% · {p.normative.koCount} ko</span></div><div className="flex justify-between"><span className="text-slate-400">Anomalies</span><span className="font-semibold text-slate-700">{p.issues}</span></div></div>
                </div>
              </Card>
            );
          })}</div>
        )
      ) : (
        <SessionDetail companyId={current.id} companyName={current.name} onBack={() => setSelected(null)} />
      )}
    </Page>
  );
}

function SessionDetail({ companyId, companyName, onBack }: { companyId: string; companyName: string; onBack: () => void }) {
  const db = useDB();
  const live = useLiveCoherence(companyId);
  const [tab, setTab] = useState("coherence");
  const cats = useMemo(() => [...new Set(live.coherence.lines.map((l) => l.cat))], [live.coherence.lines]);
  return (
    <div>
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-indigo-600"><ArrowLeft size={15} /> Portefeuille</button>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div><h2 className="text-xl font-black tracking-tight text-slate-900">{companyName}</h2><p className="flex items-center gap-1.5 text-sm text-slate-500"><span className="live-dot h-2 w-2 rounded-full bg-emerald-500" /> Cohérence en direct · recalculée à chaque modification</p></div>
        <div className="ml-auto flex items-center gap-2"><Badge tone={live.score >= 80 ? "emerald" : live.score >= 60 ? "amber" : "rose"}>Score {live.score}%</Badge><Badge tone="sky">Cohérence {live.coherence.score}%</Badge><Badge tone="violet">Normatif {live.normative.score}%</Badge></div>
      </div>
      <div className="mb-6"><Tabs active={tab} onChange={setTab} tabs={[{ id: "coherence", label: `Contrôles C1…C9 (${live.coherence.lines.length})` }, { id: "normatif", label: `Plan normatif (${live.normative.checks.length})` }, { id: "anomalies", label: `Anomalies (${live.openIssues})` }]} /></div>
      {tab === "coherence" && (
        <Card className="p-5">
          <div className="mb-3 flex flex-wrap gap-2"><Badge tone="emerald">OK! {live.coherence.okCount}</Badge><Badge tone="rose">Déséquilibrés {live.coherence.koCount}</Badge><Badge tone="amber">Avertissements {live.coherence.warnCount}</Badge></div>
          {cats.map((cat) => {
            const cl = live.coherence.lines.filter((l) => l.cat === cat);
            const ko = cl.some((l) => l.status !== "OK!");
            return (
              <div key={cat} className="mb-4">
                <p className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">{cat} {ko ? <Badge tone="rose">déséquilibré</Badge> : <Badge tone="emerald">OK!</Badge>}</p>
                <div className="overflow-x-auto rounded-xl border border-slate-100"><table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-400"><tr><th className="px-2 py-2 text-left">Réf.</th><th className="px-3 py-2 text-left">Intitulé</th><th className="px-3 py-2 text-right">État N</th><th className="px-3 py-2 text-right">Note N</th><th className="px-2 py-2 text-right">Écart</th><th className="px-2 py-2 text-center">Statut</th></tr></thead>
                  <tbody>{cl.map((l, i) => (<tr key={i} className="border-t border-slate-50"><td className="px-2 py-1.5 font-mono font-semibold text-slate-600">{l.ref}</td><td className="px-3 py-1.5 text-slate-700">{l.label}</td><td className="px-3 py-1.5 text-right tabular-nums">{new Intl.NumberFormat("fr-FR").format(l.etatN)}</td><td className="px-3 py-1.5 text-right tabular-nums">{new Intl.NumberFormat("fr-FR").format(l.noteN)}</td><td className={`px-2 py-1.5 text-right tabular-nums ${l.ecartN !== 0 ? "font-semibold text-rose-600" : "text-slate-400"}`}>{new Intl.NumberFormat("fr-FR").format(l.ecartN)}</td><td className="px-2 py-1.5 text-center"><span className={l.status === "OK!" ? "font-bold text-emerald-600" : "font-bold text-rose-600"}>{l.status}</span></td></tr>))}</tbody>
                </table></div>
              </div>
            );
          })}
        </Card>
      )}
      {tab === "normatif" && (
        <Card className="p-5">
          <SectionTitle title="Contrôle normatif du plan & de la chaîne des écritures" />
          <div className="space-y-2">{live.normative.checks.map((c) => (
            <div key={c.id} className="flex items-start gap-3 rounded-xl border border-slate-100 px-4 py-3">
              {c.status === "OK!" ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-500" /> : c.status === "Avertissement" ? <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-500" /> : <XCircle size={18} className="mt-0.5 shrink-0 text-rose-500" />}
              <div className="flex-1"><div className="flex items-center justify-between"><p className="font-semibold text-slate-800">{c.title}</p><span className={c.status === "OK!" ? "text-xs font-bold text-emerald-600" : c.status === "Avertissement" ? "text-xs font-bold text-amber-600" : "text-xs font-bold text-rose-600"}>{c.status}</span></div><p className="mt-0.5 text-xs text-slate-500">{c.detail}</p>{c.data && <p className="mt-0.5 text-[11px] tabular-nums text-slate-400">{c.data}</p>}</div>
            </div>
          ))}</div>
        </Card>
      )}
      {tab === "anomalies" && (
        <Card className="p-5">
          <SectionTitle title="Anomalies de conformité ouvertes" />
          {live.openIssues === 0 ? <EmptyState icon={<CheckCircle2 />} title="Aucune anomalie 🎉" /> : (
            <div className="space-y-2">{db.complianceIssues.filter((i) => i.companyId === companyId && !i.resolved).map((i) => (
              <div key={i.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3"><div className="flex items-center gap-2"><Badge tone={i.severity === "critical" ? "rose" : i.severity === "warning" ? "amber" : "sky"}>{i.severity}</Badge><div><p className="font-semibold text-slate-800">{i.title}</p><p className="text-xs text-slate-400">{i.recommendation}</p></div></div></div>
            ))}</div>
          )}
        </Card>
      )}
    </div>
  );
}

function SectionTitle({ title }: { title: string }) { return <p className="mb-3 font-display text-sm font-bold text-slate-700">{title}</p>; }
