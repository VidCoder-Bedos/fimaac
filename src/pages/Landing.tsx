import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight, ShieldCheck, Sparkles, Building2, BookOpen, Receipt, Landmark,
  Users, FileBarChart, BarChart3, Globe2, Lock, Zap, CheckCircle2, TrendingUp,
  FileText, BrainCircuit, Layers, Star,
} from "lucide-react";
import { Button, Card, Badge, AuroraBackground, AnimatedCounter } from "../components/ui";

const MODULES = [
  { icon: <BookOpen size={20} />, title: "Comptabilité SYSCOHADA", desc: "Double partie, plan révisé, journaux, grand livre, balance, lettrage." },
  { icon: <Receipt size={20} />, title: "Moteur fiscal Togo", desc: "Calculs explicables : montant, base, règle, version, source. GUDEF." },
  { icon: <FileText size={20} />, title: "Documents & OCR", desc: "Upload, classification, extraction assistée, comptabilisation." },
  { icon: <Landmark size={20} />, title: "Banque & rapprochement", desc: "Pointage, rapprochement automatique, règles, traçabilité." },
  { icon: <FileBarChart size={20} />, title: "États financiers & liasses", desc: "Balance → états, liasses GUDEF Excel, contrôles de cohérence." },
  { icon: <ShieldCheck size={20} />, title: "Centre de conformité", desc: "Score 0–100 %, anomalies, recommandations actionnables." },
  { icon: <Users size={20} />, title: "Paie & social", desc: "Bulletins, CNSS paramétrable, écritures de paie générées." },
  { icon: <Sparkles size={20} />, title: "Assistant IA FIMAAC", desc: "Agents comptable, fiscal, audit — sans inventer de règle." },
];
const PLANS = [
  { name: "Essai", price: 0, period: "14 jours", desc: "Découvrez FIMAAC", features: ["1 cabinet", "3 utilisateurs", "Tous les modules", "Données de démo"], cta: "Commencer", tone: "outline" as const },
  { name: "Starter", price: 35000, period: "FCFA / mois", desc: "Petits cabinets", features: ["Jusqu'à 50 clients", "5 utilisateurs", "Comptabilité + Fiscalité", "Documents & OCR"], cta: "Choisir", tone: "outline" as const },
  { name: "Pro", price: 75000, period: "FCFA / mois", desc: "Cabinets en croissance", features: ["Clients illimités", "15 utilisateurs", "États financiers + IA", "Conformité & rapports", "Portail client"], cta: "Choisir Pro", tone: "primary" as const, popular: true },
  { name: "Enterprise", price: 250000, period: "FCFA / mois", desc: "Grands cabinets", features: ["Utilisateurs illimités", "Multi-pays OHADA", "Support dédié", "API & intégrations"], cta: "Contacter", tone: "outline" as const },
];
const COUNTRIES = ["🇹🇬 Togo", "🇧🇯 Bénin", "🇨🇮 Côte d'Ivoire", "🇸🇳 Sénégal", "🇧🇫 Burkina Faso"];
function fcfaShort(n: number) { return new Intl.NumberFormat("fr-FR").format(n); }

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Nav */}
      <header className="sticky top-0 z-40">
        <div className="glass border-b border-white/40">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 font-black text-white shadow-lg shadow-indigo-500/40">F<span className="live-dot absolute -right-1 -top-1 h-2 w-2 rounded-full bg-emerald-400" /></div>
              <div><p className="font-display text-lg font-extrabold leading-none tracking-tight text-slate-900">FIMAAC</p><p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Finance · Management · Accounting</p></div>
            </div>
            <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
              <a href="#modules" className="transition hover:text-indigo-600">Modules</a>
              <a href="#fonctionnalites" className="transition hover:text-indigo-600">Fonctionnalités</a>
              <a href="#tarifs" className="transition hover:text-indigo-600">Tarifs</a>
              <a href="#pays" className="transition hover:text-indigo-600">Pays OHADA</a>
            </nav>
            <div className="flex items-center gap-2">
              <Link to="/login"><Button variant="ghost" size="sm">Connexion</Button></Link>
              <Link to="/register"><Button size="sm">Démarrer <ArrowRight size={15} /></Button></Link>
            </div>
          </div>
        </div>
      </header>
      {/* Hero */}
      <section className="relative">
        <AuroraBackground />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24 lg:px-8">
          <div>
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <Badge tone="violet" className="mb-5 px-3 py-1"><Globe2 size={13} /> SYSCOHADA révisé · Togo 🇹🇬 · XOF</Badge>
              <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                {/* whitespace-pre : un inline-block colle son espace final (« Lesystème »)
                    — l'espace doit donc être préservé explicitement dans chaque mot. */}
                {"Le système d'exploitation du".split(" ").map((w, i) => (
                  <motion.span key={i} className="inline-block whitespace-pre" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.06 }}>{w}{i < 3 ? " " : ""}</motion.span>
                ))}
                <span className="text-gradient block py-1">cabinet comptable</span>
              </h1>
              <motion.p className="mt-5 max-w-xl text-lg text-slate-600" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                Comptabilité, fiscalité, documents, paie, états financiers et conformité — réunis dans une seule plateforme. <span className="font-semibold text-slate-800">Une seule saisie, plusieurs utilisations.</span>
              </motion.p>
              <motion.div className="mt-8 flex flex-wrap items-center gap-3" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
                <Link to="/register"><Button size="lg">Créer mon cabinet <ArrowRight size={18} /></Button></Link>
                <Link to="/login"><Button size="lg" variant="outline">Se connecter</Button></Link>
              </motion.div>
              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500">
                <span className="flex items-center gap-1.5"><CheckCircle2 size={15} className="text-emerald-500" /> Multi-tenant sécurisé</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 size={15} className="text-emerald-500" /> Moteur réglementaire versionné</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 size={15} className="text-emerald-500" /> IA contrôlée</span>
              </div>
            </motion.div>
          </div>
          {/* Floating bento preview */}
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2 }} className="relative">
            <motion.div animate={{ y: [0, -12, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} className="relative">
              <Card className="overflow-hidden p-0 shadow-2xl">
                <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
                  <span className="h-3 w-3 rounded-full bg-rose-400" /><span className="h-3 w-3 rounded-full bg-amber-400" /><span className="h-3 w-3 rounded-full bg-emerald-400" />
                  <span className="ml-2 text-xs font-medium text-slate-400">FIMAAC — Tableau de bord</span>
                  <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-emerald-600"><span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-500" /> En direct</span>
                </div>
                <div className="grid grid-cols-3 gap-3 p-5">
                  {[["Clients", "42"], ["Échéances", "7"], ["Conformité", "94%"]].map(([l, v]) => (
                    <div key={l} className="rounded-2xl border border-slate-100 bg-white/70 p-3"><p className="text-[10px] font-medium text-slate-400">{l}</p><p className="font-display mt-1 text-xl font-extrabold text-slate-800">{v}</p></div>
                  ))}
                </div>
                <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 p-4">
                  <div className="mb-3 flex items-center justify-between"><span className="text-xs font-semibold text-slate-600">Chiffre d'affaires</span><Badge tone="emerald"><TrendingUp size={11} /> +12 %</Badge></div>
                  <div className="flex h-24 items-end gap-1.5">{[40, 55, 48, 70, 62, 85, 95].map((h, i) => <motion.div key={i} className="flex-1 rounded-t bg-gradient-to-t from-indigo-500 to-violet-500" initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ delay: 0.8 + i * 0.1 }} />)}</div>
                </div>
              </Card>
              <motion.div animate={{ y: [0, 12, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }} className="absolute -bottom-6 -left-6 hidden w-44 rounded-2xl border border-white/60 bg-white/80 p-4 shadow-xl backdrop-blur-xl sm:block">
                <div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600"><ShieldCheck size={16} /></div><div><p className="text-xs font-bold text-slate-800">Conformité</p><p className="text-[10px] text-slate-400">Score 94/100</p></div></div>
              </motion.div>
              <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }} className="absolute -right-4 -top-4 hidden rounded-2xl border border-white/60 bg-white/80 p-3 shadow-xl backdrop-blur-xl sm:block">
                <div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-600"><BrainCircuit size={16} /></div><p className="text-[11px] font-bold text-slate-800">IA</p></div>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </section>
      {/* Stats */}
      <section className="relative">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-12 sm:px-6 lg:grid-cols-4 lg:px-8">
          {[{ v: 16, s: "modules intégrés" }, { v: 100, s: "débit = crédit garanti", p: "%" }, { v: 8, s: "classes SYSCOHADA" }, { v: 5, s: "pays OHADA prêts" }].map((x, i) => (
            <motion.div key={x.s} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }} className="text-center">
              <p className="font-display text-gradient text-4xl font-extrabold sm:text-5xl"><AnimatedCounter value={x.v} />{x.p || ""}</p>
              <p className="mt-1 text-sm text-slate-500">{x.s}</p>
            </motion.div>
          ))}
        </div>
      </section>
      {/* Modules */}
      <section id="modules" className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <Badge tone="indigo" className="mb-3"><Layers size={13} /> Modules</Badge>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Tout le cycle, dans une seule plateforme</h2>
          <p className="mt-3 text-slate-600">De l'entreprise à l'archivage, chaque information alimente automatiquement la comptabilité, la fiscalité et les rapports.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((m, i) => (
            <motion.div key={m.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
              <Card hover className="h-full p-5">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30">{m.icon}</div>
                <h3 className="font-display font-bold text-slate-900">{m.title}</h3>
                <p className="mt-1.5 text-sm text-slate-500">{m.desc}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>
      {/* Features */}
      <section id="fonctionnalites" className="relative bg-gradient-to-b from-white/60 to-slate-100/60 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <Badge tone="violet" className="mb-3"><Lock size={13} /> Conçu pour l'exigence</Badge>
            <h2 className="font-display text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">L'exactitude avant tout</h2>
            <p className="mt-3 text-slate-600">Une IA qui invente une règle fiscale est un échec. Une comptabilité déséquilibrée est un échec.</p>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            {[
              { icon: <ShieldCheck />, t: "Moteur réglementaire", d: "Chaque règle est sourcée, versionnée, datée et validée par un humain avant publication. L'IA ne publie jamais seule." },
              { icon: <BookOpen />, t: "Intégrité comptable", d: "Débit = crédit garanti. Correction par contrepassation avec audit trail — jamais de suppression silencieuse." },
              { icon: <Lock />, t: "Multi-tenant sécurisé", d: "Isolation stricte entre cabinets. RBAC granulaire. Aucune fuite de tenant à tenant." },
              { icon: <Receipt />, t: "Calcul fiscal explicable", d: "Montant, base, règle, version, source, période. Traçabilité jusqu'aux écritures sources." },
              { icon: <Zap />, t: "Une saisie, tout alimente", d: "Comptabilité, fiscalité, échéances, rapports et tableaux de bord mis à jour ensemble." },
              { icon: <Building2 />, t: "Portail client", d: "Vos clients déposent leurs pièces, répondent aux demandes et suivent leurs documents." },
            ].map((f) => (
              <Card key={f.t} hover className="p-6"><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">{f.icon}</div><h3 className="font-display text-lg font-bold text-slate-900">{f.t}</h3><p className="mt-2 text-sm text-slate-500">{f.d}</p></Card>
            ))}
          </div>
        </div>
      </section>
      {/* Countries */}
      <section id="pays" className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-10 text-center shadow-2xl sm:p-16">
          <AuroraBackground />
          <div className="relative">
            <Globe2 className="mx-auto mb-4 text-white" size={40} />
            <h2 className="font-display text-3xl font-extrabold text-white sm:text-4xl">Conçu pour l'espace OHADA</h2>
            <p className="mx-auto mt-3 max-w-xl text-indigo-100">Lancé au Togo, FIMAAC intègre une architecture par pays (« country packs ») pour un déploiement rapide.</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">{COUNTRIES.map((c) => <span key={c} className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm">{c}</span>)}</div>
          </div>
        </div>
      </section>
      {/* Pricing */}
      <section id="tarifs" className="relative py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <Badge tone="emerald" className="mb-3"><BarChart3 size={13} /> Tarifs</Badge>
            <h2 className="font-display text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Des plans adaptés à votre cabinet</h2>
            <p className="mt-3 text-slate-600">En FCFA (XOF). Facturation mensuelle, sans engagement.</p>
          </div>
          <div className="grid gap-6 lg:grid-cols-4">
            {PLANS.map((p) => (
              <Card key={p.name} hover className={`relative flex flex-col p-6 ${p.popular ? "ring-2 ring-indigo-500" : ""}`}>
                {p.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-1 text-xs font-bold text-white shadow-lg">Populaire</span>}
                <p className="text-sm font-bold uppercase tracking-wide text-indigo-600">{p.name}</p>
                <div className="mt-3 flex items-end gap-1"><span className="font-display text-3xl font-extrabold text-slate-900"><AnimatedCounter value={p.price} format={fcfaShort} /></span><span className="mb-1 text-xs text-slate-400">{p.period}</span></div>
                <p className="mt-1 text-sm text-slate-500">{p.desc}</p>
                <ul className="mt-5 flex-1 space-y-2.5">{p.features.map((f) => <li key={f} className="flex items-start gap-2 text-sm text-slate-600"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" /> {f}</li>)}</ul>
                <Link to="/register" className="mt-6"><Button variant={p.tone} className="w-full">{p.cta}</Button></Link>
              </Card>
            ))}
          </div>
        </div>
      </section>
      {/* CTA */}
      <section className="relative mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <Card className="overflow-hidden p-0">
          <div className="relative grid items-center gap-8 p-10 lg:grid-cols-2 lg:p-14">
            <AuroraBackground />
            <div className="relative">
              <div className="mb-3 flex items-center gap-1 text-amber-400">{[...Array(5)].map((_, i) => <Star key={i} size={16} fill="currentColor" />)}</div>
              <h2 className="font-display text-3xl font-extrabold tracking-tight text-slate-900">Prêt à digitaliser votre cabinet ?</h2>
              <p className="mt-3 text-slate-600">Créez votre compte en moins de 2 minutes. Inscrivez-vous en tant que cabinet ou client.</p>
              <div className="mt-6 flex flex-wrap gap-3"><Link to="/register"><Button size="lg">Créer un cabinet <ArrowRight size={18} /></Button></Link><Link to="/login"><Button size="lg" variant="outline">J'ai déjà un compte</Button></Link></div>
            </div>
            <div className="relative flex items-center justify-center gap-4">
              <div className="animate-float rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 p-5 text-white shadow-xl"><Building2 size={28} /><p className="mt-2 text-sm font-semibold">Cabinet</p></div>
              <div className="animate-float2 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-5 text-white shadow-xl"><Users size={28} /><p className="mt-2 text-sm font-semibold">Client</p></div>
            </div>
          </div>
        </Card>
      </section>
      <footer className="relative border-t border-slate-200 bg-slate-900 py-10 text-slate-400">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:px-6 md:flex-row lg:px-8">
          <div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-600 font-black text-white">F</div><span className="font-display font-extrabold text-white">FIMAAC</span></div>
          <p className="text-xs">© {new Date().getFullYear()} FIMAAC — SYSCOHADA révisé · OHADA · Togo 🇹🇬. V0.3 — démo premium.</p>
          <p className="text-[11px]">Conçu pour l'exactitude comptable & fiscale.</p>
        </div>
      </footer>
    </div>
  );
}
