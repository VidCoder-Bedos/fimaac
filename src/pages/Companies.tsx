import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Search, Building2, FileText, Receipt, ArrowRight, MapPin, CreditCard, Briefcase, ShieldAlert, X, AlertTriangle, KeyRound, Mail, Clock } from "lucide-react";
import { companiesForUser } from "../lib/scope";
import { useDB } from "../lib/store";
import { useAuth } from "../lib/auth";
import { useCompanyScope, Page } from "../components/Layout";
import { Card, Button, Badge, Modal, Field, Input, Select, EmptyState, StatCard, SectionHeading } from "../components/ui";
import { addCompanyWithAccess, addPermanentDoc, deletePermanentDoc, regenerateCompanyAccess, createCompanyAccess, updateCompanyEmail } from "../lib/actions";
import { financialSummary } from "../lib/accounting";
import { canAccessCompany } from "../lib/scope";
import { fcfa, fcfaCompact, formatDate } from "../lib/format";
import type { TaxRegime } from "../lib/types";

const REGIMES: Record<string, string> = { rs: "Réel simplifié", ri: "Réel normal", rsmi: "RSMI", rnc: "Résultat net comptable", exempt: "Exonéré" };

export function Companies() {
  const db = useDB();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ name: string; tradeName: string; legalForm: string; nif: string; sector: string; activity: string; city: string; capital: string; taxRegime: TaxRegime; vatPayer: boolean; riskLevel: "low" | "medium" | "high"; email: string; phone: string }>({ name: "", tradeName: "", legalForm: "SARL", nif: "", sector: "", activity: "", city: "Lomé", capital: "", taxRegime: "ri", vatPayer: true, riskLevel: "low", email: "", phone: "" });
  /** LOT 2 — identifiants générés, affichés UNE SEULE fois (invariant I5). */
  const [access, setAccess] = useState<{ email: string; tempPassword: string } | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const list = companiesForUser(db, user).filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.nif.includes(q));
  const resetForm = () => setForm({ name: "", tradeName: "", legalForm: "SARL", nif: "", sector: "", activity: "", city: "Lomé", capital: "", taxRegime: "ri", vatPayer: true, riskLevel: "low", email: "", phone: "" });
  /** LOT 2 — création + génération des identifiants portail de l'entreprise. */
  const save = () => {
    setAccessError(null);
    const res = addCompanyWithAccess({ name: form.name, tradeName: form.tradeName, legalForm: form.legalForm, nif: form.nif, sector: form.sector, activity: form.activity, city: form.city, capital: parseInt(form.capital || "0", 10), taxRegime: form.taxRegime, vatPayer: form.vatPayer, riskLevel: form.riskLevel, email: form.email, phone: form.phone });
    if (!res.ok) { setAccessError(res.error || "Erreur"); return; }
    setOpen(false);
    setAccess({ email: res.email!, tempPassword: res.tempPassword! });
    resetForm();
  };
  return (
    <Page>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-black tracking-tight text-slate-900">Entreprises clientes</h2><p className="text-sm text-slate-500">{list.length} client(s) du portefeuille</p></div>
        <Button onClick={() => setOpen(true)}><Plus size={15} /> Nouvelle entreprise</Button>
      </div>
      <div className="mb-4 max-w-xs"><div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><Input className="pl-9" placeholder="Rechercher (nom, NIF)…" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
      {list.length === 0 ? <EmptyState icon={<Building2 />} title="Aucune entreprise" description="Ajoutez votre première entreprise cliente." /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card hover className="cursor-pointer p-5" onClick={() => navigate(`/app/entreprises/${c.id}`)}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 font-bold text-white">{(c.tradeName || c.name).slice(0, 2).toUpperCase()}</div><div><p className="font-bold text-slate-900">{c.tradeName || c.name}</p><p className="text-xs text-slate-400">{c.legalForm} · {REGIMES[c.taxRegime]}</p></div></div>
                  <Badge tone={c.riskLevel === "high" ? "rose" : c.riskLevel === "medium" ? "amber" : "emerald"}>{c.riskLevel}</Badge>
                </div>
                <div className="mt-4 space-y-1.5 text-xs text-slate-500">
                  <p className="flex items-center gap-1.5"><MapPin size={12} /> {c.city} · {c.sector || "—"}</p>
                  <p className="flex items-center gap-1.5"><CreditCard size={12} /> NIF : {c.nif || "—"}</p>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3"><span className="text-xs text-slate-400">{db.entries.filter((e) => e.companyId === c.id).length} écritures</span><span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600">Ouvrir <ArrowRight size={13} /></span></div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
      {/* LOT 2 — identifiants générés : affichés UNE SEULE fois, jamais ré-affichables */}
      <Modal open={!!access} onClose={() => setAccess(null)} title="Identifiants portail générés" size="md">
        {access && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>
                Transmettez ces identifiants à l'entreprise <b>de façon sécurisée</b>.
                Ce mot de passe <b>ne sera plus affiché</b> ; l'entreprise devra le changer
                à sa première connexion.
              </span>
            </div>
            <div className="rounded-xl border border-slate-100 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Identifiant de connexion</p>
              <p className="mt-1 font-mono text-sm font-semibold text-slate-800">{access.email}</p>
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-400">Mot de passe temporaire</p>
              <p className="mt-1 font-mono text-sm font-bold text-indigo-600">{access.tempPassword}</p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => { navigator.clipboard.writeText(`${access.email}\n${access.tempPassword}`); }}>
                Copier les identifiants
              </Button>
              <Button onClick={() => setAccess(null)}>J'ai transmis les identifiants</Button>
            </div>
          </div>
        )}
      </Modal>
      <Modal open={open} onClose={() => setOpen(false)} title="Nouvelle entreprise cliente" size="lg">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Raison sociale" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Nom commercial"><Input value={form.tradeName || ""} onChange={(e) => setForm({ ...form, tradeName: e.target.value })} /></Field>
          <Field label="Forme juridique"><Select value={form.legalForm} onChange={(e) => setForm({ ...form, legalForm: e.target.value })}><option>SARL</option><option>SA</option><option>SUARL</option><option>SNC</option><option>Entreprise individuelle</option></Select></Field>
          <Field label="NIF"><Input value={form.nif} onChange={(e) => setForm({ ...form, nif: e.target.value })} /></Field>
          <Field label="Secteur d'activité"><Input value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} /></Field>
          <Field label="Ville"><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
          <Field label="E-mail de contact" required hint="Devient l'identifiant de connexion de l'entreprise au portail."><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="contact@entreprise.tg" /></Field>
          <Field label="Téléphone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+228 90 00 00 00" /></Field>
          <Field label="Capital (FCFA)"><Input value={form.capital} onChange={(e) => setForm({ ...form, capital: e.target.value })} inputMode="numeric" /></Field>
          <Field label="Régime fiscal"><Select value={form.taxRegime} onChange={(e) => setForm({ ...form, taxRegime: e.target.value as TaxRegime })}>{Object.entries(REGIMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Niveau de risque"><Select value={form.riskLevel} onChange={(e) => setForm({ ...form, riskLevel: e.target.value as "low" | "medium" | "high" })}><option value="low">Faible</option><option value="medium">Moyen</option><option value="high">Élevé</option></Select></Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={form.vatPayer} onChange={(e) => setForm({ ...form, vatPayer: e.target.checked })} className="h-4 w-4 rounded" /> Assujetti à la TVA</label>
        </div>
        {accessError && <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{accessError}</div>}
        <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => { setOpen(false); setAccessError(null); }}>Annuler</Button><Button onClick={save}>Créer l'entreprise & générer les accès</Button></div>
      </Modal>
    </Page>
  );
}

