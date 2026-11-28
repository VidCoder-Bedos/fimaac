import { Fragment, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, BookOpen, FileText, ListTree, Scale, Trash2, Check, X, Eye, RotateCcw, AlertTriangle, Download, Link2, Wand2, Users, ArrowLeftRight, Lock, Unlock, Paperclip, Pencil } from "lucide-react";
import { useDB } from "../lib/store";
import { useCompanyScope, Page } from "../components/Layout";
import { Card, Button, Badge, StatusBadge, Tabs, Modal, Field, Input, Select, EmptyState, SectionHeading, ProgressBar } from "../components/ui";
import { entryTotals, trialBalance, ledgerForAccount, classTotals, accountSituation } from "../lib/accounting";
import { addJournal, setEntryStatus, counterEntry, letterLines, unletterLines, autoLetter, addThirdParty, updateThirdParty, deleteThirdParty, guidedSettlement, closePeriod, reopenPeriod } from "../lib/actions";
import { fcfa, formatDate, parseFcfa } from "../lib/format";
import { CLASS_LABELS } from "../lib/chartOfAccounts";
import { JOURNAL_TYPE_LABELS } from "../lib/journals";
import type { Account, Journal, JournalEntry, JournalEntryLine, ThirdParty, AccountingPeriod } from "../lib/types";
import { auditNumbering } from "../lib/entryNumbering";
import AccountInquiry from "../components/AccountInquiry";
import { EntryEditor } from "../components/EntryEditor";
import { Can } from "../components/Can";
import { EntryAttachments, AttachmentCount, DocumentViewer } from "../components/DocumentViewer";
import type { DocumentItem } from "../lib/types";

export default function Accounting() {
  const db = useDB();
  const { id: companyId } = useCompanyScope();
  const [tab, setTab] = useState("chart");
  /** Écriture en cours d'édition (null = création). */
  const [editing, setEditing] = useState<JournalEntry | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [inquiry, setInquiry] = useState<{ code: string; tierId?: string } | null>(null);
  const [guidedOpen, setGuidedOpen] = useState(false);
  /** Écriture dont on gère les pièces jointes. */
  const [attachEntry, setAttachEntry] = useState<JournalEntry | null>(null);
  /** Pièce affichée dans la visionneuse. */
  const [viewerDoc, setViewerDoc] = useState<DocumentItem | null>(null);
  const company = db.companies.find((c) => c.id === companyId);
  const postable = useMemo(() => db.accounts.filter((a) => a.postable).sort((a, b) => a.code.localeCompare(b.code)), [db.accounts]);
  const journals = db.journals.filter((j) => j.companyId === companyId);
  const entries = db.entries.filter((e) => e.companyId === companyId).sort((a, b) => +new Date(b.date) - +new Date(a.date));

  if (!company) {
    return <Page><EmptyState icon={<BookOpen />} title="Aucune entreprise sélectionnée" description="Sélectionnez une entreprise dans la barre supérieure." /></Page>;
  }

  return (
    <Page>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-900">Comptabilité — {company.tradeName || company.name}</h2>
          <p className="text-sm text-slate-500">Référentiel SYSCOHADA révisé · Double partie · FCFA</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm"><Download size={15} /> Exporter</Button>
          <Button variant="outline" size="sm" onClick={() => setGuidedOpen(true)}><ArrowLeftRight size={15} /> Saisie guidée</Button>
          <Can permission="accounting.create">
            <Button size="sm" onClick={() => setEditorOpen(true)}><Plus size={15} /> Nouvelle écriture</Button>
          </Can>
        </div>
      </div>
      <div className="mb-6">
        <Tabs active={tab} onChange={setTab} tabs={[
          { id: "chart", label: "Plan comptable", icon: <ListTree size={15} /> },
          { id: "tiers", label: "Tiers", icon: <Users size={15} /> },
          { id: "journals", label: "Journaux", icon: <BookOpen size={15} /> },
          { id: "entries", label: "Écritures", icon: <FileText size={15} /> },
          { id: "ledger", label: "Grand livre", icon: <ListTree size={15} /> },
          { id: "balance", label: "Balance", icon: <Scale size={15} /> },
          { id: "lettrage", label: "Lettrage", icon: <Link2 size={15} /> },
          { id: "cloture", label: "Clôture", icon: <Lock size={15} /> },
        ]} />
      </div>
      {tab === "chart" && <ChartView accounts={db.accounts} onOpen={(c: string) => setInquiry({ code: c })} />}
      {tab === "tiers" && <TiersView companyId={company.id} tiers={db.tiers.filter((t) => t.companyId === company.id)} entries={entries} journals={journals} onOpen={(code: string, tierId?: string) => setInquiry({ code, tierId })} />}
      {tab === "journals" && <JournalsView journals={journals} companyId={company.id} />}
      {tab === "entries" && (
        <div className="space-y-4">
        <NumberingCard entries={entries} journals={journals} />
        <EntriesView
          entries={entries}
          accounts={db.accounts}
          documents={db.documents.filter((d) => d.companyId === company.id)}
          onEdit={(e) => { setEditing(e); setEditorOpen(true); }}
          onAttachments={(e) => setAttachEntry(e)}
          onViewDoc={(d) => setViewerDoc(d)}
        />
        </div>
      )}
      {tab === "ledger" && <LedgerView entries={entries} accounts={postable} />}
      {tab === "balance" && <BalanceView entries={entries} accounts={db.accounts} onOpen={(c: string) => setInquiry({ code: c })} />}
      {tab === "lettrage" && <LettrageView entries={entries} companyId={company.id} />}
      {tab === "cloture" && <ClosingView periods={db.periods.filter((p) => p.companyId === company.id)} entries={entries} />}
      <EntryEditor
        open={editorOpen}
        entry={editing}
        onClose={() => { setEditorOpen(false); setEditing(null); }}
        companyId={company.id}
        journals={journals}
        accounts={postable}
        tiers={db.tiers.filter((t) => t.companyId === company.id)}
      />
      <EntryAttachments entry={attachEntry} onClose={() => setAttachEntry(null)} />
      <AnimatePresence>{viewerDoc && <DocumentViewer doc={viewerDoc} onClose={() => setViewerDoc(null)} />}</AnimatePresence>
      <AccountInquiry open={!!inquiry} onClose={() => setInquiry(null)} accountCode={inquiry?.code} tierId={inquiry?.tierId} entries={entries} accounts={db.accounts} journals={journals} tiers={db.tiers.filter((t) => t.companyId === company.id)} companyName={company.name} />
      <GuidedSettlement open={guidedOpen} onClose={() => setGuidedOpen(false)} companyId={company.id} journals={journals} tiers={db.tiers.filter((t) => t.companyId === company.id)} />
    </Page>
  );
}

