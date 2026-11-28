import { Fragment, useMemo, useState } from "react";
import { FileSpreadsheet, Upload, FileDown, AlertTriangle, CheckCircle2, XCircle, Info, Wand2, ShieldCheck } from "lucide-react";
import { useDB } from "../lib/store";
import { useCompanyScope, Page } from "../components/Layout";
import { Card, Button, Badge, EmptyState, SectionHeading, Tabs, Spinner, Input } from "../components/ui";
import { parseBalanceReport, buildStatements, runChecks, exportLiasseXlsx, fillTemplate, downloadWorkbook } from "../lib/liasse";
import type { BalanceImportResult } from "../lib/balanceImport";
import { parseBalance6, runCoherenceChecks, fillStateTemplate, mappingCoverage, type Balance6, type CoherenceReport } from "../lib/liasseEngine";
import { auditNormativeCoherence } from "../lib/normative";
import { CHART_OF_ACCOUNTS } from "../lib/chartOfAccounts";
import { readAny, detectColumns, normalize, KIND_LABELS, type RawGrid, type DetectedColumn, type NormalizedDoc, type ColRole } from "../lib/universalImport";
import { auditWorkbook, cloneWorkbook, patchWorkbook, downloadWorkbookWb, type WorkbookAudit } from "../lib/reconstitution";
import type { BalanceRow } from "../lib/liasse";
import { buildTafire } from "../lib/tafire";
import { buildNotesAnnex } from "../lib/notesAnnex";
import PrintSheet from "../components/PrintSheet";
import LiassePrint from "../components/LiassePrint";
import { fcfa, fcfaCompact } from "../lib/format";
import { toast } from "../lib/toast";

