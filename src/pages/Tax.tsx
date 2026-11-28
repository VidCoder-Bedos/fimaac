import { useMemo, useState } from "react";
import { Receipt, AlertTriangle, Check, FileDown, CalendarClock, ShieldAlert, Info } from "lucide-react";
import { useDB } from "../lib/store";
import { useCompanyScope, Page } from "../components/Layout";
import { Card, Button, Badge, StatusBadge, EmptyState, SectionHeading, Input, Tabs, Field, Select } from "../components/ui";
import { computeTax } from "../lib/tax";
import { generateTvaDeclaration, generateIsDeclaration, updateTaxRate, setDeadlineStatus, tvaGrid, addTaxAdjustment, deleteTaxAdjustment } from "../lib/actions";
import { fcfa, formatDate } from "../lib/format";
import { ventilateVat } from "../lib/tvaVentilation";
import { totalAdjustments } from "../lib/fiscalite";
import { trialBalance } from "../lib/accounting";
import { suggestAdjustments, describeSuggestions } from "../lib/taxSuggestions";
import { missingFor } from "../lib/emptyStates";
import { resolveTaxRule, profileOfCompany, describeProfile, TAX_REGIME_CODES, TAX_REGIME_LABELS } from "../lib/taxRegime";
import { setCompanyTaxProfile } from "../lib/actions";
import type { TaxRegime } from "../lib/types";
import type { TaxRuleRef, DeclarationStatus } from "../lib/types";
import { toast } from "../lib/toast";

