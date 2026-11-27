import { useState } from "react";
import { FileInput, Plus, Trash2, Play, Receipt, ClipboardList, CheckCircle2, CreditCard, Library } from "lucide-react";
import { useDB } from "../lib/store";
import { useCompanyScope, Page } from "../components/Layout";
import { Card, Button, Badge, EmptyState, SectionHeading, StatCard, Modal, Field, Input, Select, Tabs } from "../components/ui";
import {
  createDocumentRequest, deleteDocumentRequest,
  createEntryTemplate, runEntryTemplate, deleteEntryTemplate,
  createTaxPaymentRequest, markTaxPaymentPaid,
  setClientRequestStatus,
  activateTemplate, runTemplateWithAmount,
} from "../lib/actions";
import { STATUS_LABELS } from "../lib/clientCatalog";
import { TEMPLATE_CATEGORIES } from "../lib/entryTemplates";
import { availableTemplates } from "../lib/actions";
import { fcfa, formatDate, relativeTime } from "../lib/format";
import type { Journal, Account, DocumentRequest, EntryTemplate, TaxPaymentRequest, ClientRequest, ClientRequestStatus } from "../lib/types";

type Recurring = DocumentRequest["recurring"];

const CATS = [
  { id: "ventes", label: "Ventes" }, { id: "achats", label: "Achats" }, { id: "banque", label: "Banque" },
  { id: "caisse", label: "Caisse" }, { id: "paie", label: "Paie" }, { id: "social", label: "Social" },
  { id: "fiscal", label: "Fiscal" }, { id: "stocks", label: "Stocks" }, { id: "immobilisations", label: "Immobilisations" },
];

export default function Requests() {
  const db = useDB();
  const { id: companyId } = useCompanyScope();
  const [tab, setTab] = useState("docs");
  const company = db.companies.find((c) => c.id === companyId);
  const docReqs = db.documentRequests.filter((r) => r.companyId === companyId);
  // Correction LOT 11 : les modèles partagés (companyId null) sont visibles de toutes les entreprises
  const templates = availableTemplates(db, companyId!);
  const taxPay = db.taxPaymentRequests.filter((r) => r.companyId === companyId);
  const clientReqs = db.clientRequests.filter((r) => r.companyId === companyId).sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
  if (!company) return <Page><EmptyState icon={<ClipboardList />} title="Sélectionnez une entreprise" /></Page>;
  return (
    <Page>
      <div className="mb-5"><h2 className="text-xl font-black tracking-tight text-slate-900">Demandes & modèles — {company.tradeName || company.name}</h2><p className="text-sm text-slate-500">Demandes documentaires, modèles d'écritures, paiements fiscaux & demandes clients</p></div>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Demandes doc." value={String(docReqs.length)} icon={<FileInput size={18} />} tone="indigo" />
        <StatCard title="Modèles" value={String(templates.length)} icon={<Plus size={18} />} tone="violet" />
        <StatCard title="Paiements fiscaux" value={String(taxPay.length)} icon={<CreditCard size={18} />} tone="amber" />
        <StatCard title="Demandes clients" value={String(clientReqs.length)} icon={<ClipboardList size={18} />} tone="sky" />
      </div>
      <div className="mb-6"><Tabs active={tab} onChange={setTab} tabs={[{ id: "docs", label: "Demandes documentaires" }, { id: "templates", label: "Mes modèles" }, { id: "library", label: "Bibliothèque", icon: <Library size={15} /> }, { id: "tax", label: "Paiements fiscaux" }, { id: "client", label: "Demandes clients" }]} /></div>
      {tab === "docs" && <DocRequestsTab companyId={company.id} items={docReqs} journals={db.journals.filter((j) => j.companyId === company.id)} />}
      {tab === "templates" && <TemplatesTab companyId={company.id} items={templates} accounts={db.accounts.filter((a) => a.postable)} journals={db.journals.filter((j) => j.companyId === company.id)} />}
      {tab === "library" && <LibraryTab companyId={company.id} active={templates} all={db.entryTemplates} />}
      {tab === "tax" && <TaxPayTab companyId={company.id} items={taxPay} />}
      {tab === "client" && <ClientReqsTab items={clientReqs} />}
    </Page>
  );
}