/* ---------------- Chart of accounts ---------------- */
function NumberingCard({ entries, journals }: { entries: JournalEntry[]; journals: Journal[] }) {
  const audit = useMemo(() => auditNumbering(entries, journals), [entries, journals]);
  const gapCount = audit.gaps.reduce((n, g) => n + g.missing.length, 0);
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {audit.ok ? <Check size={16} className="text-emerald-500" /> : <AlertTriangle size={16} className="text-rose-500" />}
          <p className="text-sm font-bold text-slate-800">Numérotation des pièces</p>
          <Badge tone={audit.ok ? "emerald" : "rose"}>{audit.ok ? "Aucun doublon" : `${audit.duplicates.length} doublon(s)`}</Badge>
          {audit.malformed.length > 0 && <Badge tone="amber">{audit.malformed.length} illisible(s)</Badge>}
        </div>
        <p className="text-xs text-slate-500">
          {audit.checked} écriture(s) · {audit.counters.length} série(s) · {gapCount} trou(s) d'import
        </p>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        Le prochain numéro reprend après le plus grand numéro existant de chaque journal, jamais après le nombre d'écritures : un numéro supprimé n'est plus recyclé.
      </p>
      {!audit.ok && (
        <div className="mt-2 space-y-1 text-xs text-rose-600">
          {audit.duplicates.slice(0, 3).map((d) => <p key={d.number}>Doublon {d.number} × {d.count}</p>)}
          {audit.malformed.slice(0, 3).map((m) => <p key={m}>Numéro illisible : {m}</p>)}
        </div>
      )}
    </Card>
  );
}

