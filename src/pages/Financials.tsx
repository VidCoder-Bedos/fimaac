import { useState } from "react";
import { FileBarChart, CheckCircle2, AlertTriangle, ShieldCheck, Download, BarChart3, ListChecks, Circle, XCircle, FileText, Wand2, Printer } from "lucide-react";
import { useDB } from "../lib/store";
import { useCompanyScope, Page } from "../components/Layout";
import { Card, Button, Badge, EmptyState, SectionHeading, StatCard, Donut, ProgressBar, Tabs, Field, Input, Select } from "../components/ui";
import { financialSummary, trialBalance, computeRatios } from "../lib/accounting";
import { auxiliaryLedger, agedBalance, echeancier, exportFEC, exportAgedCSV, exportEcheancierCSV } from "../lib/editions";
import { resolveCompliance, postRegularisation } from "../lib/actions";
import { fcfa, fcfaCompact, formatDate } from "../lib/format";
import { buildStatements, runChecks } from "../lib/liasse";
import { runCrossChecks } from "../lib/crossCheck";
import PrintSheet from "../components/PrintSheet";
import StatementsPrint from "../components/StatementsPrint";
import { buildFec, fecScopeFromFiscalYear, type FecScope } from "../lib/fec";
import { toast } from "../lib/toast";

