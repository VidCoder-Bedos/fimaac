import { useState } from "react";
import { verifyAuditChain } from "../lib/auditChain";
import { useDB } from "../lib/store";
import { Page } from "../components/Layout";
import { Card, Badge, StatusBadge, EmptyState, StatCard, SectionHeading, Avatar, Button, Field, Input, Select, Modal, ProgressBar } from "../components/ui";
import { ROLE_LABELS } from "../lib/permissions";
import { fcfa, fcfaCompact, formatDateTime, formatDate } from "../lib/format";
import { toggleCabinetSuspension, setPlatformLogo, setCabinetLogo, publishAnnouncement, updatePlanPrice, DEFAULT_PLANS, type PlatformPlan } from "../lib/actions";
import { Building2, Users, Database, CreditCard, Globe2, TrendingUp, ShieldAlert, Activity, Ban, Play, Image, Megaphone, FileText, ClipboardList, Receipt, HardDrive, Download, Search, ArrowUpDown, Mail, Phone, MapPin, Check, Layers, BarChart3, ShieldCheck, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { toast } from "../lib/toast";

// ============================================================================
// HELPERS PARTAGÉS
// ============================================================================
function cabinetStats(db: ReturnType<typeof useDB>, cabinetId: string) {
  const companies = db.companies.filter((c) => c.cabinetOrganizationId === cabinetId);
  const users = db.users.filter((u) => u.organizationId === cabinetId);
  const entries = companies.reduce((n, c) => n + db.entries.filter((e) => e.companyId === c.id).length, 0);
  const docs = companies.reduce((n, c) => n + db.documents.filter((d) => d.companyId === c.id).length, 0);
  const sub = db.subscriptions.find((s) => s.organizationId === cabinetId);
  return { companies, users, entries, docs, sub };
}

/** Logo d'une organisation : image personnalisée sinon initiales colorées. */
function OrgLogo({ org, size = 40 }: { org: { name: string; logoColor: string; logoDataUrl?: string }; size?: number }) {
  if (org.logoDataUrl) return <img src={org.logoDataUrl} alt={org.name} className="rounded-xl object-cover" style={{ width: size, height: size }} />;
  return <div className="flex items-center justify-center rounded-xl font-bold text-white" style={{ width: size, height: size, background: org.logoColor, fontSize: size * 0.38 }}>{org.name.slice(0, 2).toUpperCase()}</div>;
}

/** Téléverse un logo → data URL. */
function LogoPicker({ orgId, current, onDone }: { orgId: string; current?: string; onDone?: () => void }) {
  const [preview, setPreview] = useState<string | null>(current || null);
  const pick = (f: File | null) => {
    if (!f) return;
    if (f.size > 500_000) { toast("Logo trop volumineux (max 500 Ko). Utilisez un PNG ou SVG compressé."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setPreview(url);
      if (orgId === "org-platform") setPlatformLogo(url); else setCabinetLogo(orgId, url);
      onDone?.();
    };
    reader.readAsDataURL(f);
  };
  return (
    <div className="flex items-center gap-3">
      <label className="cursor-pointer">
        {preview ? <img src={preview} alt="Logo" className="h-12 w-12 rounded-xl object-cover ring-1 ring-slate-200" /> : <div className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-dashed border-slate-200 text-slate-300"><Image size={20} /></div>}
        <input type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0] || null)} />
      </label>
      <div><p className="text-xs font-semibold text-slate-600">Logo</p><p className="text-[10px] text-slate-400">PNG/SVG · max 500 Ko</p></div>
    </div>
  );
}

