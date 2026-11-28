import { useState } from "react";
import { motion } from "framer-motion";
import { UploadCloud, FileText, ClipboardList, Receipt, Send, Building2, Clock, Plus, MessageSquare, Paperclip, History } from "lucide-react";
import { useDB } from "../lib/store";
import { useAuth } from "../lib/auth";
import { Page } from "../components/Layout";
import { Card, Button, Badge, EmptyState, SectionHeading, StatCard, Field, Input, Textarea, Select, Modal, Tabs } from "../components/ui";
import { FileBarChart } from "lucide-react";
import { addDocument, createClientRequest, addRequestMessage, addRequestAttachment, respondToDocRequest } from "../lib/actions";
import { ACTES, FAMILIES, acteById, STATUS_LABELS } from "../lib/clientCatalog";
import type { FieldDef, ClientRequest } from "../lib/clientCatalogTypes";
import { financialSummary } from "../lib/accounting";
import { fcfa, fcfaCompact, formatDate, formatDateTime, relativeTime } from "../lib/format";
import { toast } from "../lib/toast";

export function PortalHome() {
  const db = useDB();
  const { user } = useAuth();
  const company = db.companies.find((c) => c.id === user?.companyId);
  if (!company) return <Page><EmptyState icon={<Building2 />} title="Aucune entreprise associée" /></Page>;
  const deadlines = db.taxDeadlines.filter((d) => d.companyId === company.id);
  const myReqs = db.clientRequests.filter((r) => r.companyId === company.id);
  const openReqs = myReqs.filter((r) => !["livree", "archivee", "rejetee"].includes(r.status));
  const cabinetReqs = db.documentRequests.filter((r) => r.companyId === company.id && !["received"].includes(r.status));
  return (
    <Page>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <p className="text-sm text-slate-500">Bienvenue, {user?.firstName} 👋</p>
        <h2 className="text-2xl font-black tracking-tight text-slate-900">{company.name}</h2>
        <p className="text-sm text-slate-500">Portail client FIMAAC</p>
      </motion.div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Mes demandes" value={String(myReqs.length)} icon={<ClipboardList size={18} />} tone="indigo" />
        <StatCard title="En cours" value={String(openReqs.length)} icon={<Clock size={18} />} tone="amber" />
        <StatCard title="Pièces à fournir" value={String(cabinetReqs.length)} icon={<FileText size={18} />} tone="rose" />
        <StatCard title="Échéances" value={String(deadlines.length)} icon={<Receipt size={18} />} tone="sky" />
      </div>
      <Card className="mt-6 bg-gradient-to-br from-indigo-600 to-violet-600 p-6 text-white">
        <div className="flex items-center justify-between"><div><p className="text-sm opacity-80">Besoin d'un acte ou d'un document ?</p><p className="text-lg font-bold">Déposez vos pièces ou créez une demande depuis l'onglet Demandes.</p></div><Building2 size={40} className="opacity-50" /></div>
      </Card>
    </Page>
  );
}

export function PortalDocuments() {
  const db = useDB();
  const { user } = useAuth();
  const company = db.companies.find((c) => c.id === user?.companyId);
  const docs = db.documents.filter((d) => d.companyId === user?.companyId);
  if (!company) return <Page><EmptyState icon={<Building2 />} title="Aucune entreprise associée" /></Page>;
  const now = new Date();
  const upload = () => addDocument(company.id, { name: `Document_${docs.length + 1}.pdf`, size: 240000, exercise: String(now.getFullYear()), month: now.getMonth() + 1, folder: "autre", uploadSource: "client" });
  return (
    <Page>
      <div className="mb-5 flex items-center justify-between"><div><h2 className="text-xl font-black tracking-tight text-slate-900">Mes documents</h2><p className="text-sm text-slate-500">Déposez vos pièces justificatives</p></div><Button onClick={upload}><UploadCloud size={15} /> Téléverser</Button></div>
      <Card className="mb-6 cursor-pointer border-2 border-dashed p-8 text-center" onClick={upload}><UploadCloud size={28} className="mx-auto mb-2 text-indigo-600" /><p className="font-semibold text-slate-700">Cliquez ou glissez vos fichiers</p><p className="text-sm text-slate-500">PDF, JPG, PNG, Excel</p></Card>
      {docs.length === 0 ? <EmptyState icon={<FileText />} title="Aucun document" /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{docs.map((d) => (
          <Card key={d.id} hover className="p-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><FileText size={18} /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{d.name}</p><p className="text-xs text-slate-500">{formatDate(d.uploadedAt)}</p></div></div><div className="mt-2"><Badge tone={d.status === "validated" ? "emerald" : d.status === "extracted" ? "violet" : "sky"}>{d.status}</Badge></div></Card>
        ))}</div>
      )}
    </Page>
  );
}