/* ---- Demandes documentaires (cabinet -> client) ---- */
function DocRequestsTab({ companyId, items, journals }: { companyId: string; items: DocumentRequest[]; journals: Journal[] }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ category: "ventes", docType: "", periodLabel: "", journalId: "", accountCode: "", dueDate: new Date().toISOString().slice(0, 10), recurring: "monthly" as Recurring, message: "" });
  return (
    <Card className="p-5">
      <SectionHeading title="Demandes documentaires" subtitle="Sollicitez des pièces auprès du client via le portail" action={<Button size="sm" onClick={() => setOpen(true)}><Plus size={15} /> Demander</Button>} />
      {items.length === 0 ? <EmptyState icon={<FileInput />} title="Aucune demande documentaire" /> : (
        <div className="space-y-2">{items.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2"><Badge tone="indigo">{r.category}</Badge><div><p className="font-semibold text-slate-800">{r.docType}</p><p className="text-xs text-slate-400">Période {r.periodLabel} · échéance {formatDate(r.dueDate)} · {r.recurring}</p></div></div>
            <div className="flex items-center gap-2"><Badge tone={r.status === "received" ? "emerald" : r.status === "overdue" ? "rose" : "amber"}>{r.status}</Badge><button onClick={() => deleteDocumentRequest(r.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={15} /></button></div>
          </div>
        ))}</div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Nouvelle demande documentaire">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Catégorie"><Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select></Field>
          <Field label="Type de document" required><Input value={form.docType} onChange={(e) => setForm({ ...form, docType: e.target.value })} placeholder="Factures de vente" /></Field>
          <Field label="Période"><Input value={form.periodLabel} onChange={(e) => setForm({ ...form, periodLabel: e.target.value })} placeholder="2026-02" /></Field>
          <Field label="Journal (option)"><Select value={form.journalId} onChange={(e) => setForm({ ...form, journalId: e.target.value })}><option value="">—</option>{journals.map((j) => <option key={j.id} value={j.id}>{j.code} · {j.name}</option>)}</Select></Field>
          <Field label="Échéance"><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
          <Field label="Récurrence"><Select value={form.recurring} onChange={(e) => setForm({ ...form, recurring: e.target.value as Recurring })}><option value="none">Ponctuelle</option><option value="monthly">Mensuelle</option><option value="quarterly">Trimestrielle</option><option value="yearly">Annuelle</option></Select></Field>
        </div>
        <Field label="Message au client"><Input value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Merci de transmettre…" /></Field>
        <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button><Button onClick={() => { if (form.docType) { createDocumentRequest({ companyId, ...form, journalId: form.journalId || null, accountCode: form.accountCode || null }); setOpen(false); } }}>Envoyer la demande</Button></div>
      </Modal>
    </Card>
  );
}

/* ---- Modèles d'écritures récurrentes ---- */
interface TplLine { accountId: string; label: string; debit: string; credit: string }
function TemplatesTab({ companyId, items, accounts, journals }: { companyId: string; items: EntryTemplate[]; accounts: Account[]; journals: Journal[] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [journalId, setJournalId] = useState(journals[0]?.id || "");
  const [recurring, setRecurring] = useState<"none" | "monthly" | "yearly">("monthly");
  const [lines, setLines] = useState<TplLine[]>([{ accountId: "", label: "", debit: "", credit: "" }]);
  return (
    <Card className="p-5">
      <SectionHeading title="Modèles d'écritures" subtitle="Saisies récurrentes prêtes à l'emploi (loyer, abonnements…)" action={<Button size="sm" onClick={() => setOpen(true)}><Plus size={15} /> Modèle</Button>} />
      {items.length === 0 ? <EmptyState icon={<Plus />} title="Aucun modèle" /> : (
        <div className="space-y-2">{items.map((t) => (
          <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-4 py-3">
            <div><p className="font-semibold text-slate-800">{t.name}</p><p className="text-xs text-slate-400">{t.recurring} · {t.lines.length} ligne(s){t.lastRun ? ` · dernière exécution ${relativeTime(t.lastRun)}` : ""}</p></div>
            <div className="flex items-center gap-2"><Button size="sm" variant="outline" onClick={() => { runEntryTemplate(t.id); alert("Écriture générée (brouillon)."); }}><Play size={13} /> Exécuter</Button><button onClick={() => deleteEntryTemplate(t.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={15} /></button></div>
          </div>
        ))}</div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Nouveau modèle d'écriture" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nom" required><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Loyer mensuel" /></Field>
            <Field label="Journal"><Select value={journalId} onChange={(e) => setJournalId(e.target.value)}>{journals.map((j) => <option key={j.id} value={j.id}>{j.code} · {j.name}</option>)}</Select></Field>
          </div>
          <Field label="Récurrence"><Select value={recurring} onChange={(e) => setRecurring(e.target.value as "none" | "monthly" | "yearly")}><option value="none">Ponctuelle</option><option value="monthly">Mensuelle</option><option value="yearly">Annuelle</option></Select></Field>
          <div className="space-y-2">{lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_2fr_1fr_1fr_auto] gap-2">
              <Select value={l.accountId} onChange={(e) => setLines((p) => p.map((x, idx) => idx === i ? { ...x, accountId: e.target.value } : x))}><option value="">Compte</option>{accounts.slice(0, 40).map((a) => <option key={a.code} value={a.code}>{a.code}</option>)}</Select>
              <Input value={l.label} onChange={(e) => setLines((p) => p.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))} placeholder="Libellé" />
              <Input value={l.debit} onChange={(e) => setLines((p) => p.map((x, idx) => idx === i ? { ...x, debit: e.target.value } : x))} inputMode="numeric" placeholder="Débit" />
              <Input value={l.credit} onChange={(e) => setLines((p) => p.map((x, idx) => idx === i ? { ...x, credit: e.target.value } : x))} inputMode="numeric" placeholder="Crédit" />
              <button onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))} className="text-slate-300 hover:text-rose-500"><Trash2 size={14} /></button>
            </div>
          ))}</div>
          <button onClick={() => setLines((p) => [...p, { accountId: "", label: "", debit: "", credit: "" }])} className="text-sm font-semibold text-indigo-600"><Plus size={14} className="inline" /> Ligne</button>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button><Button onClick={() => { if (name && journalId) { createEntryTemplate({ companyId, name, journalId, recurring, lines: lines.filter((l) => l.accountId).map((l) => ({ accountId: l.accountId, label: l.label, debit: parseInt(l.debit || "0", 10), credit: parseInt(l.credit || "0", 10) })) }); setOpen(false); setName(""); setLines([{ accountId: "", label: "", debit: "", credit: "" }]); } }}>Créer</Button></div>
        </div>
      </Modal>
    </Card>
  );
}