export default function Tax() {
  const db = useDB();
  const { id: companyId } = useCompanyScope();
  const [tab, setTab] = useState("calc");
  const company = db.companies.find((c) => c.id === companyId);
  const entries = db.entries.filter((e) => e.companyId === companyId);
  const [exercise, setExercise] = useState(String(new Date().getFullYear()));
  const [adj, setAdj] = useState({ type: "reintegration" as "reintegration" | "deduction", label: "", amount: "", reference: "" });
  const adjustments = useMemo(() => {
    const list = db.taxAdjustments.filter((a) => a.companyId === companyId && a.exercise === exercise);
    return { reintegrations: totalAdjustments(list, "reintegration"), deductions: totalAdjustments(list, "deduction") };
  }, [db.taxAdjustments, companyId, exercise]);
  const exerciseAdjustments = db.taxAdjustments.filter((a) => a.companyId === companyId && a.exercise === exercise);
  const tva = computeTax("TVA", entries, db.taxRules)!;
  const is = computeTax("IS", entries, db.taxRules, { adjustments })!;
  const deadlines = db.taxDeadlines.filter((d) => d.companyId === companyId);
  const declarations = db.taxDeclarations.filter((d) => d.companyId === companyId);
  const vat = useMemo(() => ventilateVat(entries, db.accounts), [entries, db.accounts]);
  // P21 — le régime déclaré et la catégorie décident de la règle applicable.
  const profile = profileOfCompany(company!);
  const scopeIS = resolveTaxRule(db.taxRules, "IS", profile);
  const scopeTVA = resolveTaxRule(db.taxRules, "TVA", profile);
  // P20 — comptes de nature non déductible : on propose, le fiscaliste décide.
  const suggestions = useMemo(
    () => suggestAdjustments(
      trialBalance(entries, db.accounts).map((r) => ({ code: r.code, label: r.label, debit: r.debit, credit: r.credit })),
      db.taxAdjustments,
      exercise,
    ),
    [entries, db.accounts, db.taxAdjustments, exercise],
  );
  if (!company) return <Page><EmptyState icon={<Receipt />} title="Sélectionnez une entreprise" /></Page>;
  return (
    <Page>
      <div className="mb-5"><h2 className="text-xl font-black tracking-tight text-slate-900">Fiscalité — {company.tradeName || company.name}</h2><p className="text-sm text-slate-500">Moteur fiscal Togo · calculs explicables · GUDEF/OTR</p></div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700"><AlertTriangle size={14} /> Taux paramétrables — à vérifier dans le Regulatory Engine</div>
        <div className="flex items-center gap-2 rounded-xl bg-sky-50 px-3 py-2 text-xs font-medium text-sky-700"><Info size={14} /> Dépôt GUDEF/OTR : mode préparation (aucune API officielle connectée)</div>
      </div>
      <Card className="mb-5 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Profil fiscal déclaré</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-800">{describeProfile(profile)}</p>
          </div>
          <Field label="Régime">
            <Select className="h-9 w-40" value={profile.regime} onChange={(e) => {
              const r = setCompanyTaxProfile(company!.id, { taxRegime: e.target.value, taxCategory: profile.category });
              if (!r.ok) toast(r.error);
            }}>
              {TAX_REGIME_CODES.map((code) => <option key={code} value={code}>{TAX_REGIME_LABELS[code]}</option>)}
            </Select>
          </Field>
          <Field label="Catégorie d'entreprise">
            <CategoryInput companyId={company!.id} regime={profile.regime} value={company!.taxCategory || ""} />
          </Field>
        </div>
        {!scopeIS.shouldCompute || !scopeTVA.shouldCompute || scopeIS.indicativeOnly || scopeTVA.indicativeOnly ? (
          <div className={`mt-3 space-y-1.5`}>
            {[scopeTVA, scopeIS].filter((s) => s.status !== "ok").map((s, i) => (
              <div key={i} className={`flex items-start gap-2 rounded-xl px-3 py-2 text-xs ${s.shouldCompute ? "bg-amber-50 text-amber-800" : "bg-rose-50 text-rose-700"}`}>
                <ShieldAlert size={14} className="mt-0.5 shrink-0" /> <span>{s.message}</span>
              </div>
            ))}
          </div>
        ) : null}
      </Card>
      <div className="mb-6"><Tabs active={tab} onChange={setTab} tabs={[{ id: "calc", label: "Calculs", icon: <Receipt size={15} /> }, { id: "tva", label: "Grille TVA", icon: <Receipt size={15} /> }, { id: "rules", label: "Moteur réglementaire", icon: <ShieldAlert size={15} /> }, { id: "deadlines", label: "Échéances & déclarations", icon: <CalendarClock size={15} /> }]} /></div>
      {tab === "calc" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between"><h3 className="flex items-center gap-2 font-bold text-slate-800"><Receipt size={17} className="text-indigo-500" /> TVA du mois</h3>{!tva.verified && <Badge tone="amber">À vérifier</Badge>}</div>
            <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-5 text-white"><p className="text-xs uppercase opacity-80">TVA nette à payer</p><p className="mt-1 text-3xl font-black">{scopeTVA.shouldCompute ? fcfa(tva.montant) : "—"}</p><p className="mt-1 text-xs opacity-80">{scopeTVA.shouldCompute ? `Base HT : ${fcfa(tva.base)} · taux ${tva.rule.rate} %` : "Non calculée : régime exonéré déclaré"}</p>{tva.tva && tva.tva.creditReporte > 0 && <p className="mt-1 text-xs font-medium text-sky-100">Crédit de TVA à reporter : {fcfa(tva.tva.creditReporte)}</p>}</div>
            <div className="mt-4 space-y-1.5">{tva.breakdown.map((b, i) => <div key={i} className="flex justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-sm"><span className="text-slate-500">{b.label}</span><span className="font-semibold tabular-nums text-slate-800">{fcfa(b.amount)}</span></div>)}</div>
            <Button className="mt-4 w-full" onClick={() => { const r = generateTvaDeclaration(company.id); if (!r.ok) toast(r.error); }}><FileDown size={15} /> Générer la déclaration TVA</Button>
          </Card>
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between"><h3 className="font-bold text-slate-800">Impôt sur les bénéfices (IS)</h3>{!is.verified && <Badge tone="amber">À vérifier</Badge>}</div>
            <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white"><p className="text-xs uppercase opacity-80">Impôt estimé</p><p className="mt-1 text-3xl font-black">{scopeIS.shouldCompute ? fcfa(is.montant) : "—"}</p><p className="mt-1 text-xs opacity-80">{scopeIS.shouldCompute ? `Base (résultat) : ${fcfa(is.base)} · taux ${is.rule.rate}%` : "Non calculé : régime exonéré déclaré"}</p></div>
            <div className="mt-4 space-y-1.5">{is.breakdown.map((b, i) => <div key={i} className="flex justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-sm"><span className="text-slate-500">{b.label}</span><span className="font-semibold tabular-nums text-slate-800">{fcfa(b.amount)}</span></div>)}</div>
            <Button className="mt-4 w-full" variant="outline" onClick={() => { const r = generateIsDeclaration(company.id, exercise); if (!r.ok) toast(r.error); }}><FileDown size={15} /> Générer la déclaration IS {exercise}</Button>
          </Card>
          <Card className="p-5 lg:col-span-2">
            <SectionHeading
              title="Retraitements fiscaux — réintégrations et déductions"
              subtitle="Amendes et pénalités, dons sans reçu, charges non justifiées (réintégrations) · produits non imposables (déductions)"
              action={
                <Select value={exercise} onChange={(e) => setExercise(e.target.value)} className="h-9 w-32">
                  {[...new Set([String(new Date().getFullYear() - 1), String(new Date().getFullYear()), String(new Date().getFullYear() + 1)])].map((y) => <option key={y} value={y}>Exercice {y}</option>)}
                </Select>
              }
            />
            <div className="mb-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 px-4 py-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Résultat comptable</p><p className="mt-1 font-black tabular-nums text-slate-800">{fcfa(is.is?.resultatComptable ?? 0)}</p></div>
              <div className="rounded-xl bg-rose-50 px-4 py-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-rose-500">+ Réintégrations</p><p className="mt-1 font-black tabular-nums text-rose-700">{fcfa(adjustments.reintegrations)}</p></div>
              <div className="rounded-xl bg-emerald-50 px-4 py-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">− Déductions</p><p className="mt-1 font-black tabular-nums text-emerald-700">{fcfa(adjustments.deductions)}</p></div>
            </div>
            <div className="mb-4 flex items-center justify-between rounded-xl bg-indigo-50 px-4 py-3">
              <span className="text-sm font-semibold text-indigo-900">Résultat fiscal avant arrondi</span>
              <span className="font-black tabular-nums text-indigo-900">{fcfa(is.is?.resultatFiscalAvantArrondi ?? 0)}</span>
            </div>
            {exerciseAdjustments.length === 0 ? (
              <p className="mb-4 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">Aucun retraitement saisi pour l'exercice {exercise}. Le résultat fiscal est alors égal au résultat comptable — aucune réintégration n'est supposée.</p>
            ) : (
              <div className="mb-4 overflow-x-auto rounded-xl border border-slate-100">
                <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Réintégrations proposées — exercice {exercise}</p>
                    <span className="text-[11px] text-indigo-700">{describeSuggestions(suggestions)}</span>
                  </div>
                  {suggestions.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-500">Aucun compte de nature non déductible trouvé (pénalités 647x, dons 6582/6583/835, jetons 6581).</p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {suggestions.map((sg) => (
                        <div key={sg.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-800">{sg.label} · <span className="tabular-nums">{fcfa(sg.amount)}</span></p>
                            <p className="text-[11px] text-slate-500">{sg.rationale} <span className="text-slate-400">({sg.accounts.map((a) => a.code).join(", ")})</span></p>
                          </div>
                          {sg.alreadyRecorded ? (
                            <Badge tone="emerald">Reprise</Badge>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => {
                              const res = addTaxAdjustment(company.id, { exercise, type: sg.type, label: sg.label, amount: sg.amount, reference: sg.reference, suggestionId: sg.id });
                              if (!res.ok) { toast(res.error); return; }
                              toast("Réintégration reprise.", "Montant et origine conservés dans le journal d'audit.", "success");
                            }}>
                              Reprendre
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="mt-2 text-[11px] text-slate-500">Un compte proposé n'est pas une décision : la déductibilité dépend des pièces et du texte applicable. Rien n'est enregistré sans votre clic.</p>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-400"><tr><th className="px-3 py-2">Type</th><th className="px-3 py-2">Libellé</th><th className="px-3 py-2">Référence</th><th className="px-3 py-2 text-right">Montant</th><th className="px-3 py-2" /></tr></thead>
                  <tbody>{exerciseAdjustments.map((a) => (
                    <tr key={a.id} className="border-t border-slate-50">
                      <td className="px-3 py-2"><Badge tone={a.type === "reintegration" ? "rose" : "emerald"}>{a.type === "reintegration" ? "Réintégration" : "Déduction"}</Badge></td>
                      <td className="px-3 py-2 text-slate-700">{a.label}</td>
                      <td className="px-3 py-2 text-xs text-slate-400">{a.reference || "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fcfa(a.amount)}</td>
                      <td className="px-3 py-2 text-right"><button className="text-xs font-semibold text-rose-600 hover:underline" onClick={() => deleteTaxAdjustment(a.id)}>Supprimer</button></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-5">
              <Field label="Type"><Select value={adj.type} onChange={(e) => setAdj({ ...adj, type: e.target.value as "reintegration" | "deduction" })}><option value="reintegration">Réintégration</option><option value="deduction">Déduction</option></Select></Field>
              <Field label="Libellé" required><Input value={adj.label} onChange={(e) => setAdj({ ...adj, label: e.target.value })} placeholder="Amendes fiscales, dons…" /></Field>
              <Field label="Montant (FCFA)" required><Input value={adj.amount} onChange={(e) => setAdj({ ...adj, amount: e.target.value })} inputMode="numeric" /></Field>
              <Field label="Référence"><Input value={adj.reference} onChange={(e) => setAdj({ ...adj, reference: e.target.value })} placeholder="Pièce, article CGI" /></Field>
              <div className="flex items-end">
                <Button className="w-full" onClick={() => {
                  const res = addTaxAdjustment(company.id, { exercise, type: adj.type, label: adj.label, amount: Number(adj.amount.replace(/\s/g, "").replace(",", ".")), reference: adj.reference });
                  if (!res.ok) { toast(res.error); return; }
                  setAdj({ ...adj, label: "", amount: "", reference: "" });
                }}>Ajouter</Button>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Chaque ligne est attribuée, horodatée et scellée dans le journal d'audit. Le calcul de l'IS reprend ces montants : le même résultat fiscal alimente l'écran, la déclaration et la liasse.
            </p>
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
            {declarations.length === 0 ? (
              <div>
                <p className="text-sm text-slate-400">Aucune déclaration. Générez la TVA depuis l'onglet Calculs.</p>
                {missingFor("fiscalite", db, companyId) ? (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-xs text-amber-800">
                    <Info size={12} /> {missingFor("fiscalite", db, companyId)!.message}
                  </p>
                ) : null}
              </div>
            ) : (
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
            <div className="mt-6">
              <h4 className="font-bold text-slate-800">Ventilation par taux</h4>
              <p className="mb-3 text-xs text-slate-500">18 % · 9 % · exonéré — la TVA nette ci-dessus ne peut être juste que si la ventilation l'est.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase text-slate-400">
                      <th className="px-3 py-2">Taux</th>
                      <th className="px-3 py-2 text-right">Base HT</th>
                      <th className="px-3 py-2 text-right">TVA comptabilisée</th>
                      <th className="px-3 py-2 text-right">TVA théorique</th>
                      <th className="px-3 py-2 text-right">Écart</th>
                      <th className="px-3 py-2 text-center">Écritures</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vat.bands.map((b) => (
                      <tr key={b.rate} className="border-b border-slate-50">
                        <td className="px-3 py-2.5 font-semibold text-slate-700">{b.label}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{fcfa(b.base)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-emerald-600">{fcfa(b.vat)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{fcfa(b.vatTheorique)}</td>
                        <td className={`px-3 py-2.5 text-right tabular-nums ${Math.abs(b.ecart) > 1 ? "font-semibold text-rose-600" : "text-slate-400"}`}>{b.ecart === 0 ? "—" : fcfa(b.ecart)}</td>
                        <td className="px-3 py-2.5 text-center text-xs text-slate-500">{b.entries}{b.inferred > 0 ? ` (dont ${b.inferred} déduit${b.inferred > 1 ? "s" : ""})` : ""}</td>
                      </tr>
                    ))}
                    {vat.bands.length === 0 && (
                      <tr><td colSpan={6} className="px-3 py-4 text-center text-xs text-slate-400">Aucune vente validée sur le dossier.</td></tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200 font-bold text-slate-800">
                      <td className="px-3 py-2.5">Total</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{fcfa(vat.totals.base)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{fcfa(vat.totals.collectee)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{fcfa(vat.totals.theorique)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{vat.totals.ecart === 0 ? "—" : fcfa(vat.totals.ecart)}</td>
                      <td className="px-3 py-2.5 text-center text-xs">{vat.bands.reduce((n, b) => n + b.entries, 0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="mt-4 space-y-2">
                {vat.controls.map((c) => (
                  <div key={c.id} className="flex items-start gap-3 rounded-xl border border-slate-100 px-3 py-2.5">
                    {c.level === "ok" ? <Check size={15} className="mt-0.5 shrink-0 text-emerald-500" /> : <AlertTriangle size={15} className={`mt-0.5 shrink-0 ${c.level === "blocking" ? "text-rose-500" : "text-amber-500"}`} />}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{c.label}</p>
                      <p className="text-xs text-slate-500">{c.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                La TVA déductible ({fcfa(vat.totals.deductible)}, dont {fcfa(vat.totals.deductibleImmo)} d'immobilisations) n'est pas ventilée par taux : elle n'en dépend pas.
                Taux paramétrés dans le moteur réglementaire ; les codes taxe des lignes priment sur toute déduction.
              </p>
            </div>
            <Button className="mt-4 w-full" onClick={() => { generateTvaDeclaration(company.id); toast("Déclaration TVA pré-remplie et contrôlée générée (voir onglet Échéances & déclarations)."); }}><FileDown size={15} /> Générer la déclaration TVA pré-remplie</Button>
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

/**
 * P21 — La catégorie d'entreprise alimente les taux différenciés. Elle se saisit
 * (et s'audite) ; une saisie vide signifie « aucune catégorie déclarée », ce qui
 * est un état explicite et non un oubli silencieux.
 */
function CategoryInput({ companyId, regime, value }: { companyId: string; regime: TaxRegime; value: string }) {
  const [draft, setDraft] = useState(value);
  const commit = () => {
    if (draft.trim() === (value || "")) return;
    const res = setCompanyTaxProfile(companyId, { taxRegime: regime, taxCategory: draft });
    if (!res.ok) { toast(res.error); return; }
    toast("Catégorie déclarée.", "Les règles portant cette catégorie s'appliquent désormais.", "success");
  };
  return (
    <Input
      className="h-9 w-52"
      value={draft}
      placeholder="PME, grande entreprise…"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") { e.currentTarget.blur(); } }}
    />
  );
}
