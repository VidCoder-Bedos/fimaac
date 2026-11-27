import { useMemo, useState } from "react";
import { UploadCloud, FileText, Search, Folder, FolderOpen, ChevronRight, ChevronDown, AlertTriangle, Wand2, CheckCircle2, RefreshCw, Inbox, Layers, Eye, Pencil, Check, AlertOctagon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useDB } from "../lib/store";
import { useCompanyScope, Page } from "../components/Layout";
import { Card, Button, Badge, EmptyState, Modal, Field, Input, Select } from "../components/ui";
import { addDocument, runOcr, postFromDocument, reclassifyDocument, setExtractionField } from "../lib/actions";
import { relativeTime } from "../lib/format";
import { OCR_FIELD_DEFS, type OcrFieldStatus } from "../lib/ocr";
import { DocumentViewer } from "../components/DocumentViewer";
import type { DocFolder, DocStatus, DocumentItem } from "../lib/types";
import type { BadgeTone } from "../components/ui";

const FOLDERS: { id: DocFolder; label: string; icon: string }[] = [
  { id: "achat", label: "Factures d'achat", icon: "🧾" },
  { id: "vente", label: "Factures de vente", icon: "💵" },
  { id: "banque", label: "Relevés bancaires", icon: "🏦" },
  { id: "ccp", label: "Relevés CCP", icon: "📮" },
  { id: "caisse", label: "Caisse / petite caisse", icon: "💰" },
  { id: "paie", label: "Bulletins de paie", icon: "👥" },
  { id: "social", label: "Charges sociales", icon: "🤝" },
  { id: "fiscal", label: "Déclarations fiscales", icon: "📋" },
  { id: "juridique", label: "Documents juridiques", icon: "⚖️" },
  { id: "douane", label: "Douane (import/export)", icon: "🚢" },
  { id: "stocks", label: "Stocks / inventaires", icon: "📦" },
  { id: "immobilisations", label: "Immobilisations", icon: "🏗️" },
  { id: "autre", label: "Autres pièces", icon: "📄" },
];
const folderLabel = (id: string | null) => FOLDERS.find((f) => f.id === id)?.label || "—";
const folderIcon = (id: string | null) => FOLDERS.find((f) => f.id === id)?.icon || "📄";
const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const STATUS_DOC: Record<DocStatus, { tone: BadgeTone; label: string }> = {
  non_classe: { tone: "rose", label: "Non classé" },
  a_traiter: { tone: "amber", label: "À traiter" },
  traite: { tone: "sky", label: "Traité" },
  comptabilise: { tone: "emerald", label: "Comptabilisé" },
  archive: { tone: "slate", label: "Archivé" },
};
/** Style d'un statut de lisibilité. */
const READ_STYLE: Record<OcrFieldStatus, { tone: BadgeTone; label: string; icon: React.ReactNode }> = {
  read: { tone: "emerald", label: "Lu", icon: <Check size={11} /> },
  manual: { tone: "indigo", label: "Saisi", icon: <Pencil size={11} /> },
  unreadable: { tone: "rose", label: "Illisible", icon: <AlertOctagon size={11} /> },
  missing: { tone: "slate", label: "Absent", icon: <AlertTriangle size={11} /> },
};