// ============================================================================
// 1. VUE D'ENSEMBLE PLATEFORME
// ============================================================================
export function AdminOverview() {
  const db = useDB();
  const cabinets = db.organizations.filter((o) => o.type === "cabinet");
  const clients = db.companies;
  const mrr = db.subscriptions.reduce((s, x) => s + x.monthlyAmount, 0);
  const recentLogs = [...db.auditLogs].slice(0, 8);
  const platform = db.organizations.find((o) => o.id === "org-platform");
  const totalEntries = db.entries.length;
  const totalDocs = db.documents.length;
  const suspended = cabinets.filter((c) => db.subscriptions.find((s) => s.organizationId === c.id)?.status === "past_due").length;

  return (
    <Page>
      <div className="mb-5 flex items-center gap-4">
        {platform && <OrgLogo org={platform} size={48} />}
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-900">Administration plateforme</h2>
          <p className="text-sm text-slate-500">FIMAAC — console d&apos;administration</p>
        </div>
        {platform && <div className="ml-auto"><LogoPicker orgId="org-platform" current={platform.logoDataUrl} /></div>}
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Cabinets" value={String(cabinets.length)} icon={<Building2 size={18} />} tone="indigo" sub={`${suspended} suspendu(s)`} />
        <StatCard title="Entreprises gérées" value={String(clients.length)} icon={<Database size={18} />} tone="violet" />
        <StatCard title="Utilisateurs" value={String(db.users.length)} icon={<Users size={18} />} tone="sky" />
        <StatCard title="MRR" value={fcfa(mrr)} icon={<TrendingUp size={18} />} tone="emerald" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Écritures" value={String(totalEntries)} icon={<FileText size={18} />} tone="indigo" sub="toutes entreprises" />
        <StatCard title="Documents" value={String(totalDocs)} icon={<ClipboardList size={18} />} tone="sky" sub="pièces téléversées" />
        <StatCard title="Abonnements" value={String(db.subscriptions.length)} icon={<CreditCard size={18} />} tone="emerald" />
        <StatCard title="Événements audit" value={String(db.auditLogs.length)} icon={<Activity size={18} />} tone="amber" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-5"><SectionHeading title="Cabinets récents" action={<Button size="sm" variant="ghost" onClick={() => window.location.hash = "#/admin/cabinets"}>Tout voir</Button>} />
          <div className="space-y-2">{cabinets.slice(0, 5).map((c) => { const st = cabinetStats(db, c.id); return (
            <div key={c.id} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5"><OrgLogo org={c} size={36} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{c.name}</p><p className="text-xs text-slate-400">{st.companies.length} entreprise(s) · {st.users.length} utilisateur(s)</p></div><Badge tone={st.sub?.status === "past_due" ? "rose" : "emerald"}>{st.sub?.status === "past_due" ? "Suspendu" : "Actif"}</Badge></div>
          ); })}</div>
        </Card>
        <Card className="p-5"><SectionHeading title="Activité système" />
          <div className="space-y-2">{recentLogs.map((l) => { const u = db.users.find((x) => x.id === l.userId); return (
            <div key={l.id} className="flex items-start gap-2 text-xs"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" /><div><p className="text-slate-700"><span className="font-semibold">{u?.firstName || "Système"}</span> · {l.action.replace(/_/g, " ").toLowerCase()}</p><p className="text-slate-400">{formatDateTime(l.createdAt)} · {l.after}</p></div></div>
          ); })}</div>
        </Card>
      </div>
    </Page>
  );
}

// ============================================================================
// 2. CABINETS (détaché des utilisateurs — avec fiche détaillée)
// ============================================================================
export function AdminCabinets() {
  const db = useDB();
  const cabinets = db.organizations.filter((o) => o.type === "cabinet");
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<string | null>(null);
  const list = cabinets.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()));
  const current = cabinets.find((c) => c.id === detail);

  return (
    <Page>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-black tracking-tight text-slate-900">Cabinets clients</h2><p className="text-sm text-slate-500">{cabinets.length} cabinet(s) inscrit(s) — tenants de la plateforme</p></div>
        <div className="relative w-64"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><Input className="pl-9" placeholder="Rechercher un cabinet…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      {!current ? (
        list.length === 0 ? <EmptyState icon={<Building2 />} title="Aucun cabinet" /> : (
          <div className="space-y-3">{list.map((c) => {
            const st = cabinetStats(db, c.id);
            const suspended = st.sub?.status === "past_due";
            return (
              <Card key={c.id} hover className="cursor-pointer p-5" onClick={() => setDetail(c.id)}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <OrgLogo org={c} size={44} />
                    <div>
                      <p className="font-bold text-slate-900">{c.name}</p>
                      <p className="flex items-center gap-2 text-xs text-slate-400"><MapPin size={11} /> {c.city || "—"} · {c.country} {c.email ? <><Mail size={11} /> {c.email}</> : null}{c.phone ? <><Phone size={11} /> {c.phone}</> : null}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {suspended && <Badge tone="rose"><Ban size={11} /> Suspendu</Badge>}
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div><p className="text-xs text-slate-400">Entreprises</p><p className="font-bold text-slate-800">{st.companies.length}</p></div>
                      <div><p className="text-xs text-slate-400">Users</p><p className="font-bold text-slate-800">{st.users.length}</p></div>
                      <div><p className="text-xs text-slate-400">Plan</p><p className="text-xs font-bold capitalize text-indigo-600">{st.sub?.plan || c.plan}</p></div>
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs sm:grid-cols-4">
                  <div><span className="text-slate-400">Écritures :</span> <b className="text-slate-700">{st.entries}</b></div>
                  <div><span className="text-slate-400">Documents :</span> <b className="text-slate-700">{st.docs}</b></div>
                  <div><span className="text-slate-400">MRR :</span> <b className="text-emerald-600">{fcfa(st.sub?.monthlyAmount || 0)}</b></div>
                  <div><span className="text-slate-400">Depuis :</span> <b className="text-slate-700">{formatDate(c.createdAt)}</b></div>
                </div>
              </Card>
            );
          })}</div>
        )
      ) : (
        <CabinetDetail cabinetId={current.id} onBack={() => setDetail(null)} />
      )}
    </Page>
  );
}

