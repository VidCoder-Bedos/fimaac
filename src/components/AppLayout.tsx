import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Building2, BookOpen, FileText, Receipt, Landmark, Package,
  Users, ShieldCheck, ClipboardList, BarChart3, Sparkles, CreditCard,
  Settings, Bell, LogOut, Menu, X, ChevronDown, AlertTriangle, Boxes, Briefcase,
  Globe2, Database, FileBarChart, FileInput, FileSpreadsheet, CalendarClock, Coins, Megaphone, HardDrive,
} from "lucide-react";
import GlobalSearch from "./GlobalSearch";
import StorageNotice from "./StorageNotice";
import { ErrorBoundary } from "./ErrorBoundary";
import { companiesForUser } from "../lib/scope";
import { useDB } from "../lib/store";
import { useAuth, logout } from "../lib/auth";
import { cn } from "../utils/cn";
import { Avatar } from "./ui";
import { markAllNotificationsRead, markNotificationRead, setCurrentCompany } from "../lib/actions";
import { getStoredCompanyId } from "../lib/companyScope";
import { ROLE_LABELS } from "../lib/permissions";
import { relativeTime } from "../lib/format";

interface NavItem { to: string; label: string; icon: React.ReactNode; end?: boolean }

const WORKSPACE_NAV: { section: string; items: NavItem[] }[] = [
  { section: "Pilotage", items: [
    { to: "/app", label: "Tableau de bord", icon: <LayoutDashboard size={18} />, end: true },
    { to: "/app/entreprises", label: "Entreprises", icon: <Building2 size={18} /> },
    { to: "/app/missions", label: "Missions & tâches", icon: <Briefcase size={18} /> },
    { to: "/app/obligations", label: "Centre des obligations", icon: <CalendarClock size={18} /> },
  ] },
  { section: "Production", items: [
    { to: "/app/comptabilite", label: "Comptabilité", icon: <BookOpen size={18} /> },
    { to: "/app/documents", label: "Documents & OCR", icon: <FileText size={18} /> },
    { to: "/app/demandes", label: "Demandes & modèles", icon: <FileInput size={18} /> },
    { to: "/app/fiscalite", label: "Fiscalité", icon: <Receipt size={18} /> },
    { to: "/app/banque", label: "Banque & rapprochement", icon: <Landmark size={18} /> },
  ] },
  { section: "Gestion", items: [
    { to: "/app/immobilisations", label: "Immobilisations", icon: <Boxes size={18} /> },
    { to: "/app/stocks", label: "Stocks", icon: <Package size={18} /> },
    { to: "/app/paie", label: "Paie & social", icon: <Users size={18} /> },
  ] },
  { section: "Clôture & conformité", items: [
    { to: "/app/atelier-etats", label: "Atelier états financiers", icon: <FileSpreadsheet size={18} /> },
    { to: "/app/atelier-conformite", label: "Atelier conformité & cohérence", icon: <ShieldCheck size={18} /> },
    { to: "/app/liasse", label: "Liasses fiscales GUDEF", icon: <FileSpreadsheet size={18} /> },
    { to: "/app/etats-financiers", label: "États financiers", icon: <FileBarChart size={18} /> },
    { to: "/app/conformite", label: "Centre de conformité", icon: <ShieldCheck size={18} /> },
    { to: "/app/rapports", label: "Rapports", icon: <BarChart3 size={18} /> },
  ] },
  { section: "Intelligence", items: [
    { to: "/app/ia", label: "Assistant IA", icon: <Sparkles size={18} /> },
  ] },
  { section: "Administration", items: [
    { to: "/app/facturation", label: "Facturation & plans", icon: <CreditCard size={18} /> },
    { to: "/app/parametres", label: "Paramètres", icon: <Settings size={18} /> },
  ] },
];

const PORTAL_NAV: NavItem[] = [
  { to: "/portail", label: "Accueil", icon: <LayoutDashboard size={18} />, end: true },
  { to: "/portail/documents", label: "Mes documents", icon: <FileText size={18} /> },
  { to: "/portail/demandes", label: "Centre de demandes", icon: <ClipboardList size={18} /> },
  { to: "/portail/etats", label: "Mes états", icon: <FileBarChart size={18} /> },
  { to: "/portail/factures", label: "Factures", icon: <Receipt size={18} /> },
];