export default function Liasse() {
  const db = useDB();
  const { id: companyId } = useCompanyScope();
  const [tab, setTab] = useState("edit");
  const [prev, setPrev] = useState<BalanceRow[] | null>(null);
  const [cur, setCur] = useState<BalanceRow[] | null>(null);
  const [loading, setLoading] = useState("");
  const [tplFilled, setTplFilled] = useState<number | null>(null);
  const [bal6, setBal6] = useState<Balance6 | null>(null);
  const [report, setReport] = useState<CoherenceReport | null>(null);
  const [stateFilled, setStateFilled] = useState<{ filled: number; unmatched: string[]; report: string[] } | null>(null);
  /** P0-4 — dernier rapport d'import : jamais d'échec muet. */
  const [importReport, setImportReport] = useState<{ which: string; report: BalanceImportResult } | null>(null);
  const [printing, setPrinting] = useState(false);
  const company = db.companies.find((c) => c.id === companyId);
  const stmt = useMemo(() => (cur ? buildStatements(cur) : null), [cur]);
  const checks = useMemo(() => (stmt ? runChecks(stmt) : []), [stmt]);
  const tafire = useMemo(() => (cur ? buildTafire(prev, cur) : null), [prev, cur]);
  const annex = useMemo(
    () => (cur ? buildNotesAnnex({ n: cur, n1: prev ?? [], accounts: db.accounts, companyName: company?.name, exercise: String(new Date().getFullYear()) }) : null),
    [cur, prev, db.accounts, company],
  );

  const onFile = async (which: string, file: File | null) => {
    if (!file || !company) return;
    setLoading(which);
    try {
      const report = await parseBalanceReport(file);
      setImportReport({ which, report });
      if (report.ok) {
        if (which === "prev") setPrev(report.rows); else setCur(report.rows);
      }
    } catch (e) {
      setImportReport({
        which,
        report: {
          ok: false, rows: [], headerRow: null,
          mapping: { code: -1, label: -1, debit: -1, credit: -1, solde: -1, soldeDebit: -1, soldeCredit: -1 },
          signals: [], warnings: [], errors: [(e as Error)?.message || String(e)],
          totals: { debit: 0, credit: 0, ecart: 0 }, rejected: [],
        },
      });
    }
    setLoading("");
  };

  if (!company) return <Page><EmptyState icon={<FileSpreadsheet />} title="Sélectionnez une entreprise" /></Page>;
  const info = { name: company.name, nif: company.nif || "—", rccm: company.rccm || "—", form: company.legalForm, exercise: String(new Date().getFullYear()), currency: "FCFA (XOF)" };

  const generate = async () => {
    if (!cur) { toast("Importez d'abord la Balance N."); return; }
    setLoading("gen");
    try { await exportLiasseXlsx(info, prev || [], cur, checks); } catch { toast("Erreur lors de la génération de la liasse."); }
    setLoading("");
  };

  const fillTpl = async (file: File | null) => {
    if (!file || !cur) { toast("Importez d'abord la Balance N."); return; }
    setLoading("tpl");
    try { const { workbook, filled } = await fillTemplate(file, cur); await downloadWorkbook(workbook, `Liasse_GUDEF_remplie_${company.name}.xlsx`); setTplFilled(filled); } catch (e) { toast("Impossible de remplir le modèle :\n\n" + ((e as Error)?.message || String(e))); }
    setLoading("");
  };

  // V0.7 — import balance 6 colonnes
  const onBal6 = async (file: File | null) => {
    if (!file) return;
    setLoading("bal6");
    try {
      const b = await parseBalance6(file);
      setBal6(b);
      setPrev(b.n1); setCur(b.n);
      const dN = b.n.reduce((s, r) => s + r.debit, 0), cN = b.n.reduce((s, r) => s + r.credit, 0);
      if (dN !== cN) toast(`Attention : Balance N déséquilibrée (écart ${fcfa(dN - cN)}).`);
    } catch { toast("Impossible de lire la balance 6 colonnes. Format attendu : Compte · Libellé · SD N · SC N · SD N-1 · SC N-1."); }
    setLoading("");
  };

  // V0.7 — éditer un état fourni (remplissage non destructif)
  const onFillState = async (file: File | null) => {
    if (!file) { toast("Importez d'abord la balance (6 colonnes ou N-1/N)."); return; }
    if (!cur) { toast("Importez d'abord la Balance N."); return; }
    setLoading("state");
    try {
      const { blob, filled, unmatched, report } = await fillStateTemplate(file, prev || [], cur);
      const url = URL.createObjectURL(blob);
      const dl = document.createElement("a");
      dl.href = url; dl.download = `Etat_rempli_${company.name}.xlsx`; dl.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setStateFilled({ filled, unmatched, report });
      // Rapport de vérification
      let msg = `✅ État rempli : ${filled} cellule(s) renseignée(s).\n`;
      if (prev && prev.length > 0) msg += `📊 Balance N-1 : ${prev.length} comptes lus.\n`;
      msg += `📊 Balance N : ${cur.length} comptes lus.\n`;
      if (unmatched.length > 0) msg += `\n⚠️ Références non reconnues : ${unmatched.join(", ")}`;
      if (report.length > 0) msg += `\n\nDétail (10 premières valeurs) :\n${report.slice(0, 10).join("\n")}`;
      toast(msg);
    } catch (e) { toast("Impossible de remplir l'état fourni :\n\n" + ((e as Error)?.message || String(e))); }
    setLoading("");
  };

  // V0.7 — contrôles de cohérence
  const onRunChecks = () => {
    if (!cur) { toast("Importez d'abord la Balance N (ou la balance 6 colonnes)."); return; }
    setReport(runCoherenceChecks(prev || [], cur));
    setTab("coherence");
  };

  return (
    <Page>
      <div className="mb-5"><h2 className="text-xl font-black tracking-tight text-slate-900">Liasse fiscale GUDEF — {company.tradeName || company.name}</h2><p className="text-sm text-slate-500">États financiers SYSCOHADA · Balance N-1 / N · contrôles de cohérence · export Excel non destructif</p></div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-xl bg-sky-50 px-3 py-2 text-xs font-medium text-sky-700"><Info size={14} /> Aucune API GUDEF connectée : export fidèle au modèle, prêt pour dépôt. Le mapping officiel se règle par import du modèle (Mode B).</div>
      </div>
      <div className="mb-6"><Tabs active={tab} onChange={setTab} tabs={[{ id: "univ", label: "Import universel", icon: <Upload size={15} /> }, { id: "reconst", label: "Audit & reconstitution", icon: <FileSpreadsheet size={15} /> }, { id: "edit", label: "Génération (mode A)", icon: <FileSpreadsheet size={15} /> }, { id: "bal6", label: "Balance 6 colonnes", icon: <FileSpreadsheet size={15} /> }, { id: "fourni", label: "État fourni (mode B)", icon: <Wand2 size={15} /> }, { id: "checks", label: "Contrôles de base", icon: <ShieldCheck size={15} /> }, { id: "coherence", label: "Cohérence SYSCOHADA", icon: <ShieldCheck size={15} /> }, { id: "tafire", label: "TAFIRE", icon: <FileSpreadsheet size={15} /> }, { id: "notes", label: "Notes annexes", icon: <FileSpreadsheet size={15} /> }, { id: "plan", label: "Plan & écritures", icon: <ShieldCheck size={15} /> }]} /></div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(prev || cur) && <Button onClick={onRunChecks}><ShieldCheck size={15} /> Lancer les contrôles de cohérence</Button>}
        <Button variant="outline" disabled={!cur} onClick={() => setPrinting(true)}>
          <FileDown size={15} /> Imprimer la liasse / PDF
        </Button>
      </div>
      {tab === "edit" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <UploadZone label="Balance N-1 (Excel / CSV)" hint={prev ? `${prev.length} comptes · Σ ${fcfaCompact(prev.reduce((s, r) => s + r.debit, 0))}` : "Aucun fichier"} loading={loading === "prev"} onFile={(f) => onFile("prev", f)} />
            <UploadZone label="Balance N (Excel / CSV)" hint={cur ? `${cur.length} comptes · Σ ${fcfaCompact(cur.reduce((s, r) => s + r.debit, 0))}` : "Aucun fichier"} loading={loading === "cur"} onFile={(f) => onFile("cur", f)} />
          </div>
          {importReport && (
            <Card className="p-5">
              <SectionHeading
                title={`Rapport d'import — ${importReport.which === "prev" ? "Balance N-1" : "Balance N"}`}
                subtitle={importReport.report.ok ? `${importReport.report.rows.length} compte(s) lus · Σ débit ${fcfa(importReport.report.totals.debit)} · Σ crédit ${fcfa(importReport.report.totals.credit)}` : "Import refusé — aucun compte exploitable"}
              />
              {importReport.report.ok ? (
                <div className={`mb-3 flex items-start gap-2 rounded-xl px-3 py-2 text-xs ${importReport.report.totals.ecart === 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                  {importReport.report.totals.ecart === 0 ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <AlertTriangle size={14} className="mt-0.5 shrink-0" />}
                  {importReport.report.totals.ecart === 0
                    ? "Balance équilibrée : Σ débit = Σ crédit."
                    : `Balance déséquilibrée : écart de ${fcfa(importReport.report.totals.ecart)} entre débits et crédits.`}
                </div>
              ) : (
                <div className="mb-3 flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  <XCircle size={14} className="mt-0.5 shrink-0" />
                  <span>{importReport.report.errors.join(" ")}</span>
                </div>
              )}
              {importReport.report.signals.length > 0 && (
                <ul className="mb-2 space-y-1 text-xs text-slate-500">
                  {importReport.report.signals.slice(0, 8).map((x, i) => <li key={i} className="flex gap-1.5"><Info size={12} className="mt-0.5 shrink-0" />{x}</li>)}
                </ul>
              )}
              {importReport.report.warnings.length > 0 && (
                <ul className="mb-2 space-y-1 text-xs text-amber-700">
                  {importReport.report.warnings.slice(0, 8).map((x, i) => <li key={i} className="flex gap-1.5"><AlertTriangle size={12} className="mt-0.5 shrink-0" />{x}</li>)}
                </ul>
              )}
              {importReport.report.rejected.length > 0 && (
                <details className="mt-2 text-xs text-slate-500">
                  <summary className="cursor-pointer font-medium text-slate-600">
                    {importReport.report.rejected.length} ligne(s) écartée(s) — voir le détail
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {importReport.report.rejected.slice(0, 10).map((r, i) => (
                      <li key={i}>Ligne {r.row} : {r.reason} — <span className="font-mono">{r.values.join(" | ")}</span></li>
                    ))}
                  </ul>
                </details>
              )}
            </Card>
          )}
          {stmt && (
            <>
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="p-5"><SectionHeading title="Compte de résultat (N)" />
                  <div className="space-y-1.5"><Row2 l="Produits (classe 7)" v={fcfa(stmt.result.produits)} tone="emerald" /><Row2 l="Charges (classe 6)" v={fcfa(stmt.result.charges)} tone="rose" /><div className="my-1 border-t border-dashed border-slate-200" /><Row2 l="RÉSULTAT" v={fcfa(stmt.result.resultat)} bold /></div>
                </Card>
                <Card className="p-5"><SectionHeading title="Bilan synthétique (N)" />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div><p className="mb-1 text-xs font-bold uppercase text-slate-400">Actif</p><Row2 l="Immo nettes" v={fcfa(stmt.bilan.immoNet)} /><Row2 l="Stocks" v={fcfa(stmt.bilan.stocks)} /><Row2 l="Créances" v={fcfa(stmt.bilan.creances)} /><Row2 l="Trésorerie" v={fcfa(stmt.bilan.tresorerie)} /><Row2 l="TOTAL" v={fcfa(stmt.bilan.actifTotal)} bold /></div>
                    <div><p className="mb-1 text-xs font-bold uppercase text-slate-400">Passif</p><Row2 l="Capitaux" v={fcfa(stmt.bilan.capitaux)} /><Row2 l="Résultat" v={fcfa(stmt.bilan.resultat)} /><Row2 l="Dettes fin." v={fcfa(stmt.bilan.dettesFin)} /><Row2 l="Fournisseurs" v={fcfa(stmt.bilan.dettesFourn)} /><Row2 l="TOTAL" v={fcfa(stmt.bilan.passifTotal)} bold /></div>
                  </div>
                </Card>
              </div>
              <Card className="p-5"><SectionHeading title="Export de la liasse" subtitle="Feuilles : Balance N-1, Balance N, Compte de résultat, Bilan, Contrôles — styles et formules préservés" />
                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={generate} disabled={loading === "gen"}><FileDown size={16} /> Générer & exporter (Mode A)</Button>
                  <span className="text-sm text-slate-400">ou</span>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100">
                    <Wand2 size={16} /> Remplir un modèle GUDEF (Mode B)
                    <input type="file" accept=".xlsx" className="hidden" onChange={(e) => fillTpl(e.target.files?.[0] || null)} />
                  </label>
                  {tplFilled !== null && <Badge tone="emerald">{tplFilled} cellule(s) renseignée(s)</Badge>}
                </div>
              </Card>
            </>
          )}
        </div>
      )}
      {tab === "checks" && (
        <Card className="p-5">
          <SectionHeading title="Rapport de cohérence & conformité" subtitle="Confrontation bilan / compte de résultat / balance" />
          {!stmt ? <EmptyState icon={<ShieldCheck />} title="Importez une Balance N pour lancer les contrôles" /> : (
            <>
              <div className="mb-4 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-emerald-50 p-3"><p className="text-2xl font-black text-emerald-600">{checks.filter((c) => c.status === "ok").length}</p><p className="text-xs text-slate-500">Conformes</p></div>
                <div className="rounded-xl bg-amber-50 p-3"><p className="text-2xl font-black text-amber-600">{checks.filter((c) => c.status === "warning").length}</p><p className="text-xs text-slate-500">Avertissements</p></div>
                <div className="rounded-xl bg-rose-50 p-3"><p className="text-2xl font-black text-rose-600">{checks.filter((c) => c.status === "blocking").length}</p><p className="text-xs text-slate-500">Bloquants</p></div>
              </div>
              <div className="space-y-2">{checks.map((c) => (
                <div key={c.id} className="flex items-start gap-3 rounded-xl border border-slate-100 px-4 py-3">
                  {c.status === "ok" ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-500" /> : c.status === "warning" ? <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-500" /> : <XCircle size={18} className="mt-0.5 shrink-0 text-rose-500" />}
                  <div className="flex-1"><div className="flex items-center justify-between"><p className="font-semibold text-slate-800">{c.title}</p><Badge tone="slate">{c.sheet}</Badge></div><p className="text-xs text-slate-400">{c.detail}</p><p className="mt-1 text-xs tabular-nums text-slate-500">Attendu {fcfa(c.expected)} · Constaté {fcfa(c.actual)} · Écart {fcfa(c.diff)}</p></div>
                </div>
              ))}</div>
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-xs text-indigo-700"><ShieldCheck size={14} className="mt-0.5 shrink-0" /> Les cellules dérivées (totaux, reports, soldes) sont recalculées automatiquement à partir des comptes sources ; chaque correction est consignée dans l'audit trail.</div>
            </>
          )}
        </Card>
      )}
      {tab === "tafire" && (
        <div className="space-y-6">
          {!tafire ? (
            <Card className="p-5"><EmptyState icon={<FileSpreadsheet />} title="Importez une balance N" description="Le TAFIRE se calcule à partir des balances N-1 et N." /></Card>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatMini label="CAFG" value={fcfa(tafire.cafg)} tone="emerald" />
                <StatMini label="Variation du BFR" value={fcfa(tafire.variationBfr)} tone="sky" />
                <StatMini label="Trésorerie de clôture" value={fcfa(tafire.tresorerieCloture)} tone="indigo" />
                <StatMini label="Écart de bouclage" value={fcfa(tafire.ecart)} tone={tafire.ecart === 0 ? "emerald" : "rose"} />
              </div>
              <Card className="p-5">
                <SectionHeading title="Tableau des flux de trésorerie" subtitle="SYSCOHADA révisé · aucun flux saisi : tout découle de la variation des soldes" />
                {!tafire.available ? (
                  <div className="flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{tafire.reason}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <tbody>
                        <tr className="border-b border-slate-100"><td className="px-3 py-2.5 font-bold text-slate-800">Trésorerie d'ouverture</td><td className="px-3 py-2.5 text-right font-bold tabular-nums">{fcfa(tafire.tresorerieOuverture)}</td></tr>
                        {tafire.zones.map((z) => (
                          <Fragment key={z.id}>
                            <tr className="bg-slate-50"><td colSpan={2} className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-500">{z.label}</td></tr>
                            {z.fluxes.map((f) => (
                              <tr key={f.label} className="border-b border-slate-50">
                                <td className="px-3 py-2 pl-6 text-slate-700">{f.label}<p className="text-[11px] text-slate-400">{f.basis}</p></td>
                                <td className="px-3 py-2 text-right tabular-nums text-slate-700">{fcfa(f.amount)}</td>
                              </tr>
                            ))}
                            <tr className="border-b border-slate-200"><td className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Total de la zone</td><td className="px-3 py-2 text-right font-bold tabular-nums text-slate-800">{fcfa(z.total)}</td></tr>
                          </Fragment>
                        ))}
                        <tr className="border-t-2 border-slate-300"><td className="px-3 py-3 font-black text-slate-900">Trésorerie de clôture (calculée)</td><td className="px-3 py-3 text-right font-black tabular-nums text-slate-900">{fcfa(tafire.tresorerieCalculee)}</td></tr>
                        <tr><td className="px-3 py-2 text-slate-500">Trésorerie de clôture (balance)</td><td className="px-3 py-2 text-right tabular-nums text-slate-500">{fcfa(tafire.tresorerieCloture)}</td></tr>
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="mt-4 space-y-2">
                  {tafire.controls.map((c) => (
                    <div key={c.id} className="flex items-start gap-3 rounded-xl border border-slate-100 px-3 py-2.5">
                      {c.level === "ok" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" /> : <AlertTriangle size={16} className={`mt-0.5 shrink-0 ${c.level === "blocking" ? "text-rose-500" : "text-amber-500"}`} />}
                      <div className="min-w-0"><p className="text-sm font-semibold text-slate-800">{c.label}</p><p className="text-xs text-slate-500">{c.detail}</p></div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}
        </div>
      )}
      {tab === "notes" && (
        <div className="space-y-6">
          {!annex ? (
            <Card className="p-5"><EmptyState icon={<FileSpreadsheet />} title="Importez une balance N" description="Les notes annexes se calculent depuis la balance (et la balance N-1 pour les variations)." /></Card>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatMini label="Notes calculées" value={String(annex.computedCount)} tone="emerald" />
                <StatMini label="À compléter à la main" value={String(annex.manualCount)} tone="rose" />
                <StatMini label="Référentiel" value={String(annex.registryCount)} tone="indigo" />
                <StatMini label="Valeurs indéterminées" value={String(annex.undeterminedCells)} tone="sky" />
              </div>
              <Card className="p-5">
                <SectionHeading title="Contrôles des notes annexes" subtitle="Ce que la balance permet de calculer — et ce qu'elle ne permet pas" />
                <div className="space-y-2">
                  {annex.controls.map((c) => (
                    <div key={c.id} className="flex items-start gap-3 rounded-xl border border-slate-100 px-3 py-2.5">
                      {c.level === "ok" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" />}
                      <div className="min-w-0"><p className="text-sm font-semibold text-slate-800">{c.label}</p><p className="text-xs text-slate-500">{c.detail}</p></div>
                    </div>
                  ))}
                </div>
              </Card>
              {annex.notes.length > 0 && (
                <Card className="p-5">
                  <SectionHeading title="Notes calculées" subtitle="Montants N, N-1 et variation · « — » = valeur non déterminée, jamais 0" />
                  <div className="space-y-3">
                    {annex.notes.map((note) => (
                      <details key={note.code} className="rounded-xl border border-slate-100">
                        <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3">
                          <span className="flex items-center gap-2"><Badge tone="indigo">{note.code}</Badge><span className="text-sm font-semibold text-slate-800">{note.title}</span></span>
                          <span className="flex items-center gap-4 text-sm tabular-nums text-slate-600">
                            <span>N {note.totalN === null ? "—" : fcfa(note.totalN)}</span>
                            <span className="text-slate-400">N-1 {note.totalN1 === null ? "—" : fcfa(note.totalN1)}</span>
                            <span className={note.variation && note.variation !== 0 ? "font-semibold text-indigo-600" : "text-slate-400"}>Δ {note.variation === null ? "—" : fcfa(note.variation)}</span>
                          </span>
                        </summary>
                        {note.rows.length > 0 && (
                          <div className="overflow-x-auto border-t border-slate-100">
                            <table className="w-full text-xs">
                              <thead className="bg-slate-50 text-slate-400"><tr><th className="px-4 py-2 text-left">Réf.</th><th className="px-4 py-2 text-left">Libellé</th><th className="px-4 py-2 text-right">N</th><th className="px-4 py-2 text-right">N-1</th><th className="px-4 py-2 text-right">Variation</th></tr></thead>
                              <tbody>{note.rows.map((r, i) => (
                                <tr key={i} className="border-t border-slate-50">
                                  <td className="px-4 py-1.5 font-mono text-slate-500">{r.ref || "—"}</td>
                                  <td className="px-4 py-1.5 text-slate-700">{r.label}</td>
                                  <td className="px-4 py-1.5 text-right tabular-nums">{r.n === null ? "—" : fcfa(r.n)}</td>
                                  <td className="px-4 py-1.5 text-right tabular-nums text-slate-500">{r.n1 === null ? "—" : fcfa(r.n1)}</td>
                                  <td className="px-4 py-1.5 text-right tabular-nums text-slate-500">{r.variation === null ? "—" : fcfa(r.variation)}</td>
                                </tr>
                              ))}</tbody>
                            </table>
                          </div>
                        )}
                      </details>
                    ))}
                  </div>
                </Card>
              )}
              {annex.manualNotes.length > 0 && (
                <Card className="p-5">
                  <SectionHeading title="Notes à compléter" subtitle="Aucune donnée de balance ne permet de les déduire — elles ne sont pas remplies de zéros" />
                  <div className="grid gap-2 sm:grid-cols-2">
                    {annex.manualNotes.map((note) => (
                      <div key={note.code} className="rounded-xl border border-amber-100 bg-amber-50/50 px-3 py-2">
                        <p className="text-sm font-semibold text-slate-800"><span className="font-mono text-xs text-amber-700">{note.code}</span> {note.title}</p>
                        <p className="text-[11px] text-slate-500">{note.missingInfo[0] || "Saisie manuelle requise."}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      )}
      {tab === "univ" && <UniversalImportView onResult={(n) => { setCur(n.balanceN.length ? n.balanceN : null); setPrev(n.balanceN1.length ? n.balanceN1 : null); if (n.kind === "balance6" || n.kind === "balance") setTab("coherence"); }} />}
      {tab === "reconst" && <ReconstitutionView cur={cur} prev={prev} />}
      {tab === "plan" && <PlanCoherenceView companyId={companyId!} />}
      {tab === "bal6" && (
        <Card className="p-5">
          <SectionHeading title="Balance 6 colonnes (N et N-1)" subtitle="Format : Compte · Libellé · SD N · SC N · SD N-1 · SC N-1 — sous-totaux détectés" />
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
              <Upload size={16} /> Importer la balance 6 colonnes
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => onBal6(e.target.files?.[0] || null)} />
            </label>
            {loading === "bal6" && <Spinner className="text-indigo-500" />}
            {bal6 && <Badge tone="emerald">{bal6.n.length} comptes N · {bal6.n1.length} N-1 · {bal6.subtotals.length} sous-totaux</Badge>}
          </div>
          {bal6 && (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-100 p-3"><p className="text-xs text-slate-400">Σ Balance N</p><p className="font-bold text-slate-800">D {fcfa(bal6.n.reduce((s, r) => s + r.debit, 0))} / C {fcfa(bal6.n.reduce((s, r) => s + r.credit, 0))}</p></div>
                <div className="rounded-xl border border-slate-100 p-3"><p className="text-xs text-slate-400">Σ Balance N-1</p><p className="font-bold text-slate-800">D {fcfa(bal6.n1.reduce((s, r) => s + r.debit, 0))} / C {fcfa(bal6.n1.reduce((s, r) => s + r.credit, 0))}</p></div>
              </div>
              <div className="max-h-72 overflow-auto rounded-xl border border-slate-100"><table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-400"><tr><th className="px-3 py-2 text-left">Compte</th><th className="px-3 py-2 text-left">Libellé</th><th className="px-3 py-2 text-right">SD N</th><th className="px-3 py-2 text-right">SC N</th><th className="px-3 py-2 text-right">SD N-1</th><th className="px-3 py-2 text-right">SC N-1</th></tr></thead>
                <tbody>{bal6.n.map((r, i) => (<tr key={i} className="border-t border-slate-50"><td className="px-3 py-1.5 font-mono">{r.code}</td><td className="px-3 py-1.5 text-slate-600">{r.label}</td><td className="px-3 py-1.5 text-right tabular-nums">{r.debit || "—"}</td><td className="px-3 py-1.5 text-right tabular-nums">{r.credit || "—"}</td><td className="px-3 py-1.5 text-right tabular-nums">{bal6.n1[i]?.debit || "—"}</td><td className="px-3 py-1.5 text-right tabular-nums">{bal6.n1[i]?.credit || "—"}</td></tr>))}</tbody>
              </table></div>
              <Button className="mt-4" onClick={onRunChecks}><ShieldCheck size={15} /> Lancer les contrôles de cohérence</Button>
            </>
          )}
        </Card>
      )}
      {tab === "fourni" && (
        <div className="space-y-6">
        {/* DIAGNOSTIC BALANCES */}
        <Card className="p-5">
          <SectionHeading title="🔍 Diagnostic des balances lues par le moteur" subtitle="Vérifiez que vos balances N et N-1 sont correctement importées AVANT de remplir l'état" />
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Balance N */}
            <div className={`rounded-xl border-2 p-4 ${cur ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200 bg-slate-50"}`}>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Balance N (exercice courant)</p>
              {cur ? (
                <>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-slate-500">Comptes lus</span><span className="font-bold text-slate-800">{cur.length}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Σ Débit</span><span className="font-semibold tabular-nums text-slate-800">{fcfa(cur.reduce((s, r) => s + r.debit, 0))}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Σ Crédit</span><span className="font-semibold tabular-nums text-slate-800">{fcfa(cur.reduce((s, r) => s + r.credit, 0))}</span></div>
                    <div className={`mt-1 rounded-lg px-2 py-1 text-center text-xs font-bold ${cur.reduce((s, r) => s + r.debit, 0) === cur.reduce((s, r) => s + r.credit, 0) ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                      {cur.reduce((s, r) => s + r.debit, 0) === cur.reduce((s, r) => s + r.credit, 0) ? "✓ ÉQUILIBRÉE" : "✗ DÉSÉQUILIBRÉE"}
                    </div>
                  </div>
                  {/* 5 premiers comptes */}
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[11px] font-semibold text-indigo-600">Aperçu (5 premiers comptes)</summary>
                    <table className="mt-1 w-full text-[11px]">
                      <thead className="text-slate-400"><tr><th className="px-1 py-0.5 text-left">Cpte</th><th className="px-1 py-0.5 text-right">Débit</th><th className="px-1 py-0.5 text-right">Crédit</th></tr></thead>
                      <tbody>{cur.slice(0, 5).map((r, i) => <tr key={i} className="border-t border-slate-100"><td className="px-1 py-0.5 font-mono">{r.code}</td><td className="px-1 py-0.5 text-right tabular-nums">{r.debit || "—"}</td><td className="px-1 py-0.5 text-right tabular-nums">{r.credit || "—"}</td></tr>)}</tbody>
                    </table>
                  </details>
                </>
              ) : (
                <p className="py-4 text-center text-sm text-slate-400">⚠️ Aucune balance N importée.<br />Utilisez l'onglet « Génération » ou « Balance 6 colonnes ».</p>
              )}
            </div>
            {/* Balance N-1 */}
            <div className={`rounded-xl border-2 p-4 ${prev && prev.length > 0 ? "border-sky-200 bg-sky-50/40" : "border-slate-200 bg-slate-50"}`}>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Balance N-1 (exercice précédent)</p>
              {prev && prev.length > 0 ? (
                <>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-slate-500">Comptes lus</span><span className="font-bold text-slate-800">{prev.length}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Σ Débit</span><span className="font-semibold tabular-nums text-slate-800">{fcfa(prev.reduce((s, r) => s + r.debit, 0))}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Σ Crédit</span><span className="font-semibold tabular-nums text-slate-800">{fcfa(prev.reduce((s, r) => s + r.credit, 0))}</span></div>
                    <div className={`mt-1 rounded-lg px-2 py-1 text-center text-xs font-bold ${prev.reduce((s, r) => s + r.debit, 0) === prev.reduce((s, r) => s + r.credit, 0) ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                      {prev.reduce((s, r) => s + r.debit, 0) === prev.reduce((s, r) => s + r.credit, 0) ? "✓ ÉQUILIBRÉE" : "✗ DÉSÉQUILIBRÉE"}
                    </div>
                  </div>
                </>
              ) : (
                <p className="py-4 text-center text-sm text-slate-400">ℹ️ Aucune balance N-1 importée.<br />Optionnelle (comparatif N/N-1).</p>
              )}
            </div>
          </div>
          {/* Valeurs calculées clés */}
          {cur && stmt && (
            <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-indigo-600">📊 Valeurs calculées par le moteur (seront écrites dans l'état)</p>
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div className="rounded-lg bg-white px-3 py-2"><p className="text-[10px] text-slate-400">Total Actif</p><p className="font-bold tabular-nums text-slate-800">{fcfaCompact(stmt.bilan.actifTotal)}</p></div>
                <div className="rounded-lg bg-white px-3 py-2"><p className="text-[10px] text-slate-400">Total Passif</p><p className="font-bold tabular-nums text-slate-800">{fcfaCompact(stmt.bilan.passifTotal)}</p></div>
                <div className="rounded-lg bg-white px-3 py-2"><p className="text-[10px] text-slate-400">Résultat</p><p className={`font-bold tabular-nums ${stmt.result.resultat >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{fcfaCompact(stmt.result.resultat)}</p></div>
                <div className="rounded-lg bg-white px-3 py-2"><p className="text-[10px] text-slate-400">Trésorerie</p><p className="font-bold tabular-nums text-slate-800">{fcfaCompact(stmt.bilan.tresorerie)}</p></div>
              </div>
            </div>
          )}
        </Card>
        {/* REMPLISSAGE ÉTAT */}
        <Card className="p-5">
          <SectionHeading title="Éditer un état fourni (remplissage non destructif)" subtitle="Téléversez un modèle d'état (Bilan, CR, TAFIRE…) — il est rempli à partir des balances sans altérer fusions, styles ni formules" />
          <div className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> L'état fourni est détecté par ses codes de référence SYSCOHADA (AE, TA, RA…) puis rempli. La structure d'origine est préservée.</div>
          {!cur && <p className="mb-3 text-sm text-rose-500">Importez d'abord une balance (onglet « Balance 6 colonnes » ou « Génération »).</p>}
          <label className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ${cur ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-slate-200 text-slate-400"}`}>
            <Wand2 size={16} /> {loading === "state" ? "Édition…" : "Téléverser le modèle d'état & éditer"}
            <input type="file" accept=".xlsx,.xls" className="hidden" disabled={!cur} onChange={(e) => onFillState(e.target.files?.[0] || null)} />
          </label>
          {stateFilled && (
            <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
              <p className="flex items-center gap-2 font-semibold text-emerald-700"><CheckCircle2 size={16} /> {stateFilled.filled} cellule(s) renseignée(s) — état exporté sans altération du modèle.</p>
              {stateFilled.unmatched.length > 0 && <p className="mt-1 text-xs text-amber-600">Références non reconnues (ignorées) : {stateFilled.unmatched.join(", ")}</p>}
              {stateFilled.report && stateFilled.report.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-slate-500">Rapport de vérification ({stateFilled.report.length} valeurs écrites)</summary>
                  <div className="mt-2 max-h-48 overflow-y-auto rounded-lg bg-slate-900 p-3 font-mono text-[11px] text-slate-300">
                    {stateFilled.report.map((r, i) => <div key={i}>{r}</div>)}
                  </div>
                </details>
              )}
            </div>
          )}
        </Card>
        </div>
      )}
      {tab === "coherence" && (
        <Card className="p-5">
          <SectionHeading title="Contrôle de cohérence & d'équilibre des états (SYSCOHADA)" subtitle="Confrontation Bilan / Compte de résultat / TFT / notes annexes — N et N-1" />
          <div className="mb-4 flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> <b>NOTE IMPORTANTE :</b> avant toute utilisation des états, assurez-vous que tous les contrôles affichent « OK! ». En cas de déséquilibre entre un état de base (Bilan/CR) et une note/état fiscal, corrigez d'abord l'état de base puis éditez la note correspondante.</div>
          {!report ? <EmptyState icon={<ShieldCheck />} title="Aucun contrôle lancé" description="Importez une balance puis cliquez sur « Lancer les contrôles de cohérence »." /> : (
            <>
              <div className="mb-4 grid grid-cols-4 gap-3 text-center">
                <div className="rounded-xl bg-emerald-50 p-3"><p className="text-2xl font-black text-emerald-600">{report.okCount}</p><p className="text-xs text-slate-500">OK!</p></div>
                <div className="rounded-xl bg-rose-50 p-3"><p className="text-2xl font-black text-rose-600">{report.koCount}</p><p className="text-xs text-slate-500">Déséquilibrés</p></div>
                <div className="rounded-xl bg-amber-50 p-3"><p className="text-2xl font-black text-amber-600">{report.warnCount}</p><p className="text-xs text-slate-500">Avertissements</p></div>
                <div className="rounded-xl bg-indigo-50 p-3"><p className="text-2xl font-black text-indigo-600">{report.score}%</p><p className="text-xs text-slate-500">Score cohérence</p></div>
              </div>
              {[...new Set(report.lines.map((l) => l.cat))].map((cat) => {
                const cl = report.lines.filter((l) => l.cat === cat);
                const ko = cl.some((l) => l.status !== "OK!");
                return (
                  <div key={cat} className="mb-4">
                    <p className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">{cat} {ko ? <Badge tone="rose">déséquilibré</Badge> : <Badge tone="emerald">OK!</Badge>}</p>
                    <div className="overflow-x-auto rounded-xl border border-slate-100"><table className="w-full text-xs">
                      <thead className="bg-slate-50 text-slate-400"><tr><th className="px-2 py-2 text-left">Réf.</th><th className="px-3 py-2 text-left">Intitulé</th><th className="px-3 py-2 text-right">État N</th><th className="px-3 py-2 text-right">Note N</th><th className="px-2 py-2 text-right">Écart N</th><th className="px-3 py-2 text-right">État N-1</th><th className="px-2 py-2 text-right">Écart N-1</th><th className="px-2 py-2 text-center">Statut</th></tr></thead>
                      <tbody>{cl.map((l, i) => (<tr key={i} className="border-t border-slate-50"><td className="px-2 py-1.5 font-mono font-semibold text-slate-600">{l.ref}</td><td className="px-3 py-1.5 text-slate-700">{l.label}</td><td className="px-3 py-1.5 text-right tabular-nums">{fcfa(l.etatN)}</td><td className="px-3 py-1.5 text-right tabular-nums">{fcfa(l.noteN)}</td><td className={`px-2 py-1.5 text-right tabular-nums ${l.ecartN !== 0 ? "text-rose-600 font-semibold" : "text-slate-400"}`}>{fcfa(l.ecartN)}</td><td className="px-3 py-1.5 text-right tabular-nums">{fcfa(l.etatN1)}</td><td className={`px-2 py-1.5 text-right tabular-nums ${l.ecartN1 !== 0 ? "text-rose-600 font-semibold" : "text-slate-400"}`}>{fcfa(l.ecartN1)}</td><td className="px-2 py-1.5 text-center"><span className={l.status === "OK!" ? "font-bold text-emerald-600" : "font-bold text-rose-600"}>{l.status}</span></td></tr>))}</tbody>
                    </table></div>
                  </div>
                );
              })}
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-xs text-indigo-700"><ShieldCheck size={14} className="mt-0.5 shrink-0" /> Règle de correction : ÉTAT DE BASE correct d'abord, puis ajustement de la note/état complémentaire. Les soldes intermédiaires (marge, VA, EBE, RN) sont recalculés en cascade ; chaque correction est tracée dans l'audit trail.</div>
            </>
          )}
        </Card>
      )}

      <PrintSheet open={printing} onClose={() => setPrinting(false)}>
        {cur && (
          <LiassePrint
            company={company}
            stmt={buildStatements(cur)}
            checks={runChecks(buildStatements(cur))}
            exercise={String(new Date().getFullYear())}
            tafire={tafire}
            annex={annex}
          />
        )}
      </PrintSheet>
    </Page>
  );
}

function ReconstitutionView({ cur, prev }: { cur: BalanceRow[] | null; prev: BalanceRow[] | null }) {
  const [audit, setAudit] = useState<WorkbookAudit | null>(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState({ feuille: "FICHE IDENTIFICATION 1", B2: "", B3: "", B4: "", B5: "", B6: "", B7: "" });
  const [patched, setPatched] = useState<{ patched: number; preserved: number; errors: string[] } | null>(null);
  const onAudit = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    try { setAudit(await auditWorkbook(file)); } catch (e) { toast("Impossible d'auditer ce classeur :\n\n" + ((e as Error)?.message || String(e))); }
    setBusy(false);
  };
  const onClone = async (file: File | null) => { if (file) { await cloneWorkbook(file); } };
  const onPatch = async (file: File | null) => {
    if (!file) { return; }
    setBusy(true);
    try {
      const inputs: Record<string, string | number> = {};
      // Identification
      Object.entries(info).filter(([k]) => k !== "feuille").forEach(([k, v]) => { if (v) inputs[`${info.feuille}!${k}`] = v; });
      // Balances
      if (cur) cur.slice(0, 200).forEach((r, i) => { const row = i + 2; inputs[`BALANCE N!A${row}`] = r.code; inputs[`BALANCE N!C${row}`] = r.debit; inputs[`BALANCE N!D${row}`] = r.credit; });
      if (prev) prev.slice(0, 200).forEach((r, i) => { const row = i + 2; inputs[`BALANCE N-1!A${row}`] = r.code; inputs[`BALANCE N-1!C${row}`] = r.debit; inputs[`BALANCE N-1!D${row}`] = r.credit; });
      const res = await patchWorkbook(file, inputs);
      await downloadWorkbookWb(res.workbook, `etat_reconstitue_${file.name}`);
      setPatched({ patched: res.patched, preserved: res.preserved, errors: res.errors });
    } catch (e) { toast("Échec de l'édition non destructive :\n\n" + ((e as Error)?.message || String(e))); }
    setBusy(false);
  };
  return (
    <Card className="p-5">
      <SectionHeading title="Audit & reconstitution d'état financier" subtitle="Méthode « modèle + entrées + recalcul » : non-destructive, formules préservées" />
      <div className="mb-4 flex items-start gap-2 rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-700"><Info size={14} className="mt-0.5 shrink-0" /> Philosophie : on utilise le classeur fourni comme <b>modèle</b>, on ne modifie que les <b>données d'entrée</b> (balances + fiche d'identification), et on laisse Excel <b>recalculer</b> les formules. Aucune formule, fusion ni style n'est écrasé.</div>
      <div className="mb-4 flex flex-wrap gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"><FileSpreadsheet size={16} /> {busy ? "Analyse…" : "1 · Auditer le modèle"}<input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => onAudit(e.target.files?.[0] || null)} /></label>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"><FileSpreadsheet size={16} /> 2 · Cloner (copie exacte)<input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => onClone(e.target.files?.[0] || null)} /></label>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"><Wand2 size={16} /> 3 · Patcher (édition non destructive)<input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => onPatch(e.target.files?.[0] || null)} /></label>
      </div>
      {/* Fiche d'identification (pour le patch) */}
      <div className="mb-5 rounded-xl border border-slate-100 p-4">
        <p className="mb-2 text-xs font-bold uppercase text-slate-400">Fiche d'identification (renseignée dans le patch)</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input value={info.B2} onChange={(e) => setInfo({ ...info, B2: e.target.value })} placeholder="B2 — Raison sociale" />
          <Input value={info.B3} onChange={(e) => setInfo({ ...info, B3: e.target.value })} placeholder="B3 — NIF" />
          <Input value={info.B4} onChange={(e) => setInfo({ ...info, B4: e.target.value })} placeholder="B4 — RCCM" />
          <Input value={info.B5} onChange={(e) => setInfo({ ...info, B5: e.target.value })} placeholder="B5 — Forme juridique" />
          <Input value={info.B6} onChange={(e) => setInfo({ ...info, B6: e.target.value })} placeholder="B6 — Capital" />
          <Input value={info.B7} onChange={(e) => setInfo({ ...info, B7: e.target.value })} placeholder="B7 — Exercice" />
        </div>
        <p className="mt-2 text-[11px] text-slate-400">Balances : {cur ? `${cur.length} comptes N` : "N non chargée"} · {prev ? `${prev.length} N-1` : "N-1 non chargée"} (importez-les via l'onglet « Import universel »).</p>
      </div>
      {patched && (
        <div className="mb-5 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
          <p className="flex items-center gap-2 font-semibold text-emerald-700"><CheckCircle2 size={16} /> Édition non destructive terminée : {patched.patched} cellule(s) d'entrée renseignée(s), {patched.preserved} cellule(s) de formule préservée(s), recalcul forcé à l'ouverture.</p>
          {patched.errors.length > 0 && <p className="mt-1 text-xs text-amber-600">{patched.errors.slice(0, 4).join(" · ")}</p>}
        </div>
      )}
      {/* Audit (radiographie) */}
      {audit && (
        <div>
          <p className="mb-2 font-display text-sm font-bold text-slate-700">Radiographie du modèle — {audit.fileName}</p>
          <div className="mb-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
            {[["Feuilles", audit.sheetNames.length], ["Valeurs", audit.totalValues], ["Formules", audit.formulas], ["Fusions", audit.totalMerged], ["Feuilles GUDEF", audit.matchedKeySheets.length], ["Taille (Ko)", Math.round(audit.size / 1024)]].map(([l, v]) => (
              <div key={l as string} className="rounded-xl border border-slate-100 p-3 text-center"><p className="text-lg font-bold text-slate-800">{v as number}</p><p className="text-[10px] text-slate-400">{l}</p></div>
            ))}
          </div>
          <div className="mb-3 flex flex-wrap gap-2">{audit.matchedKeySheets.map((s) => <Badge key={s} tone="emerald">✓ {s}</Badge>)}{audit.matchedKeySheets.length === 0 && <span className="text-xs text-amber-600">Aucune feuille GUDEF standard reconnue.</span>}</div>
          <div className="overflow-x-auto rounded-xl border border-slate-100"><table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-400"><tr><th className="px-3 py-2 text-left">Feuille</th><th className="px-2 py-2 text-right">Valeurs</th><th className="px-2 py-2 text-right">Formules</th><th className="px-2 py-2 text-right">Saisie</th><th className="px-2 py-2 text-right">Calculées</th><th className="px-2 py-2 text-right">Fusions</th><th className="px-2 py-2">Exemples de formules</th></tr></thead>
            <tbody>{audit.sheetDetails.map((s) => (<tr key={s.name} className={`border-t border-slate-50 ${s.key ? "bg-emerald-50/30" : ""}`}><td className="px-3 py-1.5 font-medium text-slate-700">{s.name}{s.key && <span className="ml-1 text-emerald-500">★</span>}</td><td className="px-2 py-1.5 text-right tabular-nums">{s.values}</td><td className="px-2 py-1.5 text-right tabular-nums">{s.formulas}</td><td className="px-2 py-1.5 text-right tabular-nums">{s.inputCells}</td><td className="px-2 py-1.5 text-right tabular-nums">{s.calcCells}</td><td className="px-2 py-1.5 text-right tabular-nums">{s.merged}</td><td className="px-2 py-1.5 text-slate-400">{s.formulaSamples.slice(0, 2).join(" · ")}</td></tr>))}</tbody>
          </table></div>
          {audit.creator !== "—" && <p className="mt-2 text-[11px] text-slate-400">Métadonnées : créateur {audit.creator} · créé {audit.created.slice(0, 10)} · modifié {audit.modified.slice(0, 10)} · recalcul auto : {audit.fullCalcOnLoad ? "oui" : "non"}.</p>}
        </div>
      )}
    </Card>
  );
}

function UniversalImportView({ onResult }: { onResult: (n: NormalizedDoc) => void }) {
  const [grid, setGrid] = useState<RawGrid | null>(null);
  const [cols, setCols] = useState<DetectedColumn[]>([]);
  const [norm, setNorm] = useState<NormalizedDoc | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const onFile = async (file: File | null) => {
    if (!file) return;
    setFileName(file.name);
    setLoading(true);
    try {
      const g = await readAny(file);
      setGrid(g);
      const detected = detectColumns(g);
      setCols(detected);
      setNorm(normalize(detected, g));
    } catch { toast("Fichier illisible. Formats acceptés : .xlsx, .xls, .csv."); }
    setLoading(false);
  };
  const recompute = (newCols: DetectedColumn[]) => { setCols(newCols); if (grid) setNorm(normalize(newCols, grid)); };
  const validate = () => { if (norm) { onResult(norm); } };
  const roles: ColRole[] = ["compte", "libelle", "debitN", "creditN", "debitN1", "creditN1", "soldeDebit", "soldeCredit", "ref", "brut", "amort", "net", "montant", "taux", "quantite", "ignore"];
  return (
    <Card className="p-5">
      <SectionHeading title="Import universel" subtitle="Déposez n'importe quel Excel/CSV : FIMAAC détecte la structure, normalise et alimente les états financiers" />
      <div className="mb-4 flex items-start gap-2 rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-700"><Info size={14} className="mt-0.5 shrink-0" /> Aucun format imposé : balance, balance 6 colonnes, modèle d'état, plan comptable… Tout séparateur CSV, montants universels (espaces, virgules, parenthèses), multi-feuilles.</div>
      <label className="mb-4 flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed py-10 hover:border-indigo-300 hover:bg-slate-50">
        {loading ? <Spinner className="text-indigo-500" /> : <Upload size={28} className="mb-2 text-indigo-500" />}
        <p className="font-semibold text-slate-700">{fileName || "Déposez n'importe quel fichier (Excel/CSV)"}</p>
        <p className="text-xs text-slate-400">.xlsx · .xls · .csv</p>
        <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0] || null)} />
      </label>
      {norm && grid && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-100 p-3"><p className="text-xs text-slate-400">Type détecté</p><p className="font-bold text-indigo-600">{KIND_LABELS[norm.kind]}</p></div>
            <div className="rounded-xl border border-slate-100 p-3"><p className="text-xs text-slate-400">Lignes / Colonnes</p><p className="font-bold text-slate-800">{norm.rowCount} / {norm.colCount}</p></div>
            <div className="rounded-xl border border-slate-100 p-3"><p className="text-xs text-slate-400">Comptes N / N-1</p><p className="font-bold text-slate-800">{norm.balanceN.length} / {norm.balanceN1.length}</p></div>
            <div className="rounded-xl border border-slate-100 p-3"><p className="text-xs text-slate-400">Totaux détectés</p><p className="font-bold text-slate-800">{norm.totals.length}</p></div>
          </div>
          <div className="mb-4">
            <p className="mb-2 text-xs font-bold uppercase text-slate-400">Mapping détecté (modifiable)</p>
            <div className="overflow-x-auto rounded-xl border border-slate-100"><table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-400"><tr><th className="px-3 py-2 text-left">Colonne source</th><th className="px-3 py-2 text-left">Rôle assigné</th></tr></thead>
              <tbody>{cols.map((c) => (
                <tr key={c.index} className="border-t border-slate-50"><td className="px-3 py-1.5 font-medium text-slate-700">{c.header}</td><td className="px-3 py-1.5"><select value={c.role} onChange={(e) => recompute(cols.map((x) => x.index === c.index ? { ...x, role: e.target.value as ColRole } : x))} className="h-7 rounded-lg border border-slate-200 px-2 text-xs">{roles.map((r) => <option key={r} value={r}>{r}</option>)}</select></td></tr>
              ))}</tbody>
            </table></div>
          </div>
          <div className="mb-4">
            <p className="mb-2 text-xs font-bold uppercase text-slate-400">Aperçu normalisé (5 premières lignes)</p>
            <div className="overflow-x-auto rounded-xl border border-slate-100"><table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-400"><tr><th className="px-3 py-2 text-left">Compte</th><th className="px-3 py-2 text-left">Libellé</th><th className="px-3 py-2 text-right">Débit N</th><th className="px-3 py-2 text-right">Crédit N</th>{norm.balanceN1.length > 0 && <><th className="px-3 py-2 text-right">Débit N-1</th><th className="px-3 py-2 text-right">Crédit N-1</th></>}</tr></thead>
              <tbody>{norm.balanceN.slice(0, 5).map((r, i) => (<tr key={i} className="border-t border-slate-50"><td className="px-3 py-1.5 font-mono">{r.code}</td><td className="px-3 py-1.5 text-slate-600">{r.label}</td><td className="px-3 py-1.5 text-right tabular-nums">{fcfa(r.debit)}</td><td className="px-3 py-1.5 text-right tabular-nums">{fcfa(r.credit)}</td>{norm.balanceN1.length > 0 && <><td className="px-3 py-1.5 text-right tabular-nums">{fcfa(norm.balanceN1[i]?.debit || 0)}</td><td className="px-3 py-1.5 text-right tabular-nums">{fcfa(norm.balanceN1[i]?.credit || 0)}</td></>}</tr>))}</tbody>
            </table></div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl bg-slate-50 px-4 py-2 text-sm"><span className="text-slate-400">Σ Débit N : </span><b className="tabular-nums text-slate-800">{fcfa(norm.balanceN.reduce((s, r) => s + r.debit, 0))}</b><span className="text-slate-400"> · Σ Crédit N : </span><b className="tabular-nums text-slate-800">{fcfa(norm.balanceN.reduce((s, r) => s + r.credit, 0))}</b></div>
            <Button onClick={validate}><ShieldCheck size={15} /> Valider & continuer vers les états</Button>
          </div>
        </>
      )}
    </Card>
  );
}

function PlanCoherenceView({ companyId }: { companyId: string }) {
  const db = useDB();
  const entries = db.entries.filter((e) => e.companyId === companyId);
  const coverage = mappingCoverage(CHART_OF_ACCOUNTS);
  const report = auditNormativeCoherence(entries, CHART_OF_ACCOUNTS, coverage.missing);
  return (
    <Card className="p-5">
      <SectionHeading title="Cohérence du plan comptable & de la chaîne des écritures" subtitle="Le plan SYSCOHADA révisé est la source de vérité unique : écritures → balance → états financiers" />
      <div className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> Plan SYSCOHADA révisé (norme 2016) — version de travail profonde, <b>à valider contre les textes officiels AUDCIF</b>. La cohérence interne (écritures/balance/états) est garantie par ce contrôle.</div>
      <div className="mb-4 grid grid-cols-4 gap-3 text-center">
        <div className="rounded-xl bg-emerald-50 p-3"><p className="text-2xl font-black text-emerald-600">{report.okCount}</p><p className="text-xs text-slate-500">OK!</p></div>
        <div className="rounded-xl bg-rose-50 p-3"><p className="text-2xl font-black text-rose-600">{report.koCount}</p><p className="text-xs text-slate-500">Déséquilibrés</p></div>
        <div className="rounded-xl bg-amber-50 p-3"><p className="text-2xl font-black text-amber-600">{report.warnCount}</p><p className="text-xs text-slate-500">Avertissements</p></div>
        <div className="rounded-xl bg-indigo-50 p-3"><p className="text-2xl font-black text-indigo-600">{report.score}%</p><p className="text-xs text-slate-500">Score normatif</p></div>
      </div>
      <div className="space-y-2">{report.checks.map((c) => (
        <div key={c.id} className="flex items-start gap-3 rounded-xl border border-slate-100 px-4 py-3">
          {c.status === "OK!" ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-500" /> : c.status === "Avertissement" ? <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-500" /> : <XCircle size={18} className="mt-0.5 shrink-0 text-rose-500" />}
          <div className="flex-1"><div className="flex items-center justify-between"><p className="font-semibold text-slate-800">{c.title}</p><span className="flex items-center gap-2"><Badge tone="slate">{c.category}</Badge><span className={c.status === "OK!" ? "text-xs font-bold text-emerald-600" : c.status === "Avertissement" ? "text-xs font-bold text-amber-600" : "text-xs font-bold text-rose-600"}>{c.status}</span></span></div><p className="mt-0.5 text-xs text-slate-500">{c.detail}</p>{c.data && <p className="mt-0.5 text-[11px] tabular-nums text-slate-400">{c.data}</p>}</div>
        </div>
      ))}</div>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
        {Object.entries(report.chartStats.classes).map(([k, v]) => <div key={k} className="rounded-xl border border-slate-100 p-3 text-center"><p className="text-xs text-slate-400">Classe {k}</p><p className="text-lg font-bold text-slate-800">{v}</p></div>)}
      </div>
      <p className="mt-3 text-[11px] text-slate-400">Plan : {report.chartStats.total} comptes · profondeur {report.chartStats.maxDepth} niveaux · {report.chartStats.postable} imputables · mapping états : {coverage.covered}/{coverage.total} références couvertes.</p>
    </Card>
  );
}

function UploadZone({ label, hint, loading, onFile }: { label: string; hint: string; loading: boolean; onFile: (f: File | null) => void }) {
  return (
    <Card className="p-5">
      <p className="mb-2 text-sm font-bold text-slate-700">{label}</p>
      <label className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed py-8 transition-all hover:border-indigo-300 hover:bg-slate-50 ${loading ? "border-indigo-300 bg-indigo-50" : "border-slate-200"}`}>
        {loading ? <Spinner className="text-indigo-500" /> : <Upload size={24} className="mb-2 text-indigo-500" />}
        <p className="text-sm font-semibold text-slate-700">{loading ? "Lecture…" : "Cliquer pour importer"}</p>
        <p className="text-xs text-slate-400">{hint}</p>
        <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0] || null)} />
      </label>
    </Card>
  );
}

function Row2({ l, v, tone, bold }: { l: string; v: string; tone?: string; bold?: boolean }) {
  return <div className="flex items-center justify-between rounded-lg px-3 py-1.5 text-sm"><span className={bold ? "font-black text-slate-900" : "text-slate-600"}>{l}</span><span className={`tabular-nums ${bold ? "text-base font-black" : "font-semibold"} ${tone === "emerald" ? "text-emerald-600" : tone === "rose" ? "text-rose-600" : "text-slate-800"}`}>{v}</span></div>;
}

function StatMini({ label, value, tone }: { label: string; value: string; tone: "emerald" | "sky" | "indigo" | "rose" }) {
  const tones: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-700",
    sky: "bg-sky-50 text-sky-700",
    indigo: "bg-indigo-50 text-indigo-700",
    rose: "bg-rose-50 text-rose-700",
  };
  return (
    <div className={`rounded-xl px-4 py-3 ${tones[tone]}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 font-black tabular-nums">{value}</p>
    </div>
  );
}
