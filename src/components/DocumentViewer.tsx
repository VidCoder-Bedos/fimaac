import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Download, FileText, Eye, AlertTriangle, Image as ImageIcon, Paperclip, Link2, Trash2, UploadCloud } from "lucide-react";
import { Modal, Button, Badge, EmptyState, Input, Select } from "./ui";
import { useDB } from "../lib/store";
import { addDocument, linkDocumentToEntry, unlinkDocumentFromEntry } from "../lib/actions";
import { getDocumentFile } from "../lib/documentStore";
import { formatDate, relativeTime } from "../lib/format";
import type { DocumentItem, JournalEntry } from "../lib/types";

/** Type de rendu possible pour une pièce. */
function kindOf(doc: DocumentItem): "image" | "pdf" | "other" {
  const n = doc.name.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|bmp)$/.test(n)) return "image";
  if (n.endsWith(".pdf")) return "pdf";
  return "other";
}

/** Statut de lisibilité de l'extraction — pour l'avertissement. */
function readabilityBadge(doc: DocumentItem) {
  const ex = doc.extraction;
  if (!ex) return { tone: "slate" as const, label: "Non analysé" };
  if (ex.readable === false) return { tone: "rose" as const, label: "Illisible" };
  if (ex.readable) return { tone: "emerald" as const, label: "Données lues" };
  return { tone: "slate" as const, label: "— " };
}

