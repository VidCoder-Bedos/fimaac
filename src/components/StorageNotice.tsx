// ============================================================================
// FIMAAC — Bandeau « démonstration + stockage local » (P0-5)
//
// Trois informations que l'utilisateur ne pouvait pas obtenir nulle part :
//   1. où vivent ses données (dans son navigateur, pas sur un serveur) ;
//   2. combien de place il reste ;
//   3. si la dernière écriture a échoué (auquel cas son travail est en mémoire
//      seulement — c'est le cas qu'il ne faut jamais laisser silencieux).
// ============================================================================
import { useMemo, useState } from "react";
import { AlertTriangle, Download, HardDrive, Info, ShieldAlert, X } from "lucide-react";
import { storageSnapshot, exportDB, useDB } from "../lib/store";
import { backupFileName, humanBytes, storageMessage } from "../lib/storage";

export default function StorageNotice() {
  const [dismissed, setDismissed] = useState(false);
  const db = useDB();

  // Recalculé à chaque mutation du store (et non à chaque rendu) : la jauge et
  // l'état de sauvegarde suivent la réalité, sans sérialiser la base en boucle.
  const snapshot = useMemo(() => {
    try {
      return storageSnapshot();
    } catch {
      return null;
    }
  }, [db]);

  if (!snapshot || !snapshot.usage) return null;
  const { usage, persistError, lastPersistedAt } = snapshot;
  const message = storageMessage(usage, persistError);
  // Un incident de sauvegarde ne se referme pas : il doit rester sous les yeux.
  const closable = !persistError && usage.level === "ok";
  if (dismissed && closable) return null;

  const tone =
    message.tone === "critical"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : message.tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-slate-200 bg-slate-50 text-slate-600";
  const barTone =
    message.tone === "critical" ? "bg-rose-500" : message.tone === "warn" ? "bg-amber-600" : "bg-emerald-600";
  const Icon = message.tone === "critical" ? ShieldAlert : message.tone === "warn" ? AlertTriangle : Info;

  const download = () => {
    const blob = new Blob([exportDB()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = backupFileName();
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`flex flex-wrap items-center gap-3 border-b px-4 py-2 text-xs sm:px-6 ${tone}`}>
      <span className="flex items-center gap-1.5 font-semibold">
        <Icon size={14} className="shrink-0" />
        {message.title}
      </span>
      <span className="min-w-0 flex-1 basis-64 leading-snug opacity-90">{message.detail}</span>

      <span className="flex items-center gap-1.5 tabular-nums opacity-90" title="Occupation du stockage du navigateur">
        <HardDrive size={13} />
        <span className="relative inline-block h-1.5 w-20 overflow-hidden rounded-full bg-black/10">
          <span className={`absolute inset-y-0 left-0 ${barTone}`} style={{ width: `${Math.min(100, usage.percent)}%` }} />
        </span>
        {humanBytes(usage.bytes)} / {humanBytes(usage.budgetBytes)}
      </span>

      <button
        onClick={download}
        className="flex items-center gap-1.5 rounded-lg border border-current/20 bg-white/70 px-2.5 py-1 font-semibold hover:bg-white"
      >
        <Download size={13} /> Exporter la sauvegarde
      </button>

      {lastPersistedAt && !persistError && usage.level === "ok" && (
        <span className="hidden opacity-60 sm:inline">
          sauvegardé à {new Date(lastPersistedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
        </span>
      )}

      {closable && (
        <button onClick={() => setDismissed(true)} className="rounded p-1 opacity-60 hover:opacity-100" aria-label="Masquer le bandeau">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