/* ---- Demandes de paiement fiscal ---- */
function TaxPayTab({ companyId, items }: { companyId: string; items: TaxPaymentRequest[] }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ taxCode: "TVA", label: "", base: "", amount: "", dueDate: new Date().toISOString().slice(0, 10), method: "virement" });
  return (
    <Card className="p-5">
      <SectionHeading title="Paiements fiscaux" subtitle="Demandez au client de procéder à un règlement fiscal" action={<Button size="sm" onClick={() => setOpen(true)}><Plus size={15} /> Paiement</Button>} />
      {items.length === 0 ? <EmptyState icon={<CreditCard />} title="Aucun paiement demandé" /> : (
        <div className="space-y-2">{items.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2"><Receipt size={16} className="text-indigo-500" /><div><p className="font-semibold text-slate-800">{r.label}</p><p className="text-xs text-slate-400">{r.taxCode} · {fcfa(r.amount)} · échéance {formatDate(r.dueDate)}</p></div></div>
            <div className="flex items-center gap-2">{r.status === "paid" ? <Badge tone="emerald"><CheckCircle2 size={11} /> Payé</Badge> : <Button size="sm" variant="outline" onClick={() => markTaxPaymentPaid(r.id)}>Marquer payé</Button>}</div>
          </div>
        ))}</div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Demande de paiement fiscal">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Impôt"><Select value={form.taxCode} onChange={(e) => setForm({ ...form, taxCode: e.target.value })}><option value="TVA">TVA</option><option value="IS">IS / Acompte</option><option value="TPA">TPA</option><option value="TSPP">TSPP</option><option value="TFE">TFE</option></Select></Field>
          <Field label="Libellé" required><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="TVA mensuelle" /></Field>
          <Field label="Base (FCFA)"><Input value={form.base} onChange={(e) => setForm({ ...form, base: e.target.value })} inputMode="numeric" /></Field>
          <Field label="Montant (FCFA)" required><Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} inputMode="numeric" /></Field>
          <Field label="Échéance"><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
          <Field label="Mode"><Select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}><option value="virement">Virement</option><option value="mobile_money">Mobile Money</option><option value="especes">Espèces</option></Select></Field>
        </div>
        <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button><Button onClick={() => { if (form.label && form.amount) { createTaxPaymentRequest({ companyId, taxCode: form.taxCode, label: form.label, base: parseInt(form.base || "0", 10), amount: parseInt(form.amount, 10), dueDate: form.dueDate, method: form.method }); setOpen(false); } }}>Créer</Button></div>
      </Modal>
    </Card>
  );
}

