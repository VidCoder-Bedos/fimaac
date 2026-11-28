import { useState } from "react";
import { Receipt, AlertTriangle, Check, FileDown, CalendarClock, ShieldAlert, Info } from "lucide-react";
import { useDB } from "../lib/store";
import { useCompanyScope, Page } from "../components/Layout";
import { Card, Button, Badge, StatusBadge, EmptyState, SectionHeading, Input, Tabs } from "../components/ui";
import { computeTax } from "../lib/tax";
import { generateTvaDeclaration, updateTaxRate, setDeadlineStatus, tvaGrid } from "../lib/actions";
import { fcfa, formatDate } from "../lib/format";
import type { TaxRuleRef, DeclarationStatus } from "../lib/types";

export default function Tax() {
  const db = useDB();
  const { id: companyId } = useCompanyScope();
  const [tab, setTab] = useState("calc");
  const company = db.companies.find((c) => c.id === companyId);
  const entries = db.entries.filter((e) => e.companyId === companyId);
  const tva = computeTax("TVA", entries, db.taxRules)!;
  const is = computeTax("IS", entries, db.taxRules)!;
  const deadlines = db.taxDeadlines.filter((d) => d.companyId === companyId);
  const declarations = db.taxDeclarations.filter((d) => d.companyId === companyId);
  if (!company) return <Page><EmptyState icon={<Receipt />} title="Sélectionnez une entreprise" /></Page>;
  return (
    <Page>
      <div className="mb-5"><h2 className="text-xl font-black tracking-tight text-slate-900">Fiscalité — {company.tradeName || company.name}</h2><p className="text-sm text-slate-500">Moteur fiscal Togo · calculs explicables · GUDEF/OTR</p></div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700"><AlertTriangle size={14} /> Taux paramétrables — à vérifier dans le Regulatory Engine</div>
        <div className="flex items-center gap-2 rounded-xl bg-sky-50 px-3 py-2 text-xs font-medium text-sky-700"><Info size={14} /> Dépôt GUDEF/OTR : mode préparation (aucune API officielle connectée)</div>
      </div>
      <div className="mb-6"><Tabs active={tab} onChange={setTab} tabs={[{ id: "calc", label: "Calculs", icon: <Receipt size={15} /> }, { id: "tva", label: "Grille TVA", icon: <Receipt size={15} /> }, { id: "rules", label: "Moteur réglementaire", icon: <ShieldAlert size={15} /> }, { id: "deadlines", label: "Échéances & déclarations", icon: <CalendarClock size={15} /> }]} /></div>
      {tab === "calc" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between"><h3 className="flex items-center gap-2 font-bold text-slate-800"><Receipt size={17} className="text-indigo-500" /> TVA du mois</h3>{!tva.verified && <Badge tone="amber">À vérifier</Badge>}</div>
            <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-5 text-white"><p className="text-xs uppercase opacity-80">TVA nette à payer</p><p className="mt-1 text-3xl font-black">{fcfa(tva.montant)}</p><p className="mt-1 text-xs opacity-80">Base HT : {fcfa(tva.base)} · taux {tva.rule.rate} %</p>{tva.tva && tva.tva.creditReporte > 0 && <p className="mt-1 text-xs font-medium text-sky-100">Crédit de TVA à reporter : {fcfa(tva.tva.creditReporte)}</p>}</div>
            <div className="mt-4 space-y-1.5">{tva.breakdown.map((b, i) => <div key={i} className="flex justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-sm"><span className="text-slate-500">{b.label}</span><span className="font-semibold tabular-nums text-slate-800">{fcfa(b.amount)}</span></div>)}</div>
            <Button className="mt-4 w-full" onClick={() => generateTvaDeclaration(company.id)}><FileDown size={15} /> Générer la déclaration TVA</Button>
          </Card>
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between"><h3 className="font-bold text-slate-800">Impôt sur les bénéfices (IS)</h3>{!is.verified && <Badge tone="amber">À vérifier</Badge>}</div>
            <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white"><p className="text-xs uppercase opacity-80">Impôt estimé</p><p className="mt-1 text-3xl font-black">{fcfa(is.montant)}</p><p className="mt-1 text-xs opacity-80">Base (résultat) : {fcfa(is.base)} · taux {is.rule.rate}%</p></div>
            <div className="mt-4 space-y-1.5">{is.breakdown.map((b, i) => <div key={i} className="flex justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-sm"><span className="text-slate-500">{b.label}</span><span className="font-semibold tabular-nums text-slate-800">{fcfa(b.amount)}</span></div>)}</div>
          </Card>
          <Card className="p-5 lg:col-span-2">
            <h3 className="mb-3 font-bold text-slate-800">Explication du calcul (traçabilité)</h3>
            <div className="grid gap-3 sm:grid-cols-4">
              {[["Montant", fcfa(tva.montant)], ["Base", fcfa(tva.base)], ["Règle", tva.rule.code], ["Version", tva.rule.version]].map(([k, v]) => <div key={k} className="rounded-xl border border-slate-100 p-3"><p className="text-xs text-slate-400">{k}</p><p className="mt-0.5 truncate font-bold text-slate-800">{v}</p></div>)}
            </div>
            <p className="mt-3 text-xs text-slate-400">Source : {tva.rule.source}</p>
          </Card>
        </div>
      )}
      {tab === "rules" && (
        <Card className="p-5">
          <SectionHeading title="Regulatory Engine" subtitle="Règles versionnées — source, version, statut. Édition réservée aux administrateurs autorisés." />
          <div className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700 mb-4"><ShieldAlert size={14} className="mt-0.5 shrink-0" /> L'IA ne publie jamais seule une règle. Toute règle passe par : SOURCE → EXTRACTION → ANALYSE → STRUCTURATION → TESTS → VALIDATION HUMAINE → PUBLICATION.</div>
          <div className="space-y-3">
            {db.taxRules.map((r) => <RuleRow key={r.id} rule={r} />)}
          </div>
        </Card>
      )}
      {tab === "deadlines" && (
        <div className="space-y-6">
          <Card className="p-5">
            <SectionHeading title="Déclarations générées" />
            {declarations.length === 0 ? <p className="text-sm text-slate-400">Aucune déclaration. Générez la TVA depuis l'onglet Calculs.</p> : (
              <div className="space-y-2">{declarations.map((d) => <div key={d.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3"><div><p className="font-semibold text-slate-800">{d.taxCode} · {d.periodLabel}</p><p className="text-xs text-slate-400">Échéance {formatDate(d.dueDate)} · {fcfa(d.amount)}</p></div><StatusBadge status={d.status} /></div>)}</div>
            )}
          </Card>
          <Card className="p-5">
            <SectionHeading title="Calendrier fiscal" />
            {deadlines.length === 0 ? <p className="text-sm text-slate-400">Aucune échéance.</p> : (
              <div className="space-y-2">{deadlines.map((d) => (
                <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-4 py-3">
                  <div><p className="font-semibold text-slate-800">{d.label}</p><p className="text-xs text-slate-400">{d.taxCode} · échéance {formatDate(d.dueDate)}</p></div>
                  <div className="flex items-center gap-2"><StatusBadge status={d.status} /><select value={d.status} onChange={(e) => setDeadlineStatus(d.id, e.target.value as DeclarationStatus)} className="h-8 rounded-lg border border-slate-200 px-2 text-xs"><option value="pending">En attente</option><option value="in_progress">En cours</option><option value="ready">Prête</option><option value="submitted">Déposée</option><option value="paid">Payée</option></select></div>
                </div>
              ))}</div>
            )}
          </Card>
        </div>
      )}
      {tab === "tva" && (() => {
        const g = tvaGrid(company.id, entries);
        const net = g.tvaCollectee - g.tvaRecuperable;
        return (
          <Card className="p-5">
            <SectionHeading title="Grille de TVA" subtitle={`Taux paramétré : ${g.rate}% (à vérifier)`} />
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-100 p-4"><p className="text-xs text-slate-400">Base HT estimée</p><p className="text-xl font-bold text-slate-800">{fcfa(g.baseHT)}</p></div>
              <div className="rounded-xl border border-slate-100 p-4"><p className="text-xs text-slate-400">TVA collectée (443)</p><p className="text-xl font-bold text-emerald-600">{fcfa(g.tvaCollectee)}</p></div>
              <div className="rounded-xl border border-slate-100 p-4"><p className="text-xs text-slate-400">TVA récupérable (445)</p><p className="text-xl font-bold text-sky-600">{fcfa(g.tvaRecuperable)}</p></div>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-5 text-white"><span className="text-sm opacity-90">TVA nette à payer {net >= 0 ? "(à reverser)" : "(crédit à reporter)"}</span><span className="text-2xl font-black">{fcfa(Math.abs(net))}</span></div>
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-700"><Info size={14} className="mt-0.5 shrink-0" /> Calcul explicable, identique à celui de l'onglet Calculs : TVA nette = TVA collectée (443) − TVA déductible (445) − crédit reporté. La base HT est le chiffre d'affaires comptable (comptes 70), et non la TVA collectée.</div>
            <Button className="mt-4 w-full" onClick={() => { generateTvaDeclaration(company.id); alert("Déclaration TVA pré-remplie et contrôlée générée (voir onglet Échéances & déclarations)."); }}><FileDown size={15} /> Générer la déclaration TVA pré-remplie</Button>
          </Card>
        );
      })()}
    </Page>
  );
}

function RuleRow({ rule }: { rule: TaxRuleRef }) {
  const [rate, setRate] = useState(String(rule.rate));
  const [verified, setVerified] = useState(rule.verified);
  return (
    <div className="rounded-xl border border-slate-100 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><p className="font-bold text-slate-800">{rule.code} — {rule.name}</p><p className="text-xs text-slate-400">{rule.source} · v{rule.version}</p></div>
        <Badge tone={rule.verified ? "emerald" : "amber"}>{rule.verified ? <><Check size={11} /> Vérifié</> : "À vérifier"}</Badge>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-slate-600">Taux (%) <Input value={rate} onChange={(e) => setRate(e.target.value)} type="number" className="mt-1 h-9 w-24" /></label>
        <label className="flex items-center gap-2 pb-2 text-xs font-medium text-slate-600"><input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} className="h-4 w-4 rounded" /> Vérifié contre source officielle</label>
        <Button size="sm" onClick={() => updateTaxRate(rule.code, parseFloat(rate) || 0, verified)}>Enregistrer</Button>
      </div>
      {rule.note && <p className="mt-2 text-xs text-slate-400">{rule.note}</p>}
    </div>
  );
}
