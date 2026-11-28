import { useMemo, useState } from "react";
import { Sparkles, Send, ShieldAlert, CheckCircle2, Bot } from "lucide-react";
import { motion } from "framer-motion";
import { companiesForUser } from "../lib/scope";
import { useDB } from "../lib/store";
import { useAuth } from "../lib/auth";
import { useCompanyScope, Page } from "../components/Layout";
import { Card, Button, Badge, EmptyState } from "../components/ui";
import { AGENTS, aiRespond } from "../lib/ai";

interface Msg { role: "user" | "assistant"; content: string; sources: string[]; verified: boolean; agent: string }

export default function AIAssistant() {
  const db = useDB();
  const { user } = useAuth();
  const { id: companyId } = useCompanyScope();
  const [agent, setAgent] = useState("assistant");
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const company = useMemo(() => db.companies.find((c) => c.id === companyId) || companiesForUser(db, user)[0], [db.companies, companyId, user]);

  const send = (text: string) => {
    if (!text.trim() || !company) return;
    const ctx = {
      entries: db.entries.filter((e) => e.companyId === company.id),
      companyName: company.name,
      overdueDeadlines: db.taxDeadlines.filter((d) => d.companyId === company.id && d.status === "overdue").length,
      unreconciledTx: db.bankTransactions.filter((t) => t.companyId === company.id && !t.reconciled).length,
      openIssues: db.complianceIssues.filter((i) => i.companyId === company.id && !i.resolved).length,
      taxRules: db.taxRules,
    };
    const res = aiRespond(agent, text, ctx);
    setMsgs((p) => [...p, { role: "user", content: text, sources: [], verified: true, agent }, { role: "assistant", content: res.content, sources: res.sources, verified: res.verified, agent: res.agent }]);
    setInput("");
  };

  if (!company) return <Page><EmptyState icon={<Sparkles />} title="Aucune entreprise" /></Page>;

  const suggestions = ["Quel est le résultat de l'exercice ?", "Y a-t-il des anomalies ?", "Calcule la TVA due", "Quel est le taux de l'IS ?"];

  return (
    <Page>
      <div className="mb-5"><h2 className="text-xl font-black tracking-tight text-slate-900">Assistant IA FIMAAC</h2><p className="text-sm text-slate-500">{company.name} · agents spécialisés</p></div>
      <div className="grid gap-6 lg:grid-cols-4">
        <Card className="p-4 lg:col-span-1">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Agents</p>
          <div className="space-y-1">{AGENTS.map((a) => (
            <button key={a.id} onClick={() => setAgent(a.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${agent === a.id ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg" : "hover:bg-slate-100"}`}>
              <span className="text-xl">{a.icon}</span><div><p className="text-sm font-semibold">{a.name}</p><p className={`text-[10px] ${agent === a.id ? "text-indigo-100" : "text-slate-500"}`}>{a.desc}</p></div>
            </button>
          ))}</div>
          <div className="mt-4 rounded-xl bg-rose-50 p-3 text-[11px] text-rose-700"><ShieldAlert size={13} className="mb-1" /> L'IA n'invente jamais de taux, article, obligation ou chiffre. Information non vérifiée = signalée.</div>
        </Card>
        <Card className="flex flex-col lg:col-span-3" style={{ minHeight: 520 }}>
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {msgs.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white"><Bot size={26} /></div>
                <p className="font-bold text-slate-800">{AGENTS.find((a) => a.id === agent)?.name}</p>
                <p className="mb-4 text-sm text-slate-500">Posez votre question ou choisissez une suggestion.</p>
                <div className="flex flex-wrap justify-center gap-2">{suggestions.map((s) => <button key={s} onClick={() => send(s)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-600">{s}</button>)}</div>
              </div>
            )}
            {msgs.map((m, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${m.role === "user" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-800"}`}>
                  <p className="whitespace-pre-wrap text-sm">{m.content}</p>
                  {m.role === "assistant" && (
                    <div className="mt-2 space-y-1.5 border-t border-slate-200 pt-2">
                      {!m.verified && <Badge tone="amber"><ShieldAlert size={11} /> Information non vérifiée</Badge>}
                      {m.verified && <Badge tone="emerald"><CheckCircle2 size={11} /> Basé sur les données</Badge>}
                      {m.sources.length > 0 && <p className="text-[10px] text-slate-500">Sources : {m.sources.join(" · ")}</p>}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
          <div className="border-t border-slate-100 p-3">
            <div className="flex items-center gap-2">
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send(input)} placeholder="Écrivez votre question…" className="h-11 flex-1 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100" />
              <Button onClick={() => send(input)}><Send size={16} /></Button>
            </div>
          </div>
        </Card>
      </div>
    </Page>
  );
}