export default function Documents() {
  const db = useDB();
  const { id: companyId } = useCompanyScope();
  const company = db.companies.find((c) => c.id === companyId);
  const [sel, setSel] = useState<{ exercise?: string; month?: number; folder?: DocFolder; toclass?: boolean }>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [reclassify, setReclassify] = useState<string | null>(null);
  /** Pièce en cours de complétion manuelle. */
  const [editDoc, setEditDoc] = useState<DocumentItem | null>(null);
  /** Pièce affichée dans la visionneuse. */
  const [viewerDoc, setViewerDoc] = useState<DocumentItem | null>(null);
  /** Diagnostic de la dernière extraction. */
  const [ocrResult, setOcrResult] = useState<{ readable: boolean; readCount: number; unreadableCount: number; warnings: string[]; docName: string } | null>(null);
  const docs = db.documents.filter((d) => d.companyId === companyId);
  const exercises = useMemo(() => [...new Set(docs.map((d) => d.exercise).filter(Boolean) as string[])].sort((a, b) => Number(b) - Number(a)), [docs]);
  const nonClasse = docs.filter((d) => d.docStatus === "non_classe");
  const filtered = useMemo(() => {
    let list = docs;
    if (sel.toclass) list = nonClasse;
    else {
      if (sel.exercise) list = list.filter((d) => d.exercise === sel.exercise);
      if (sel.month != null) list = list.filter((d) => d.month === sel.month);
      if (sel.folder) list = list.filter((d) => d.folder === sel.folder);
    }
    if (q.trim()) { const ql = q.toLowerCase(); list = list.filter((d) => d.name.toLowerCase().includes(ql) || (d.uploadedBy || "").toLowerCase().includes(ql) || Object.values(d.extraction?.fields || {}).some((v) => v.toLowerCase().includes(ql))); }
    return list.sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt));
  }, [docs, sel, q, nonClasse]);
  if (!company) return <Page><EmptyState icon={<FileText />} title="Sélectionnez une entreprise" /></Page>;
  const toggle = (k: string) => setExpanded((p) => ({ ...p, [k]: !p[k] }));
  const monthsFor = (ex: string) => [...new Set(docs.filter((d) => d.exercise === ex && d.month != null).map((d) => d.month!))].sort((a, b) => a - b);
  const foldersFor = (ex: string, m: number) => FOLDERS.filter((f) => docs.some((d) => d.exercise === ex && d.month === m && d.folder === f.id));
  const count = (ex: string) => docs.filter((d) => d.exercise === ex).length;
  const crumb: { label: string; onClick: () => void }[] = [{ label: company.name, onClick: () => setSel({}) }];
  if (sel.toclass) crumb.push({ label: "À classer", onClick: () => setSel({ toclass: true }) });
  if (sel.exercise) crumb.push({ label: `Exercice ${sel.exercise}`, onClick: () => setSel({ exercise: sel.exercise }) });
  if (sel.month != null) crumb.push({ label: MONTHS[sel.month - 1], onClick: () => setSel({ exercise: sel.exercise, month: sel.month }) });
  if (sel.folder) crumb.push({ label: folderLabel(sel.folder), onClick: () => setSel({ exercise: sel.exercise, month: sel.month, folder: sel.folder }) });
  const tauxTraite = docs.length ? Math.round((docs.filter((d) => ["traite", "comptabilise", "archive"].includes(d.docStatus)).length / docs.length) * 100) : 0;
  /** Lancement de la lecture réelle d'une pièce. */
  const doExtract = async (d: DocumentItem) => {
    const res = await runOcr(d.id);
    setOcrResult({ ...res, docName: d.name });
  };
  return (
    <Page>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-black tracking-tight text-slate-900">Documents — {company.tradeName || company.name}</h2><p className="text-sm text-slate-500">Classement par exercice › mois › catégorie — {docs.length} pièce(s), {nonClasse.length} à classer</p></div>
        <Button onClick={() => setUploadOpen(true)}><UploadCloud size={15} /> Téléverser</Button>
      </div>
      {/* Diagnostic de la dernière extraction */}
      {ocrResult && (
        <div className={`mb-4 rounded-xl border p-4 ${ocrResult.readable ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/50"}`}>
          <div className="flex flex-wrap items-center gap-2">
            {ocrResult.readable
              ? <><CheckCircle2 size={16} className="text-emerald-600" /><p className="text-sm font-semibold text-emerald-700">{ocrResult.docName} — {ocrResult.readCount} donnée(s) lue(s)</p></>
              : <><AlertTriangle size={16} className="text-amber-600" /><p className="text-sm font-semibold text-amber-700">{ocrResult.docName} — aucune donnée lisible</p></>}
            <button onClick={() => setOcrResult(null)} className="ml-auto text-xs text-slate-400 hover:text-slate-600">Masquer</button>
          </div>
          {!ocrResult.readable && (
            <p className="mt-1.5 text-xs text-amber-700">
              Les zones non lisibles n'ont <b>pas été devinées</b>. Complétez les champs manuellement sur chaque pièce (bouton « Données »).
            </p>
          )}
          {ocrResult.readCount > 0 && ocrResult.unreadableCount > 0 && (
            <p className="mt-1.5 text-xs text-amber-700">{ocrResult.unreadableCount} champ(s) restent à compléter manuellement.</p>
          )}
          {ocrResult.warnings.map((w, i) => (
            <p key={i} className="mt-1 text-[11px] text-slate-500">· {w}</p>
          ))}
        </div>
      )}
      {/* Breadcrumb + stats */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 text-sm">{crumb.map((c, i) => (<span key={i} className="flex items-center gap-1">{i > 0 && <ChevronRight size={13} className="text-slate-300" />}<button onClick={c.onClick} className={i === crumb.length - 1 ? "font-bold text-slate-800" : "text-slate-500 hover:text-indigo-600"}>{c.label}</button></span>))}</div>
        <div className="flex gap-2 text-xs"><Badge tone="indigo">{docs.length} pièces</Badge><Badge tone={nonClasse.length ? "rose" : "emerald"}>{nonClasse.length} à classer</Badge><Badge tone="sky">{tauxTraite}% traité</Badge></div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* Tree */}
        <Card className="h-fit p-3">
          <button onClick={() => setSel({ toclass: true })} className={`mb-1 flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm font-semibold ${sel.toclass ? "bg-rose-50 text-rose-700" : "text-slate-600 hover:bg-slate-50"}`}><span className="flex items-center gap-2"><Inbox size={15} /> À classer</span>{nonClasse.length > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{nonClasse.length}</span>}</button>
          <div className="my-1 border-t border-slate-100" />
          {exercises.map((ex) => (
            <div key={ex}>
              <button onClick={() => { toggle(ex); setSel({ exercise: ex }); }} className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                {expanded[ex] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <FolderOpen size={15} className="text-amber-500" /> Exercice {ex} <span className="ml-auto text-xs text-slate-400">{count(ex)}</span>
              </button>
              <AnimatePresence>
                {expanded[ex] && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pl-4">
                    {monthsFor(ex).map((m) => (
                      <div key={m}>
                        <button onClick={() => { toggle(`${ex}-${m}`); setSel({ exercise: ex, month: m }); }} className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
                          {expanded[`${ex}-${m}`] ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                          <Folder size={14} className="text-slate-400" /> {MONTHS[m - 1]}
                        </button>
                        <AnimatePresence>
                          {expanded[`${ex}-${m}`] && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pl-4">
                              {foldersFor(ex, m).map((f) => (
                                <button key={f.id} onClick={() => setSel({ exercise: ex, month: m, folder: f.id })} className={`flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs ${sel.folder === f.id && sel.month === m ? "bg-indigo-50 font-semibold text-indigo-700" : "text-slate-500 hover:bg-slate-50"}`}>
                                  <span>{f.icon}</span> {f.label}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
          {exercises.length === 0 && <p className="px-2.5 py-3 text-xs text-slate-400">Aucun exercice. Téléversez vos premières pièces.</p>}
        </Card>
        {/* Content */}
        <div>
          <div className="mb-3 max-w-xs"><div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><Input className="pl-9" placeholder="Rechercher (nom ou donnée lue)…" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
          {filtered.length === 0 ? (
            <EmptyState icon={sel.toclass ? <CheckCircle2 /> : <Layers />} title={sel.toclass ? "Rien à classer 🎉" : "Aucune pièce dans ce dossier"} description={sel.toclass ? "Toutes les pièces sont classées." : "Téléversez ou sélectionnez un dossier."} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{filtered.map((d) => {
              const ex = d.extraction;
              const readFields = Object.entries(ex?.readability || {});
              const unreadable = readFields.filter(([, v]) => v.status === "unreadable").length;
              const read = readFields.filter(([, v]) => v.status === "read" || v.status === "manual").length;
              return (
              <Card key={d.id} hover className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-lg">{d.folder ? folderIcon(d.folder) : "📄"}</div><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{d.name}</p><p className="text-xs text-slate-400">{relativeTime(d.uploadedAt)} · {d.uploadSource === "client" ? "Client" : "Cabinet"}</p></div></div>
                  <Badge tone={STATUS_DOC[d.docStatus ?? "non_classe"].tone}>{STATUS_DOC[d.docStatus ?? "non_classe"].label}</Badge>
                </div>
                {d.exercise && <p className="mt-2 text-xs text-slate-500">{d.exercise} · {d.month ? MONTHS[d.month - 1] : "—"} · {folderLabel(d.folder)}</p>}
                {/* Données extraites — lisibilité explicite */}
                {ex && (
                  <div className="mt-2 rounded-lg border border-slate-100 p-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Données lues</p>
                    {read === 0 ? (
                      <p className="mt-1 flex items-start gap-1 text-[11px] text-rose-600"><AlertOctagon size={11} className="mt-0.5 shrink-0" /> Aucune donnée lisible — {unreadable} zone(s) non déduite(s)</p>
                    ) : (
                      <dl className="mt-1 space-y-0.5">
                        {Object.entries(ex.fields).slice(0, 4).map(([k, v]) => (
                          <div key={k} className="flex justify-between text-[11px]"><dt className="text-slate-400">{k}</dt><dd className="truncate font-semibold text-slate-700">{v}</dd></div>
                        ))}
                        {Object.keys(ex.fields).length > 4 && <p className="text-[10px] text-slate-400">+{Object.keys(ex.fields).length - 4} autre(s)</p>}
                      </dl>
                    )}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => setViewerDoc(d)}><Eye size={13} /> Voir</Button>
                  {!ex && <Button size="sm" onClick={() => doExtract(d)}><Wand2 size={13} /> Lire</Button>}
                  {ex && <Button size="sm" onClick={() => setEditDoc(d)}><Pencil size={13} /> Données</Button>}
                  {d.docStatus === "non_classe" && <Button size="sm" variant="outline" onClick={() => setReclassify(d.id)}><RefreshCw size={13} /> Classer</Button>}
                  {d.extraction && d.docStatus !== "comptabilise" && d.folder === "achat" && <Button size="sm" variant="outline" onClick={() => { const e = postFromDocument(d.id, companyId!); if (e) alert("Écriture générée et liée."); }}><CheckCircle2 size={13} /> Comptabiliser</Button>}
                </div>
              </Card>
            ); })}</div>
          )}
        </div>
      </div>
      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} companyId={companyId!} defaultExercise={String(new Date().getFullYear())} defaultMonth={new Date().getMonth() + 1} />
      {reclassify && <ReclassifyModal docId={reclassify} current={{ exercise: db.documents.find((d) => d.id === reclassify)?.exercise || String(new Date().getFullYear()), month: db.documents.find((d) => d.id === reclassify)?.month || new Date().getMonth() + 1, folder: db.documents.find((d) => d.id === reclassify)?.folder || "achat" }} onClose={() => setReclassify(null)} />}
      <AnimatePresence>{editDoc && <ExtractionEditor doc={db.documents.find((d) => d.id === editDoc.id) || editDoc} onClose={() => setEditDoc(null)} />}</AnimatePresence>
      <AnimatePresence>{viewerDoc && <DocumentViewer doc={db.documents.find((d) => d.id === viewerDoc.id) || viewerDoc} onClose={() => setViewerDoc(null)} />}</AnimatePresence>
    </Page>
  );
}
/** Éditeur des données extraites — complétion manuelle des champs illisibles. */
function ExtractionEditor({ doc, onClose }: { doc: DocumentItem; onClose: () => void }) {
  const ex = doc.extraction;
  const read = ex?.readability || {};
  const [values, setValues] = useState<Record<string, string>>(ex?.fields || {});
  return (
    <Modal open onClose={onClose} title={`Données de la pièce — ${doc.name}`} size="lg">
      <div className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <span>
          Seuls les champs réellement lus par la machine sont pré-remplis. Les champs
          <b> illisibles</b> ou <b>absents</b> sont laissés vides — <b>aucune valeur n'a été devinée</b>.
          Complétez-les manuellement : ils seront tracés comme « saisi » dans l'audit trail.
        </span>
      </div>
      <div className="space-y-2">
        {OCR_FIELD_DEFS.map((def) => {
          const st = read[def.key]?.status || "missing";
          const style = READ_STYLE[st];
          const value = values[def.key] ?? "";
          return (
            <div key={def.key} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-700">{def.label}</p>
                <p className="text-[11px] text-slate-400">
                  {read[def.key]?.note || (st === "read" ? "Lu automatiquement" : st === "unreadable" ? "Zone présente mais non lisible" : "Aucune zone correspondante")}
                </p>
              </div>
              <Badge tone={style.tone}>{style.icon} {style.label}</Badge>
              <Input
                value={value}
                onChange={(e) => setValues((p) => ({ ...p, [def.key]: e.target.value }))}
                placeholder={st === "read" ? "—" : "À compléter"}
                className="h-9 w-44"
              />
              <Button size="sm" variant="outline" onClick={() => setExtractionField(doc.id, def.key, value)} disabled={!value.trim()}>
                Enregistrer
              </Button>
            </div>
          );
        })}
      </div>
      {ex?.warnings && ex.warnings.length > 0 && (
        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3">
          <p className="mb-1 text-xs font-bold uppercase text-slate-400">Diagnostic de l'extraction</p>
          {ex.warnings.map((w, i) => <p key={i} className="text-[11px] text-slate-500">· {w}</p>)}
          <p className="mt-1 text-[11px] text-slate-400">Moteur : {ex.engine || "—"} · confiance moyenne {ex.confidence}%</p>
        </div>
      )}
      <div className="mt-4 flex justify-end"><Button onClick={onClose}>Fermer</Button></div>
    </Modal>
  );
}
function UploadModal({ open, onClose, companyId, defaultExercise, defaultMonth }: { open: boolean; onClose: () => void; companyId: string; defaultExercise: string; defaultMonth: number }) {
  const [files, setFiles] = useState<FileList | null>(null);
  const [ex, setEx] = useState(defaultExercise);
  const [m, setM] = useState(defaultMonth);
  const [f, setF] = useState<DocFolder>("achat");
  const [busy, setBusy] = useState(false);
  const doUpload = async () => {
    if (!files) return;
    setBusy(true);
    for (const file of Array.from(files)) {
      const id = addDocument(companyId, { name: file.name, size: file.size, file, exercise: ex, month: m, folder: f });
      // Lecture réelle du contenu — aucune valeur inventée
      await runOcr(id);
    }
    setFiles(null); setBusy(false); onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Téléverser & lire">
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> Chaque pièce est rattachée à un exercice, un mois et une catégorie. Elle est ensuite lue : <b>seules les données réellement lisibles sont extraites</b> — les zones illisibles sont signalées, jamais devinées.</div>
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed py-8 hover:border-indigo-300 hover:bg-slate-50">
          <UploadCloud size={26} className="mb-2 text-indigo-500" /><p className="text-sm font-semibold text-slate-700">{files ? `${files.length} fichier(s) sélectionné(s)` : "Cliquez ou glissez vos fichiers"}</p>
          <input type="file" multiple className="hidden" onChange={(e) => setFiles(e.target.files)} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Exercice"><Input value={ex} onChange={(e) => setEx(e.target.value)} placeholder="2026" /></Field>
          <Field label="Mois"><Select value={m} onChange={(e) => setM(Number(e.target.value))}>{MONTHS.map((mo, i) => <option key={i} value={i + 1}>{mo}</option>)}</Select></Field>
        </div>
        <Field label="Catégorie"><Select value={f} onChange={(e) => setF(e.target.value as DocFolder)}>{FOLDERS.map((fo) => <option key={fo.id} value={fo.id}>{fo.icon} {fo.label}</option>)}</Select></Field>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Annuler</Button><Button onClick={doUpload} disabled={!files || busy}><UploadCloud size={15} /> {busy ? "Lecture…" : "Téléverser & lire"}</Button></div>
      </div>
    </Modal>
  );
}
function ReclassifyModal({ docId, current, onClose }: { docId: string; current: { exercise: string; month: number; folder: DocFolder }; onClose: () => void }) {
  const [ex, setEx] = useState(current.exercise);
  const [m, setM] = useState(current.month);
  const [f, setF] = useState<DocFolder>(current.folder);
  return (
    <Modal open onClose={onClose} title="Reclasser la pièce">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Exercice"><Input value={ex} onChange={(e) => setEx(e.target.value)} /></Field>
          <Field label="Mois"><Select value={m} onChange={(e) => setM(Number(e.target.value))}>{MONTHS.map((mo, i) => <option key={i} value={i + 1}>{mo}</option>)}</Select></Field>
        </div>
        <Field label="Catégorie"><Select value={f} onChange={(e) => setF(e.target.value as DocFolder)}>{FOLDERS.map((fo) => <option key={fo.id} value={fo.id}>{fo.icon} {fo.label}</option>)}</Select></Field>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Annuler</Button><Button onClick={() => { reclassifyDocument(docId, ex, m, f); onClose(); }}>Enregistrer</Button></div>
      </div>
    </Modal>
  );
}
