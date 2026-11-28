import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ArrowRight, CornerDownLeft, Building2, FileText, BookOpen, ListChecks } from "lucide-react";
import { companiesForUser } from "../lib/scope";
import { useDB } from "../lib/store";
import { useAuth } from "../lib/auth";
import { fcfa } from "../lib/format";
import { setCurrentCompany } from "../lib/actions";
import { STATIC_COMMANDS, rankCommands, groupCommands, type Command } from "../lib/commands";

const GROUP_ICON: Record<string, React.ReactNode> = {
  "Aller à": <ArrowRight size={15} />,
  Actions: <ListChecks size={15} />,
  Entreprises: <Building2 size={15} />,
  Écritures: <FileText size={15} />,
  Documents: <FileText size={15} />,
};

/**
 * P19 — Palette de commandes.
 *
 * Elle remplace l'ancienne recherche cachée derrière « / » : la même touche
 * fonctionne toujours, mais ⌘K / Ctrl+K est désormais l'entrée annoncée, et la
 * palette sert d'abord à **aller quelque part** ou à **agir**, ensuite à
 * chercher des pièces. Les flèches et Entrée la pilotent sans souris.
 */
export default function GlobalSearch() {
  const db = useDB();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      const isPaletteKey = (e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey);
      if (isPaletteKey && user) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "/" && !typing && !open && user) { e.preventDefault(); setOpen(true); return; }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, user]);

  useEffect(() => {
    // À l'ouverture, on repart d'une liste vierge et de la première entrée.
    if (open) { setQ(""); setActive(0); }
  }, [open]);

  if (!user) return null;
  const scopeCompanies = companiesForUser(db, user);

  // ---- Construction des commandes : navigation, actions, données ----
  const commands = useMemo(() => {
    const ql = q.toLowerCase().trim();
    const list: Command[] = [...STATIC_COMMANDS];
    for (const c of scopeCompanies) {
      list.push({
        id: `co-${c.id}`, label: c.name, group: "Entreprises",
        hint: `${c.legalForm || ""} · NIF ${c.nif || "—"}`, to: `/app/entreprises/${c.id}`,
        keywords: `${c.nif || ""} ${c.tradeName || ""} ${c.city || ""}`,
      });
    }
    if (ql.length >= 2) {
      // Les données ne sont cherchées qu'à partir de deux caractères : en dessous,
      // la palette doit rester une liste d'actions lisible.
      for (const c of scopeCompanies) {
        for (const e of db.entries.filter((x) => x.companyId === c.id)) {
          if (!`${e.number} ${e.label} ${e.reference || ""}`.toLowerCase().includes(ql)) continue;
          const amt = e.lines.reduce((s, l) => s + l.debit, 0);
          list.push({
            id: `en-${e.id}`, label: `${e.number} — ${e.label}`, group: "Écritures",
            hint: `${c.name} · ${fcfa(amt)}`, to: "/app/comptabilite",
            run: () => setCurrentCompany(c.id),
            keywords: `${e.reference || ""} ${e.lines.map((l) => l.accountId).join(" ")}`,
          });
        }
        for (const d of db.documents.filter((x) => x.companyId === c.id)) {
          if (!d.name.toLowerCase().includes(ql)) continue;
          list.push({
            id: `doc-${d.id}`, label: d.name, group: "Documents", hint: `${c.name} · pièce justificative`,
            to: "/app/documents", run: () => setCurrentCompany(c.id),
          });
        }
      }
    }
    return rankCommands(q, list, 6);
  }, [q, db.entries, db.documents, scopeCompanies]);

  const groups = groupCommands(commands);
  const flat = commands;
  const safeActive = Math.min(active, Math.max(flat.length - 1, 0));

  const go = (c: Command | undefined) => {
    if (!c) return;
    c.run?.();
    if (c.to) navigate(c.to);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (flat.length ? (i + 1) % flat.length : 0)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0)); }
    else if (e.key === "Enter") { e.preventDefault(); go(flat[safeActive]); }
  };

  // Garde la ligne active visible dans la liste qui défile.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${safeActive}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [safeActive]);

  let index = -1;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400 transition-all hover:border-indigo-300 hover:text-indigo-600 md:flex"
        aria-keyshortcuts="Meta+K Control+K"
      >
        <Search size={15} /> <span>Rechercher ou aller à…</span>
        <kbd className="ml-4 rounded border border-slate-200 bg-slate-50 px-1.5 text-[10px] font-semibold text-slate-400">⌘K</kbd>
      </button>
      <button onClick={() => setOpen(true)} className="rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 md:hidden" aria-label="Ouvrir la palette de commandes">
        <Search size={18} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-900/40 p-4 backdrop-blur-sm sm:pt-24"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              role="dialog" aria-modal="true" aria-label="Palette de commandes"
              className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl"
              initial={{ opacity: 0, scale: 0.97, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 border-b border-slate-100 px-4">
                <Search size={18} className="text-slate-400" aria-hidden="true" />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => { setQ(e.target.value); setActive(0); }}
                  onKeyDown={onKeyDown}
                  role="combobox"
                  aria-expanded="true"
                  aria-controls="command-list"
                  aria-activedescendant={flat.length ? `command-${safeActive}` : undefined}
                  aria-label="Rechercher une page, une entreprise, une pièce ou une action"
                  placeholder="Aller à une page, une entreprise, une pièce, une action…"
                  className="h-14 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                />
                <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 text-[10px] font-semibold text-slate-400">ESC</kbd>
              </div>
              <div ref={listRef} id="command-list" role="listbox" aria-label="Résultats" className="max-h-[60vh] overflow-y-auto p-2">
                {flat.length === 0 && (
                  <p className="px-3 py-8 text-center text-sm text-slate-400">Aucun résultat pour « {q} ».</p>
                )}
                {groups.map((g) => (
                  <div key={g.group} className="mb-1">
                    <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">{g.group}</p>
                    {g.items.map((c) => {
                      index += 1;
                      const isActive = index === safeActive;
                      return (
                        <button
                          key={c.id}
                          id={`command-${index}`}
                          data-index={index}
                          role="option"
                          aria-selected={isActive}
                          onMouseEnter={() => setActive(index)}
                          onClick={() => go(c)}
                          className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${isActive ? "bg-indigo-50" : ""}`}
                        >
                          <span className={`shrink-0 ${isActive ? "text-indigo-500" : "text-slate-400"}`}>{GROUP_ICON[c.group] || <BookOpen size={15} />}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-slate-800">{c.label}</span>
                            {c.hint && <span className="block truncate text-xs text-slate-400">{c.hint}</span>}
                          </span>
                          {isActive && <ArrowRight size={15} className="shrink-0 text-indigo-500" />}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
                <span className="flex items-center gap-3">
                  <span className="flex items-center gap-1"><CornerDownLeft size={11} /> Ouvrir</span>
                  <span className="hidden sm:inline">↑ ↓ naviguer</span>
                  <span className="hidden sm:inline">⌘K rouvrir</span>
                </span>
                <span>Résultats limités à votre organisation</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
