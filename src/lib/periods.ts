// ============================================================================
// FIMAAC — Rattachement d'une date comptable à son exercice et à sa période
//
// Constat d'audit : une écriture datée hors exercice était rattachée à la
// **première période du dossier**, et son `fiscalYearId` au **premier exercice**
// trouvé. Deux effets pervers, tous deux silencieux : l'écriture apparaissait
// dans les états d'un exercice qu'elle ne concernait pas, et le contrôle de
// période clôturée portait sur la mauvaise période — donc une saisie pouvait
// atterrir dans un exercice clos.
//
// Règle retenue ici : une date est acceptée pour ce qu'elle est, ou refusée en
// le disant. Jamais déplacée.
// ============================================================================
import type { AccountingPeriod, FiscalYear } from "./types";

export type PlacementCode =
  | "ok"
  | "invalid-date"
  | "outside-fiscal-year"
  | "closed-fiscal-year"
  | "closed-period"
  | "ambiguous";

export interface DatePlacement {
  ok: boolean;
  code: PlacementCode;
  /** Message prêt à afficher, nommant la date et le motif. */
  message: string;
  fiscalYear: FiscalYear | null;
  period: AccountingPeriod | null;
  /**
   * Vrai quand l'exercice est ouvert mais que la période mensuelle n'existe pas
   * encore : l'appelant la crée, plutôt que de détourner une autre période.
   */
  periodCreated: boolean;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export const isValidIsoDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !ISO.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
};

const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

const monthLabel = (iso: string) => {
  const [y, m] = iso.split("-");
  return `${MONTHS[Number(m) - 1]} ${y}`;
};

/** Exercice qui contient la date (bornes incluses), le plus récent en cas de chevauchement. */
export function fiscalYearFor(date: string, fiscalYears: FiscalYear[]): FiscalYear | null {
  const matching = fiscalYears.filter((f) => f.startDate <= date && date <= f.endDate);
  if (matching.length === 0) return null;
  return matching.sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
}

/** Liste lisible des exercices du dossier, pour un message d'erreur utile. */
export function describeFiscalYears(fiscalYears: FiscalYear[]): string {
  if (fiscalYears.length === 0) return "aucun exercice n'est défini";
  return fiscalYears
    .slice()
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .map((f) => `${f.label} (${f.startDate} → ${f.endDate}${f.status === "closed" ? ", clos" : ""})`)
    .join(" · ");
}

/**
 * Résout l'exercice et la période d'une date comptable.
 * Ne modifie rien : retourne un diagnostic que l'appelant applique.
 */
export function resolveAccountingDate(
  date: string,
  fiscalYears: FiscalYear[],
  periods: AccountingPeriod[],
  opts: { companyId?: string } = {},
): DatePlacement {
  const fail = (code: PlacementCode, message: string, fy: FiscalYear | null = null, period: AccountingPeriod | null = null): DatePlacement => ({
    ok: false, code, message, fiscalYear: fy, period, periodCreated: false,
  });

  if (!isValidIsoDate(date)) {
    return fail("invalid-date", `Date comptable invalide : « ${String(date)} ». Format attendu AAAA-MM-JJ.`);
  }

  const scopedYears = opts.companyId ? fiscalYears.filter((f) => f.companyId === opts.companyId) : fiscalYears;
  const fy = fiscalYearFor(date, scopedYears);
  if (!fy) {
    return fail(
      "outside-fiscal-year",
      `La date ${date} n'appartient à aucun exercice du dossier : ${describeFiscalYears(scopedYears)}. Créez l'exercice correspondant ou choisissez une date dans ces bornes.`,
    );
  }
  if (fy.status === "closed") {
    return fail("closed-fiscal-year", `L'exercice ${fy.label} est clos : la date ${date} n'est pas saisissable.`, fy);
  }

  const month = Number(date.slice(5, 7));
  const year = Number(date.slice(0, 4));
  const scopedPeriods = periods.filter((p) => (!opts.companyId || p.companyId === opts.companyId) && p.month === month && p.year === year);
  const period = scopedPeriods.find((p) => p.fiscalYearId === fy.id) ?? scopedPeriods[0] ?? null;

  if (period) {
    if (period.status === "closed") {
      return fail("closed-period", `La période ${monthLabel(date)} est clôturée : la date ${date} n'est pas modifiable.`, fy, period);
    }
    return {
      ok: true,
      code: "ok",
      message: `Écriture rattachée à ${fy.label}, période ${monthLabel(date)}.`,
      fiscalYear: fy,
      period,
      periodCreated: false,
    };
  }

  // Aucune période pour ce mois, mais l'exercice est ouvert : la période sera
  // créée par l'appelant (et tracée), au lieu de détourner une autre période.
  return {
    ok: true,
    code: "ok",
    message: `Période ${monthLabel(date)} absente : elle sera créée dans ${fy.label}.`,
    fiscalYear: fy,
    period: null,
    periodCreated: true,
  };
}

export interface PlacementAnomaly {
  entryId: string;
  number: string;
  date: string;
  reason: string;
}

export interface PlacementAudit {
  ok: boolean;
  checked: number;
  anomalies: PlacementAnomaly[];
  /** Écritures rattachées à un exercice qui ne contient pas leur date. */
  wrongFiscalYear: number;
  /** Écritures rattachées à une période qui ne contient pas leur date. */
  wrongPeriod: number;
  /** Écritures sans exercice ou sans période. */
  unassigned: number;
}

/**
 * Contrôle l'héritage : une écriture doit être rattachée à l'exercice et à la
 * période qui contiennent sa date. Les écarts sont listés, jamais corrigés
 * d'office — déplacer une écriture est un acte comptable, pas un nettoyage.
 */
export function auditFiscalYearPlacement(
  entries: { id: string; number: string; date: string; fiscalYearId: string; periodId: string }[],
  fiscalYears: FiscalYear[],
  periods: AccountingPeriod[],
): PlacementAudit {
  const fyById = new Map(fiscalYears.map((f) => [f.id, f]));
  const periodById = new Map(periods.map((p) => [p.id, p]));
  const anomalies: PlacementAnomaly[] = [];
  let wrongFiscalYear = 0;
  let wrongPeriod = 0;
  let unassigned = 0;

  for (const e of entries) {
    const fy = fyById.get(e.fiscalYearId);
    const period = periodById.get(e.periodId);
    if (!fy || !period) {
      unassigned += 1;
      anomalies.push({ entryId: e.id, number: e.number, date: e.date, reason: !fy ? "exercice inconnu" : "période inconnue" });
      continue;
    }
    if (!(fy.startDate <= e.date && e.date <= fy.endDate)) {
      wrongFiscalYear += 1;
      anomalies.push({ entryId: e.id, number: e.number, date: e.date, reason: `exercice ${fy.label} (${fy.startDate} → ${fy.endDate})` });
      continue;
    }
    if (!(period.startDate <= e.date && e.date <= period.endDate)) {
      // La période se termine parfois au 28 dans les jeux de données : on
      // tolère le mois, on refuse l'écart d'exercice ou de mois.
      const sameMonth = period.startDate.slice(0, 7) === e.date.slice(0, 7);
      if (!sameMonth) {
        wrongPeriod += 1;
        anomalies.push({ entryId: e.id, number: e.number, date: e.date, reason: `période ${period.startDate.slice(0, 7)}` });
      }
    }
  }

  return {
    ok: anomalies.length === 0,
    checked: entries.length,
    anomalies,
    wrongFiscalYear,
    wrongPeriod,
    unassigned,
  };
}
