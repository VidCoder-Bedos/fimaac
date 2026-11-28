import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from "lucide-react";
import { dismissToast, expireToasts, getToasts, subscribeToasts, type Toast, type ToastTone } from "../lib/toast";

const ICONS: Record<ToastTone, typeof Info> = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  danger: XCircle,
};

const TONES: Record<ToastTone, { box: string; icon: string; title: string }> = {
  success: { box: "border-emerald-200 bg-emerald-50", icon: "text-emerald-700", title: "text-emerald-900" },
  info: { box: "border-sky-200 bg-sky-50", icon: "text-sky-700", title: "text-sky-900" },
  warning: { box: "border-amber-200 bg-amber-50", icon: "text-amber-700", title: "text-amber-900" },
  danger: { box: "border-rose-200 bg-rose-50", icon: "text-rose-700", title: "text-rose-900" },
};

/** Abonnement au magasin de notifications. */
export function useToasts(): Toast[] {
  const [list, setList] = useState<Toast[]>(getToasts());
  useEffect(() => {
    setList(getToasts());
    return subscribeToasts(() => setList(getToasts()));
  }, []);
  return list;
}

/**
 * Pile de notifications. Rendu global (une seule instance, montée dans `App`),
 * avec une région `aria-live` : un lecteur d'écran annonce le message, ce que
 * `alert()` ne faisait que de façon bloquante et impossible à relire.
 */
export default function Toaster() {
  const toasts = useToasts();

  // Les échéances sont vérifiées au rendu suivant : pas de minuteur orphelin
  // quand l'onglet est en arrière-plan.
  useEffect(() => {
    if (toasts.length === 0) return;
    const next = Math.min(...toasts.map((t) => Math.max(0, t.createdAt + t.durationMs - Date.now())));
    const id = window.setTimeout(() => expireToasts(Date.now()), next + 50);
    return () => window.clearTimeout(id);
  }, [toasts]);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2" role="region" aria-label="Notifications">
      <div aria-live="polite" aria-atomic="false" className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const tone = TONES[t.tone];
            const Icon = ICONS[t.tone];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24 }}
                transition={{ type: "spring", duration: 0.35 }}
                role={t.tone === "danger" ? "alert" : "status"}
                className={`pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg ${tone.box}`}
              >
                <Icon size={18} className={`mt-0.5 shrink-0 ${tone.icon}`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold ${tone.title}`}>
                    {t.title}
                    {t.count > 1 && <span className="ml-1.5 rounded-full bg-white/70 px-1.5 py-0.5 text-[11px] font-bold text-slate-600">×{t.count}</span>}
                  </p>
                  {t.body && <p className="mt-0.5 break-words text-xs text-slate-600">{t.body}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(t.id)}
                  aria-label={`Fermer la notification : ${t.title}`}
                  className="shrink-0 rounded-lg p-1 text-slate-500 transition-colors hover:bg-white/70 hover:text-slate-700"
                >
                  <X size={14} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