const ADMIN_NAV: NavItem[] = [
  { to: "/admin", label: "Vue d'ensemble", icon: <LayoutDashboard size={18} />, end: true },
  { to: "/admin/cabinets", label: "Cabinets", icon: <Building2 size={18} /> },
  { to: "/admin/utilisateurs", label: "Utilisateurs", icon: <Users size={18} /> },
  { to: "/admin/facturation", label: "Tarifs & revenus", icon: <Coins size={18} /> },
  { to: "/admin/annonces", label: "Annonces", icon: <Megaphone size={18} /> },
  { to: "/admin/reglementaire", label: "Moteur réglementaire", icon: <Globe2 size={18} /> },
  { to: "/admin/donnees", label: "Données plateforme", icon: <HardDrive size={18} /> },
  { to: "/admin/audit", label: "Journal d'audit", icon: <Database size={18} /> },
];

/* Company scope (for cabinet modules) */
const CompanyCtx = createContext<{ id: string | null; set: (id: string) => void }>({ id: null, set: () => {} });
export function useCompanyScope() { return useContext(CompanyCtx); }

function Sidebar({ nav, sectioned, dark }: { nav: { section: string; items: NavItem[] }[] | NavItem[]; sectioned: boolean; dark?: boolean }) {
  return (
    <nav className="relative z-10 flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {sectioned
        ? (nav as { section: string; items: NavItem[] }[]).map((g) => (
            <div key={g.section} className="mb-4">
              <p className={cn("px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider", dark ? "text-slate-500" : "text-slate-500")}>{g.section}</p>
              {g.items.map((it) => <NavBtn key={it.to} item={it} dark={dark} />)}
            </div>
          ))
        : (nav as NavItem[]).map((it) => <NavBtn key={it.to} item={it} dark={dark} />)}
    </nav>
  );
}