/** Modal de visualisation / téléchargement d'une pièce jointe. */
export function DocumentViewer({ doc, onClose }: { doc: DocumentItem | null; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (!doc) { setUrl(null); setGone(false); return; }
    const file = getDocumentFile(doc.id);
    if (!file) { setGone(true); setUrl(null); return; }
    const u = URL.createObjectURL(file);
    setUrl(u);
    setGone(false);
    return () => URL.revokeObjectURL(u);
  }, [doc]);
  if (!doc) return null;
  const kind = kindOf(doc);
  const rb = readabilityBadge(doc);
  const download = () => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.name;
    a.click();
  };
  return (
    <Modal open={!!doc} onClose={onClose} title={doc.name} size="lg">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone="indigo">{doc.category}</Badge>
        <Badge tone={rb.tone}>{rb.label}</Badge>
        <Badge tone="slate">{(doc.size / 1024).toFixed(0)} Ko</Badge>
        <span className="text-xs text-slate-500">{formatDate(doc.uploadedAt)} · {relativeTime(doc.uploadedAt)}</span>
        {url && (
          <Button size="sm" variant="outline" className="ml-auto" onClick={download}>
            <Download size={14} /> Télécharger
          </Button>
        )}
      </div>
      {gone ? (
        <EmptyState
          icon={<FileText />}
          title="Aperçu indisponible"
          description="Le fichier source n'est plus en mémoire (session rechargée). Les métadonnées et l'extraction restent consultables. Re-téléversez la pièce pour l'aperçu."
        />
      ) : url && kind === "image" ? (
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <img src={url} alt={doc.name} className="mx-auto max-h-[60vh] w-auto rounded-lg object-contain" />
        </div>
      ) : url && kind === "pdf" ? (
        <iframe src={url} title={doc.name} className="h-[60vh] w-full rounded-xl border border-slate-100" />
      ) : (
        <EmptyState
          icon={<FileText />}
          title="Aucun aperçu pour ce format"
          description="Utilisez le bouton Télécharger pour ouvrir le fichier dans l'application adaptée."
          action={url ? <Button variant="outline" onClick={download}><Download size={15} /> Télécharger</Button> : undefined}
        />
      )}
      {doc.extraction && (
        <div className="mt-4 rounded-xl border border-slate-100 p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Données extraites</p>
          {Object.keys(doc.extraction.fields).length === 0 ? (
            <p className="text-sm text-slate-500">Aucune donnée lue — les zones non lisibles n'ont pas été devinées.</p>
          ) : (
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Object.entries(doc.extraction.fields).map(([k, v]) => (
                <div key={k} className="rounded-lg bg-slate-50 px-3 py-1.5 text-sm">
                  <dt className="text-[11px] uppercase text-slate-500">{k}</dt>
                  <dd className="font-semibold text-slate-800">{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {doc.extraction.warnings?.map((w, i) => (
            <p key={i} className="mt-2 flex items-start gap-1.5 text-xs text-amber-700"><AlertTriangle size={12} className="mt-0.5 shrink-0" /> {w}</p>
          ))}
        </div>
      )}
    </Modal>
  );
}

/** Bandeau des pièces jointes d'une écriture + liaison de documents. */
export function EntryAttachments({ entry, onClose }: { entry: JournalEntry | null; onClose: () => void }) {
  const db = useDB();
  const [viewerDoc, setViewerDoc] = useState<DocumentItem | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({ exercise: String(new Date().getFullYear()), month: new Date().getMonth() + 1, folder: "autre" as const });
  const companyId = entry?.companyId ?? "";
  const company = db.companies.find((c) => c.id === companyId);
  const linked = useMemo(
    () => entry ? entry.attachmentDocIds.map((id) => db.documents.find((d) => d.id === id)).filter((d): d is DocumentItem => Boolean(d)) : [],
    [entry, db.documents],
  );
  const candidates = useMemo(
    () => company ? db.documents.filter((d) => d.companyId === company.id && !entry?.attachmentDocIds.includes(d.id)) : [],
    [db.documents, company, entry],
  );
  if (!entry || !company) return null;
  const doUpload = () => {
    if (!file) return;
    const id = addDocument(company.id, {
      name: file.name, size: file.size, file,
      exercise: form.exercise, month: form.month, folder: form.folder,
      uploadSource: "cabinet",
    });
    linkDocumentToEntry(id, entry.id);
    setFile(null);
  };
  return (
    <>
      <Modal open={!!entry} onClose={onClose} title={`Pièces jointes — ${entry.number}`} size="lg">
        <p className="mb-4 text-sm text-slate-500">{entry.label} · {formatDate(entry.date)}</p>
        <div className="space-y-2">
          {linked.length === 0 && (
            <EmptyState icon={<Paperclip />} title="Aucune pièce jointe" description="Rattachez un document déjà téléversé ou ajoutez-en un nouveau." />
          )}
          {linked.map((d) => {
            const rb = d.extraction?.readable === false ? "rose" : d.extraction?.readable ? "emerald" : "slate";
            return (
              <div key={d.id} className="flex items-center gap-3 rounded-xl border border-slate-100 px-4 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  {kindOf(d) === "image" ? <ImageIcon size={16} /> : <FileText size={16} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{d.name}</p>
                  <p className="text-xs text-slate-500">{formatDate(d.uploadedAt)} · {(d.size / 1024).toFixed(0)} Ko</p>
                </div>
                <Badge tone={rb}>{d.extraction?.readable === false ? "Illisible" : d.extraction?.readable ? "Lu" : "—"}</Badge>
                <Button size="sm" variant="ghost" onClick={() => setViewerDoc(d)}><Eye size={14} /> Voir</Button>
                <button onClick={() => unlinkDocumentFromEntry(d.id)} className="text-slate-500 hover:text-rose-700"><Trash2 size={15} /></button>
              </div>
            );
          })}
        </div>
        <div className="mt-5 space-y-4 border-t border-slate-100 pt-4">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Rattacher une pièce existante</p>
            {candidates.length === 0 ? (
              <p className="text-sm text-slate-500">Toutes les pièces de l'entreprise sont déjà rattachées.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {candidates.slice(0, 8).map((d) => (
                  <button key={d.id} onClick={() => linkDocumentToEntry(d.id, entry.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-600">
                    <Link2 size={12} /> {d.name.slice(0, 28)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Ajouter une nouvelle pièce</p>
            <input type="file" className="hidden" id="entry-att-file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="entry-att-file" className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-600">
                <UploadCloud size={15} /> {file ? file.name : "Choisir un fichier"}
              </label>
              {file && (
                <>
                  <Input value={form.exercise} onChange={(e) => setForm({ ...form, exercise: e.target.value })} className="h-9 w-24" placeholder="Exercice" />
                  <Select value={form.month} onChange={(e) => setForm({ ...form, month: Number(e.target.value) })} className="h-9 w-32">
                    {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(new Date(2024, i, 1))}</option>)}
                  </Select>
                  <Button size="sm" onClick={doUpload}><UploadCloud size={14} /> Ajouter & rattacher</Button>
                </>
              )}
            </div>
            <p className="mt-2 text-[11px] text-slate-500">La pièce est classée (exercice / mois / catégorie) puis lue : seules les données réellement lisibles sont extraites.</p>
          </div>
        </div>
      </Modal>
      <AnimatePresence>{viewerDoc && <DocumentViewer doc={viewerDoc} onClose={() => setViewerDoc(null)} />}</AnimatePresence>
    </>
  );
}

/** Petit indicateur de pièces jointes (utilisé dans les lignes de tableaux). */
export function AttachmentCount({ count, onClick }: { count: number; onClick: () => void }) {
  if (count === 0) {
    return <span className="text-xs text-slate-500">—</span>;
  }
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-100">
      <Paperclip size={11} /> {count}
    </button>
  );
}