/* ---- Demandes clients reçues (gestion cabinet) ---- */
function ClientReqsTab({ items }: { items: ClientRequest[] }) {
  return (
    <Card className="p-5">
      <SectionHeading title="Demandes clients reçues" subtitle="Formalités et actes demandés par le client via le portail" />
      {items.length === 0 ? <EmptyState icon={<ClipboardList />} title="Aucune demande client" /> : (
        <div className="space-y-2">{items.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-4 py-3">
            <div className="min-w-0"><div className="flex items-center gap-2"><span className="font-mono text-xs text-slate-400">{r.number}</span><p className="truncate font-semibold text-slate-800">{r.title}</p></div><p className="text-xs text-slate-400">{relativeTime(r.createdAt)} · {r.messages.length} message(s)</p></div>
            <div className="flex items-center gap-2">
              <Badge tone={STATUS_LABELS[r.status]?.tone}>{STATUS_LABELS[r.status]?.label || r.status}</Badge>
              <select value={r.status} onChange={(e) => setClientRequestStatus(r.id, e.target.value as ClientRequestStatus, "cabinet")} className="h-8 rounded-lg border border-slate-200 px-2 text-xs">
                <option value="soumise">Soumise</option><option value="prise_en_charge">Prise en charge</option><option value="en_traitement">En traitement</option><option value="livree">Livrée</option><option value="archivee">Archivée</option><option value="rejetee">Rejetée</option>
              </select>
            </div>
          </div>
        ))}</div>
      )}
    </Card>
  );
}

