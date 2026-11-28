import { HashRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "./lib/auth";
import { WorkspaceLayout, PortalLayout, AdminLayout } from "./components/Layout";
import Landing from "./pages/Landing";
import { Login, Register } from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import { Companies, CompanyDetail } from "./pages/Companies";
import Accounting from "./pages/Accounting";
import Documents from "./pages/Documents";
import Tax from "./pages/Tax";
import { Bank, FixedAssets, Inventory, Payroll } from "./pages/Operations";
import { Financials, Reports, Compliance } from "./pages/Reporting";
import Missions from "./pages/Missions";
import AIAssistant from "./pages/AIAssistant";
import { Settings, Billing } from "./pages/Account";
import Requests from "./pages/Requests";
import Liasse from "./pages/Liasse";
import StatementsWorkshop from "./pages/StatementsWorkshop";
import ConformityWorkshop from "./pages/ConformityWorkshop";
import Obligations from "./pages/Obligations";
import { AdminOverview, AdminCabinets, AdminUsers, AdminRegulatory, AdminAudit, AdminBilling, AdminAnnouncements, AdminData } from "./pages/Admin";
import { PortalHome, PortalDocuments, PortalRequests, PortalStatements, PortalInvoices } from "./pages/Portal";
import WorkbookExtractor from "./pages/WorkbookExtractor";
import { changeOwnPassword } from "./lib/actions";
import { Card, Button, Field, Input } from "./components/ui";
import Toaster from "./components/Toaster";
import { KeyRound, AlertTriangle } from "lucide-react";
import type { User } from "./lib/types";

function homeFor(u: User | null): string {
  if (!u) return "/login";
  if (u.role === "super_admin") return "/admin";
  if (u.userType === "client") return "/portail";
  return "/app";
}

function Require({ allow }: { allow: (u: User) => boolean }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!allow(user)) return <Navigate to={homeFor(user)} replace />;
  return <Outlet />;
}

/** LOT 5 — bloque l'accès tant que le mot de passe temporaire n'a pas été changé. */
function PasswordGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.mustChangePassword) return <ForceChangePassword />;
  return <>{children}</>;
}

function Root() {
  const { user } = useAuth();
  return user ? <Navigate to={homeFor(user)} replace /> : <Landing />;
}

/**
 * LOT 5 — Écran bloquant de première connexion : les identifiants générés par le
 * cabinet imposent un changement de mot de passe avant tout accès aux modules.
 */
function ForceChangePassword() {
  const [old, setOld] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const submit = () => {
    if (next !== confirm) { setError("La confirmation ne correspond pas."); return; }
    const r = changeOwnPassword(old, next);
    if (!r.ok) { setError(r.error || "Erreur"); return; }
    // Le store notifie les abonnés : user.mustChangePassword passe à false et les
    // Routes se rendent normalement.
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <Card className="w-full max-w-md p-8">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"><KeyRound size={24} /></div>
        <h1 className="text-xl font-black tracking-tight text-slate-900">Changez votre mot de passe</h1>
        <p className="mt-2 text-sm text-slate-500">
          Vos identifiants ont été générés par votre cabinet. Pour sécuriser votre compte,
          définissez votre propre mot de passe avant de continuer.
        </p>
        {error && <div className="mt-4 flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"><AlertTriangle size={15} className="mt-0.5 shrink-0" /> {error}</div>}
        <div className="mt-5 space-y-4">
          <Field label="Mot de passe temporaire" required><Input type="password" value={old} onChange={(e) => setOld(e.target.value)} /></Field>
          <Field label="Nouveau mot de passe" required hint="Minimum 8 caractères."><Input type="password" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
          <Field label="Confirmer le nouveau mot de passe" required><Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
          <Button className="w-full" size="lg" onClick={submit} disabled={!old || !next || !confirm}>Enregistrer et continuer</Button>
        </div>
      </Card>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Toaster />
      <PasswordGate>
        <Routes>
        <Route path="/" element={<Root />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/extractor" element={<WorkbookExtractor />} />
        {/* Cabinet / Admin workspace */}
        <Route element={<Require allow={(u) => u.userType === "cabinet" || u.role === "super_admin"} />}>
          <Route path="/app" element={<WorkspaceLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="entreprises" element={<Companies />} />
            <Route path="entreprises/:id" element={<CompanyDetail />} />
            <Route path="comptabilite" element={<Accounting />} />
            <Route path="documents" element={<Documents />} />
            <Route path="fiscalite" element={<Tax />} />
            <Route path="banque" element={<Bank />} />
            <Route path="demandes" element={<Requests />} />
            <Route path="atelier-etats" element={<StatementsWorkshop />} />
            <Route path="atelier-conformite" element={<ConformityWorkshop />} />
            <Route path="liasse" element={<Liasse />} />
            <Route path="immobilisations" element={<FixedAssets />} />
            <Route path="stocks" element={<Inventory />} />
            <Route path="paie" element={<Payroll />} />
            <Route path="etats-financiers" element={<Financials />} />
            <Route path="missions" element={<Missions />} />
            <Route path="obligations" element={<Obligations />} />
            <Route path="conformite" element={<Compliance />} />
            <Route path="rapports" element={<Reports />} />
            <Route path="ia" element={<AIAssistant />} />
            <Route path="facturation" element={<Billing />} />
            <Route path="parametres" element={<Settings />} />
          </Route>
        </Route>
        {/* Platform admin */}
        <Route element={<Require allow={(u) => u.role === "super_admin"} />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminOverview />} />
            <Route path="cabinets" element={<AdminCabinets />} />
            <Route path="utilisateurs" element={<AdminUsers />} />
            <Route path="reglementaire" element={<AdminRegulatory />} />
            <Route path="audit" element={<AdminAudit />} />
            <Route path="facturation" element={<AdminBilling />} />
            <Route path="annonces" element={<AdminAnnouncements />} />
            <Route path="donnees" element={<AdminData />} />
          </Route>
        </Route>
        {/* Client portal */}
        <Route element={<Require allow={(u) => u.userType === "client"} />}>
          <Route path="/portail" element={<PortalLayout />}>
            <Route index element={<PortalHome />} />
            <Route path="documents" element={<PortalDocuments />} />
            <Route path="demandes" element={<PortalRequests />} />
            <Route path="etats" element={<PortalStatements />} />
            <Route path="factures" element={<PortalInvoices />} />
            <Route path="parametres" element={<Settings />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </PasswordGate>
    </HashRouter>
  );
}