export function PortalRequests() {
  const db = useDB();
  const { user } = useAuth();
  const company = db.companies.find((c) => c.id === user?.companyId);
  const [tab, setTab] = useState("cabinet");
  const [detail, setDetail] = useState<string | null>(null);
  const [formActe, setFormActe] = useState<string | null>(null);
  if (!company) return <Page><EmptyState icon={<ClipboardList />} title="Aucune entreprise" /></Page>;
  const cabinetReqs = db.documentRequests.filter((r) => r.companyId === company.id);
  const myReqs = db.clientRequests.filter((r) => r.companyId === company.id).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const detailReq = myReqs.find((r) => r.id === detail);
  return (
    <Page>
      <div className="mb-5"><h2 className="text-xl font-black tracking-tight text-slate-900">Centre de demandes</h2><p className="text-sm text-slate-500">{company.name} — demandes du cabinet, mes demandes & formalités</p></div>
      <div className="mb-6"><Tabs active={tab} onChange={setTab} tabs={[{ id: "cabinet", label: `Demandes du cabinet (${cabinetReqs.length})` }, { id: "mine", label: `Mes demandes (${myReqs.length})` }, { id: "new", label: "Nouvelle demande" }]} /></div>
      {tab === "cabinet" && (<Card className="p-5"><SectionHeading title="Demandes du cabinet" subtitle="Pièces demandées par votre cabinet — téléversez vos documents" />{cabinetReqs.length === 0 ? <EmptyState icon={<FileText />} title="Aucune demande en attente" /> : (<div className="space-y-2">{cabinetReqs.map((r) => (<div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-4 py-3"><div><div className="flex items-center gap-2"><Badge tone="indigo">{r.category}</Badge><p className="font-semibold text-slate-800">{r.docType}</p></div><p className="text-xs text-slate-500">Période {r.periodLabel} · échéance {formatDate(r.dueDate)}</p><p className="mt-1 text-xs text-slate-500">{r.message}</p></div><div className="flex items-center gap-2"><Badge tone={r.status === "received" ? "emerald" : r.status === "overdue" ? "rose" : "amber"}>{r.status}</Badge>{r.status !== "received" && (<label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"><UploadCloud size={14} /> Fournir<input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { respondToDocRequest(r.id, company.id, f.name); toast("Pièce transmise au cabinet."); } }} /></label>)}</div></div>))}</div>)}</Card>)}
      {tab === "mine" && (<Card className="p-5"><SectionHeading title="Mes demandes" subtitle="Formalités et services demandés au cabinet" action={<Button size="sm" onClick={() => setTab("new")}><Plus size={15} /> Nouvelle</Button>} />{myReqs.length === 0 ? <EmptyState icon={<ClipboardList />} title="Aucune demande" description="Créez votre première demande." /> : (<div className="space-y-2">{myReqs.map((r) => (<button key={r.id} onClick={() => setDetail(r.id)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-100 px-4 py-3 text-left hover:bg-indigo-50/40"><div className="min-w-0"><div className="flex items-center gap-2"><span className="font-mono text-xs text-slate-500">{r.number}</span><p className="truncate font-semibold text-slate-800">{r.title}</p></div><p className="text-xs text-slate-500">{formatDate(r.createdAt)} · {r.messages.length} message(s)</p></div><Badge tone={STATUS_LABELS[r.status]?.tone}>{STATUS_LABELS[r.status]?.label}</Badge></button>))}</div>)}</Card>)}
      {tab === "new" && (<div className="space-y-6">{FAMILIES.map((fam) => { const items = ACTES.filter((a) => a.family === fam.id); if (!items.length) return null; return (<div key={fam.id}><div className="mb-3 flex items-center gap-2"><span className="text-lg">{fam.icon}</span><h3 className="font-display text-sm font-bold uppercase tracking-wide text-slate-500">{fam.label}</h3></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((a) => (<Card key={a.id} hover className="cursor-pointer p-4" onClick={() => setFormActe(a.id)}><div className="flex items-start gap-3"><span className="text-2xl">{a.icon}</span><div><p className="font-bold text-slate-800">{a.label}</p><p className="mt-0.5 text-xs text-slate-500">{a.desc}</p></div></div></Card>))}</div></div>); })}</div>)}
      {detailReq && <DetailModal req={detailReq} authorId={user?.id || ""} onClose={() => setDetail(null)} />}
      {formActe && <NewRequestModal acteId={formActe} companyId={company.id} orgId={company.organizationId} onClose={() => setFormActe(null)} onDone={() => { setFormActe(null); setTab("mine"); }} />}
    </Page>
  );
}

function NewRequestModal({ acteId, companyId, orgId, onClose, onDone }: { acteId: string; companyId: string; orgId: string; onClose: () => void; onDone: () => void }) {
  const acte = acteById(acteId)!;
  const [fields, setFields] = useState<Record<string, string>>({});
  const set = (k: string, v: string) => setFields((p) => ({ ...p, [k]: v }));
  const submit = () => { createClientRequest(companyId, orgId, { id: acte.id, family: acte.family, label: acte.label }, fields); toast(`Demande « ${acte.label} » envoyée au cabinet.`); onDone(); };
  return (<Modal open onClose={onClose} title={`${acte.icon} ${acte.label}`} size="lg"><p className="mb-4 text-sm text-slate-500">{acte.desc}</p><div className="grid gap-4 sm:grid-cols-2">{acte.fields.map((f) => (<div key={f.key} className={f.half ? "" : "sm:col-span-2"}><Field label={f.label} required={f.required}><FieldInput f={f} value={fields[f.key] || ""} onChange={(v) => set(f.key, v)} /></Field></div>))}</div><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Annuler</Button><Button onClick={submit}><Send size={15} /> Envoyer</Button></div></Modal>);
}

export function FieldInput({ f, value, onChange }: { f: FieldDef; value: string; onChange: (v: string) => void }) {
  if (f.type === "textarea") return <Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={f.placeholder} rows={3} />;
  if (f.type === "select") return <Select value={value} onChange={(e) => onChange(e.target.value)}><option value="">—</option>{f.options?.map((o) => <option key={o}>{o}</option>)}</Select>;
  return <Input type={f.type === "year" || f.type === "number" || f.type === "amount" ? "text" : f.type} inputMode={f.type === "year" || f.type === "number" || f.type === "amount" ? "numeric" : undefined} value={value} onChange={(e) => onChange(e.target.value)} placeholder={f.placeholder} />;
}

function DetailModal({ req, authorId, onClose }: { req: ClientRequest; authorId: string; onClose: () => void }) {
  const [msg, setMsg] = useState("");
  const acte = acteById(req.acteType);
  const send = () => { if (msg.trim()) { addRequestMessage(req.id, msg, "client", authorId); setMsg(""); } };
  return (<Modal open onClose={onClose} title={`${req.number} — ${req.title}`} size="lg"><div className="mb-4 flex flex-wrap items-center gap-2"><Badge tone={STATUS_LABELS[req.status]?.tone}>{STATUS_LABELS[req.status]?.label}</Badge><span className="text-xs text-slate-500">Créée {relativeTime(req.createdAt)}</span></div>{acte && acte.fields.length > 0 && (<div className="mb-4 rounded-xl border border-slate-100 p-3"><p className="mb-2 text-xs font-bold uppercase text-slate-500">Détails</p><div className="grid grid-cols-2 gap-2">{acte.fields.map((f) => (<div key={f.key} className="rounded-lg bg-slate-50 px-3 py-1.5 text-sm"><span className="text-slate-500">{f.label} : </span><span className="font-semibold text-slate-700">{req.fields[f.key] || "—"}</span></div>))}</div></div>)}{req.attachments.length > 0 && (<div className="mb-4"><p className="mb-1.5 text-xs font-bold uppercase text-slate-500">Pièces jointes</p><div className="flex flex-wrap gap-2">{req.attachments.map((a) => <Badge key={a.id} tone="sky"><Paperclip size={11} /> {a.name}</Badge>)}</div></div>)}<div className="mb-4"><p className="mb-1.5 flex items-center gap-1 text-xs font-bold uppercase text-slate-500"><History size={12} /> Historique</p><div className="space-y-1">{req.history.map((h) => <div key={h.id} className="flex items-center gap-2 text-xs"><span className="h-1.5 w-1.5 rounded-full bg-indigo-400" /><span className="font-medium text-slate-700">{h.label}</span><span className="text-slate-500">· {formatDateTime(h.at)}</span></div>)}</div></div><div className="mb-3"><p className="mb-1.5 flex items-center gap-1 text-xs font-bold uppercase text-slate-500"><MessageSquare size={12} /> Discussion</p><div className="max-h-44 space-y-2 overflow-y-auto rounded-xl border border-slate-100 p-3">{req.messages.length === 0 && <p className="text-center text-xs text-slate-500">Aucun message</p>}{req.messages.map((m) => (<div key={m.id} className={`flex ${m.author === "client" ? "justify-end" : "justify-start"}`}><div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${m.author === "client" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-800"}`}><p>{m.text}</p><p className={`mt-0.5 text-[10px] ${m.author === "client" ? "text-indigo-100" : "text-slate-500"}`}>{relativeTime(m.createdAt)}</p></div></div>))}</div></div><div className="space-y-2"><div className="flex items-center gap-2"><input value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Écrire un message…" className="h-10 flex-1 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100" /><Button size="sm" onClick={send}><Send size={14} /></Button></div><label className="inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-200 py-2 text-xs font-semibold text-slate-500 hover:border-indigo-300 hover:text-indigo-600"><UploadCloud size={14} /> Joindre une pièce<input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { addRequestAttachment(req.id, f.name, "client"); } }} /></label></div></Modal>);
}

export function PortalStatements() {
  const db = useDB();
  const { user } = useAuth();
  const company = db.companies.find((c) => c.id === user?.companyId);
  if (!company) return <Page><EmptyState icon={<FileBarChart />} title="Aucune entreprise associée" /></Page>;
  const sum = financialSummary(db.entries.filter((e) => e.companyId === company.id));
  return (<Page><div className="mb-5"><h2 className="text-xl font-black tracking-tight text-slate-900">Mes états financiers</h2><p className="text-sm text-slate-500">{company.name}</p></div><div className="grid grid-cols-2 gap-4 lg:grid-cols-4"><StatCard title="Produits" value={fcfaCompact(sum.produits)} tone="emerald" /><StatCard title="Charges" value={fcfaCompact(sum.charges)} tone="amber" /><StatCard title="Résultat" value={fcfaCompact(sum.resultat)} tone="indigo" /><StatCard title="Trésorerie" value={fcfaCompact(sum.tresorerie)} tone="sky" /></div><Card className="mt-6 p-6"><SectionHeading title="Synthèse" /><div className="space-y-2 max-w-xl"><div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"><span className="text-slate-600">Produits</span><span className="font-semibold tabular-nums text-emerald-700">{fcfa(sum.produits)}</span></div><div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"><span className="text-slate-600">Charges</span><span className="font-semibold tabular-nums text-rose-700">{fcfa(sum.charges)}</span></div><div className="flex justify-between rounded-lg px-3 py-2 text-base font-black"><span className="text-slate-900">Résultat</span><span className="tabular-nums text-indigo-600">{fcfa(sum.resultat)}</span></div></div></Card></Page>);
}

export function PortalInvoices() {
  const db = useDB();
  const { user } = useAuth();
  const company = db.companies.find((c) => c.id === user?.companyId);
  return (<Page><div className="mb-5"><h2 className="text-xl font-black tracking-tight text-slate-900">Factures</h2><p className="text-sm text-slate-500">{company?.name}</p></div><Card className="p-5"><SectionHeading title="Mes factures" /><EmptyState icon={<Receipt />} title="Aucune facture" description="Les factures de votre cabinet apparaîtront ici." /></Card></Page>);
}
