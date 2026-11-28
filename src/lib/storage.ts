// ============================================================================
// FIMAAC — Garde-fou de stockage local (P0-5)
//
// Constat d'audit : les données vivent dans le `localStorage` du navigateur, et
// `persist()` avalait silencieusement l'erreur de quota (`catch { /* quota */ }`).
// Conséquence : au-delà de la limite, l'application continue d'afficher des
// écritures qui ne sont plus écrites nulle part. L'utilisateur travaille dans
// le vide sans le savoir, puis perd son dossier au rechargement.
//
// Ce module ne manipule que des nombres : il rend l'occupation lisible et
// calculable, sans dépendre du DOM. `store.ts` l'alimente avec la taille réelle
// de la base sérialisée.
// ============================================================================

/**
 * Budget de référence du `localStorage` : 5 Mio est la limite la plus basse
 * couramment rencontrée (5 Mio par origine dans la plupart des navigateurs).
 * Hypothèse assumée : la valeur réelle peut être supérieure, jamais inférieure
 * — on préfère donc alerter trop tôt que trop tard.
 */
export const STORAGE_BUDGET_BYTES = 5 * 1024 * 1024;

/** Seuil d'alerte : au-delà, on invite explicitement à exporter. */
export const QUOTA_WARN_RATIO = 0.8;

/** Seuil critique : la sauvegarde peut échouer à la prochaine écriture. */
export const QUOTA_CRITICAL_RATIO = 0.95;

export type StorageLevel = "ok" | "warn" | "critical";

export interface StorageUsage {
  bytes: number;
  budgetBytes: number;
  /** Occupation entre 0 et 1 (peut dépasser 1 si le budget est dépassé). */
  ratio: number;
  /** Occupation en pourcentage arrondi, plafonnée à 999 pour l'affichage. */
  percent: number;
  level: StorageLevel;
  remainingBytes: number;
}

/** Évalue l'occupation à partir d'une taille en octets. */
export function measureUsage(bytes: number, budgetBytes: number = STORAGE_BUDGET_BYTES): StorageUsage {
  const safeBytes = Math.max(0, Math.round(bytes));
  const safeBudget = budgetBytes > 0 ? budgetBytes : STORAGE_BUDGET_BYTES;
  const ratio = safeBytes / safeBudget;
  const level: StorageLevel =
    ratio >= QUOTA_CRITICAL_RATIO ? "critical" : ratio >= QUOTA_WARN_RATIO ? "warn" : "ok";
  return {
    bytes: safeBytes,
    budgetBytes: safeBudget,
    ratio,
    percent: Math.min(999, Math.round(ratio * 100)),
    level,
    remainingBytes: Math.max(0, safeBudget - safeBytes),
  };
}

/**
 * Taille en octets d'une chaîne telle qu'un navigateur la stocke (UTF-16 :
 * 2 octets par unité de code pour l'essentiel des caractères).
 */
export function byteLength(value: string): number {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(value).length;
  return value.length * 2;
}

/** Taille de la base sérialisée, sans dépendre du DOM. */
export function measureSerialized(serialized: string, budgetBytes?: number): StorageUsage {
  return measureUsage(byteLength(serialized), budgetBytes);
}

/** Formatage humain : « 512 o », « 1,4 Mo ». */
export function humanBytes(bytes: number): string {
  const n = Math.max(0, bytes);
  if (n < 1024) return `${Math.round(n)} o`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1).replace(".", ",") : Math.round(kb)} ko`;
  const mb = kb / 1024;
  return `${mb < 10 ? mb.toFixed(1).replace(".", ",") : Math.round(mb)} Mo`;
}

/** Nom de fichier de sauvegarde horodaté, stable pour les tests. */
export function backupFileName(date: Date = new Date(), prefix = "fimaac-sauvegarde"): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `${prefix}_${stamp}.json`;
}

/** Message affiché à l'utilisateur selon le niveau d'occupation. */
export function storageMessage(usage: StorageUsage, persistError: string | null = null): {
  tone: "info" | "warn" | "critical";
  title: string;
  detail: string;
} {
  if (persistError) {
    return {
      tone: "critical",
      title: "Vos modifications ne sont plus enregistrées",
      detail:
        `Le navigateur a refusé l'écriture (${persistError}). Le dossier reste affiché en mémoire, ` +
        "mais il sera perdu au rechargement : exportez une sauvegarde immédiatement.",
    };
  }
  if (usage.level === "critical") {
    return {
      tone: "critical",
      title: `Stockage local presque saturé (${usage.percent} %)`,
      detail: `${humanBytes(usage.bytes)} sur ${humanBytes(usage.budgetBytes)}. Exportez la sauvegarde puis archivez les exercices clos.`,
    };
  }
  if (usage.level === "warn") {
    return {
      tone: "warn",
      title: `Stockage local à ${usage.percent} %`,
      detail: `${humanBytes(usage.bytes)} sur ${humanBytes(usage.budgetBytes)}. Pensez à exporter une sauvegarde.`,
    };
  }
  return {
    tone: "info",
    title: "Environnement de démonstration — données locales",
    detail:
      `Vos données sont stockées dans ce navigateur (${humanBytes(usage.bytes)} sur ${humanBytes(usage.budgetBytes)}) ` +
      "et peuvent être effacées. Exportez une sauvegarde avant toute manipulation importante.",
  };
}
