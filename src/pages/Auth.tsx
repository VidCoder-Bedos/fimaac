import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ArrowLeft, Building2, Users, Lock } from "lucide-react";
import { Button, Field, Input, Select } from "../components/ui";
import { login, registerCabinet, registerClient } from "../lib/auth";
import { getDB, useDB } from "../lib/store";

function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left visual */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-700 via-violet-700 to-fuchsia-700 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-10 right-0 h-72 w-72 rounded-full bg-fuchsia-400/20 blur-3xl" />
        </div>
        <Link to="/" className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 font-black text-white backdrop-blur">F</div>
          <span className="text-xl font-black text-white">FIMAAC</span>
        </Link>
        <motion.div className="relative" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <h2 className="text-4xl font-black leading-tight text-white">Le système d'exploitation du cabinet comptable.</h2>
          <p className="mt-4 max-w-md text-indigo-100">Comptabilité SYSCOHADA, fiscalité togolaise, documents, paie, états financiers et conformité — réunis.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            {["Multi-tenant", "SYSCOHADA révisé", "IA contrôlée", "Audit trail"].map((t) => (
              <span key={t} className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium text-white backdrop-blur">{t}</span>
            ))}
          </div>
        </motion.div>
        <p className="relative text-xs text-indigo-200">© {new Date().getFullYear()} FIMAAC — Togo 🇹🇬 · XOF</p>
      </div>
      {/* Right form */}
      <div className="flex items-center justify-center bg-slate-50 px-4 py-10 sm:px-8">
        <motion.div className="w-full max-w-md" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-indigo-600"><ArrowLeft size={15} /> Accueil</Link>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          <div className="mt-6">{children}</div>
          <div className="mt-6 text-center text-sm text-slate-500">{footer}</div>
        </motion.div>
      </div>
    </div>
  );
}

function routeFor(userId: string): string {
  const u = getDB().users.find((x) => x.id === userId);
  if (!u) return "/login";
  if (u.role === "super_admin") return "/admin";
  if (u.userType === "client") return "/portail";
  return "/app";
}

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = login(email, password);
    setLoading(false);
    if (!res.ok) { setError(res.error || "Erreur"); return; }
    const u = getDB().users.find((x) => x.email.toLowerCase() === email.toLowerCase());
    navigate(u ? routeFor(u.id) : "/app");
  };

  return (
    <AuthShell title="Connexion" subtitle="Accédez à votre espace FIMAAC." footer={<>Pas encore de compte ? <Link to="/register" className="font-semibold text-indigo-600">Créer un compte</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        {error && <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}
        <Field label="Adresse e-mail"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@cabinet.tg" required /></Field>
        <Field label="Mot de passe"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required /></Field>
        <Button type="submit" className="w-full" size="lg" disabled={loading}>{loading ? "Connexion…" : "Se connecter"} <ArrowRight size={18} /></Button>
      </form>
    </AuthShell>
  );
}

export function Register() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"cabinet" | "client">("cabinet");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [f, setF] = useState({ orgName: "", firstName: "", lastName: "", email: "", password: "", legalForm: "SARL" });
  // LOT 4 — cabinet choisi parmi ceux inscrits sur la plateforme (obligatoire)
  const db = useDB();
  const cabinets = db.organizations.filter((o) => o.type === "cabinet");
  const [cabinetId, setCabinetId] = useState("");
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = mode === "cabinet"
      ? registerCabinet({ cabinetName: f.orgName, legalForm: f.legalForm, email: f.email, password: f.password, firstName: f.firstName, lastName: f.lastName })
      : registerClient({ companyName: f.orgName, legalForm: f.legalForm, email: f.email, password: f.password, firstName: f.firstName, lastName: f.lastName, cabinetOrganizationId: cabinetId });
    setLoading(false);
    if (!res.ok) { setError(res.error || "Erreur"); return; }
    navigate(mode === "client" ? "/portail" : "/app");
  };

  return (
    <AuthShell
      title="Créer un compte"
      subtitle="Inscription en tant que cabinet ou client."
      footer={<>Déjà inscrit ? <Link to="/login" className="font-semibold text-indigo-600">Se connecter</Link></>}
    >
      <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
        {([["cabinet", "Cabinet", Building2], ["client", "Client", Users]] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setMode(id)} className={`relative flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all ${mode === id ? "text-indigo-700" : "text-slate-500"}`}>
            {mode === id && <motion.span layoutId="reg-tab" className="absolute inset-0 rounded-lg bg-white shadow-sm" />}
            <span className="relative z-10 flex items-center gap-2"><Icon size={15} /> {label}</span>
          </button>
        ))}
      </div>
      {cabinets.length === 0 && (
        <div className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-700">
          Aucun cabinet n&apos;est encore inscrit sur la plateforme. Créez d&apos;abord un compte cabinet.
        </div>
      )}
      <form onSubmit={submit} className="space-y-4">
        {error && <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}
        <Field label={mode === "cabinet" ? "Nom du cabinet" : "Nom de l'entreprise"} required>
          <Input value={f.orgName} onChange={(e) => set("orgName", e.target.value)} placeholder={mode === "cabinet" ? "Cabinet Dupont & Associés" : "Ma Société SARL"} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prénom" required><Input value={f.firstName} onChange={(e) => set("firstName", e.target.value)} required /></Field>
          <Field label="Nom" required><Input value={f.lastName} onChange={(e) => set("lastName", e.target.value)} required /></Field>
        </div>
        <Field label="Forme juridique">
          <Select value={f.legalForm} onChange={(e) => set("legalForm", e.target.value)}>
            <option>SARL</option><option>SUARL</option><option>SA</option><option>SNC</option><option>Entreprise individuelle</option>
          </Select>
        </Field>
        {/* LOT 4 — la rubrique « Choisir le cabinet » n'existe QUE pour une entreprise.
            Un cabinet qui s'inscrit ne choisit pas un autre cabinet (il EST le cabinet). */}
        {mode === "client" && (
          <Field label="Choisir le cabinet" required hint="Le cabinet qui gérera votre comptabilité et vos déclarations.">
            <Select value={cabinetId} onChange={(e) => setCabinetId(e.target.value)}>
              <option value="">— Sélectionnez votre cabinet —</option>
              {cabinets.map((c) => <option key={c.id} value={c.id}>{c.name}{c.city ? ` · ${c.city}` : ""}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Adresse e-mail" required><Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="vous@cabinet.tg" required /></Field>
        <Field label="Mot de passe" hint="Minimum 8 caractères." required>
          <div className="relative"><Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><Input type="password" className="pl-9" value={f.password} onChange={(e) => set("password", e.target.value)} placeholder="••••••••" required /></div>
        </Field>
        {/* Correction : `!cabinetId` ne bloque que le mode CLIENT (le cabinet qui
            s'inscrit ne choisit pas de cabinet — il EST le cabinet). Avant, le
            bouton était bloqué en mode cabinet car cabinetId restait vide. */}
        <Button type="submit" className="w-full" size="lg" disabled={loading || (mode === "client" && !cabinetId)}>{loading ? "Création…" : "Créer mon compte"} <ArrowRight size={18} /></Button>
      </form>
    </AuthShell>
  );
}