function CabinetDetail({ cabinetId, onBack }: { cabinetId: string; onBack: () => void }) {
  const db = useDB();
  const org = db.organizations.find((o) => o.id === cabinetId);
  const st = cabinetStats(db, cabinetId);
  const suspended = st.sub?.status === "past_due";
  if (!org) return null;
  return (
    <div>
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-indigo-600"><ArrowUpDown size={14} className="rotate-90" /> Tous les cabinets</button>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <OrgLogo org={org} size={56} />
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900">{org.name}</h2>
            <p className="text-sm text-slate-500">{org.legalForm || "—"} · {org.city || "—"} · {org.email}</p>
          </div>
        </div>
        <Button variant={suspended ? "success" : "danger"} size="sm" onClick={() => { const r = toggleCabinetSuspension(cabinetId); if (r.ok) toast(r.suspended ? "Cabinet suspendu." : "Cabinet réactivé."); }}>
          {suspended ? <><Play size={14} /> Réactiver</> : <><Ban size={14} /> Suspendre</>}
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Entreprises" value={String(st.companies.length)} icon={<Database size={18} />} tone="violet" />
        <StatCard title="Utilisateurs" value={String(st.users.length)} icon={<Users size={18} />} tone="sky" />
        <StatCard title="Écritures" value={String(st.entries)} icon={<FileText size={18} />} tone="indigo" />
        <StatCard title="MRR" value={fcfa(st.sub?.monthlyAmount || 0)} icon={<TrendingUp size={18} />} tone="emerald" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <SectionHeading title="Branding du cabinet" subtitle="Logo visible par ses entreprises et sur ses documents" />
          <div className="flex items-center gap-4"><LogoPicker orgId={cabinetId} current={org.logoDataUrl} /><div className="flex-1"><p className="text-sm font-semibold text-slate-800">{org.name}</p><p className="text-xs text-slate-400">Le logo apparaît sur le portail de ses entreprises.</p></div></div>
        </Card>
        <Card className="p-5">
          <SectionHeading title="Abonnement" />
          <div className="space-y-2 text-sm">
            <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2"><span className="text-slate-500">Plan</span><b className="capitalize text-indigo-600">{st.sub?.plan || org.plan}</b></div>
            <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2"><span className="text-slate-500">Montant mensuel</span><b className="text-slate-800">{fcfa(st.sub?.monthlyAmount || 0)}</b></div>
            <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2"><span className="text-slate-500">Statut</span><StatusBadge status={st.sub?.status || "active"} /></div>
            <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2"><span className="text-slate-500">Renouvellement</span><b className="text-slate-800">{formatDate(st.sub?.renewsAt)}</b></div>
          </div>
        </Card>
      </div>
      <Card className="mt-6 p-5">
        <SectionHeading title={`Entreprises gérées (${st.companies.length})`} subtitle="Portefeuille du cabinet" />
        {st.companies.length === 0 ? <EmptyState icon={<Database />} title="Aucune entreprise" /> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase text-slate-400"><th className="px-3 py-2">Entreprise</th><th className="px-3 py-2">NIF</th><th className="px-3 py-2">Régime</th><th className="px-3 py-2 text-right">Écritures</th><th className="px-3 py-2">Accès portail</th></tr></thead>
            <tbody>{st.companies.map((c) => { const hasAccess = db.users.some((u) => u.companyId === c.id); return (
              <tr key={c.id} className="border-b border-slate-50"><td className="px-3 py-2.5 font-medium text-slate-800">{c.tradeName || c.name}</td><td className="px-3 py-2.5 text-slate-500">{c.nif || "—"}</td><td className="px-3 py-2.5"><Badge tone="sky">{c.taxRegime.toUpperCase()}</Badge></td><td className="px-3 py-2.5 text-right tabular-nums">{db.entries.filter((e) => e.companyId === c.id).length}</td><td className="px-3 py-2.5">{hasAccess ? <Badge tone="emerald"><Check size={11} /> Créé</Badge> : <Badge tone="amber">À créer</Badge>}</td></tr>
            ); })}</tbody>
          </table></div>
        )}
      </Card>
      <Card className="mt-6 p-5">
        <SectionHeading title={`Utilisateurs du cabinet (${st.users.length})`} />
        <div className="space-y-2">{st.users.map((u) => (
          <div key={u.id} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5"><Avatar name={`${u.firstName} ${u.lastName}`} color={u.avatarColor} size={32} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{u.firstName} {u.lastName}</p><p className="truncate text-xs text-slate-400">{u.email}</p></div><Badge tone="slate">{ROLE_LABELS[u.role]}</Badge><Badge tone={u.active ? "emerald" : "rose"}>{u.active ? "Actif" : "Inactif"}</Badge></div>
        ))}</div>
      </Card>
    </div>
  );
}

