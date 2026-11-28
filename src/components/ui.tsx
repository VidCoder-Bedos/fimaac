import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "../utils/cn";
import { FOCUSABLE_SELECTOR, nextFocusIndex, shouldTrapKey, isEscapeKey, dialogLabel } from "../lib/focusTrap";

/* ---------------- Button ---------------- */
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "success";
export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" | "lg" }) {
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5",
    secondary: "bg-slate-900 text-white hover:bg-slate-800",
    ghost: "text-slate-600 hover:bg-slate-100",
    danger: "bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-lg shadow-rose-500/25",
    success: "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25",
    outline: "border border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/50",
  };
  const sizes = { sm: "h-8 px-3 text-xs", md: "h-10 px-4 text-sm", lg: "h-12 px-6 text-base" };
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      className={cn("shimmer relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50", variants[variant], sizes[size], className)}
      {...(props as React.ComponentProps<typeof motion.button>)}
    >
      {children}
    </motion.button>
  );
}

/* ---------------- Card ---------------- */
export function Card({ className, children, hover, ...props }: React.HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return (
    <div
      className={cn(
        "ring-gradient relative overflow-hidden rounded-[20px] bg-white/80 backdrop-blur-xl shadow-[0_1px_3px_rgba(15,23,42,0.06),0_10px_30px_-14px_rgba(15,23,42,0.18)]",
        hover && "transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_28px_70px_-22px_rgba(79,70,229,0.45)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** Animated aurora gradient background (decorative). */
export function AuroraBackground({ className }: { className?: string }) {
  return (
    <div className={"pointer-events-none absolute inset-0 overflow-hidden " + (className || "")} aria-hidden>
      <div className="aurora aurora-1" style={{ width: 460, height: 460, left: "-9%", top: "-12%", background: "radial-gradient(circle at 30% 30%, #6366f1, transparent 70%)" }} />
      <div className="aurora aurora-2" style={{ width: 520, height: 520, right: "-12%", top: "2%", background: "radial-gradient(circle at 70% 30%, #ec4899, transparent 70%)" }} />
      <div className="aurora aurora-1" style={{ width: 420, height: 420, left: "32%", bottom: "-14%", background: "radial-gradient(circle at 50% 50%, #22d3ee, transparent 70%)", animationDelay: "-6s" }} />
    </div>
  );
}

/** Count-up number animation. */
export function AnimatedCounter({ value, duration = 1.3, format }: { value: number; duration?: number; format?: (n: number) => string }) {
  const [n, setN] = useState(0);
  const ref = useRef<number>(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = ref.current;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / (duration * 1000));
      const eased = 1 - Math.pow(1 - p, 3);
      const cur = Math.round(from + (value - from) * eased);
      setN(cur);
      if (p < 1) raf = requestAnimationFrame(tick);
      else ref.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span className="tabular-nums">{format ? format(n) : n.toLocaleString("fr-FR")}</span>;
}

export function SectionHeading({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ---------------- Badge ---------------- */
const BADGE_TONES: Record<string, string> = {
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  rose: "bg-rose-50 text-rose-700 ring-rose-200",
  sky: "bg-sky-50 text-sky-700 ring-sky-200",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
};
export type BadgeTone = keyof typeof BADGE_TONES;
export function Badge({ tone = "slate", children, className }: { tone?: BadgeTone; children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", BADGE_TONES[tone], className)}>{children}</span>;
}

const STATUS_MAP: Record<string, { tone: BadgeTone; label: string }> = {
  draft: { tone: "slate", label: "Brouillon" },
  in_review: { tone: "sky", label: "En revue" },
  validated: { tone: "emerald", label: "Validée" },
  rejected: { tone: "rose", label: "Rejetée" },
  cancelled: { tone: "slate", label: "Annulée" },
  pending: { tone: "amber", label: "En attente" },
  in_progress: { tone: "sky", label: "En cours" },
  ready: { tone: "violet", label: "Prête" },
  submitted: { tone: "indigo", label: "Déposée" },
  paid: { tone: "emerald", label: "Payée" },
  overdue: { tone: "rose", label: "En retard" },
  not_applicable: { tone: "slate", label: "N/A" },
  todo: { tone: "slate", label: "À faire" },
  done: { tone: "emerald", label: "Terminée" },
  review: { tone: "sky", label: "Revue" },
  open: { tone: "amber", label: "Ouvert" },
  closed: { tone: "emerald", label: "Clôturé" },
  answered: { tone: "sky", label: "Répondu" },
  trialing: { tone: "violet", label: "Essai" },
  active: { tone: "emerald", label: "Actif" },
  past_due: { tone: "rose", label: "En retard" },
  uploaded: { tone: "sky", label: "Téléversé" },
  processing: { tone: "amber", label: "Traitement" },
  extracted: { tone: "violet", label: "Extrait" },
  archived: { tone: "slate", label: "Archivé" },
};

export function StatusBadge({ status }: { status: string }) {
  const map = STATUS_MAP[status] || { tone: "slate" as BadgeTone, label: status };
  return <Badge tone={map.tone}>{map.label}</Badge>;
}

/* ---------------- Form ---------------- */
export function Field({ label, children, hint, required }: { label: string; children: React.ReactNode; hint?: string; required?: boolean }) {
  // Le libellé est déjà associé implicitement (le contrôle est enfant du
  // `<label>`) ; on ajoute la description pour que l'indication « Montant en
  // FCFA » soit annoncée avec le champ, et non comme un texte voisin.
  const hintId = React.useId();
  const control = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        "aria-describedby": hint ? hintId : undefined,
        "aria-required": required || undefined,
      })
    : children;
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label} {required && <span className="text-rose-700" aria-hidden="true">*</span>}
      </span>
      {control}
      {hint && <span id={hintId} className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn("h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-500 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100", className)}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-500 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100", className)} {...props} />;
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 fill=%22none%22 viewBox=%220 0 24 24%22 stroke=%22%2394a3b8%22 stroke-width=%222%22><path stroke-linecap=%22round%22 stroke-linejoin=%22round%22 d=%22M19 9l-7 7-7-7%22/></svg>')] bg-[length:18px] bg-[right_0.75rem_center] bg-no-repeat px-3.5 pr-10 text-sm text-slate-900 outline-none transition-all focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

/* ---------------- Modal ---------------- */
export function Modal({ open, onClose, title, children, size = "md" }: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode; size?: "sm" | "md" | "lg" | "xl" }) {
  const widths = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" };
  const boxRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const titleId = React.useId();
  const label = dialogLabel(title);

  useEffect(() => {
    if (!open) return;
    // Restitution du focus : sans cela, fermer une modale renvoie le clavier en
    // haut de page et l'utilisateur perd sa position dans un tableau de 400 lignes.
    restoreRef.current = document.activeElement as HTMLElement | null;
    const box = boxRef.current;
    const first = box?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (first || box)?.focus();

    // Le défilement de la page en arrière-plan est figé, sinon la molette
    // déplace un contenu que l'on ne peut ni voir ni atteindre.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (isEscapeKey(e.key)) {
        e.stopPropagation();
        onClose();
        return;
      }
      if (!shouldTrapKey(box ? box.querySelectorAll(FOCUSABLE_SELECTOR).length : 0, e.key)) return;
      const items = Array.from(box!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      const current = items.indexOf(document.activeElement as HTMLElement);
      const next = nextFocusIndex(items.length, current, e.shiftKey);
      if (next >= 0) {
        e.preventDefault();
        items[next].focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      restoreRef.current?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm sm:p-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            ref={boxRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-label={title ? undefined : label}
            tabIndex={-1}
            className={cn("relative w-full rounded-2xl bg-white shadow-2xl outline-none", widths[size])}
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            transition={{ type: "spring", duration: 0.4 }}
            onClick={(e) => e.stopPropagation()}
          >
            {title && (
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <h3 id={titleId} className="text-lg font-bold text-slate-900">{title}</h3>
                <button type="button" onClick={onClose} aria-label="Fermer le dialogue" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700">
                  <X size={18} />
                </button>
              </div>
            )}
            <div className="p-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------------- Tabs ---------------- */
export function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: string; icon?: React.ReactNode }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn("relative flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-all", active === t.id ? "text-indigo-700" : "text-slate-500 hover:text-slate-800")}
        >
          {active === t.id && <motion.span layoutId="tab-bg" className="absolute inset-0 rounded-lg bg-white shadow-sm" transition={{ type: "spring", duration: 0.4 }} />}
          <span className="relative z-10 flex items-center gap-1.5">{t.icon}{t.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------------- StatCard ---------------- */
export function StatCard({ title, value, icon, trend, tone = "indigo", sub, countTo }: { title: string; value: string; icon?: React.ReactNode; trend?: string; tone?: BadgeTone; sub?: string; countTo?: number }) {
  const tones: Record<string, string> = {
    indigo: "from-indigo-500 to-violet-600", emerald: "from-emerald-500 to-teal-600",
    amber: "from-amber-500 to-orange-600", rose: "from-rose-500 to-red-600",
    sky: "from-sky-500 to-blue-600", violet: "from-violet-500 to-purple-600",
    slate: "from-slate-600 to-slate-800",
  };
  const glow: Record<string, string> = {
    indigo: "#6366f1", emerald: "#10b981", amber: "#f59e0b", rose: "#f43f5e", sky: "#0ea5e9", violet: "#8b5cf6", slate: "#475569",
  };
  return (
    <Card hover className="group p-5">
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-50" style={{ background: glow[tone] || "#6366f1" }} />
      <div className="relative flex items-start justify-between">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-slate-500">{title}</p>
          <p className="font-display mt-2 text-[26px] font-extrabold leading-none tracking-tight text-slate-900">{countTo !== undefined ? <AnimatedCounter value={countTo} /> : value}</p>
          {sub && <p className="mt-1.5 text-xs text-slate-500">{sub}</p>}
        </div>
        {icon && <div className={cn("relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg", tones[tone])}>{icon}</div>}
      </div>
      {trend && <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">{trend}</p>}
    </Card>
  );
}

/* ---------------- Misc ---------------- */
export function ProgressBar({ value, tone = "indigo" }: { value: number; tone?: string }) {
  const colors: Record<string, string> = { indigo: "bg-indigo-500", emerald: "bg-emerald-500", amber: "bg-amber-500", rose: "bg-rose-500" };
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <motion.div className={cn("h-full rounded-full", colors[tone] || colors.indigo)} initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.max(0, value))}%` }} transition={{ duration: 0.8, ease: "easeOut" }} />
    </div>
  );
}

export function Avatar({ name, color, size = 36 }: { name: string; color?: string; size?: number }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="flex shrink-0 items-center justify-center rounded-full font-bold text-white" style={{ width: size, height: size, background: color || "#6366f1", fontSize: size * 0.38 }}>
      {initials}
    </div>
  );
}

/**
 * P24 — `next` nomme le prérequis manquant : un écran vide dit rarement *pourquoi*
 * il est vide. Le lien évite de renvoyer l'utilisateur à la recherche de l'écran.
 */
export function EmptyState({ icon, title, description, action, next }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode; next?: { message: string; href: string; cta: string } }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-14 text-center">
      {icon && <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm">{icon}</div>}
      <p className="font-semibold text-slate-700">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {next && (
        <div className="mt-3 max-w-md rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{next.message}</div>
      )}
      {next ? (
        <div className="mt-3">
          <Link to={next.href} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">
            {next.cta} <ArrowRight size={13} />
          </Link>
        </div>
      ) : null}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Money({ amount, className }: { amount: number; className?: string }) {
  const widened = new Intl.NumberFormat("fr-FR").format(amount).replace(/[\u202F\u00A0]/g, " ");
  return <span className={cn("tabular-nums whitespace-nowrap", className)}>{widened} FCFA</span>;
}

/* ---------------- Charts (SVG) ---------------- */
export function Donut({ value, size = 130, stroke = 14, color = "#6366f1", track = "#e2e8f0", label, sublabel }: { value: number; size?: number; stroke?: number; color?: string; track?: string; label?: string; sublabel?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, value)) / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: offset }} transition={{ duration: 1, ease: "easeOut" }} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold text-slate-900">{label ?? `${Math.round(value)}%`}</span>
        {sublabel && <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{sublabel}</span>}
      </div>
    </div>
  );
}

export function BarChart({ data, height = 180, tone = "indigo" }: { data: { label: string; value: number }[]; height?: number; tone?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const colors: Record<string, string> = { indigo: "#6366f1", emerald: "#10b981", amber: "#f59e0b", sky: "#0ea5e9" };
  const color = colors[tone] || colors.indigo;
  return (
    <div className="flex items-end justify-between gap-2" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center justify-end gap-2">
          <motion.div className="w-full rounded-t-lg" style={{ background: `linear-gradient(to top, ${color}, ${color}99)` }} initial={{ height: 0 }} animate={{ height: `${(d.value / max) * (height - 28)}px` }} transition={{ duration: 0.7, delay: i * 0.05 }} />
          <span className="text-[10px] font-medium text-slate-500">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function LineArea({ data, height = 180, color = "#6366f1" }: { data: { label: string; value: number }[]; height?: number; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const min = Math.min(0, ...data.map((d) => d.value));
  const range = max - min || 1;
  const w = 100;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1 || 1)) * w;
    const y = 100 - ((d.value - min) / range) * 92 - 4;
    return [x, y];
  });
  const path = pts.map((p) => `${p[0]},${p[1]}`).map((s, i) => `${i === 0 ? "M" : "L"}${s}`).join(" ");
  const area = `${path} L${w},100 L0,100 Z`;
  return (
    <div className="w-full" style={{ height }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
        <defs>
          <linearGradient id="la" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.path d={area} fill="url(#la)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }} />
        <motion.path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: "easeOut" }} />
      </svg>
      <div className="mt-1 flex justify-between">
        {data.map((d, i) => (
          <span key={i} className="text-[10px] text-slate-500">{d.label}</span>
        ))}
      </div>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <div className={cn("h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600", className)} />;
}