/* ---- LOT 11 — Bibliothèque : les 49 modèles du catalogue ---- */
function LibraryTab({ companyId, active, all }: { companyId: string; active: EntryTemplate[]; all: EntryTemplate[] }) {
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [runTpl, setRunTpl] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [ref, setRef] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const activeIds = new Set(active.map((t) => t.name));
  // Modèles du catalogue pas encore activés pour cette entreprise
  const catalog = all.filter((t) => t.companyId === null && !activeIds.has(t.name));
  const list = catalog.filter((t) => {
    if (q && !t.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const doActivate = (id: string) => {
    const r = activateTemplate(id, companyId);
    setMsg(r.ok ? "Modèle activé — retrouvez-le dans l'onglet « Mes modèles » pour l'exécuter." : r.error || "Erreur");
  };
  return (
    <Card className="p-5">
      <SectionHeading title="Bibliothèque de modèles" subtitle="49 modèles équilibrés (Σ débit = Σ crédit) couvrant les opérations courantes OHADA — activez ceux dont vous avez besoin" />
      {msg && <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">{msg}</div>}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un modèle…" className="max-w-xs" />
        <Select value={cat} onChange={(e) => setCat(e.target.value)} className="max-w-xs">
          <option value="all">Toutes catégories</option>
          {TEMPLATE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
        </Select>
        <Badge tone="indigo">{list.length} disponible(s)</Badge>
        <Badge tone="slate">{active.length} activé(s)</Badge>
      </div>
      {list.length === 0 ? <EmptyState icon={<Library />} title="Tous les modèles sont activés" description="Retrouvez-les dans l'onglet « Mes modèles »." /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((t) => {
            const d = t.lines.reduce((a, l) => a + l.debit, 0);
            return (
              <Card key={t.id} hover className="flex flex-col p-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0"><p className="truncate font-semibold text-slate-800">{t.name}</p><p className="text-xs text-slate-400">{t.lines.length} ligne(s) · base {new Intl.NumberFormat("fr-FR", { notation: "compact" }).format(d)} FCFA</p></div>
                  <Badge tone="sky">{t.recurring === "none" ? "Ponctuel" : t.recurring === "monthly" ? "Mensuel" : "Annuel"}</Badge>
                </div>
                <div className="mt-2 flex-1 space-y-0.5">
                  {t.lines.slice(0, 3).map((l, i) => (
                    <p key={i} className="truncate text-[11px] text-slate-500"><span className="font-mono text-slate-400">{l.accountId}</span> {l.label}</p>
                  ))}
                  {t.lines.length > 3 && <p className="text-[10px] text-slate-400">+{t.lines.length - 3} autre(s) ligne(s)</p>}
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setRunTpl(t.id); setAmount(""); setRef(""); }}><Play size={13} /> Utiliser</Button>
                  <Button size="sm" variant="outline" onClick={() => doActivate(t.id)}><Plus size={13} /> Activer</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {/* Modale « Utiliser » : montant de base + date → écriture équilibrée */}
      <Modal open={!!runTpl} onClose={() => setRunTpl(null)} title="Utiliser le modèle">
        {runTpl && all.find((x) => x.id === runTpl) && (() => {
          const t = all.find((x) => x.id === runTpl)!;
          return (
            <div className="space-y-4">
              <div className="rounded-xl bg-indigo-50 px-3 py-2 text-xs text-indigo-700">Le modèle est mis à l&apos;échelle proportionnellement au montant saisi, puis équilibré automatiquement (Σ débit = Σ crédit). L&apos;écriture est créée en <b>brouillon</b>.</div>
              <div className="rounded-xl border border-slate-100 p-3">
                <p className="mb-1 text-xs font-bold uppercase text-slate-400">{t.name}</p>
                {t.lines.map((l, i) => <p key={i} className="text-xs text-slate-600"><span className="font-mono text-slate-400">{l.accountId}</span> {l.label} <span className="text-slate-400">· {l.debit ? "D" : "C"} {new Intl.NumberFormat("fr-FR").format(l.debit || l.credit)}</span></p>)}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Montant de base (FCFA)" required><Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" /></Field>
                <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
              </div>
              <Field label="Référence"><Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="FAC-2026-001" /></Field>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setRunTpl(null)}>Annuler</Button>
                <Button onClick={() => { const r = runTemplateWithAmount(runTpl, parseInt(amount || "0", 10), date, ref); if (!r.ok) { setMsg(r.error || "Erreur"); setRunTpl(null); return; } setMsg("Écriture générée en brouillon — retrouvez-la dans Comptabilité → Écritures."); setRunTpl(null); }} disabled={!amount}>Générer l&apos;écriture</Button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </Card>
  );
}