// ============================================================================
// 3. UTILISATEURS (tous types confondus, détaché des cabinets)
// ============================================================================
export function AdminUsers() {
  const db = useDB();
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const list = db.users.filter((u) => {
    if (typeFilter !== "all" && u.userType !== typeFilter) return false;
    if (q) { const ql = q.toLowerCase(); return u.email.toLowerCase().includes(ql) || `${u.firstName} ${u.lastName}`.toLowerCase().includes(ql); }
    return true;
  });
  const counts = { admin: db.users.filter((u) => u.userType === "admin").length, cabinet: db.users.filter((u) => u.userType === "cabinet").length, client: db.users.filter((u) => u.userType === "client").length };
  return (
    <Page>
      <div className="mb-5"><h2 className="text-xl font-black tracking-tight text-slate-900">Utilisateurs</h2><p className="text-sm text-slate-500">{db.users.length} compte(s) — tous types confondus</p></div>
      <div className="mb-4 grid grid-cols-3 gap-3">
        <StatCard title="Admins plateforme" value={String(counts.admin)} icon={<ShieldAlert size={18} />} tone="rose" />
        <StatCard title="Cabinets" value={String(counts.cabinet)} icon={<Building2 size={18} />} tone="indigo" />
        <StatCard title="Entreprises clientes" value={String(counts.client)} icon={<Users size={18} />} tone="amber" />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 max-w-xs"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><Input className="pl-9" placeholder="Rechercher (nom, e-mail)…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-48">
          <option value="all">Tous types</option><option value="admin">Admins</option><option value="cabinet">Cabinets</option><option value="client">Entreprises</option>
        </Select>
        <Badge tone="slate">{list.length}</Badge>
      </div>
      <Card className="overflow-x-auto p-5"><table className="w-full text-sm">
        <thead><tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase text-slate-400"><th className="px-3 py-2">Utilisateur</th><th className="px-3 py-2">E-mail</th><th className="px-3 py-2">Rôle</th><th className="px-3 py-2">Organisation</th><th className="px-3 py-2">Entreprise</th><th className="px-3 py-2">Dernière connexion</th><th className="px-3 py-2">Statut</th></tr></thead>
        <tbody>{list.map((u) => { const org = db.organizations.find((o) => o.id === u.organizationId); const co = db.companies.find((c) => c.id === u.companyId); return (
          <tr key={u.id} className="border-b border-slate-50"><td className="px-3 py-2.5"><div className="flex items-center gap-2"><Avatar name={`${u.firstName} ${u.lastName}`} color={u.avatarColor} size={28} /><span className="font-medium text-slate-800">{u.firstName} {u.lastName}</span></div></td><td className="px-3 py-2.5 text-slate-500">{u.email}</td><td className="px-3 py-2.5"><Badge tone="indigo">{ROLE_LABELS[u.role]}</Badge></td><td className="px-3 py-2.5 text-slate-500">{org?.name}</td><td className="px-3 py-2.5 text-slate-500">{co?.tradeName || co?.name || "—"}</td><td className="px-3 py-2.5 text-slate-400">{u.lastLoginAt ? formatDate(u.lastLoginAt) : "Jamais"}</td><td className="px-3 py-2.5">{u.active ? <Badge tone="emerald">Actif</Badge> : <Badge tone="rose">Inactif</Badge>}</td></tr>
        ); })}</tbody>
      </table></Card>
    </Page>
  );
}

