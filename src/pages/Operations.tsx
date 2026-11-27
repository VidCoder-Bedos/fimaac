import { useState } from "react";
import { Landmark, Boxes, Users, Plus, Check, AlertTriangle, Calculator, X, Wand2, FileText, Trash2 } from "lucide-react";
import { useDB } from "../lib/store";
import { useCompanyScope, Page } from "../components/Layout";
import { Card, Button, Badge, EmptyState, SectionHeading, Modal, Field, Input, Select, StatCard } from "../components/ui";
import {
  addBankTransaction, toggleReconcile, addFixedAsset, depreciationSchedule, generateDepreciationEntry,
  autoReconcile, addReconRule, deleteReconRule, addStockItem, adjustStock, deleteStockItem,
  runPayroll, updatePayrollConfig, pointAll,
} from "../lib/actions";
import { accountSituation } from "../lib/accounting";
import { fcfa, formatDate } from "../lib/format";

/* ============ BANQUE (rapprochement pro) ============ */
export function Bank() {
  const db = useDB();
  const { id: companyId } = useCompanyScope();
  const company = db.companies.find((c) => c.id === companyId);
  const accounts = db.bankAccounts.filter((a) => a.companyId === companyId);
  const txs = db.bankTransactions.filter((t) => t.companyId === companyId).sort((a, b) => +new Date(b.date) - +new Date(a.date));
  const rules = db.reconRules.filter((r) => r.organizationId === company?.organizationId);
  const [open, setOpen] = useState(false);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), label: "", amount: "" });
  const [rule, setRule] = useState({ label: "", pattern: "", accountId: "62" });
  const expenseAccounts = db.accounts.filter((a) => a.postable && a.classNumber === 6).slice(0, 12);
  if (!company) return <Page><EmptyState icon={<Landmark />} title="Sélectionnez une entreprise" /></Page>;
  const unreconciled = txs.filter((t) => !t.reconciled).length;
  const balance = accounts.reduce((s, a) => s + a.openingBalance, 0) + txs.reduce((s, t) => s + t.amount, 0);
  const doAuto = () => { const r = autoReconcile(company.id); if (r.matched) alert(`${r.matched} transaction(s) rapprochée(s) automatiquement.`); else alert("Aucune correspondance automatique trouvée."); };
  const c521 = accountSituation(db.entries.filter((e) => e.companyId === company.id), "5211", db.journals);
  const soldeCompta = c521.solde;
  const opening = accounts.reduce((s, a) => s + a.openingBalance, 0);
  const soldeReleve = opening + txs.reduce((s, t) => s + t.amount, 0);
  const np = txs.filter((t) => !t.reconciled);
  const encNP = np.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const decNP = np.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);
  const soldeRapproche = soldeCompta + encNP + decNP;
  const ecart = soldeRapproche - soldeReleve;
  return (
    <Page>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black tracking-tight text-slate-900">Banque & rapprochement</h2><p className="text-sm text-slate-500">{company.tradeName || company.name}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setRuleOpen(true)}><Wand2 size={15} /> Règles</Button><Button size="sm" variant="outline" onClick={() => { const n = pointAll(company.id); alert(n ? `${n} transaction(s) pointée(s) par lot.` : "Rien à pointer."); }}>Pointer par lot</Button><Button size="sm" variant="outline" onClick={doAuto}>Rapprochement auto</Button><Button size="sm" onClick={() => setOpen(true)}><Plus size={15} /> Transaction</Button></div></div>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard title="Solde calculé" value={fcfa(balance)} icon={<Landmark size={18} />} tone="indigo" />
        <StatCard title="Transactions" value={String(txs.length)} icon={<Calculator size={18} />} tone="sky" />
        <StatCard title="Non rapprochées" value={String(unreconciled)} icon={<AlertTriangle size={18} />} tone="amber" />
      </div>
      <Card className="p-5">
        <SectionHeading title="Relevé & pointage" subtitle="Pointage manuel ou rapprochement automatique par montant correspondant." />
        {txs.length === 0 ? <EmptyState icon={<Landmark />} title="Aucune transaction" /> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase text-slate-400"><th className="px-3 py-2">Date</th><th className="px-3 py-2">Libellé</th><th className="px-3 py-2 text-right">Montant</th><th className="px-3 py-2">Lettré</th><th className="px-3 py-2 text-right">Pointage</th></tr></thead>
            <tbody>{txs.map((t) => (
              <tr key={t.id} className="border-b border-slate-50"><td className="px-3 py-2.5 text-slate-500">{formatDate(t.date)}</td><td className="px-3 py-2.5 text-slate-700">{t.label}</td><td className={`px-3 py-2.5 text-right font-semibold tabular-nums ${t.amount >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{t.amount >= 0 ? "+" : ""}{fcfa(t.amount)}</td><td className="px-3 py-2.5">{t.reconciled ? <Badge tone="emerald"><Check size={11} /> Lettré</Badge> : <Badge tone="amber">À pointer</Badge>}</td><td className="px-3 py-2.5 text-right"><Button size="sm" variant={t.reconciled ? "outline" : "primary"} onClick={() => toggleReconcile(t.id)}>{t.reconciled ? "Dépointer" : "Pointer"}</Button></td></tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
      <Card className="mt-6 p-5">
        <SectionHeading title="État de rapprochement" subtitle="Compte 521 (comptabilité) ↔ relevé bancaire" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-bold uppercase text-slate-400">Selon la comptabilité (521)</p>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-1.5"><span className="text-slate-500">Solde 521 en comptabilité</span><span className="font-semibold tabular-nums text-slate-800">{fcfa(soldeCompta)}</span></div>
              <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-1.5"><span className="text-slate-500">+ Encaissements non pointés</span><span className="font-semibold tabular-nums text-emerald-600">{fcfa(encNP)}</span></div>
              <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-1.5"><span className="text-slate-500">− Décaissements non pointés</span><span className="font-semibold tabular-nums text-rose-600">{fcfa(-decNP)}</span></div>
              <div className="flex justify-between rounded-lg bg-indigo-50 px-3 py-2"><span className="font-bold text-slate-700">Solde rapproché</span><span className="font-bold tabular-nums text-indigo-700">{fcfa(soldeRapproche)}</span></div>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-bold uppercase text-slate-400">Selon le relevé bancaire</p>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-1.5"><span className="text-slate-500">Solde de départ (relevé)</span><span className="font-semibold tabular-nums text-slate-800">{fcfa(opening)}</span></div>
              <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-1.5"><span className="text-slate-500">+ Mouvements du relevé</span><span className="font-semibold tabular-nums text-slate-800">{fcfa(txs.reduce((s, t) => s + t.amount, 0))}</span></div>
              <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2"><span className="font-bold text-slate-700">Solde final relevé</span><span className="font-bold tabular-nums text-slate-800">{fcfa(soldeReleve)}</span></div>
              <div className={`flex justify-between rounded-lg px-3 py-2 ${Math.abs(ecart) < 1 ? "bg-emerald-50" : "bg-amber-50"}`}><span className="font-bold text-slate-700">Écart de rapprochement</span><span className={`font-bold tabular-nums ${Math.abs(ecart) < 1 ? "text-emerald-600" : "text-amber-600"}`}>{fcfa(ecart)}</span></div>
            </div>
          </div>
        </div>
        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-bold uppercase text-slate-400">Relevé ({txs.length})</p>
            <div className="max-h-52 overflow-auto rounded-xl border border-slate-100"><table className="w-full text-xs"><tbody>{txs.map((t) => <tr key={t.id} className="border-b border-slate-50"><td className="px-3 py-1.5 text-slate-500">{formatDate(t.date)}</td><td className="px-3 py-1.5 text-slate-700">{t.label}</td><td className={`px-3 py-1.5 text-right tabular-nums ${t.amount >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{fcfa(t.amount)}</td><td className="px-2 py-1.5">{t.reconciled ? <Badge tone="emerald">✓</Badge> : <span className="text-slate-300">•</span>}</td></tr>)}</tbody></table></div>
          </div>
          <div>
            <p className="mb-2 text-xs font-bold uppercase text-slate-400">Compta 521 ({c521.lines.length})</p>
            <div className="max-h-52 overflow-auto rounded-xl border border-slate-100"><table className="w-full text-xs"><tbody>{c521.lines.map((l, i) => <tr key={i} className="border-b border-slate-50"><td className="px-3 py-1.5 text-slate-500">{formatDate(l.date)}</td><td className="px-3 py-1.5 text-slate-700">{l.label}</td><td className="px-3 py-1.5 text-right tabular-nums text-slate-800">{fcfa(l.debit - l.credit)}</td></tr>)}</tbody></table></div>
          </div>
        </div>
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Nouvelle transaction">
        <div className="space-y-4">
          <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Libellé"><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></Field>
          <Field label="Montant (FCFA)" hint="Positif = encaissement, négatif = décaissement"><Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} inputMode="numeric" /></Field>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button><Button onClick={() => { if (accounts[0] && form.label) { addBankTransaction(accounts[0].id, company.id, form.date, form.label, parseInt(form.amount || "0", 10)); setOpen(false); } }}>Ajouter</Button></div>
        </div>
      </Modal>
      <Modal open={ruleOpen} onClose={() => setRuleOpen(false)} title="Règles de rapprochement automatique">
        <div className="space-y-3">
          {rules.length > 0 && <div className="space-y-1">{rules.map((r) => <div key={r.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"><span>{r.label} <span className="text-xs text-slate-400">« {r.pattern} » → {r.accountId}</span></span><button onClick={() => deleteReconRule(r.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={14} /></button></div>)}</div>}
          <Field label="Libellé"><Input value={rule.label} onChange={(e) => setRule({ ...rule, label: e.target.value })} placeholder="Prélèvement eau" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mot-clé (libellé)"><Input value={rule.pattern} onChange={(e) => setRule({ ...rule, pattern: e.target.value })} placeholder="SDE" /></Field>
            <Field label="Compte"><Select value={rule.accountId} onChange={(e) => setRule({ ...rule, accountId: e.target.value })}>{expenseAccounts.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.label}</option>)}</Select></Field>
          </div>
          <Button onClick={() => { if (rule.label && rule.pattern) { addReconRule(rule); setRule({ label: "", pattern: "", accountId: "62" }); } }}>Ajouter la règle</Button>
        </div>
      </Modal>
    </Page>
  );
}
/* ============ IMMOBILISATIONS ============ */
export function FixedAssets() {
  const db = useDB();
  const { id: companyId } = useCompanyScope();
  const company = db.companies.find((c) => c.id === companyId);
  const assets = db.fixedAssets.filter((a) => a.companyId === companyId);
  const accounts = db.accounts.filter((a) => a.postable && a.classNumber === 2).slice(0, 10);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", accountCode: "218", cost: "", usefulLifeYears: "5", residualValue: "0", acquisitionDate: new Date().toISOString().slice(0, 10) });
  if (!company) return <Page><EmptyState icon={<Boxes />} title="Sélectionnez une entreprise" /></Page>;
  const total = assets.reduce((s, a) => s + a.cost, 0);
  return (
    <Page>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black tracking-tight text-slate-900">Immobilisations</h2><p className="text-sm text-slate-500">Amortissements linéaires · génération des écritures de dotation</p></div><Button size="sm" onClick={() => setOpen(true)}><Plus size={15} /> Immobilisation</Button></div>
      <div className="mb-6 grid grid-cols-2 gap-4"><StatCard title="Valeur brute" value={fcfa(total)} icon={<Boxes size={18} />} tone="indigo" /><StatCard title="Actifs" value={String(assets.length)} icon={<Calculator size={18} />} tone="sky" /></div>
      {assets.length === 0 ? <EmptyState icon={<Boxes />} title="Aucune immobilisation" /> : (
        <div className="grid gap-4 lg:grid-cols-2">{assets.map((a) => {
          const sched = depreciationSchedule(a.cost, a.residualValue, a.usefulLifeYears);
          const cumul = sched[0]?.cumulative || 0;
          return (
            <Card key={a.id} className="p-5">
              <div className="flex items-center justify-between"><div><p className="font-bold text-slate-800">{a.name}</p><p className="text-xs text-slate-400">{a.accountCode} · acquis le {formatDate(a.acquisitionDate)}</p></div><Badge tone="indigo">{a.method}</Badge></div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center"><div><p className="text-xs text-slate-400">Coût</p><p className="font-bold text-slate-800">{fcfa(a.cost)}</p></div><div><p className="text-xs text-slate-400">Durée</p><p className="font-bold text-slate-800">{a.usefulLifeYears} ans</p></div><div><p className="text-xs text-slate-400">Cumul</p><p className="font-bold text-slate-800">{fcfa(cumul)}</p></div></div>
              <div className="mt-3 max-h-32 overflow-y-auto rounded-lg border border-slate-100"><table className="w-full text-xs"><thead><tr className="bg-slate-50 text-slate-400 sticky top-0"><th className="px-2 py-1.5 text-left">Année</th><th className="px-2 py-1.5 text-right">Annuité</th><th className="px-2 py-1.5 text-right">VNC</th></tr></thead><tbody>{sched.map((s) => <tr key={s.year} className="border-t border-slate-50"><td className="px-2 py-1.5">{s.year}</td><td className="px-2 py-1.5 text-right tabular-nums">{fcfa(s.annuity)}</td><td className="px-2 py-1.5 text-right tabular-nums">{fcfa(s.netBookValue)}</td></tr>)}</tbody></table></div>
              <Button className="mt-3 w-full" size="sm" variant="outline" onClick={() => generateDepreciationEntry(company.id, a.id)}><FileText size={14} /> Générer l'écriture de dotation</Button>
            </Card>
          );
        })}</div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Nouvelle immobilisation">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Désignation" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Compte"><Select value={form.accountCode} onChange={(e) => setForm({ ...form, accountCode: e.target.value })}>{accounts.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.label}</option>)}</Select></Field>
          <Field label="Coût (FCFA)" required><Input value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} inputMode="numeric" /></Field>
          <Field label="Durée (ans)"><Input value={form.usefulLifeYears} onChange={(e) => setForm({ ...form, usefulLifeYears: e.target.value })} inputMode="numeric" /></Field>
          <Field label="Valeur résiduelle"><Input value={form.residualValue} onChange={(e) => setForm({ ...form, residualValue: e.target.value })} inputMode="numeric" /></Field>
          <Field label="Date d'acquisition"><Input type="date" value={form.acquisitionDate} onChange={(e) => setForm({ ...form, acquisitionDate: e.target.value })} /></Field>
        </div>
        <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button><Button onClick={() => { if (form.name && form.cost) { addFixedAsset(company.id, { name: form.name, accountCode: form.accountCode, cost: parseInt(form.cost, 10), usefulLifeYears: parseInt(form.usefulLifeYears, 10), residualValue: parseInt(form.residualValue, 10), acquisitionDate: form.acquisitionDate }); setOpen(false); } }}>Créer</Button></div>
      </Modal>
    </Page>
  );
}
/* ============ STOCKS (persistés) ============ */
export function Inventory() {
  const db = useDB();
  const { id: companyId } = useCompanyScope();
  const company = db.companies.find((c) => c.id === companyId);
  const items = db.stockItems.filter((i) => i.companyId === companyId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", category: "Fournitures", qty: "", unitPrice: "", warehouse: "Lomé" });
  if (!company) return <Page><EmptyState icon={<Boxes />} title="Sélectionnez une entreprise" /></Page>;
  const total = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  return (
    <Page>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black tracking-tight text-slate-900">Stocks</h2><p className="text-sm text-slate-500">Valorisation · entrées/sorties · données persistées</p></div><Button size="sm" onClick={() => setOpen(true)}><Plus size={15} /> Article</Button></div>
      <div className="mb-6 grid grid-cols-2 gap-4"><StatCard title="Articles" value={String(items.length)} icon={<Boxes size={18} />} tone="indigo" /><StatCard title="Valeur du stock" value={fcfa(total)} icon={<Calculator size={18} />} tone="emerald" /></div>
      {items.length === 0 ? <EmptyState icon={<Boxes />} title="Aucun article" /> : (
        <Card className="overflow-x-auto p-5"><table className="w-full text-sm">
          <thead><tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase text-slate-400"><th className="px-3 py-2">Désignation</th><th className="px-3 py-2">Catégorie</th><th className="px-3 py-2 text-right">Qté</th><th className="px-3 py-2 text-right">P.U.</th><th className="px-3 py-2 text-right">Valeur</th><th className="px-3 py-2 text-right">Mouvements</th><th className="px-3 py-2"></th></tr></thead>
          <tbody>{items.map((i) => (
            <tr key={i.id} className="border-b border-slate-50"><td className="px-3 py-2.5 font-medium text-slate-800">{i.name}</td><td className="px-3 py-2.5 text-slate-500">{i.category}</td><td className="px-3 py-2.5 text-right tabular-nums">{i.qty}</td><td className="px-3 py-2.5 text-right tabular-nums">{fcfa(i.unitPrice)}</td><td className="px-3 py-2.5 text-right font-semibold tabular-nums text-slate-800">{fcfa(i.qty * i.unitPrice)}</td>
              <td className="px-3 py-2.5 text-right"><div className="flex justify-end gap-1"><button onClick={() => adjustStock(i.id, 1)} className="rounded bg-emerald-50 px-1.5 text-emerald-600 hover:bg-emerald-100">+</button><button onClick={() => adjustStock(i.id, -1)} className="rounded bg-rose-50 px-1.5 text-rose-600 hover:bg-rose-100">−</button></div></td>
              <td className="px-3 py-2.5 text-right"><button onClick={() => deleteStockItem(i.id)} className="text-slate-300 hover:text-rose-500"><X size={15} /></button></td></tr>
          ))}</tbody>
        </table></Card>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Nouvel article">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Désignation" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Catégorie"><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
          <Field label="Quantité"><Input value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} inputMode="numeric" /></Field>
          <Field label="Prix unitaire"><Input value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} inputMode="numeric" /></Field>
        </div>
        <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button><Button onClick={() => { if (form.name) { addStockItem(company.id, { name: form.name, category: form.category, qty: parseInt(form.qty || "0", 10), unitPrice: parseInt(form.unitPrice || "0", 10), warehouse: form.warehouse }); setOpen(false); } }}>Créer</Button></div>
      </Modal>
    </Page>
  );
}
/* ============ PAIE (complète) ============ */
export function Payroll() {
  const db = useDB();
  const { id: companyId } = useCompanyScope();
  const company = db.companies.find((c) => c.id === companyId);
  const employees = db.employees.filter((e) => e.companyId === companyId);
  const payslips = db.payslips.filter((p) => p.companyId === companyId).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const cfg = db.payrollConfig;
  const [period, setPeriod] = useState(new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date()));
  const [edit, setEdit] = useState(false);
  const [rates, setRates] = useState({ cnssEmployeeRate: String(cfg.cnssEmployeeRate), cnssEmployerRate: String(cfg.cnssEmployerRate), cnssPlafond: String(cfg.cnssPlafond), withholdingRate: String(cfg.withholdingRate) });
  if (!company) return <Page><EmptyState icon={<Users />} title="Sélectionnez une entreprise" /></Page>;
  const totalGross = employees.reduce((s, e) => s + e.grossSalary, 0);
  const totalNet = payslips.filter((p) => p.periodLabel === period).reduce((s, p) => s + p.net, 0);
  return (
    <Page>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black tracking-tight text-slate-900">Paie & social</h2><p className="text-sm text-slate-500">{company.tradeName || company.name}</p></div><Button size="sm" variant="outline" onClick={() => setEdit(true)}><Calculator size={15} /> Taux</Button></div>
      <div className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> Taux CNSS/ITS <b>paramétrables et à vérifier</b> contre les barèmes officiels. Statut : {cfg.verified ? "vérifié" : "non vérifié"}.</div>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Employés" value={String(employees.length)} icon={<Users size={18} />} tone="indigo" />
        <StatCard title="Masse brute" value={fcfa(totalGross)} icon={<Calculator size={18} />} tone="amber" />
        <StatCard title="Bulletins" value={String(payslips.length)} icon={<FileText size={18} />} tone="sky" />
        <StatCard title={`Net ${period}`} value={fcfa(totalNet)} icon={<Check size={18} />} tone="emerald" />
      </div>
      <Card className="mb-6 p-5"><SectionHeading title="Lancer la paie" subtitle="Génère les bulletins + une écriture comptable équilibrée (brouillon)" />
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Période"><Input value={period} onChange={(e) => setPeriod(e.target.value)} className="w-56" /></Field>
          <Button onClick={() => { const r = runPayroll(company.id, period); alert(r.entryCreated ? `Paie ${period} : ${r.slips} bulletin(s) + écriture de paie en brouillon.` : `Paie ${period} : ${r.slips} bulletin(s) générés. ⚠️ Créez un journal « Paie » pour générer l'écriture comptable.`); }}><Calculator size={15} /> Calculer & générer</Button>
        </div>
      </Card>
      {payslips.length > 0 && (
        <Card className="mb-6 p-5"><SectionHeading title="Derniers bulletins" />
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase text-slate-400"><th className="px-3 py-2">Employé</th><th className="px-3 py-2">Période</th><th className="px-3 py-2 text-right">Brut</th><th className="px-3 py-2 text-right">CNSS sal.</th><th className="px-3 py-2 text-right">Retenue</th><th className="px-3 py-2 text-right">Net</th></tr></thead>
            <tbody>{payslips.slice(0, 12).map((p) => { const emp = employees.find((e) => e.id === p.employeeId); return (
              <tr key={p.id} className="border-b border-slate-50"><td className="px-3 py-2.5 font-medium text-slate-800">{emp ? `${emp.firstName} ${emp.lastName}` : "—"}</td><td className="px-3 py-2.5 text-slate-500">{p.periodLabel}</td><td className="px-3 py-2.5 text-right tabular-nums">{fcfa(p.gross)}</td><td className="px-3 py-2.5 text-right tabular-nums text-rose-500">{fcfa(p.cnssEmployee)}</td><td className="px-3 py-2.5 text-right tabular-nums text-rose-500">{fcfa(p.withholding)}</td><td className="px-3 py-2.5 text-right font-bold tabular-nums text-emerald-600">{fcfa(p.net)}</td></tr>
            ); })}</tbody>
          </table></div>
        </Card>
      )}
      <Card className="p-5"><SectionHeading title="Effectifs" />
        {employees.length === 0 ? <EmptyState icon={<Users />} title="Aucun employé" /> : (
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase text-slate-400"><th className="px-3 py-2">Employé</th><th className="px-3 py-2">Poste</th><th className="px-3 py-2">Contrat</th><th className="px-3 py-2 text-right">Salaire brut</th></tr></thead>
            <tbody>{employees.map((e) => <tr key={e.id} className="border-b border-slate-50"><td className="px-3 py-2.5 font-medium text-slate-800">{e.firstName} {e.lastName}</td><td className="px-3 py-2.5 text-slate-600">{e.position}</td><td className="px-3 py-2.5"><Badge tone="sky">{e.contractType.toUpperCase()}</Badge></td><td className="px-3 py-2.5 text-right font-semibold tabular-nums text-slate-800">{fcfa(e.grossSalary)}</td></tr>)}</tbody>
          </table></div>
        )}
      </Card>
      <Modal open={edit} onClose={() => setEdit(false)} title="Taux sociaux (paramétrables)">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="CNSS salarié (%)"><Input value={rates.cnssEmployeeRate} onChange={(e) => setRates({ ...rates, cnssEmployeeRate: e.target.value })} inputMode="numeric" /></Field>
            <Field label="CNSS employeur (%)"><Input value={rates.cnssEmployerRate} onChange={(e) => setRates({ ...rates, cnssEmployerRate: e.target.value })} inputMode="numeric" /></Field>
            <Field label="Plafond CNSS (FCFA)"><Input value={rates.cnssPlafond} onChange={(e) => setRates({ ...rates, cnssPlafond: e.target.value })} inputMode="numeric" /></Field>
            <Field label="Retenue (ITS, %)"><Input value={rates.withholdingRate} onChange={(e) => setRates({ ...rates, withholdingRate: e.target.value })} inputMode="numeric" /></Field>
          </div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEdit(false)}>Annuler</Button><Button onClick={() => { updatePayrollConfig({ cnssEmployeeRate: parseFloat(rates.cnssEmployeeRate) || 0, cnssEmployerRate: parseFloat(rates.cnssEmployerRate) || 0, cnssPlafond: parseInt(rates.cnssPlafond, 10) || 0, withholdingRate: parseFloat(rates.withholdingRate) || 0 }); setEdit(false); }}>Enregistrer</Button></div>
        </div>
      </Modal>
    </Page>
  );
}