function ChartView({ accounts, onOpen }: { accounts: Account[]; onOpen?: (code: string) => void }) {
  const [q, setQ] = useState("");
  const [openClass, setOpenClass] = useState<number | null>(1);
  const filtered = accounts.filter((a) => !q || a.code.includes(q) || a.label.toLowerCase().includes(q.toLowerCase()));
  const byClass = (c: number) => filtered.filter((a) => a.classNumber === c).sort((a, b) => a.code.localeCompare(b.code));
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="Rechercher un compte…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Badge tone="indigo">{accounts.length} comptes</Badge>
      </div>
      <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700 mb-4">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" /> Plan comptable SYSCOHADA révisé (OHADA) — version de travail. À valider/compléter contre les textes officiels AUDCIF.
      </div>
      <div className="space-y-2">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((c) => {
          const list = byClass(c);
          if (list.length === 0) return null;
          const isOpen = openClass === c || !!q;
          return (
            <div key={c} className="overflow-hidden rounded-xl border border-slate-100">
              <button onClick={() => setOpenClass(isOpen ? null : c)} className="flex w-full items-center justify-between bg-slate-50 px-4 py-3 text-left hover:bg-slate-100">
                <span className="flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">{c}</span><span className="font-bold text-slate-800">{CLASS_LABELS[c]}</span></span>
                <Badge tone="slate">{list.length}</Badge>
              </button>
              {isOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="overflow-hidden">
                  <table className="w-full text-sm">
                    <tbody>
                      {list.map((a) => (
                        <tr key={a.code} className={`border-t border-slate-50 ${a.postable ? "cursor-pointer hover:bg-indigo-50/40" : ""}`} onDoubleClick={a.postable && onOpen ? () => onOpen(a.code) : undefined} title={a.postable ? "Double-clic pour consulter le compte" : ""}>
                          <td className="w-24 px-4 py-2 font-mono font-semibold text-slate-700">{a.code}</td>
                          <td className="px-4 py-2 text-slate-700">{a.label}</td>
                          <td className="w-28 px-4 py-2 text-right"><Badge tone={a.normalBalance === "debit" ? "sky" : "emerald"}>{a.normalBalance === "debit" ? "Débit" : "Crédit"}</Badge></td>
                          <td className="w-28 px-4 py-2 text-right">{a.postable ? <Badge tone="indigo">Imputable</Badge> : <span className="text-xs text-slate-300">titre</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </motion.div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ---------------- Journals ---------------- */
function JournalsView({ journals, companyId }: { journals: Journal[]; companyId: string }) {
  const db = useDB();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", type: "misc" });
  // Types alignés sur journals.ts (18 types)
  const types: Record<string, string> = JOURNAL_TYPE_LABELS;
  const save = () => { if (form.code && form.name) { addJournal(companyId, form.code.toUpperCase(), form.name, form.type as Journal["type"]); setForm({ code: "", name: "", type: "misc" }); setOpen(false); } };
  return (
    <Card className="p-5">
      <SectionHeading title="Journaux" subtitle="Journaux comptables de l'entreprise" action={<Button size="sm" onClick={() => setOpen(true)}><Plus size={15} /> Journal</Button>} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {journals.map((j) => {
          const count = db.entries.filter((e) => e.journalId === j.id).length;
          return (
            <Card key={j.id} hover className="p-4">
              <div className="flex items-center justify-between"><Badge tone="indigo">{j.code}</Badge><span className="text-xs text-slate-400">{count} écriture(s)</span></div>
              <p className="mt-2 font-bold text-slate-800">{j.name}</p>
              <p className="text-xs text-slate-400">{types[j.type]}</p>
            </Card>
          );
        })}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Nouveau journal">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code" required><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="VTE" /></Field>
            <Field label="Type"><Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{Object.entries(types).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          </div>
          <Field label="Libellé" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Journal des ventes" /></Field>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button><Button onClick={save}>Créer</Button></div>
        </div>
      </Modal>
    </Card>
  );
}

/* ---------------- Entries ---------------- */
function EntriesView({ entries, accounts, documents, onEdit, onAttachments, onViewDoc }: {
  entries: JournalEntry[];
  accounts: Account[];
  documents: DocumentItem[];
  onEdit: (e: JournalEntry) => void;
  onAttachments: (e: JournalEntry) => void;
  onViewDoc: (d: DocumentItem) => void;
}) {
  const db = useDB();
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const filtered = entries.filter((e) => filter === "all" || e.status === filter);
  const journalName = (id: string) => db.journals.find((j) => j.id === id)?.code || "—";
  /** Pièces jointes d'une écriture (résolues depuis les métadonnées). */
  const docsOf = (e: JournalEntry) =>
    e.attachmentDocIds.map((id) => documents.find((d) => d.id === id)).filter((d): d is DocumentItem => Boolean(d));

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {["all", "draft", "in_review", "validated", "rejected"].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${filter === s ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}>{s === "all" ? "Toutes" : s === "draft" ? "Brouillons" : s === "validated" ? "Validées" : s === "rejected" ? "Rejetées" : "En revue"}</button>
        ))}
      </div>
      {filtered.length === 0 ? <EmptyState icon={<FileText />} title="Aucune écriture" description="Créez votre première écriture comptable." /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              <th className="px-3 py-2">N°</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Jnl</th><th className="px-3 py-2">Libellé</th><th className="px-3 py-2 text-right">Montant</th><th className="px-3 py-2">Pièces</th><th className="px-3 py-2">Statut</th><th className="px-3 py-2 text-right">Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map((e) => {
                const t = entryTotals(e.lines);
                const isExp = expanded === e.id;
                return (
                  <Fragment key={e.id}>
                    <tr className="border-b border-slate-50 hover:bg-slate-50/60">
                      <td className="cursor-pointer px-3 py-2.5 font-mono font-semibold text-slate-700" onClick={() => setExpanded(isExp ? null : e.id)}>{e.number}</td>
                      <td className="px-3 py-2.5 text-slate-500" onClick={() => setExpanded(isExp ? null : e.id)}>{formatDate(e.date)}</td>
                      <td className="px-3 py-2.5"><Badge tone="slate">{journalName(e.journalId)}</Badge></td>
                      <td className="px-3 py-2.5 text-slate-700" onClick={() => setExpanded(isExp ? null : e.id)}>{e.label}</td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-slate-800">{fcfa(t.debit)}</td>
                      <td className="px-3 py-2.5">
                        <AttachmentCount count={docsOf(e).length} onClick={() => onAttachments(e)} />
                      </td>
                      <td className="px-3 py-2.5"><StatusBadge status={e.status} /></td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setExpanded(isExp ? null : e.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Détails"><Eye size={15} /></button>
                          <button onClick={() => onAttachments(e)} title="Pièces jointes" className="rounded-lg p-1.5 text-indigo-500 hover:bg-indigo-50"><Paperclip size={15} /></button>
                          <button onClick={() => onEdit(e)} title="Modifier l'écriture" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-600"><Pencil size={15} /></button>
                          {/* M2 — actions sensibles réservées aux rôles autorisés */}
                          {e.status === "draft" && <Can permission="accounting.validate"><button onClick={() => setEntryStatus(e.id, "validated")} title="Valider" className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50"><Check size={15} /></button></Can>}
                          {e.status === "draft" && <Can permission="accounting.validate"><button onClick={() => setEntryStatus(e.id, "rejected")} title="Rejeter" className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"><X size={15} /></button></Can>}
                          {e.status === "validated" && <Can permission="accounting.validate"><button onClick={() => counterEntry(e.id)} title="Contrepasser" className="rounded-lg p-1.5 text-amber-600 hover:bg-amber-50"><RotateCcw size={15} /></button></Can>}
                        </div>
                      </td>
                    </tr>
                    {isExp && (
                      <tr className="bg-slate-50/40">
                        <td colSpan={8} className="px-3 py-3">
                          {docsOf(e).length > 0 && (
                            <div className="mb-3 rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
                              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-indigo-600">Pièces jointes ({docsOf(e).length})</p>
                              <div className="flex flex-wrap gap-2">
                                {docsOf(e).map((d) => (
                                  <button key={d.id} onClick={() => onViewDoc(d)} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50">
                                    <Paperclip size={12} /> {d.name.slice(0, 30)}
                                    {d.extraction?.readable === false && <span className="text-rose-500">· illisible</span>}
                                    {d.extraction?.readable && <span className="text-emerald-600">· lu</span>}
                                  </button>
                                ))}
                              </div>
                              <button onClick={() => onAttachments(e)} className="mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                                Gérer les pièces jointes →
                              </button>
                            </div>
                          )}
                          <div className="overflow-hidden rounded-lg border border-slate-100 bg-white">
                            <table className="w-full text-xs">
                              <thead><tr className="bg-slate-50 text-slate-400"><th className="px-3 py-1.5 text-left">Compte</th><th className="px-3 py-1.5 text-left">Libellé</th><th className="px-3 py-1.5 text-right">Débit</th><th className="px-3 py-1.5 text-right">Crédit</th></tr></thead>
                              <tbody>
                                {e.lines.map((l) => {
                                  const acc = accounts.find((a) => a.code === l.accountId);
                                  return <tr key={l.id} className="border-t border-slate-50"><td className="px-3 py-1.5 font-mono text-slate-600">{l.accountId}</td><td className="px-3 py-1.5 text-slate-600">{l.label} <span className="text-slate-300">· {acc?.label}</span></td><td className="px-3 py-1.5 text-right tabular-nums">{l.debit ? fcfa(l.debit) : "—"}</td><td className="px-3 py-1.5 text-right tabular-nums">{l.credit ? fcfa(l.credit) : "—"}</td></tr>;
                                })}
                                <tr className="border-t-2 border-slate-200 font-bold text-slate-800"><td className="px-3 py-1.5" colSpan={2}>Totaux</td><td className="px-3 py-1.5 text-right tabular-nums">{fcfa(t.debit)}</td><td className="px-3 py-1.5 text-right tabular-nums">{fcfa(t.credit)}</td></tr>
                              </tbody>
                            </table>
                          </div>
                          <p className={`mt-2 text-xs font-semibold ${t.balanced ? "text-emerald-600" : "text-rose-600"}`}>{t.balanced ? "✓ Écriture équilibrée (débit = crédit)" : `✗ Déséquilibrée : écart ${fcfa(Math.abs(t.diff))}`}</p>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ---------------- Clôture des périodes ---------------- */
function ClosingView({ periods, entries }: { periods: AccountingPeriod[]; entries: JournalEntry[] }) {
  const sorted = [...periods].sort((a, b) => a.year - b.year || a.month - b.month);
  return (
    <Card className="p-5">
      <SectionHeading title="Clôture des périodes" subtitle="Workflow Sage : clôturer un mois bloque la saisie jusqu'à réouverture." />
      <div className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> Une période clôturée interdit toute saisie ou validation sur ce mois.</div>
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase text-slate-400"><th className="px-3 py-2">Période</th><th className="px-3 py-2 text-right">Écritures</th><th className="px-3 py-2">Statut</th><th className="px-3 py-2 text-right">Action</th></tr></thead>
        <tbody>{sorted.map((p) => { const cnt = entries.filter((e) => e.periodId === p.id).length; return (
          <tr key={p.id} className="border-b border-slate-50"><td className="px-3 py-2.5 font-medium text-slate-800">{p.label}</td><td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{cnt}</td>
            <td className="px-3 py-2.5">{p.status === "closed" ? <Badge tone="rose"><Lock size={11} /> Clôturée</Badge> : <Badge tone="emerald"><Unlock size={11} /> Ouverte</Badge>}</td>
            <td className="px-3 py-2.5 text-right">{p.status === "closed" ? <Button size="sm" variant="outline" onClick={() => reopenPeriod(p.id)}>Réouvrir</Button> : <Button size="sm" onClick={() => closePeriod(p.id)}>Clôturer</Button>}</td></tr>
        ); })}</tbody>
      </table></div>
    </Card>
  );
}

/* ---------------- Saisie guidée de règlement ---------------- */
function GuidedSettlement({ open, onClose, companyId, journals, tiers }: { open: boolean; onClose: () => void; companyId: string; journals: Journal[]; tiers: ThirdParty[] }) {
  const [kind, setKind] = useState<"receipt" | "payment">("payment");
  const [form, setForm] = useState({ tierId: "", amount: "", date: new Date().toISOString().slice(0, 10), journalId: "", reference: "" });
  const bankJournals = journals.filter((j) => j.type === "bank" || j.type === "cash");
  useEffect(() => { if (open) setForm((f) => ({ ...f, journalId: bankJournals[0]?.id || "", tierId: "", amount: "", reference: "" })); /* eslint-disable-next-line */ }, [open]);
  const tierList = tiers.filter((t) => (kind === "receipt" ? t.type === "customer" : t.type === "supplier"));
  const submit = () => {
    const res = guidedSettlement(companyId, { kind, tierId: form.tierId, amount: parseFcfa(form.amount), date: form.date, journalId: form.journalId, reference: form.reference });
    if (!res.ok) { alert(res.error); return; }
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Saisie guidée de règlement">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
          {([["payment", "Règlement fournisseur"], ["receipt", "Encaissement client"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setKind(k)} className={`relative rounded-lg py-2 text-sm font-semibold ${kind === k ? "text-indigo-700" : "text-slate-500"}`}>{kind === k && <motion.span layoutId="gs-tab" className="absolute inset-0 rounded-lg bg-white shadow-sm" />}<span className="relative z-10">{l}</span></button>
          ))}
        </div>
        <Field label="Tiers"><Select value={form.tierId} onChange={(e) => setForm({ ...form, tierId: e.target.value })}><option value="">—</option>{tierList.map((t) => <option key={t.id} value={t.id}>{t.code} · {t.name}</option>)}</Select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Montant (FCFA)" required><Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} inputMode="numeric" /></Field>
          <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Journal (banque/caisse)"><Select value={form.journalId} onChange={(e) => setForm({ ...form, journalId: e.target.value })}>{bankJournals.map((j) => <option key={j.id} value={j.id}>{j.code} · {j.name}</option>)}</Select></Field>
          <Field label="Référence"><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="CHQ-001" /></Field>
        </div>
        <div className="rounded-xl bg-indigo-50 px-3 py-2 text-xs text-indigo-700">Comptabilisation : {kind === "receipt" ? "Débit 521 Banque / Crédit 411 Client" : "Débit 401 Fournisseur / Crédit 521 Banque"} + lettrage automatique du tiers.</div>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Annuler</Button><Button onClick={submit}>Comptabiliser & lettrer</Button></div>
      </div>
    </Modal>
  );
}

/* ---------------- Lettrage ---------------- */
function LettrageView({ entries, companyId }: { entries: JournalEntry[]; companyId: string }) {
  const [acc, setAcc] = useState("4111");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [letter, setLetter] = useState("");
  const rows: { entry: JournalEntry; line: JournalEntryLine }[] = [];
  for (const e of entries) { if (e.status !== "validated") continue; for (const l of e.lines) if (l.accountId === acc) rows.push({ entry: e, line: l }); }
  const unlettered = rows.filter((r) => !r.line.letter);
  const lettered = rows.filter((r) => r.line.letter);
  const letterGroups = [...new Set(lettered.map((r) => r.line.letter))];
  const k = (entryId: string, lineId: string) => `${entryId}|${lineId}`;
  const toggle = (key: string) => setSel((p) => { const n = new Set(p); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const selRows = unlettered.filter((r) => sel.has(k(r.entry.id, r.line.id)));
  const selDebit = selRows.reduce((s, r) => s + r.line.debit, 0);
  const selCredit = selRows.reduce((s, r) => s + r.line.credit, 0);
  const ecart = selDebit - selCredit;
  const doLetter = () => { const targets = [...sel].map((x) => { const [entryId, lineId] = x.split("|"); return { entryId, lineId }; }); letterLines(targets, letter.toUpperCase() || "A"); setSel(new Set()); setLetter(""); };
  const unletter = (code: string) => { const targets = lettered.filter((r) => r.line.letter === code).map((r) => ({ entryId: r.entry.id, lineId: r.line.id })); unletterLines(targets); };
  const solde = unlettered.reduce((s, r) => s + r.line.debit - r.line.credit, 0);
  return (
    <Card className="p-5">
      <SectionHeading title="Lettrage des comptes de tiers" subtitle="Apparier débit et crédit (clients 411 / fournisseurs 401) — l'écart de lettrage doit être nul." action={<Button size="sm" variant="outline" onClick={() => { const r = autoLetter(companyId, acc); alert(r.lettered ? `${r.lettered} ligne(s) lettrée(s) automatiquement.` : "Aucun appariement trouvé."); }}><Wand2 size={14} /> Lettrage auto</Button>} />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Compte de tiers"><Select value={acc} onChange={(e) => { setAcc(e.target.value); setSel(new Set()); }} className="w-56"><option value="4111">4111 — Clients</option><option value="4011">4011 — Fournisseurs</option></Select></Field>
        <div className="rounded-xl bg-slate-50 px-4 py-2 text-sm"><span className="text-slate-400">Solde non lettré : </span><span className={`font-bold tabular-nums ${solde === 0 ? "text-emerald-600" : "text-rose-600"}`}>{fcfa(solde)}</span></div>
      </div>
      {unlettered.length === 0 ? <EmptyState icon={<Link2 />} title="Tout est lettré sur ce compte 🎉" /> : (
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase text-slate-400"><th className="px-2 py-2 w-8"></th><th className="px-2 py-2">Date</th><th className="px-2 py-2">N°</th><th className="px-2 py-2">Libellé</th><th className="px-2 py-2 text-right">Débit</th><th className="px-2 py-2 text-right">Crédit</th></tr></thead>
          <tbody>{unlettered.map((r) => (
            <tr key={r.line.id} className={`border-b border-slate-50 ${sel.has(k(r.entry.id, r.line.id)) ? "bg-indigo-50/50" : ""}`}>
              <td className="px-2 py-2"><input type="checkbox" checked={sel.has(k(r.entry.id, r.line.id))} onChange={() => toggle(k(r.entry.id, r.line.id))} className="h-4 w-4 rounded" /></td>
              <td className="px-2 py-2 text-slate-500">{formatDate(r.entry.date)}</td>
              <td className="px-2 py-2 font-mono text-slate-600">{r.entry.number}</td>
              <td className="px-2 py-2 text-slate-700">{r.line.label}</td>
              <td className="px-2 py-2 text-right tabular-nums">{r.line.debit ? fcfa(r.line.debit) : "—"}</td>
              <td className="px-2 py-2 text-right tabular-nums">{r.line.credit ? fcfa(r.line.credit) : "—"}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3">
        <Input value={letter} onChange={(e) => setLetter(e.target.value)} placeholder="Code (ex. A)" className="h-9 w-32" />
        <Button size="sm" onClick={doLetter} disabled={sel.size < 2 || !letter || ecart !== 0}><Link2 size={14} /> Lettrer ({sel.size})</Button>
        <div className="ml-auto flex items-center gap-4 text-sm">
          <span className="text-slate-500">Débit sel. : <b className="tabular-nums text-slate-800">{fcfa(selDebit)}</b></span>
          <span className="text-slate-500">Crédit sel. : <b className="tabular-nums text-slate-800">{fcfa(selCredit)}</b></span>
          <span className={`font-bold tabular-nums ${ecart === 0 ? "text-emerald-600" : "text-rose-600"}`}>Écart : {fcfa(ecart)}</span>
        </div>
      </div>
      {letterGroups.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Lignes lettrées ({letterGroups.length})</p>
          <div className="space-y-2">{letterGroups.map((code) => {
            const g = lettered.filter((r) => r.line.letter === code);
            const gd = g.reduce((s, r) => s + r.line.debit, 0);
            const gc = g.reduce((s, r) => s + r.line.credit, 0);
            return (
              <div key={code} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-4 py-2.5">
                <div className="flex items-center gap-2"><Badge tone="emerald">{code}</Badge><span className="text-xs text-slate-500">{g.length} ligne(s) · D {fcfa(gd)} / C {fcfa(gc)}</span></div>
                <button onClick={() => unletter(code || "")} className="text-xs font-semibold text-rose-500 hover:text-rose-700">Délettrer</button>
              </div>
            );
          })}</div>
        </div>
      )}
    </Card>
  );
}

/* ---------------- Tiers ---------------- */
function TiersView({ companyId, tiers, entries, journals, onOpen }: { companyId: string; tiers: ThirdParty[]; entries: JournalEntry[]; journals: { id: string; code: string }[]; onOpen: (code: string, tierId?: string) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const blank: { code: string; collective: string; type: "customer" | "supplier"; name: string; city: string; nif: string; contact: string; phone: string; paymentTerms: string; creditLimit: string } = { code: "", collective: "411", type: "customer", name: "", city: "Lomé", nif: "", contact: "", phone: "", paymentTerms: "30 jours", creditLimit: "" };
  const [form, setForm] = useState<typeof blank>(blank);
  const list = tiers.filter((t) => !q || t.name.toLowerCase().includes(q.toLowerCase()) || t.code.toLowerCase().includes(q.toLowerCase()));
  const openNew = () => { setEditId(null); setForm({ ...blank, code: "CLI" + String(tiers.length + 1).padStart(3, "0") }); setOpen(true); };
  const openEdit = (t: ThirdParty) => { setEditId(t.id); setForm({ code: t.code, collective: t.collective, type: t.type, name: t.name, city: t.city || "", nif: t.nif || "", contact: t.contact || "", phone: t.phone || "", paymentTerms: t.paymentTerms || "", creditLimit: t.creditLimit ? String(t.creditLimit) : "" }); setOpen(true); };
  const save = () => { const payload = { ...form, creditLimit: parseInt(form.creditLimit || "0", 10) }; if (editId) updateThirdParty(editId, payload); else addThirdParty(companyId, payload); setOpen(false); };
  return (
    <Card className="p-5">
      <SectionHeading title="Plan des tiers" subtitle="Clients (411) et fournisseurs (401) — fiches auxiliaires rattachées aux comptes collectifs" action={<Button size="sm" onClick={openNew}><Plus size={15} /> Nouveau tiers</Button>} />
      <div className="mb-4 max-w-xs"><div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><Input className="pl-9" placeholder="Rechercher un tiers…" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
      {list.length === 0 ? <EmptyState icon={<Users />} title="Aucun tiers" description="Créez une fiche client ou fournisseur." /> : (
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase text-slate-400"><th className="px-3 py-2">Code</th><th className="px-3 py-2">Nom</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">NIF</th><th className="px-3 py-2 text-right">Débit</th><th className="px-3 py-2 text-right">Crédit</th><th className="px-3 py-2 text-right">Solde</th><th className="px-3 py-2 text-right">Actions</th></tr></thead>
          <tbody>{list.map((t) => { const s = accountSituation(entries, t.collective, journals, t.id); return (
            <tr key={t.id} className="border-b border-slate-50 hover:bg-indigo-50/40">
              <td className="px-3 py-2.5 font-mono font-semibold text-slate-700">{t.code}</td>
              <td className="px-3 py-2.5"><p className="font-semibold text-slate-800">{t.name}</p><p className="text-xs text-slate-400">{t.city}{t.contact ? ` · ${t.contact}` : ""}</p></td>
              <td className="px-3 py-2.5"><Badge tone={t.type === "customer" ? "indigo" : "sky"}>{t.type === "customer" ? "Client" : "Fournisseur"} · {t.collective}</Badge></td>
              <td className="px-3 py-2.5 text-slate-500">{t.nif || "—"}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{fcfa(s.totalDebit)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{fcfa(s.totalCredit)}</td>
              <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-indigo-600">{fcfa(s.solde)}</td>
              <td className="px-3 py-2.5"><div className="flex items-center justify-end gap-1"><Button size="sm" variant="outline" onClick={() => onOpen(t.collective, t.id)}>Consulter</Button><button onClick={() => openEdit(t)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><Eye size={15} /></button><button onClick={() => deleteThirdParty(t.id)} className="rounded-lg p-1.5 text-slate-300 hover:text-rose-500"><Trash2 size={15} /></button></div></td>
            </tr>
          ); })}</tbody>
        </table></div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={editId ? "Modifier la fiche tiers" : "Nouvelle fiche tiers"} size="lg">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type"><Select value={form.type} onChange={(e) => { const type = e.target.value as "customer" | "supplier"; setForm({ ...form, type, collective: type === "customer" ? "411" : "401" }); }}><option value="customer">Client (411)</option><option value="supplier">Fournisseur (401)</option></Select></Field>
          <Field label="Code auxiliaire"><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
          <Field label="Nom / Raison sociale" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Ville"><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
          <Field label="NIF"><Input value={form.nif} onChange={(e) => setForm({ ...form, nif: e.target.value })} /></Field>
          <Field label="Contact"><Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></Field>
          <Field label="Téléphone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Conditions de règlement"><Input value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} /></Field>
          <Field label="Plafond crédit (FCFA)"><Input value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: e.target.value })} inputMode="numeric" /></Field>
        </div>
        <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button><Button onClick={save}>{editId ? "Enregistrer" : "Créer"}</Button></div>
      </Modal>
    </Card>
  );
}

/* ---------------- Ledger ---------------- */
function LedgerView({ entries, accounts }: { entries: JournalEntry[]; accounts: Account[] }) {
  const [acc, setAcc] = useState(accounts[0]?.code || "");
  const lines = ledgerForAccount(entries, acc);
  const totalD = lines.reduce((s, l) => s + l.debit, 0);
  const totalC = lines.reduce((s, l) => s + l.credit, 0);
  return (
    <Card className="p-5">
      <SectionHeading title="Grand livre" subtitle="Mouvements par compte (écritures validées)" action={<Select value={acc} onChange={(e) => setAcc(e.target.value)} className="w-64"><option value="">— Sélectionner —</option>{accounts.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.label}</option>)}</Select>} />
      {lines.length === 0 ? <EmptyState icon={<ListTree />} title="Aucun mouvement" /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase text-slate-400"><th className="px-3 py-2">Libellé</th><th className="px-3 py-2 text-right">Débit</th><th className="px-3 py-2 text-right">Crédit</th></tr></thead>
            <tbody>
              {lines.map((l) => <tr key={l.id} className="border-b border-slate-50"><td className="px-3 py-2 text-slate-700">{l.label}</td><td className="px-3 py-2 text-right tabular-nums">{l.debit ? fcfa(l.debit) : "—"}</td><td className="px-3 py-2 text-right tabular-nums">{l.credit ? fcfa(l.credit) : "—"}</td></tr>)}
              <tr className="border-t-2 font-bold text-slate-800"><td className="px-3 py-2">Totaux</td><td className="px-3 py-2 text-right tabular-nums">{fcfa(totalD)}</td><td className="px-3 py-2 text-right tabular-nums">{fcfa(totalC)}</td></tr>
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ---------------- Balance ---------------- */
function BalanceView({ entries, accounts, onOpen }: { entries: JournalEntry[]; accounts: Account[]; onOpen?: (code: string) => void }) {
  const rows = trialBalance(entries, accounts);
  const classes = classTotals(entries, accounts);
  const tDebit = rows.reduce((s, r) => s + r.debit, 0);
  const tCredit = rows.reduce((s, r) => s + r.credit, 0);
  const tSoldeD = rows.reduce((s, r) => s + r.soldeDebit, 0);
  const tSoldeC = rows.reduce((s, r) => s + r.soldeCredit, 0);
  return (
    <div className="space-y-6">
      <Card className="p-5">
        <SectionHeading title="Balance générale" subtitle="Récapitulatif des comptes (écritures validées)" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {classes.map((c) => <div key={c.classe} className="rounded-xl border border-slate-100 p-3"><p className="text-xs text-slate-400">Classe {c.classe}</p><p className="font-bold text-slate-800">{fcfa(Math.abs(c.solde))}</p></div>)}
        </div>
      </Card>
      <Card className="p-5">
        {rows.length === 0 ? <EmptyState icon={<Scale />} title="Aucune donnée" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase text-slate-400">
                <th className="px-3 py-2">Compte</th><th className="px-3 py-2">Libellé</th><th className="px-3 py-2 text-right">Débit</th><th className="px-3 py-2 text-right">Crédit</th><th className="px-3 py-2 text-right">Solde D</th><th className="px-3 py-2 text-right">Solde C</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => <tr key={r.code} className="cursor-pointer border-b border-slate-50 hover:bg-indigo-50/40" onDoubleClick={onOpen ? () => onOpen(r.code) : undefined} title="Double-clic pour consulter le compte"><td className="px-3 py-2 font-mono font-semibold">{r.code}</td><td className="px-3 py-2 text-slate-600">{r.label}</td><td className="px-3 py-2 text-right tabular-nums">{r.debit ? fcfa(r.debit) : "—"}</td><td className="px-3 py-2 text-right tabular-nums">{r.credit ? fcfa(r.credit) : "—"}</td><td className="px-3 py-2 text-right tabular-nums">{r.soldeDebit ? fcfa(r.soldeDebit) : "—"}</td><td className="px-3 py-2 text-right tabular-nums">{r.soldeCredit ? fcfa(r.soldeCredit) : "—"}</td></tr>)}
                <tr className="border-t-2 border-slate-200 font-bold text-slate-800"><td className="px-3 py-2" colSpan={2}>TOTAUX</td><td className="px-3 py-2 text-right tabular-nums">{fcfa(tDebit)}</td><td className="px-3 py-2 text-right tabular-nums">{fcfa(tCredit)}</td><td className="px-3 py-2 text-right tabular-nums">{fcfa(tSoldeD)}</td><td className="px-3 py-2 text-right tabular-nums">{fcfa(tSoldeC)}</td></tr>
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700"><Check size={14} /> {tDebit === tCredit ? `Balance équilibrée : ${fcfa(tDebit)}` : "Balance déséquilibrée"}</div>
        <div className="mt-3"><p className="mb-1 text-xs font-medium text-slate-400">Contrôle d'équilibre</p><ProgressBar value={tDebit && tCredit ? (1 - Math.abs(tDebit - tCredit) / Math.max(tDebit, tCredit)) * 100 : 0} tone="emerald" /></div>
      </Card>
    </div>
  );
}