// ============================================================================
// 4. TARIFS & REVENUS (définir les tarifs + revenus MRR)
// ============================================================================
export function AdminBilling() {
  const db = useDB();
  const mrr = db.subscriptions.reduce((s, x) => s + x.monthlyAmount, 0);
  const [editing, setEditing] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>(Object.fromEntries(DEFAULT_PLANS.map((p) => [p.id, String(p.monthlyPrice)])));
  const [announce, setAnnounce] = useState({ title: "", body: "", audience: "cabinets" as "all" | "cabinets" | "clients" });
  const [announceOpen, setAnnounceOpen] = useState(false);
  const savePrice = (planId: string) => { const v = parseInt(prices[planId] || "0", 10); if (Number.isFinite(v)) { updatePlanPrice(planId as PlatformPlan["id"], v); setEditing(null); } };
  const mrrByPlan = DEFAULT_PLANS.map((p) => ({ ...p, count: db.subscriptions.filter((s) => s.plan === p.id).length }));
  return (
    <Page>
      <div className="mb-5"><h2 className="text-xl font-black tracking-tight text-slate-900">Tarifs & revenus</h2><p className="text-sm text-slate-500">Définissez les tarifs, suivez les revenus, publiez des annonces</p></div>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="MRR total" value={fcfa(mrr)} icon={<TrendingUp size={18} />} tone="emerald" />
        <StatCard title="ARR projeté" value={fcfaCompact(mrr * 12)} icon={<BarChart3 size={18} />} tone="indigo" sub="MRR × 12" />
        <StatCard title="Abonnements" value={String(db.subscriptions.length)} icon={<CreditCard size={18} />} tone="sky" />
        <StatCard title="Factures" value={String(db.invoices.length)} icon={<Receipt size={18} />} tone="violet" />
      </div>
      <Card className="mb-6 p-5">
        <SectionHeading title="Définition des tarifs" subtitle="Modifiez le prix mensuel de chaque plan — impacte les prochains renouvellements" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {DEFAULT_PLANS.map((p) => (
            <Card key={p.id} hover className={`p-4 ${p.id === "pro" ? "ring-2 ring-indigo-400" : ""}`}>
              <div className="flex items-center justify-between"><p className="text-sm font-bold uppercase text-indigo-600">{p.name}</p>{editing === p.id ? null : <Badge tone={p.active ? "emerald" : "slate"}>{p.active ? "Vendable" : "Désactivé"}</Badge>}</div>
              {editing === p.id ? (
                <div className="mt-3 space-y-2">
                  <Input value={prices[p.id]} onChange={(e) => setPrices({ ...prices, [p.id]: e.target.value })} inputMode="numeric" className="h-9" />
                  <div className="flex gap-1"><Button size="sm" onClick={() => savePrice(p.id)}><Check size={13} /> OK</Button><Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Annuler</Button></div>
                </div>
              ) : (
                <div className="mt-2"><p className="text-2xl font-black text-slate-900">{fcfa(p.monthlyPrice)}<span className="text-xs font-normal text-slate-400">/mois</span></p><p className="mt-1 text-xs text-slate-400">{mrrByPlan.find((x) => x.id === p.id)?.count || 0} abonné(s)</p><button onClick={() => setEditing(p.id)} className="mt-2 text-xs font-semibold text-indigo-600">Modifier le tarif</button></div>
              )}
              <ul className="mt-3 space-y-1">{p.features.map((f) => <li key={f} className="flex items-center gap-1.5 text-[11px] text-slate-500"><Check size={11} className="text-emerald-500" /> {f}</li>)}</ul>
              <div className="mt-2 border-t border-slate-100 pt-2 text-[11px] text-slate-400"><span>Entreprises : {p.maxCompanies ?? "∞"}</span> · <span>Users : {p.maxUsers ?? "∞"}</span></div>
            </Card>
          ))}
        </div>
      </Card>
      <Card className="mb-6 p-5">
        <SectionHeading title="Répartition des revenus par plan" />
        <div className="space-y-3">
          {mrrByPlan.map((p) => { const rev = p.count * p.monthlyPrice; const pct = mrr > 0 ? Math.round((rev / mrr) * 100) : 0; return (
            <div key={p.id}><div className="mb-1 flex justify-between text-sm"><span className="font-semibold text-slate-700">{p.name} <span className="text-xs text-slate-400">({p.count} abonné(s))</span></span><span className="font-bold tabular-nums text-slate-800">{fcfa(rev)} <span className="text-xs text-slate-400">({pct}%)</span></span></div><ProgressBar value={pct} tone={p.id === "pro" ? "indigo" : p.id === "enterprise" ? "violet" : "emerald"} /></div>
          ); })}
        </div>
      </Card>
      <Card className="p-5">
        <SectionHeading title="Factures émises" />
        {db.invoices.length === 0 ? <p className="text-sm text-slate-400">Aucune facture.</p> : (
          <div className="space-y-2">{db.invoices.map((inv) => { const org = db.organizations.find((o) => o.id === inv.organizationId); return (
            <div key={inv.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3"><div><p className="font-semibold text-slate-800">{inv.number}</p><p className="text-xs text-slate-400">{org?.name} · {inv.plan}</p></div><div className="flex items-center gap-3"><span className="font-bold tabular-nums text-slate-800">{fcfa(inv.amount)}</span><StatusBadge status={inv.status} /></div></div>
          ); })}</div>
        )}
      </Card>
      <Modal open={announceOpen} onClose={() => setAnnounceOpen(false)} title="Publier une annonce">
        <div className="space-y-4">
          <Field label="Titre" required><Input value={announce.title} onChange={(e) => setAnnounce({ ...announce, title: e.target.value })} /></Field>
          <Field label="Message" required><Input value={announce.body} onChange={(e) => setAnnounce({ ...announce, body: e.target.value })} /></Field>
          <Field label="Audience"><Select value={announce.audience} onChange={(e) => setAnnounce({ ...announce, audience: e.target.value as "all" | "cabinets" | "clients" })}><option value="all">Tous</option><option value="cabinets">Cabinets uniquement</option><option value="clients">Entreprises uniquement</option></Select></Field>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setAnnounceOpen(false)}>Annuler</Button><Button onClick={() => { if (announce.title && announce.body) { publishAnnouncement(announce.title, announce.body, announce.audience); setAnnounceOpen(false); setAnnounce({ title: "", body: "", audience: "cabinets" }); } }}>Publier</Button></div>
        </div>
      </Modal>
    </Page>
  );
}