function downloadCSV(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
const CAT_LABELS: Record<string, string> = { accounting: "Comptabilité", tax: "Fiscalité", social: "Social", legal: "Juridique", documents: "Documents", deadlines: "Échéances" };

export function Financials() {
  const db = useDB();
  const { id: companyId } = useCompanyScope();
  const [tab, setTab] = useState("result");
  const [printing, setPrinting] = useState(false);
  const [reg, setReg] = useState<{ type: "CCA" | "PCA" | "CAP" | "PAR"; account: string; amount: string; label: string; date: string }>({ type: "CCA", account: "62", amount: "", label: "", date: new Date().toISOString().slice(0, 10) });
  const company = db.companies.find((c) => c.id === companyId);
  if (!company) return <Page><EmptyState icon={<FileBarChart />} title="Sélectionnez une entreprise" /></Page>;
  const sum = financialSummary(db.entries.filter((e) => e.companyId === companyId));
  // P1 — le bilan affiché et le document imprimé sortent de la MÊME source que
  // la page Liasse (`buildStatements`, mapping unique P0-1).
  const stmt = buildStatements(trialBalance(db.entries.filter((e) => e.companyId === companyId), db.accounts));
  const checks = runChecks(stmt);
  const closingSteps = [
    { label: "Contrôle des journaux", ok: true as const }, { label: "Contrôle des périodes", ok: true as const },
    { label: "Rapprochements bancaires", ok: db.bankTransactions.some((t) => t.companyId === companyId && !t.reconciled) ? "warn" as const : true as const },
    { label: "Immobilisations & amortissements", ok: true as const }, { label: "Inventaire des stocks", ok: "warn" as const },
    { label: "Contrôle des créances", ok: true as const }, { label: "Contrôle des dettes", ok: true as const },
    { label: "Régularisations", ok: "warn" as const }, { label: "Provisions / dépréciations", ok: "warn" as const },
    { label: "Contrôle fiscal", ok: true as const }, { label: "Balance après inventaire", ok: true as const },
    { label: "États financiers", ok: "warn" as const }, { label: "Contrôle final & clôture", ok: false as const },
  ];
  return (
    <Page>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-xl font-black tracking-tight text-slate-900">États financiers — {company.tradeName || company.name}</h2><p className="text-sm text-slate-500">SYSCOHADA révisé · Balance → États · traçabilité des montants</p></div>
        <Button variant="outline" onClick={() => setPrinting(true)}><Printer size={15} /> Imprimer / PDF</Button>
      </div>
      <div className="mb-6"><Tabs active={tab} onChange={setTab} tabs={[{ id: "result", label: "Compte de résultat" }, { id: "bilan", label: "Bilan synthétique" }, { id: "regul", label: "Régularisations" }, { id: "closing", label: "Assistant de clôture" }]} /></div>
      {tab === "result" && (
        <Card className="p-6"><SectionHeading title="Compte de résultat (synthèse)" subtitle={`Exercice ${new Date().getFullYear()}`} />
          <div className="space-y-1.5 max-w-2xl"><Row label="Produits (classe 7)" value={fcfa(sum.produits)} tone="credit" /><Row label="Charges (classe 6)" value={fcfa(sum.charges)} tone="debit" /><div className="my-2 border-t-2 border-dashed border-slate-200" /><Row label="RÉSULTAT DE L'EXERCICE" value={fcfa(sum.resultat)} tone={sum.resultat >= 0 ? "credit" : "debit"} bold /></div>
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-700"><FileText size={14} className="mt-0.5 shrink-0" /> Chaque montant est traçable jusqu'aux comptes et écritures sources. Format GUDEF/OTR : préparation — aucune API officielle connectée.</div>
          <div className="mt-4"><p className="mb-2 text-xs font-bold uppercase text-slate-400">Ratios financiers (calculés)</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{computeRatios(sum).map((r) => (<div key={r.key} className="rounded-xl border border-slate-100 p-3"><div className="flex items-center justify-between"><span className="text-xs text-slate-500">{r.label}</span><Badge tone={r.tone}>{r.value}</Badge></div><p className="mt-0.5 text-[10px] text-slate-400">{r.desc}</p></div>))}</div></div>
        </Card>
      )}
      {tab === "bilan" && (() => {
        const b = stmt.bilan;
        const ecart = b.actifTotal - b.passifTotal;
        return (
          <div className="space-y-4">
            <div className={`flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium ${ecart === 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
              {ecart === 0 ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
              {ecart === 0
                ? `Bilan équilibré : actif = passif = ${fcfa(b.actifTotal)}.`
                : `Bilan déséquilibré : écart de ${fcfa(ecart)} entre actif et passif.`}
              <span className="opacity-70">· {stmt.nonMappes.length === 0 ? "tous les comptes sont rattachés à un poste" : `${stmt.nonMappes.length} compte(s) non rattaché(s)`}</span>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="p-6"><h3 className="mb-4 font-bold text-slate-800">ACTIF</h3><div className="space-y-1.5">
                <Row label="Immobilisations brutes" value={fcfa(b.immoBrut)} tone="debit" />
                <Row label="Amortissements" value={fcfa(-b.amort)} tone="credit" />
                <Row label="Immobilisations nettes" value={fcfa(b.immoNet)} tone="debit" />
                <Row label="Stocks nets" value={fcfa(b.stocks)} tone="debit" />
                <Row label="Créances clients" value={fcfa(b.creancesClients)} tone="debit" />
                <Row label="Créances sur l'État" value={fcfa(b.creancesEtat)} tone="debit" />
                <Row label="Dépréciations des créances" value={fcfa(-b.deprecTiers)} tone="credit" />
                <Row label="Trésorerie" value={fcfa(b.tresorerie)} tone="debit" />
                <div className="my-2 border-t-2 border-dashed border-slate-200" />
                <Row label="TOTAL ACTIF" value={fcfa(b.actifTotal)} tone="debit" bold />
              </div></Card>
              <Card className="p-6"><h3 className="mb-4 font-bold text-slate-800">PASSIF</h3><div className="space-y-1.5">
                <Row label="Capitaux propres (hors report)" value={fcfa(b.capitauxHorsReport)} tone="credit" />
                <Row label="Report à nouveau" value={fcfa(b.reportANouveau)} tone="credit" />
                <Row label="Résultat de l'exercice" value={fcfa(b.resultat)} tone={b.resultat >= 0 ? "credit" : "debit"} />
                <Row label="Dettes financières" value={fcfa(b.dettesFin)} tone="credit" />
                <Row label="Dettes fournisseurs" value={fcfa(b.dettesFourn)} tone="credit" />
                <Row label="Dettes fiscales et sociales" value={fcfa(b.dettesFiscalesSociales)} tone="credit" />
                <Row label="Autres dettes" value={fcfa(b.autresDettes)} tone="credit" />
                <Row label="Trésorerie passif" value={fcfa(b.tresoPassif)} tone="credit" />
                <div className="my-2 border-t-2 border-dashed border-slate-200" />
                <Row label="TOTAL PASSIF" value={fcfa(b.passifTotal)} tone="credit" bold />
              </div></Card>
            </div>
          </div>
        );
      })()}
      {tab === "closing" && (<Card className="p-6"><SectionHeading title="Assistant de clôture" subtitle="Suivi étape par étape" /><div className="space-y-2">{closingSteps.map((s, i) => (<div key={i} className="flex items-center gap-3 rounded-xl border border-slate-100 px-4 py-3">{s.ok === true ? <Circle size={16} className="text-emerald-500" fill="currentColor" /> : s.ok === "warn" ? <AlertTriangle size={16} className="text-amber-500" /> : <XCircle size={16} className="text-rose-500" />}<span className="flex-1 text-sm font-medium text-slate-700">{i + 1}. {s.label}</span><Badge tone={s.ok === true ? "emerald" : s.ok === "warn" ? "amber" : "rose"}>{s.ok === true ? "Réussi" : s.ok === "warn" ? "Avertissement" : "Bloquant"}</Badge></div>))}</div></Card>)}
      {tab === "regul" && (<Card className="p-6"><SectionHeading title="Régularisations de fin d'exercice" subtitle="CCA / PCA / CAP / PAR — génère une écriture (brouillon)" /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Field label="Type"><Select value={reg.type} onChange={(e) => { const t = e.target.value as "CCA" | "PCA" | "CAP" | "PAR"; setReg({ ...reg, type: t, account: t === "CCA" || t === "CAP" ? "62" : "706" }); }}><option value="CCA">Charges constatées d'avance (476)</option><option value="PCA">Produits constatés d'avance (477)</option><option value="CAP">Charges à payer (408)</option><option value="PAR">Produits à recevoir (418)</option></Select></Field><Field label="Compte"><Select value={reg.account} onChange={(e) => setReg({ ...reg, account: e.target.value })}>{(reg.type === "CCA" || reg.type === "CAP" ? db.accounts.filter((a) => a.postable && a.classNumber === 6) : db.accounts.filter((a) => a.postable && a.classNumber === 7)).map((a) => <option key={a.code} value={a.code}>{a.code} · {a.label}</option>)}</Select></Field><Field label="Montant (FCFA)" required><Input value={reg.amount} onChange={(e) => setReg({ ...reg, amount: e.target.value })} inputMode="numeric" /></Field><Field label="Libellé"><Input value={reg.label} onChange={(e) => setReg({ ...reg, label: e.target.value })} /></Field><Field label="Date"><Input type="date" value={reg.date} onChange={(e) => setReg({ ...reg, date: e.target.value })} /></Field></div><Button className="mt-4" onClick={() => { const r = postRegularisation(company.id, { type: reg.type, account: reg.account, amount: parseInt(reg.amount || "0", 10), label: reg.label, date: reg.date }); if (!r.ok) { toast(r.error); return; } toast("Écriture de régularisation générée (brouillon)."); setReg({ ...reg, amount: "", label: "" }); }}><Wand2 size={15} /> Générer l'écriture</Button></Card>)}
      <PrintSheet open={printing} onClose={() => setPrinting(false)}>
        <StatementsPrint company={company} stmt={stmt} checks={checks.filter((c) => c.status !== "ok").map((c) => ({ ok: false, label: c.title }))} />
      </PrintSheet>
    </Page>
  );
}
function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 px-4 py-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 font-black tabular-nums text-slate-800">{value}</p></div>;
}
function Row({ label, value, tone, bold }: { label: string; value: string; tone: "debit" | "credit"; bold?: boolean }) {
  return <div className="flex items-center justify-between rounded-lg px-3 py-2 text-sm"><span className={bold ? "font-black text-slate-900" : "text-slate-600"}>{label}</span><span className={`tabular-nums ${bold ? "text-lg font-black" : "font-semibold"} ${tone === "credit" ? "text-emerald-600" : "text-slate-800"}`}>{value}</span></div>;
}

export function Reports() {
  const db = useDB();
  const { id: companyId } = useCompanyScope();
  const company = db.companies.find((c) => c.id === companyId);
  const [tab, setTab] = useState("apercu");
  // P13 — un FEC se dépose par exercice. L'export couvrait tout l'historique.
  const [fecYear, setFecYear] = useState<string>("");
  if (!company) return <Page><EmptyState icon={<BarChart3 />} title="Sélectionnez une entreprise" /></Page>;
  const entries = db.entries.filter((e) => e.companyId === companyId);
  const sum = financialSummary(entries);
  const tb = trialBalance(entries, db.accounts);
  const tiers = db.tiers.filter((t) => t.companyId === companyId);
  const aux = auxiliaryLedger(entries, db.journals, tiers);
  const aged = agedBalance(entries, tiers);
  const eche = echeancier(entries, tiers);
  const companyYears = db.fiscalYears.filter((fy) => fy.companyId === companyId);
  const activeYear = companyYears.find((fy) => fy.label === fecYear) || companyYears[0];
  const fecScope: FecScope | null = activeYear ? fecScopeFromFiscalYear(activeYear) : null;
  const fec = buildFec(entries, db.journals, db.accounts, tiers, fecScope);
  const aPayer = eche.filter((e) => e.type === "supplier");
  const aRecevoir = eche.filter((e) => e.type === "customer");
  const exportBalance = () => downloadCSV(`balance_${company.name}.csv`, [["Compte", "Libellé", "Débit", "Crédit", "Solde D", "Solde C"], ...tb.map((r) => [r.code, r.label, r.debit, r.credit, r.soldeDebit, r.soldeCredit])]);
  const exportAux = () => downloadCSV(`auxiliaire_${company.name}.csv`, [["Code", "Tiers", "Type", "Débit", "Crédit", "Solde"], ...aux.map((a) => [a.tier.code, a.tier.name, a.tier.type, a.totalDebit, a.totalCredit, a.solde])]);
  return (
    <Page>
      <div className="mb-5"><h2 className="text-xl font-black tracking-tight text-slate-900">Éditions — {company.tradeName || company.name}</h2><p className="text-sm text-slate-500">Grand livre auxiliaire · balance âgée · échéancier · FEC · exports CSV</p></div>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4"><StatCard title="Produits" value={fcfaCompact(sum.produits)} tone="emerald" /><StatCard title="Charges" value={fcfaCompact(sum.charges)} tone="amber" /><StatCard title="Résultat" value={fcfaCompact(sum.resultat)} tone="indigo" /><StatCard title="Trésorerie" value={fcfaCompact(sum.tresorerie)} tone="sky" /></div>
      <div className="mb-6"><Tabs active={tab} onChange={setTab} tabs={[{ id: "apercu", label: "Aperçu" }, { id: "aux", label: "Grand livre auxiliaire" }, { id: "aged", label: "Balance âgée" }, { id: "eche", label: "Échéancier" }, { id: "fec", label: "Export FEC" }]} /></div>
      {tab === "apercu" && (<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[{ t: "Balance générale", d: "Tous les comptes", icon: <BarChart3 />, act: exportBalance }, { t: "Grand livre auxiliaire", d: `${tiers.length} tiers`, icon: <FileText />, act: exportAux }, { t: "Compte de résultat", d: `Résultat ${fcfaCompact(sum.resultat)}`, icon: <FileBarChart />, act: () => setTab("aux") }, { t: "Export FEC", d: "Fichier des écritures", icon: <ListChecks />, act: () => setTab("fec") }].map((r) => (<Card key={r.t} hover className="cursor-pointer p-5" onClick={r.act}><div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">{r.icon}</div><p className="font-bold text-slate-800">{r.t}</p><p className="mt-1 text-xs text-slate-400">{r.d}</p><div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600"><Download size={13} /> Exporter</div></Card>))}</div>)}
      {tab === "aux" && (<Card className="p-5"><SectionHeading title="Grand livre auxiliaire" action={<Button size="sm" variant="outline" onClick={exportAux}><Download size={14} /> CSV</Button>} />{aux.length === 0 ? <EmptyState icon={<FileText />} title="Aucun tiers" /> : (<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase text-slate-400"><th className="px-3 py-2">Code</th><th className="px-3 py-2">Tiers</th><th className="px-3 py-2">Type</th><th className="px-3 py-2 text-right">Débit</th><th className="px-3 py-2 text-right">Crédit</th><th className="px-3 py-2 text-right">Solde</th></tr></thead><tbody>{aux.map((a) => (<tr key={a.tier.id} className="border-b border-slate-50"><td className="px-3 py-2.5 font-mono">{a.tier.code}</td><td className="px-3 py-2.5 font-medium text-slate-800">{a.tier.name}</td><td className="px-3 py-2.5"><Badge tone={a.tier.type === "customer" ? "indigo" : "sky"}>{a.tier.type === "customer" ? "Client" : "Fournisseur"}</Badge></td><td className="px-3 py-2.5 text-right tabular-nums">{fcfa(a.totalDebit)}</td><td className="px-3 py-2.5 text-right tabular-nums">{fcfa(a.totalCredit)}</td><td className="px-3 py-2.5 text-right font-semibold tabular-nums text-indigo-600">{fcfa(a.solde)}</td></tr>))}</tbody></table></div>)}</Card>)}
      {tab === "aged" && (<Card className="p-5"><SectionHeading title="Balance âgée" action={<Button size="sm" variant="outline" onClick={() => exportAgedCSV(aged, `balance_agee_${company.name}.csv`)}><Download size={14} /> CSV</Button>} />{aged.length === 0 ? <EmptyState icon={<BarChart3 />} title="Aucun encours" /> : (<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase text-slate-400"><th className="px-3 py-2">Tiers</th><th className="px-3 py-2 text-right">0-30 j</th><th className="px-3 py-2 text-right">31-60 j</th><th className="px-3 py-2 text-right">61-90 j</th><th className="px-3 py-2 text-right">+90 j</th><th className="px-3 py-2 text-right">Total</th></tr></thead><tbody>{aged.map((r) => (<tr key={r.tier.id} className="border-b border-slate-50"><td className="px-3 py-2.5"><p className="font-medium text-slate-800">{r.tier.name}</p><p className="text-xs text-slate-400">{r.tier.type === "customer" ? "Client" : "Fournisseur"}</p></td><td className="px-3 py-2.5 text-right tabular-nums">{fcfa(r.tranches[0])}</td><td className="px-3 py-2.5 text-right tabular-nums">{fcfa(r.tranches[1])}</td><td className="px-3 py-2.5 text-right tabular-nums">{fcfa(r.tranches[2])}</td><td className="px-3 py-2.5 text-right tabular-nums text-rose-600">{fcfa(r.tranches[3])}</td><td className="px-3 py-2.5 text-right font-bold tabular-nums text-slate-800">{fcfa(r.total)}</td></tr>))}</tbody></table></div>)}</Card>)}
      {tab === "eche" && (<div className="space-y-6"><Card className="p-5"><SectionHeading title="À payer (fournisseurs)" subtitle={`${aPayer.length} facture(s)`} action={<Button size="sm" variant="outline" onClick={() => exportEcheancierCSV(aPayer, `echeancier_payer_${company.name}.csv`)}><Download size={14} /> CSV</Button>} />{aPayer.length === 0 ? <EmptyState icon={<ListChecks />} title="Rien à payer" /> : (<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase text-slate-400"><th className="px-3 py-2">Tiers</th><th className="px-3 py-2">Pièce</th><th className="px-3 py-2">Échéance</th><th className="px-3 py-2 text-right">Montant</th><th className="px-3 py-2">Statut</th></tr></thead><tbody>{aPayer.map((e, i) => (<tr key={i} className="border-b border-slate-50"><td className="px-3 py-2.5 text-slate-700">{e.tier}</td><td className="px-3 py-2.5 font-mono text-xs text-slate-500">{e.number}</td><td className="px-3 py-2.5 text-slate-500">{formatDate(e.due)}</td><td className="px-3 py-2.5 text-right font-semibold tabular-nums text-rose-600">{fcfa(e.amount)}</td><td className="px-3 py-2.5">{e.overdue ? <Badge tone="rose">Retard</Badge> : <Badge tone="amber">{e.days} j</Badge>}</td></tr>))}</tbody></table></div>)}</Card><Card className="p-5"><SectionHeading title="À recevoir (clients)" subtitle={`${aRecevoir.length} facture(s)`} action={<Button size="sm" variant="outline" onClick={() => exportEcheancierCSV(aRecevoir, `echeancier_recevoir_${company.name}.csv`)}><Download size={14} /> CSV</Button>} />{aRecevoir.length === 0 ? <EmptyState icon={<ListChecks />} title="Rien à recevoir" /> : (<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase text-slate-400"><th className="px-3 py-2">Tiers</th><th className="px-3 py-2">Pièce</th><th className="px-3 py-2">Échéance</th><th className="px-3 py-2 text-right">Montant</th><th className="px-3 py-2">Statut</th></tr></thead><tbody>{aRecevoir.map((e, i) => (<tr key={i} className="border-b border-slate-50"><td className="px-3 py-2.5 text-slate-700">{e.tier}</td><td className="px-3 py-2.5 font-mono text-xs text-slate-500">{e.number}</td><td className="px-3 py-2.5 text-slate-500">{formatDate(e.due)}</td><td className="px-3 py-2.5 text-right font-semibold tabular-nums text-emerald-600">{fcfa(e.amount)}</td><td className="px-3 py-2.5">{e.overdue ? <Badge tone="rose">Retard</Badge> : <Badge tone="amber">{e.days} j</Badge>}</td></tr>))}</tbody></table></div>)}</Card></div>)}
      {tab === "fec" && (
        <div className="space-y-6">
          <Card className="p-5">
            <SectionHeading
              title="Export FEC (Fichier des Écritures Comptables)"
              subtitle={fecScope
                ? `Exercice ${fecScope.label} · du ${formatDate(fecScope.startDate)} au ${formatDate(fecScope.endDate)} · 18 colonnes normalisées`
                : "Aucun exercice défini : fichier sur tout l'historique · 18 colonnes normalisées"}
              action={
                <div className="flex items-center gap-2">
                  {companyYears.length > 0 && (
                    <Select
                      className="w-44"
                      aria-label="Exercice du fichier FEC"
                      value={activeYear?.label || ""}
                      onChange={(e) => setFecYear(e.target.value)}
                    >
                      {companyYears.map((fy) => <option key={fy.id} value={fy.label}>{fy.label}{fy.status === "closed" ? " (clôturé)" : ""}</option>)}
                    </Select>
                  )}
                  <Button size="sm" onClick={() => exportFEC(entries, db.journals, db.accounts, company.name, tiers, fecScope)}><Download size={14} /> Générer le FEC (.txt)</Button>
                </div>
              }
            />
            <div className="grid gap-3 sm:grid-cols-4">
              <Mini label="Écritures validées" value={String(fec.entryCount)} />
              <Mini label="Lignes exportées" value={String(fec.lineCount)} />
              <Mini label="Hors exercice (exclues)" value={String(fec.excludedCount)} />
              <Mini label="Σ débit / Σ crédit" value={`${fcfa(fec.totals.debit)} / ${fcfa(fec.totals.credit)}`} />
            </div>
            <div className="mt-4 overflow-x-auto rounded-xl bg-slate-50 p-4 font-mono text-[11px] leading-relaxed text-slate-500">
              {fec.header.join("|")}
            </div>
            <div className="mt-4 space-y-2">
              {fec.controls.map((c) => (
                <div key={c.id} className="flex items-start gap-3 rounded-xl border border-slate-100 px-3 py-2.5">
                  {c.level === "ok" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" /> : <AlertTriangle size={16} className={`mt-0.5 shrink-0 ${c.level === "blocking" ? "text-rose-500" : "text-amber-500"}`} />}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{c.label}</p>
                    <p className="text-xs text-slate-500">{c.detail}</p>
                  </div>
                </div>
              ))}
            </div>
            {fec.blockingCount > 0 && (
              <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                {fec.blockingCount} contrôle(s) bloquant(s) : le fichier ne doit pas être déposé en l'état.
              </p>
            )}
          </Card>
          <Card className="p-5">
            <SectionHeading title="Aperçu des premières lignes" subtitle="Tronqué à 12 lignes" />
            {fec.rows.length === 0 ? <EmptyState icon={<ListChecks />} title="Aucune écriture validée" /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-slate-100 text-left font-semibold uppercase text-slate-400">{["Journal", "N°", "Date", "Compte", "Tiers", "Libellé", "Débit", "Crédit", "Valid."].map((h) => <th key={h} className="whitespace-nowrap px-2 py-2">{h}</th>)}</tr></thead>
                  <tbody>{fec.rows.slice(0, 12).map((r, i) => (
                    <tr key={i} className="border-b border-slate-50">
                      <td className="px-2 py-2 font-mono">{r[0]}</td>
                      <td className="px-2 py-2 font-mono">{r[2]}</td>
                      <td className="px-2 py-2 font-mono">{r[3]}</td>
                      <td className="px-2 py-2 font-mono">{r[4]}</td>
                      <td className="px-2 py-2">{r[6] || "—"}</td>
                      <td className="max-w-[220px] truncate px-2 py-2 text-slate-600">{r[10]}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{r[11] === "0.00" ? "" : r[11]}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{r[12] === "0.00" ? "" : r[12]}</td>
                      <td className="px-2 py-2 font-mono">{r[15]}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </Page>
  );
}

export function Compliance() {
  const db = useDB();
  const { id: companyId } = useCompanyScope();
  const company = db.companies.find((c) => c.id === companyId);
  const issues = db.complianceIssues.filter((i) => (!companyId || i.companyId === companyId) && !i.resolved);
  // P2 — les contrôles croisés existaient et n'étaient affichés nulle part.
  const cross = company
    ? runCrossChecks({
        entries: db.entries.filter((e) => e.companyId === company.id),
        employees: db.employees.filter((e) => e.companyId === company.id),
        bankTransactions: db.bankTransactions.filter((t) => t.companyId === company.id),
        fixedAssets: db.fixedAssets.filter((f) => f.companyId === company.id),
      })
    : null;
  if (!company) return <Page><EmptyState icon={<ShieldCheck />} title="Sélectionnez une entreprise" /></Page>;
  const score = Math.max(20, 100 - issues.reduce((s, i) => s + (i.severity === "critical" ? 15 : i.severity === "warning" ? 7 : 3), 0));
  const cats = ["accounting", "tax", "social", "legal", "documents", "deadlines"];
  return (
    <Page>
      <div className="mb-5"><h2 className="text-xl font-black tracking-tight text-slate-900">Centre de conformité</h2><p className="text-sm text-slate-500">{company.tradeName || company.name}</p></div>
      <div className="grid gap-6 lg:grid-cols-3"><Card className="flex flex-col items-center justify-center p-6"><h3 className="mb-4 self-start font-bold text-slate-700">Score global</h3><Donut value={score} size={150} color={score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444"} sublabel="conformité" /></Card><Card className="p-6 lg:col-span-2"><SectionHeading title="Scores par catégorie" /><div className="grid gap-4 sm:grid-cols-2">{cats.map((c) => { const ci = issues.filter((i) => i.category === c); const s = Math.max(20, 100 - ci.length * 15); return <div key={c}><div className="mb-1 flex justify-between text-sm"><span className="text-slate-600">{CAT_LABELS[c]}</span><span className="font-semibold text-slate-800">{s}%</span></div><ProgressBar value={s} tone={s >= 80 ? "emerald" : s >= 60 ? "amber" : "rose"} /></div>; })}</div></Card></div>
      <Card className="mt-6 p-5">
        <SectionHeading title="Anomalies détectées" />
        {issues.length === 0 ? (
          <EmptyState icon={<CheckCircle2 />} title="Aucune anomalie 🎉" />
        ) : (
          <div className="space-y-3">
            {issues.map((i) => (
              <div key={i.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-100 p-4">
                <div className="flex items-start gap-3">
                  <Badge tone={i.severity === "critical" ? "rose" : i.severity === "warning" ? "amber" : "sky"}>{CAT_LABELS[i.category]}</Badge>
                  <div><p className="font-semibold text-slate-800">{i.title}</p><p className="text-xs text-slate-400">{i.recommendation}</p></div>
                </div>
                <Button size="sm" variant="outline" onClick={() => resolveCompliance(i.id)}><CheckCircle2 size={14} /> Résoudre</Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {cross && (
        <Card className="mt-6 p-5">
          <SectionHeading
            title="Contrôles croisés entre modules"
            subtitle={`Compta · TVA · Paie · CNSS · Banque · Immobilisations — ${cross.okCount} conforme(s) · ${cross.infoCount} constat(s) · ${cross.warningCount} avertissement(s) · ${cross.criticalCount} critique(s)`}
            action={<Badge tone={cross.overallStatus === "critical" ? "rose" : cross.overallStatus === "warning" ? "amber" : "emerald"}>
              {cross.overallStatus === "critical" ? "Écarts critiques" : cross.overallStatus === "warning" ? "Écarts à examiner" : "Cohérent"}
            </Badge>}
          />
          <div className="mb-3 flex items-start gap-2 rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-700">
            <FileText size={14} className="mt-0.5 shrink-0" />
            Chaque ligne confronte deux sources indépendantes du même montant. Un écart n'est pas une erreur du logiciel : c'est un point à justifier dans le dossier.
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase text-slate-400">
                  <th className="px-3 py-2">Module</th>
                  <th className="px-3 py-2 text-right">Source A</th>
                  <th className="px-3 py-2 text-right">Source B</th>
                  <th className="px-3 py-2 text-right">Écart</th>
                  <th className="px-3 py-2">Constat</th>
                </tr>
              </thead>
              <tbody>
                {cross.checks.map((c, i) => (
                  <tr key={i} className="border-b border-slate-50 align-top">
                    <td className="px-3 py-2.5 font-medium text-slate-800">{c.moduleName}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{fcfa(c.valueA)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{fcfa(c.valueB)}</td>
                    <td className={`px-3 py-2.5 text-right font-semibold tabular-nums ${Math.abs(c.ecart) < 1 ? "text-slate-500" : c.level === "critical" ? "text-rose-600" : "text-amber-600"}`}>{fcfa(c.ecart)}</td>
                    <td className="max-w-[380px] px-3 py-2.5 text-xs text-slate-500">
                      <Badge tone={c.level === "critical" ? "rose" : c.level === "warning" ? "amber" : c.level === "info" ? "sky" : "emerald"}>
                        {c.level === "critical" ? "Critique" : c.level === "warning" ? "Avertissement" : c.level === "info" ? "Info" : "Conforme"}
                      </Badge>
                      <span className="ml-2">{c.detail}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </Page>
  );
}