export function CompanyDetail() {
  const { id } = useParams();
  const db = useDB();
  const { user } = useAuth();
  const navigate = useNavigate();
  const scope = useCompanyScope();
  const company = db.companies.find((c) => c.id === id);
  const [docForm, setDocForm] = useState({ name: "", category: "juridique", date: "", note: "" });
  // LOT 3 — états de gestion des accès (les handlers suivent le early-return)
  const [accessOut, setAccessOut] = useState<{ email: string; tempPassword: string } | null>(null);
  const [accessMsg, setAccessMsg] = useState<string | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const doRegenerate = () => {
    if (!company) return;
    const r = regenerateCompanyAccess(company.id);
    if (!r.ok) { setAccessMsg(r.error || "Erreur"); return; }
    setAccessOut({ email: r.email!, tempPassword: r.tempPassword! });
  };
  const doCreateAccess = () => {
    if (!company) return;
    const r = createCompanyAccess(company.id, newEmail);
    if (!r.ok) { setAccessMsg(r.error || "Erreur"); return; }
    setAccessOut({ email: r.email!, tempPassword: r.tempPassword! });
    setNewEmail("");
  };
  const doUpdateEmail = () => {
    if (!company) return;
    const r = updateCompanyEmail(company.id, newEmail);
    if (!r.ok) { setAccessMsg(r.error || "Erreur"); return; }
    setEmailOpen(false);
    setAccessMsg(`E-mail de connexion mis à jour : ${newEmail}`);
  };
  if (!company) return <Page><EmptyState icon={<Building2 />} title="Entreprise introuvable" /></Page>;
  // Correction isolation : un cabinet ne peut ouvrir (même par URL) que les
  // entreprises qui lui sont rattachées ; un client, uniquement la sienne.
  if (!canAccessCompany(db, user, company.id)) {
    return <Page><EmptyState icon={<ShieldAlert />} title="Accès non autorisé" description="Cette entreprise n'est pas rattachée à votre cabinet." /></Page>;
  }
  const permanentDocs = db.permanentDocs.filter((d) => d.companyId === company.id);
  // LOT 3 — compte portail lié à cette entreprise (calculé après le early-return)
  const accessUser = db.users.find((u) => u.companyId === company.id && u.userType === "client");
  const entries = db.entries.filter((e) => e.companyId === company.id);
  const sum = financialSummary(entries);
  const profile = db.taxProfiles.find((p) => p.companyId === company.id);
  const deadlines = db.taxDeadlines.filter((d) => d.companyId === company.id);
  const openInModule = (path: string) => { scope.set(company.id); navigate(path); };
  const info = [
    { label: "Forme juridique", value: company.legalForm }, { label: "NIF", value: company.nif || "—" },
    { label: "RCCM", value: company.rccm || "—" }, { label: "Secteur", value: company.sector || "—" },
    { label: "Activité", value: company.activity || "—" }, { label: "Ville", value: company.city || "—" },
    { label: "Capital", value: fcfa(company.capital) }, { label: "Régime fiscal", value: REGIMES[company.taxRegime] },
    { label: "TVA", value: company.vatPayer ? "Assujetti" : "Non assujetti" }, { label: "Créé le", value: formatDate(company.createdAt) },
  ];
  return (
    <Page>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-xl font-black text-white shadow-lg">{(company.tradeName || company.name).slice(0, 2).toUpperCase()}</div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900">{company.name}</h2>
            <p className="text-sm text-slate-500">{company.tradeName ? `${company.tradeName} · ` : ""}{company.legalForm} · {REGIMES[company.taxRegime]}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => openInModule("/app/comptabilite")}><Briefcase size={15} /> Comptabilité</Button>
          <Button variant="outline" size="sm" onClick={() => openInModule("/app/fiscalite")}><Receipt size={15} /> Fiscalité</Button>
          <Button variant="outline" size="sm" onClick={() => openInModule("/app/documents")}><FileText size={15} /> Documents</Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Produits" value={`${fcfaCompact(sum.produits)}`} icon={<FileText size={18} />} tone="emerald" />
        <StatCard title="Charges" value={`${fcfaCompact(sum.charges)}`} icon={<Receipt size={18} />} tone="amber" />
        <StatCard title="Résultat" value={`${fcfaCompact(sum.resultat)}`} icon={<Building2 size={18} />} tone={sum.resultat >= 0 ? "indigo" : "rose"} />
        <StatCard title="Trésorerie" value={`${fcfaCompact(sum.tresorerie)}`} icon={<CreditCard size={18} />} tone="sky" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <SectionHeading title="Fiche entreprise" subtitle="Informations générales et juridiques" />
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            {info.map((i) => <div key={i.label}><dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{i.label}</dt><dd className="mt-0.5 text-sm font-semibold text-slate-800">{i.value}</dd></div>)}
          </dl>
        </Card>
        <Card className="p-5">
          <SectionHeading title="Profil fiscal" />
          {profile ? <div className="space-y-2">{profile.obligations.map((o) => <div key={o} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700"><ShieldAlert size={14} className="text-amber-500" /> {o}</div>)}</div> : <p className="text-sm text-slate-400">Profil non configuré</p>}
          <div className="mt-4 border-t border-slate-100 pt-3"><p className="mb-2 text-xs font-semibold uppercase text-slate-400">Échéances</p>{deadlines.length === 0 ? <p className="text-sm text-slate-400">Aucune</p> : deadlines.map((d) => <p key={d.id} className="text-sm text-slate-600">{d.taxCode} · {formatDate(d.dueDate)}</p>)}</div>
        </Card>
      </div>
      <Card className="mt-6 p-5">
        <SectionHeading title="Dossier permanent" subtitle="Pièces juridiques, fiscales et bancaires versionnées" />
        <div className="mb-4 grid gap-3 rounded-xl border border-slate-100 p-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input value={docForm.name} onChange={(e) => setDocForm({ ...docForm, name: e.target.value })} placeholder="Nom du document" />
          <Select value={docForm.category} onChange={(e) => setDocForm({ ...docForm, category: e.target.value })}><option value="juridique">Juridique</option><option value="fiscal">Fiscal</option><option value="banque">Banque</option><option value="social">Social</option><option value="autre">Autre</option></Select>
          <Input type="date" value={docForm.date} onChange={(e) => setDocForm({ ...docForm, date: e.target.value })} />
          <Button onClick={() => { if (docForm.name) { addPermanentDoc(company.id, { name: docForm.name, category: docForm.category, date: docForm.date || new Date().toISOString().slice(0, 10), note: docForm.note }); setDocForm({ name: "", category: "juridique", date: "", note: "" }); } }}><Plus size={15} /> Ajouter</Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{permanentDocs.map((d) => (
          <div key={d.id} className="flex items-start justify-between rounded-xl border border-slate-100 p-3"><div><p className="font-semibold text-slate-800">{d.name}</p><Badge tone="indigo">{d.category}</Badge><p className="mt-1 text-xs text-slate-400">{formatDate(d.date)}{d.note ? ` · ${d.note}` : ""}</p></div><button onClick={() => deletePermanentDoc(d.id)} className="text-slate-300 hover:text-rose-500"><X size={15} /></button></div>
        ))}</div>
      </Card>

      {/* LOT 3 — Accès & identifiants : le cabinet gère les coordonnées de connexion */}
      <Card className="mt-6 p-5">
        <SectionHeading
          title="Accès & identifiants"
          subtitle="Coordonnées de connexion de l'entreprise au portail — modifiables à tout moment"
        />
        {accessMsg && <div className="mb-4 rounded-xl bg-slate-50 px-4 py-2.5 text-sm text-slate-700">{accessMsg}</div>}
        {accessUser ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-100 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Identifiant de connexion</p>
              <p className="mt-1 truncate font-mono text-sm font-semibold text-slate-800">{accessUser.email}</p>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400"><Mail size={12} /> utilisé pour se connecter au portail</p>
            </div>
            <div className="rounded-xl border border-slate-100 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Dernière connexion</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{accessUser.lastLoginAt ? formatDate(accessUser.lastLoginAt) : "Jamais connecté"}</p>
              {accessUser.mustChangePassword && <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600"><Clock size={12} /> Changement de mot de passe exigé à la prochaine connexion</p>}
            </div>
            <div className="rounded-xl border border-slate-100 p-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Actions</p>
              <div className="space-y-2">
                <Button size="sm" variant="outline" className="w-full" onClick={doRegenerate}><KeyRound size={14} /> Régénérer le mot de passe</Button>
                <Button size="sm" variant="outline" className="w-full" onClick={() => { setNewEmail(accessUser.email); setEmailOpen(true); }}><Mail size={14} /> Modifier l&apos;e-mail</Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 p-4">
            <p className="text-sm text-slate-600">Cette entreprise n&apos;a pas encore d&apos;accès au portail client.</p>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <Field label="E-mail de connexion"><Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="contact@entreprise.tg" className="w-72" /></Field>
              <Button onClick={doCreateAccess}><KeyRound size={14} /> Créer l&apos;accès portail</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Modale : identifiants régénérés / créés — affichés une seule fois */}
      <Modal open={!!accessOut} onClose={() => setAccessOut(null)} title="Nouveaux identifiants" size="md">
        {accessOut && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>Transmettez-les <b>de façon sécurisée</b>. Ce mot de passe <b>ne sera plus affiché</b> ; l&apos;entreprise devra le changer à sa prochaine connexion.</span>
            </div>
            <div className="rounded-xl border border-slate-100 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Identifiant</p>
              <p className="mt-1 font-mono text-sm font-semibold text-slate-800">{accessOut.email}</p>
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-400">Mot de passe temporaire</p>
              <p className="mt-1 font-mono text-sm font-bold text-indigo-600">{accessOut.tempPassword}</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => navigator.clipboard.writeText(`${accessOut.email}\n${accessOut.tempPassword}`)}>Copier</Button>
              <Button onClick={() => setAccessOut(null)}>Terminé</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modale : modifier l&apos;e-mail de connexion */}
      <Modal open={emailOpen} onClose={() => setEmailOpen(false)} title="Modifier l'e-mail de connexion" size="sm">
        <Field label="Nouvel e-mail" required><Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="contact@entreprise.tg" /></Field>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setEmailOpen(false)}>Annuler</Button>
          <Button onClick={doUpdateEmail}>Enregistrer</Button>
        </div>
      </Modal>
    </Page>
  );
}