// ============================================================================
// 5. MOTEUR RÉGLEMENTAIRE (existant, enrichi)
// ============================================================================
export function AdminRegulatory() {
  const db = useDB();
  return (
    <Page>
      <div className="mb-5"><h2 className="text-xl font-black tracking-tight text-slate-900">Moteur réglementaire</h2><p className="text-sm text-slate-500">Administration des règles (Togo)</p></div>
      <Card className="p-5"><div className="mb-4 flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700"><ShieldAlert size={14} className="mt-0.5 shrink-0" /> Toute règle doit être sourcée, versionnée et validée par un humain. L&apos;IA ne publie jamais seule.</div>
        <div className="space-y-3">{db.taxRules.map((r) => (
          <div key={r.id} className="rounded-xl border border-slate-100 p-4"><div className="flex items-center justify-between"><div><p className="font-bold text-slate-800">{r.code} — {r.name}</p><p className="text-xs text-slate-400">{r.source} · v{r.version}</p></div><Badge tone={r.verified ? "emerald" : "amber"}>{r.verified ? "Vérifié" : "À vérifier"}</Badge></div><div className="mt-2 flex items-center gap-3 text-sm"><span className="font-semibold text-slate-700">Taux : {r.rate}%</span><span className="text-slate-400">· base : {r.base}</span></div>{r.note && <p className="mt-1 text-xs text-slate-400">{r.note}</p>}</div>
        ))}</div>
      </Card>
      <Card className="mt-6 p-5"><SectionHeading title="Country packs" /><div className="flex flex-wrap gap-2">{["🇹🇬 Togo", "🇧🇯 Bénin", "🇨🇮 Côte d'Ivoire", "🇸🇳 Sénégal", "🇧🇫 Burkina Faso"].map((c) => <Badge key={c} tone={c.includes("Togo") ? "emerald" : "slate"}><Globe2 size={11} /> {c}</Badge>)}</div></Card>
    </Page>
  );
}