function NavBtn({ item, dark }: { item: NavItem; dark?: boolean }) {
  return (
    <NavLink to={item.to} end={item.end}
      className={({ isActive }) => cn("group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
        isActive ? "text-white" : dark ? "text-slate-500 hover:bg-white/5 hover:text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900")}>
      {({ isActive }) => (
        <>
          {isActive && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 shadow-lg shadow-indigo-600/40" transition={{ type: "spring", duration: 0.4 }} />}
          {isActive && <span className="absolute left-0 top-1/2 z-20 h-6 w-1 -translate-y-1/2 rounded-r-full bg-fuchsia-400" />}
          <span className="relative z-10 shrink-0">{item.icon}</span>
          <span className="relative z-10 truncate">{item.label}</span>
        </>
      )}
    </NavLink>
  );
}

function Brand({ subtitle, dark, logoUrl }: { subtitle: string; dark?: boolean; logoUrl?: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-5">
      {logoUrl ? (
        <img src={logoUrl} alt="Logo" className="h-10 w-10 rounded-xl object-cover shadow-lg" />
      ) : (
        <motion.div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 font-black text-white shadow-lg shadow-indigo-500/40"
          initial={{ rotate: -8 }} animate={{ rotate: 0 }} transition={{ type: "spring", stiffness: 200 }}>
          F
          <span className="live-dot absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </motion.div>
      )}
      <div>
        <p className={cn("font-display text-base font-extrabold leading-none tracking-tight", dark ? "text-white" : "text-slate-900")}>FIMAAC</p>
        <p className={cn("text-[10px] font-medium uppercase tracking-wider", dark ? "text-slate-500" : "text-slate-500")}>{subtitle}</p>
      </div>
    </div>
  );
}

function TopBar({ onMenu, title, toolbar }: { onMenu: () => void; title: string; toolbar?: React.ReactNode }) {
  const { user } = useAuth();
  const db = useDB();
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const org = db.organizations.find((o) => o.id === user?.organizationId);
  const myNotifs = db.notifications.filter((n) => !user?.organizationId || n.organizationId === user.organizationId);
  const unread = myNotifs.filter((n) => !n.read).length;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur-xl sm:px-6">
      <button onClick={onMenu} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"><Menu size={20} /></button>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-bold text-slate-900">{title}</h1>
      </div>
      <GlobalSearch />
      {toolbar}

      {/* Notifications */}
      <div className="relative">
        <button onClick={() => { setNotifOpen((v) => !v); setUserOpen(false); }} className="relative rounded-xl p-2.5 text-slate-500 hover:bg-slate-100">
          <Bell size={19} />
          {unread > 0 && <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-700 px-1 text-[10px] font-bold text-white">{unread}</span>}
        </button>
        <AnimatePresence>
          {notifOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
              <motion.div initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.97 }}
                className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <p className="text-sm font-bold text-slate-900">Notifications</p>
                  {unread > 0 && <button onClick={() => org && markAllNotificationsRead(org.id)} className="text-xs font-semibold text-indigo-600">Tout marquer lu</button>}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {myNotifs.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-500">Aucune notification</p>}
                  {myNotifs.slice(0, 8).map((n) => (
                    <button
                      key={n.id}
                      onClick={() => { if (!n.read) markNotificationRead(n.id); }}
                      className={cn("flex w-full gap-3 border-b border-slate-50 px-4 py-3 text-left transition hover:bg-slate-50", !n.read && "bg-indigo-50/40")}
                      aria-label={n.read ? n.title : `${n.title} — non lue, cliquer pour marquer comme lue`}
                    >
                      <span className={cn("mt-0.5 h-2 w-2 shrink-0 rounded-full", n.type === "danger" ? "bg-rose-500" : n.type === "warning" ? "bg-amber-600" : n.type === "success" ? "bg-emerald-600" : "bg-sky-600")} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{n.title}</p>
                        <p className="text-xs text-slate-500">{n.body}</p>
                        <p className="mt-0.5 text-[10px] text-slate-500">{relativeTime(n.createdAt)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* User menu */}
      <div className="relative">
        <button onClick={() => { setUserOpen((v) => !v); setNotifOpen(false); }} className="flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-slate-100">
          <Avatar name={`${user?.firstName} ${user?.lastName}`} color={user?.avatarColor} size={34} />
          <ChevronDown size={15} className="hidden text-slate-500 sm:block" />
        </button>
        <AnimatePresence>
          {userOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setUserOpen(false)} />
              <motion.div initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.97 }}
                className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="text-sm font-bold text-slate-900">{user?.firstName} {user?.lastName}</p>
                  <p className="truncate text-xs text-slate-500">{user?.email}</p>
                  <p className="mt-1 text-[11px] font-semibold text-indigo-600">{ROLE_LABELS[user?.role || "assistant"]}</p>
                  <p className="text-[11px] text-slate-500">{org?.name}</p>
                </div>
                <button onClick={() => { setUserOpen(false); navigate("/app/parametres"); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50"><Settings size={15} /> Paramètres</button>
                <button onClick={() => { logout(); navigate("/login"); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-rose-700 hover:bg-rose-50"><LogOut size={15} /> Déconnexion</button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}

function Shell({ nav, sectioned, subtitle, title, toolbar, logoUrl }: { nav: { section: string; items: NavItem[] }[] | NavItem[]; sectioned: boolean; subtitle: string; title: string; toolbar?: React.ReactNode; logoUrl?: string }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  return (
    <div className="relative flex min-h-screen overflow-hidden">
      {/* Desktop sidebar — light glass matching the platform */}
      <aside className="relative hidden w-64 shrink-0 flex-col overflow-hidden border-r border-white/60 bg-white/65 backdrop-blur-2xl lg:flex">
        <div className="pointer-events-none absolute -left-16 -top-12 h-56 w-56 rounded-full bg-indigo-300/35 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 right-0 h-48 w-48 rounded-full bg-fuchsia-300/25 blur-3xl" />
        <div className="relative z-10"><Brand subtitle={subtitle} logoUrl={logoUrl} /></div>
        <Sidebar nav={nav} sectioned={sectioned} />
        <div className="relative z-10 border-t border-slate-100 p-3">
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-700"><AlertTriangle size={13} /> Données de démonstration — non réglementaires</div>
        </div>
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} />
            <motion.aside className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col overflow-hidden bg-white/90 backdrop-blur-2xl lg:hidden"
              initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}>
              <div className="pointer-events-none absolute -left-16 top-0 h-48 w-48 rounded-full bg-indigo-300/35 blur-3xl" />
              <div className="relative z-10 flex items-center justify-between"><Brand subtitle={subtitle} logoUrl={logoUrl} /><button onClick={() => setMobileOpen(false)} className="mr-3 p-2 text-slate-500 hover:text-slate-700"><X size={20} /></button></div>
              <Sidebar nav={nav} sectioned={sectioned} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Content with aurora */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="aurora aurora-1" style={{ width: 380, height: 380, left: "18%", top: "-8%", background: "radial-gradient(circle,#818cf8,transparent 70%)", opacity: 0.25 }} />
          <div className="aurora aurora-2" style={{ width: 360, height: 360, right: "4%", top: "32%", background: "radial-gradient(circle,#f0abfc,transparent 70%)", opacity: 0.2 }} />
        </div>
        <TopBar onMenu={() => setMobileOpen(true)} title={title} toolbar={toolbar} />
        {/* P0-5 — où vivent les données, combien de place il reste, et si la
            dernière écriture a échoué. Jamais silencieux. */}
        <StorageNotice />
        <main className="relative z-10 flex-1 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
          <motion.div key={location.pathname} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            {/* M3 — tout échec de rendu affiche un panneau de récupération au lieu d'un écran blanc */}
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </motion.div>
        </main>
      </div>
    </div>
  );
}

function pageTitleFromNav(path: string, navItems: NavItem[]): string {
  const found = navItems.find((i) => (i.end ? path === i.to : path.startsWith(i.to)));
  return found?.label || "FIMAAC";
}

function CompanyScopeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const db = useDB();
  const companies = companiesForUser(db, user);
  const [id, setId] = useState<string | null>(() => getStoredCompanyId());
  useEffect(() => {
    if (!companies.some((c) => c.id === id)) setId(companies[0]?.id || null);
  }, [companies, id]);
  const set = (v: string) => { setId(v); setCurrentCompany(v); };
  const current = companies.some((c) => c.id === id) ? id : companies[0]?.id || null;
  return <CompanyCtx.Provider value={{ id: current, set }}>{children}</CompanyCtx.Provider>;
}

function CompanySwitcher() {
  const { user } = useAuth();
  const db = useDB();
  const scope = useCompanyScope();
  const companies = companiesForUser(db, user);
  if (companies.length === 0) return null;
  return (
    <div className="hidden items-center gap-2 sm:flex">
      <Building2 size={16} className="text-slate-500" />
      <select value={scope.id || ""} onChange={(e) => scope.set(e.target.value)} className="h-9 max-w-[180px] truncate rounded-lg border border-slate-200 bg-white px-2 text-sm font-medium text-slate-700 outline-none focus:border-indigo-400">
        {companies.map((c) => <option key={c.id} value={c.id}>{c.tradeName || c.name}</option>)}
      </select>
    </div>
  );
}

export function WorkspaceLayout() {
  const location = useLocation();
  const title = useMemo(() => {
    for (const g of WORKSPACE_NAV) {
      const f = g.items.find((i) => (i.end ? location.pathname === i.to : location.pathname.startsWith(i.to) && i.to !== "/app"));
      if (f) return f.label;
    }
    return "Tableau de bord";
  }, [location.pathname]);
  const db = useDB();
  const { user } = useAuth();
  const org = db.organizations.find((o) => o.id === user?.organizationId);
  return (
    <CompanyScopeProvider>
      <Shell nav={WORKSPACE_NAV} sectioned title={title} subtitle="Espace cabinet" toolbar={<CompanySwitcher />} logoUrl={org?.logoDataUrl} />
    </CompanyScopeProvider>
  );
}

export function PortalLayout() {
  const location = useLocation();
  const db = useDB();
  const { user } = useAuth();
  const org = db.organizations.find((o) => o.id === user?.organizationId);
  return <Shell nav={PORTAL_NAV} sectioned={false} title={pageTitleFromNav(location.pathname, PORTAL_NAV)} subtitle="Portail client" logoUrl={org?.logoDataUrl} />;
}

export function AdminLayout() {
  const location = useLocation();
  const db = useDB();
  const platform = db.organizations.find((o) => o.id === "org-platform");
  return <Shell nav={ADMIN_NAV} sectioned={false} title={pageTitleFromNav(location.pathname, ADMIN_NAV)} subtitle="Console plateforme" logoUrl={platform?.logoDataUrl} />;
}

export function Page({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-7xl">{children}</div>;
}

/** Navigation exposée pour la construction du routeur. */
export const NAV = { WORKSPACE_NAV, PORTAL_NAV, ADMIN_NAV };
