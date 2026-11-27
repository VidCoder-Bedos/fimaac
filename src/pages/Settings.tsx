import { useState } from "react";
import { CreditCard, Check, AlertTriangle, Download, Upload, RotateCcw, CheckCircle2, KeyRound, Mail } from "lucide-react";
import { useDB, resetDB, exportDB, importDB } from "../lib/store";
import { useAuth } from "../lib/auth";
import { Page } from "../components/Layout";
import { Card, Button, Badge, StatusBadge, SectionHeading, Tabs, Avatar, Field, Input } from "../components/ui";
import { Can } from "../components/Can";
import { changePlan, payInvoice, changeOwnPassword, changeOwnEmail } from "../lib/actions";
import { ROLE_LABELS } from "../lib/permissions";
import { fcfa, formatDate } from "../lib/format";

const PLANS = [
  { id: "trial", name: "Essai", price: 0, features: ["1 cabinet", "3 utilisateurs", "Tous les modules"] },
  { id: "starter", name: "Starter", price: 35000, features: ["50 clients", "5 utilisateurs", "Compta + Fiscalité"] },
  { id: "pro", name: "Pro", price: 75000, features: ["Clients illimités", "15 utilisateurs", "États + IA + Conformité"] },
  { id: "enterprise", name: "Enterprise", price: 250000, features: ["Illimité", "Multi-pays OHADA", "API & support"] },
] as const;

