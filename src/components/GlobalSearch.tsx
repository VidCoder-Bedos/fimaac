import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ArrowRight, CornerDownLeft } from "lucide-react";
import { companiesForUser } from "../lib/scope";
import { useDB } from "../lib/store";
import { useAuth } from "../lib/auth";
import { fcfa } from "../lib/format";
import { setCurrentCompany } from "../lib/actions";

interface Result { type: string; label: string; sub: string; to: string; onClick?: () => void; icon?: string }
const TYPE_ICON: Record<string, string> = { Écriture: "🧾", Entreprise: "🏢", Document: "📄", Compte: "📒", Tâche: "✅", Journal: "📚" };

export default function GlobalSearch() {
  const db = useDB();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (e.key === "/" && !typing && !open && user) { e.preventDefault(); setOpen(true); }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, user]);

  if (!user || user.userType === "client") return null;
  const scopeCompanies = companiesForUser(db, user);
  const ql = q.toLowerCase().trim();
  const results: Result[] = [];
  if (ql.length >= 1) {
    for (const c of scopeCompanies) {
      for (const e of db.entries.filter((x) => x.companyId === c.id)) {
        const amt = e.lines.reduce((s, l) => s + l.debit, 0);
        const hay = `${e.number} ${e.label} ${e.reference} ${amt} ${e.lines.map((l) => l.accountId).join(" ")}`.toLowerCase();
        if (hay.includes(ql)) results.push({ type: "Écriture", label: `${e.number} — ${e.label}`, sub: `${c.name} · ${fcfa(amt)}`, to: "/app/comptabilite", onClick: () => setCurrentCompany(c.id) });
      }
      if (c.name.toLowerCase().includes(ql) || (c.nif || "").includes(ql)) results.push({ type: "Entreprise", label: c.name, sub: `${c.legalForm} · NIF ${c.nif || "—"}`, to: `/app/entreprises/${c.id}` });
    }
    for (const d of db.documents) {
      if (scopeCompanies.some((c) => c.id === d.companyId) && d.name.toLowerCase().includes(ql)) results.push({ type: "Document", label: d.name, sub: "Pièce justificative", to: "/app/documents", onClick: () => setCurrentCompany(d.companyId) });
    }
    for (const a of db.accounts) {
      if (a.code.includes(ql) || a.label.toLowerCase().includes(ql)) results.push({ type: "Compte", label: `${a.code} · ${a.label}`, sub: "Plan comptable SYSCOHADA", to: "/app/comptabilite" });
    }
    for (const t of db.tasks) {
      if (t.organizationId === user.organizationId && t.title.toLowerCase().includes(ql)) results.push({ type: "Tâche", label: t.title, sub: "Mission & tâches", to: "/app/missions" });
    }
  }
  const groups = results.slice(0, 30).reduce<Record<string, Result[]>>((acc, r) => { (acc[r.type] = acc[r.type] || []).push(r); return acc; }, {});
  const go = (r: Result) => { r.onClick?.(); navigate(r.to); setOpen(false); setQ(""); };

  return (
    <>
      <button onClick={() => setOpen(true)} className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400 transition-all hover:border-indigo-300 hover:text-indigo-600 md:flex">
        <Search size={15} /> <span>Rechercher…</span> <kbd className="ml-6 rounded border border-slate-200 bg-slate-50 px-1.5 text-[10px] font-semibold text-slate-400">/</kbd>
      </button>
      <button onClick={() => setOpen(true)} className="rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 md:hidden"><Search size={18} /></button>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-900/40 p-4 backdrop-blur-sm sm:pt-24" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
            <motion.div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl" initial={{ opacity: 0, scale: 0.97, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 border-b border-slate-100 px-4">
                <Search size={18} className="text-slate-400" />
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher écritures, entreprises, comptes, documents…" className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
                <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 text-[10px] font-semibold text-slate-400">ESC</kbd>
              </div>
              <div className="max-h-[60vh] overflow-y-auto p-2">
                {ql.length < 1 && <p className="px-3 py-8 text-center text-sm text-slate-400">Tapez pour rechercher dans toutes les données accessibles.</p>}
                {ql.length >= 1 && Object.keys(groups).length === 0 && <p className="px-3 py-8 text-center text-sm text-slate-400">Aucun résultat pour « {q} ».</p>}
                {Object.entries(groups).map(([type, items]) => (
                  <div key={type} className="mb-1">
                    <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">{type}</p>
                    {items.map((r, i) => (
                      <button key={i} onClick={() => go(r)} className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-indigo-50">
                        <span className="text-lg">{TYPE_ICON[type] || "🔎"}</span>
                        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{r.label}</p><p className="truncate text-xs text-slate-400">{r.sub}</p></div>
                        <ArrowRight size={15} className="text-slate-300 group-hover:text-indigo-500" />
                      </button>
                    ))}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400"><span className="flex items-center gap-1"><CornerDownLeft size={11} /> Ouvrir</span><span>Recherche limitée à votre organisation</span></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
