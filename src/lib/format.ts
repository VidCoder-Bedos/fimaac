// Formatting helpers — FCFA / XOF, Africa/Lome, fr-FR
// Amounts are stored as INTEGER FCFA (XOF has no centime subdivision).
// Never use naive floating point for financial math — operate on integers.

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Format an integer FCFA amount: 1250000 -> "1 250 000 FCFA" */
export function fcfa(amount: number): string {
  const n = Math.round(amount || 0);
  const grouped = new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(Math.abs(n));
  // Remplace l'espace fin insécable (U+202F / U+00A0) par un espace standard plus large
  const widened = grouped.replace(/[\u202F\u00A0]/g, " ");
  const sign = n < 0 ? "−" : "";
  return `${sign}${widened} FCFA`;
}

/** Compact money for charts/KPIs: 1_250_000 -> "1,25 M" */
export function fcfaCompact(amount: number): string {
  const n = Math.abs(amount || 0);
  if (n >= 1_000_000_000) return (amount / 1_000_000_000).toFixed(2) + " Md";
  if (n >= 1_000_000) return (amount / 1_000_000).toFixed(2) + " M";
  if (n >= 1_000) return (amount / 1_000).toFixed(0) + " k";
  return String(amount);
}

/**
 * Parse a user-typed money string to integer FCFA.
 * M7 — remplace l'ancien `replace(/[^\d-]/g,"")` qui transformait « 1,5 M » en 15
 * et « 1.5 » en 15 (erreur de ×10 sur toute saisie décimale).
 * Gère : « 1 250 000 » · « 1,5 » · « 1,5 M » · « 250 k » · « (500 000) » · « -500 000 ».
 * Heuristique de séparateur identique à parseAmount (importers.ts).
 */
export function parseFcfa(input: string): number {
  if (input == null) return 0;
  let s = String(input).trim();
  let negative = false;
  if (/^\(.*\)$/.test(s)) negative = true;
  s = s.replace(/[()\s\u00a0]/g, "").replace(/^[−–-]+/, () => { negative = true; return ""; });
  if (s === "" || s === "-") return 0;
  // Suffixes de magnitude (saisie compacte)
  let mult = 1;
  if (/[Mm]\s*$/.test(s)) { mult = 1_000_000; s = s.replace(/[Mm]\s*$/, ""); }
  else if (/[kK]\s*$/.test(s)) { mult = 1_000; s = s.replace(/[kK]\s*$/, ""); }
  if (s === "" || s === ".") return 0;
  // Heuristique de séparateur décimal
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) {
    // virgule décimale : points = milliers
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma && (s.split(".").pop() ?? "").length === 3 && /\d{1,3}(\.\d{3})+/.test(s)) {
    // milliers en points : 1.250.000
    s = s.replace(/\./g, "");
  } else if (lastComma > -1 && lastComma === s.length - 4) {
    // milliers en virgules : 1,250,000
    s = s.replace(/,/g, "");
  }
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return 0;
  const v = Math.round(n * mult);
  return negative ? -v : v;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Lome",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Lome",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.round((d - now) / 1000);
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 2592000) return rtf.format(Math.round(diff / 86400), "day");
  if (abs < 31536000) return rtf.format(Math.round(diff / 2592000), "month");
  return rtf.format(Math.round(diff / 31536000), "year");
}

/**
 * m7 — Bornes de jour calculées en Africa/Lome (GMT+0, donc composants UTC),
 * alignées sur formatDate qui force déjà ce fuseau. Avant : minuit local du
 * navigateur → une échéance « aujourd'hui » devenait « demain » hors zone GMT.
 */
export function daysUntil(iso: string): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  const day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((day - today) / 86400000);
}

export function pct(value: number): string {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)} %`;
}

export function todayISO(): string {
  return new Date().toISOString();
}