export function Settings() {
  const db = useDB();
  const { user } = useAuth();
  const [tab, setTab] = useState("profile");
  const org = db.organizations.find((o) => o.id === user?.organizationId);
  if (!user) return null;
  const doImport = () => { const v = prompt("Collez le JSON exporté :"); if (v && importDB(v)) alert("Import réussi."); };
  return (
    <Page>
      <div className="mb-5"><h2 className="text-xl font-black tracking-tight text-slate-900">Paramètres</h2><p className="text-sm text-slate-500">Compte, organisation & données</p></div>
      {/* LOT 5 — l'entreprise peut changer ses coordonnées de connexion elle-même */}
      <div className="mb-6"><Tabs active={tab} onChange={setTab} tabs={[{ id: "profile", label: "Profil" }, { id: "security", label: "Sécurité", icon: <KeyRound size={15} /> }, { id: "org", label: "Organisation" }, { id: "data", label: "Données" }]} /></div>
      {tab === "profile" && (
        <Card className="p-6"><SectionHeading title="Profil utilisateur" />
          <div className="flex items-center gap-4"><Avatar name={`${user.firstName} ${user.lastName}`} color={user.avatarColor} size={64} /><div><p className="text-lg font-bold text-slate-900">{user.firstName} {user.lastName}</p><p className="text-sm text-slate-500">{user.email}</p><Badge tone="indigo">{ROLE_LABELS[user.role]}</Badge></div></div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2"><Info label="Type de compte" value={user.userType} /><Info label="Dernière connexion" value={formatDate(user.lastLoginAt)} /><Info label="2FA" value={user.twoFactorEnabled ? "Activée" : "Désactivée"} /><Info label="Statut" value={user.active ? "Actif" : "Inactif"} /></div>
        </Card>
      )}
      {tab === "security" && user && <SecurityPanel userId={user.id} email={user.email} />}
      {tab === "org" && org && (
        <Card className="p-6"><SectionHeading title="Organisation" subtitle={org.type === "cabinet" ? "Cabinet comptable" : "Plateforme"} />
          <div className="grid gap-4 sm:grid-cols-2"><Info label="Nom" value={org.name} /><Info label="Forme juridique" value={org.legalForm || "—"} /><Info label="NIF" value={org.nif || "—"} /><Info label="E-mail" value={org.email} /><Info label="Ville" value={org.city || "—"} /><Info label="Pays" value={org.country} /><Info label="Plan actuel" value={org.plan} /><Info label="Créé le" value={formatDate(org.createdAt)} /></div>
        </Card>
      )}
      {tab === "data" && (
        <div className="space-y-6">
          <Card className="p-6"><SectionHeading title="Sauvegarde des données" subtitle="Vos données sont stockées localement dans votre navigateur." />
            <div className="grid gap-3 sm:grid-cols-3">
              <Button variant="outline" onClick={() => { const blob = new Blob([exportDB()], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "fimaac-backup.json"; a.click(); URL.revokeObjectURL(url); }}><Download size={15} /> Exporter (JSON)</Button>
              <Button variant="outline" onClick={doImport}><Upload size={15} /> Importer</Button>
              {/* M2 — la réinitialisation du dossier n'est pas offerte à tous les rôles */}
              <Can permission="settings.manage">
                <Button variant="danger" onClick={() => { if (confirm("Réinitialiser toutes les données de démonstration ?")) resetDB(); }}><RotateCcw size={15} /> Réinitialiser</Button>
              </Can>
            </div>
          </Card>
          <Card className="p-6"><div className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> Application de démonstration V0.1. L'authentification et le stockage sont côté navigateur. En production, FIMAAC utilise NestJS + PostgreSQL avec hachage serveur et isolation multi-tenant.</div></Card>
        </div>
      )}
    </Page>
  );
}

export function Billing() {
  const db = useDB();
  const { user } = useAuth();
  const org = db.organizations.find((o) => o.id === user?.organizationId);
  const sub = db.subscriptions.find((s) => s.organizationId === user?.organizationId);
  const invoices = db.invoices.filter((i) => i.organizationId === user?.organizationId);
  if (!org) return null;
  return (
    <Page>
      <div className="mb-5"><h2 className="text-xl font-black tracking-tight text-slate-900">Facturation & abonnement</h2><p className="text-sm text-slate-500">{org.name}</p></div>
      <div className="mb-4 flex items-start gap-2 rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-700"><CreditCard size={14} className="mt-0.5 shrink-0" /> Système de paiement en <b>mode simulation</b> (adapter). Aucune plateforme de paiement réelle n'est connectée. En production : intégration Mobile Money / carte (adapter documenté).</div>
      <Card className="mb-6 p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm text-slate-400">Abonnement actuel</p><p className="text-2xl font-black capitalize text-slate-900">{sub?.plan || org.plan}</p><p className="text-sm text-slate-500">{sub?.status === "trialing" ? "Période d'essai" : "Actif"} · {sub?.seats} sièges · {fcfa(sub?.monthlyAmount || 0)}/mois</p></div><Badge tone={sub?.status === "trialing" ? "violet" : "emerald"}><StatusBadge status={sub?.status || "active"} /></Badge></div></Card>
      <SectionHeading title="Plans disponibles" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{PLANS.map((p) => (
        <Card key={p.id} hover className={`p-5 ${org.plan === p.id ? "ring-2 ring-indigo-500" : ""}`}>
          <p className="text-sm font-bold uppercase text-indigo-600">{p.name}</p><p className="mt-2 text-2xl font-black text-slate-900">{fcfa(p.price)}<span className="text-xs font-normal text-slate-400">/mois</span></p>
          <ul className="mt-3 space-y-1.5">{p.features.map((f) => <li key={f} className="flex items-center gap-1.5 text-xs text-slate-600"><Check size={13} className="text-emerald-500" /> {f}</li>)}</ul>
          <Button className="mt-4 w-full" size="sm" variant={org.plan === p.id ? "outline" : "primary"} disabled={org.plan === p.id} onClick={() => changePlan(org.id, p.id)}>{org.plan === p.id ? "Plan actuel" : "Choisir"}</Button>
        </Card>
      ))}</div>
      <Card className="p-5"><SectionHeading title="Factures" />
        {invoices.length === 0 ? <p className="text-sm text-slate-400">Aucune facture.</p> : (
          <div className="space-y-2">{invoices.map((inv) => <div key={inv.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3"><div><p className="font-semibold text-slate-800">{inv.number}</p><p className="text-xs text-slate-400">{inv.plan} · {formatDate(inv.issuedAt)}</p></div><div className="flex items-center gap-3"><span className="font-bold tabular-nums text-slate-800">{fcfa(inv.amount)}</span>{inv.status === "paid" ? <Badge tone="emerald"><CheckCircle2 size={11} /> Payée</Badge> : <Button size="sm" onClick={() => payInvoice(inv.id)}>Payer (sim.)</Button>}</div></div>)}</div>
        )}
      </Card>
    </Page>
  );
}

function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p><p className="mt-0.5 font-semibold capitalize text-slate-800">{value}</p></div>; }

/**
 * LOT 5 — L'entreprise change elle-même ses coordonnées de connexion
 * (mot de passe + e-mail). « Les coordonnées peuvent être changées par après. */
function SecurityPanel({ userId, email }: { userId: string; email: string }) {
  const db = useDB();
  const u = db.users.find((x) => x.id === userId);
  const [pwd, setPwd] = useState({ old: "", next: "", confirm: "" });
  const [mail, setMail] = useState({ next: "", password: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const doPassword = () => {
    if (pwd.next !== pwd.confirm) { setMsg({ ok: false, text: "La confirmation ne correspond pas au nouveau mot de passe." }); return; }
    const r = changeOwnPassword(pwd.old, pwd.next);
    setMsg({ ok: r.ok, text: r.ok ? "Mot de passe modifié avec succès." : r.error || "Erreur" });
    if (r.ok) setPwd({ old: "", next: "", confirm: "" });
  };
  const doEmail = () => {
    const r = changeOwnEmail(mail.next, mail.password);
    setMsg({ ok: r.ok, text: r.ok ? `E-mail de connexion mis à jour : ${mail.next}` : r.error || "Erreur" });
    if (r.ok) setMail({ next: "", password: "" });
  };

  return (
    <div className="space-y-6">
      {msg && <div className={`rounded-xl px-4 py-3 text-sm font-medium ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{msg.text}</div>}
      {u?.mustChangePassword && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>Vos identifiants ont été générés par votre cabinet : <b>changez ce mot de passe temporaire</b> ci-dessous.</span>
        </div>
      )}
      <Card className="p-6">
        <SectionHeading title="Changer mon mot de passe" subtitle="Minimum 8 caractères. Doit être différent de l'ancien." />
        <div className="grid max-w-md gap-4">
          <Field label="Ancien mot de passe" required><Input type="password" value={pwd.old} onChange={(e) => setPwd({ ...pwd, old: e.target.value })} /></Field>
          <Field label="Nouveau mot de passe" required><Input type="password" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} /></Field>
          <Field label="Confirmer le nouveau mot de passe" required><Input type="password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} /></Field>
          <Button onClick={doPassword} disabled={!pwd.old || !pwd.next || !pwd.confirm}><KeyRound size={15} /> Modifier le mot de passe</Button>
        </div>
      </Card>
      <Card className="p-6">
        <SectionHeading title="Changer mon e-mail de connexion" subtitle="Confirmation par votre mot de passe actuel." />
        <div className="grid max-w-md gap-4">
          <Field label="E-mail actuel"><Input value={email} disabled /></Field>
          <Field label="Nouvel e-mail" required><Input type="email" value={mail.next} onChange={(e) => setMail({ ...mail, next: e.target.value })} /></Field>
          <Field label="Mot de passe actuel" required hint="Pour confirmer votre identité."><Input type="password" value={mail.password} onChange={(e) => setMail({ ...mail, password: e.target.value })} /></Field>
          <Button onClick={doEmail} disabled={!mail.next || !mail.password}><Mail size={15} /> Modifier l&apos;e-mail</Button>
        </div>
      </Card>
    </div>
  );
}