// ============================================================================
// 6. JOURNAL D'AUDIT (existant)
// ============================================================================
export function AdminAudit() {
  const db = useDB();
  const [q, setQ] = useState("");
  const [verif, setVerif] = useState<ReturnType<typeof verifyAuditChain> | null>(null);
  const list = db.auditLogs.filter((l) => !q || l.action.toLowerCase().includes(q.toLowerCase()) || l.after?.toLowerCase().includes(q.toLowerCase()));
  return (
    <Page>
      <div className="mb-5"><h2 className="text-xl font-black tracking-tight text-slate-900">Journal d&apos;audit</h2><p className="text-sm text-slate-500">{db.auditLogs.length} événement(s) — traçabilité complète</p></div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-full max-w-xs"><div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><Input className="pl-9" placeholder="Rechercher une action…" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
        <Button variant="outline" size="sm" onClick={() => setVerif(verifyAuditChain(db.auditLogs))}>
          <ShieldCheck size={14} /> Vérifier l&apos;intégrité
        </Button>
        {verif && (
          <span className={`flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium ${verif.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
            {verif.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            {verif.ok
              ? `Chaîne intacte : ${verif.sealed} entrée(s) scellée(s) vérifiée(s)${verif.unsealed ? ` · ${verif.unsealed} antérieure(s) au scellement` : ""}.`
              : `Rupture à l'entrée ${verif.brokenAt} : ${verif.reason}.`}
          </span>
        )}
      </div>
      <div className="mb-4 flex items-start gap-2 rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-700">
        <Info size={14} className="mt-0.5 shrink-0" />
        Chaque trace est scellée par un SHA-256 enchaîné au précédent : toute modification, insertion ou suppression locale casse la chaîne à cet endroit.
        Ce contrôle détecte l&apos;altération ; il ne l&apos;empêche pas — l&apos;inviolabilité réelle exige un ancrage serveur.
      </div>
      <Card className="overflow-x-auto p-5"><table className="w-full text-sm"><thead><tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase text-slate-400"><th className="px-3 py-2">Date</th><th className="px-3 py-2">Utilisateur</th><th className="px-3 py-2">Action</th><th className="px-3 py-2">Entité</th><th className="px-3 py-2">Détail</th></tr></thead>
        <tbody>{list.map((l) => { const u = db.users.find((x) => x.id === l.userId); return (
          <tr key={l.id} className="border-b border-slate-50"><td className="px-3 py-2.5 text-slate-400">{formatDateTime(l.createdAt)}</td><td className="px-3 py-2.5 font-medium text-slate-700">{u?.firstName || "Système"} {u?.lastName}</td><td className="px-3 py-2.5"><Badge tone="indigo">{l.action}</Badge></td><td className="px-3 py-2.5 text-slate-500">{l.entity}</td><td className="px-3 py-2.5 text-slate-500">{l.after}</td></tr>
        ); })}</tbody>
      </table></Card>
    </Page>
  );
}

// ============================================================================
// 7. ANNONCES & COMMUNICATION (nouveau)
// ============================================================================
export function AdminAnnouncements() {
  const db = useDB();
  const [announce, setAnnounce] = useState({ title: "", body: "", audience: "cabinets" as "all" | "cabinets" | "clients" });
  const [sent, setSent] = useState<string | null>(null);
  return (
    <Page>
      <div className="mb-5"><h2 className="text-xl font-black tracking-tight text-slate-900">Annonces & communication</h2><p className="text-sm text-slate-500">Publiez des messages aux cabinets et entreprises</p></div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <SectionHeading title="Nouvelle annonce" subtitle="Elle apparaîtra dans les notifications des destinataires" />
          {sent && <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">{sent}</div>}
          <div className="space-y-4">
            <Field label="Titre" required><Input value={announce.title} onChange={(e) => setAnnounce({ ...announce, title: e.target.value })} /></Field>
            <Field label="Message" required><Input value={announce.body} onChange={(e) => setAnnounce({ ...announce, body: e.target.value })} /></Field>
            <Field label="Audience"><Select value={announce.audience} onChange={(e) => setAnnounce({ ...announce, audience: e.target.value as "all" | "cabinets" | "clients" })}><option value="all">Tous (cabinets + entreprises)</option><option value="cabinets">Cabinets uniquement</option><option value="clients">Entreprises uniquement</option></Select></Field>
            <Button onClick={() => { if (announce.title && announce.body) { publishAnnouncement(announce.title, announce.body, announce.audience); setSent(`Annonce publiée : « ${announce.title} »`); setAnnounce({ title: "", body: "", audience: "cabinets" }); } }}><Megaphone size={15} /> Publier l&apos;annonce</Button>
          </div>
        </Card>
        <Card className="p-5">
          <SectionHeading title="Notifications récentes envoyées" />
          <div className="space-y-2">{db.notifications.slice(0, 12).map((n) => { const org = db.organizations.find((o) => o.id === n.organizationId); return (
            <div key={n.id} className="flex items-start gap-2 rounded-lg border border-slate-100 px-3 py-2"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-700">{n.title}</p><p className="truncate text-xs text-slate-400">{org?.name} · {formatDate(n.createdAt)}</p></div><Badge tone={n.read ? "slate" : "indigo"}>{n.read ? "Lu" : "Non lu"}</Badge></div>
          ); })}</div>
        </Card>
      </div>
    </Page>
  );
}

// ============================================================================
// 8. DONNÉES PLATEFORME (backup, stats stockage)
// ============================================================================
export function AdminData() {
  const db = useDB();
  const json = JSON.stringify(db);
  const sizeKb = Math.round(json.length / 1024);
  const collections = Object.entries(db).filter(([, v]) => Array.isArray(v)) as [string, unknown[]][];
  const biggest = collections.sort((a, b) => b[1].length - a[1].length).slice(0, 10);
  return (
    <Page>
      <div className="mb-5"><h2 className="text-xl font-black tracking-tight text-slate-900">Données plateforme</h2><p className="text-sm text-slate-500">Statistiques de stockage · sauvegarde · réinitialisation</p></div>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Taille du stockage" value={`${sizeKb} Ko`} icon={<HardDrive size={18} />} tone="indigo" sub="localStorage" />
        <StatCard title="Collections" value={String(collections.length)} icon={<Layers size={18} />} tone="violet" />
        <StatCard title="Total enregistrements" value={String(collections.reduce((s, [, v]) => s + v.length, 0))} icon={<Database size={18} />} tone="sky" />
        <StatCard title="Événements audit" value={String(db.auditLogs.length)} icon={<Activity size={18} />} tone="amber" />
      </div>
      <Card className="mb-6 p-5">
        <SectionHeading title="Collections les plus volumineuses" />
        <div className="space-y-2">{biggest.map(([name, arr]) => { const pct = Math.round((arr.length / Math.max(1, collections.reduce((s, [, v]) => s + v.length, 0))) * 100); return (
          <div key={name}><div className="mb-0.5 flex justify-between text-xs"><span className="font-medium text-slate-600">{name}</span><span className="tabular-nums text-slate-400">{arr.length} enregistrement(s)</span></div><ProgressBar value={pct} tone="indigo" /></div>
        ); })}</div>
      </Card>
      <Card className="p-5">
        <SectionHeading title="Sauvegarde & restauration" subtitle="Export complet de la base plateforme (JSON)" />
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => { const blob = new Blob([json], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `fimaac-platform-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url); }}><Download size={15} /> Exporter la base</Button>
        </div>
      </Card>
    </Page>
  );
}
