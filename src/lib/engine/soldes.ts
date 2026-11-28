// ============================================================================
// FIMAAC — Moteur de soldes unifié (DOCUMENT 5 §5-6)
// UNE logique, DEUX périodes (N et N-1) via paramètre period.
// Toutes les fonctions d'états appellent CE moteur — jamais les cellules Excel directement.
// ============================================================================
import type { EngineContext, Period, NormalizedBalance } from "./types";
import type { Account } from "../types";

/**
 * §5 — Retourne les données de balance pour la période demandée.
 * Le seul point d'accès aux données brutes. Tout le reste du moteur passe par ici.
 */
export function getBalance(ctx: EngineContext, period: Period): NormalizedBalance[] {
  return period === "N" ? ctx.balanceN : ctx.balanceN1;
}

/**
 * §5 — Solde d'un compte exact pour une période.
 */
export function accountBalance(ctx: EngineContext, code: string, period: Period): { debit: number; credit: number } {
  const balance = getBalance(ctx, period);
  const row = balance.find((r) => r.code === code);
  return { debit: row?.debit ?? 0, credit: row?.credit ?? 0 };
}

/**
 * §6 — Agrégation factorisée par préfixes de comptes.
 * C'est LA fonction centrale : tous les états, notes, annexes et contrôles l'appellent.
 *
 * @param ctx       Contexte moteur
 * @param prefixes  Codes ou préfixes (ex: ["601"], ["6"], ["401","403"])
 * @param period    "N" ou "N-1"
 * @param sign      "debit" (solde débiteur) ou "credit" (solde créditeur)
 * @returns         Somme signée des soldes
 *
 * Exemples d'appels identiques avec period différent :
 *   aggregate(ctx, ["7"], "N", "credit")     → Produits exercice N
 *   aggregate(ctx, ["7"], "N-1", "credit")   → Produits exercice N-1
 */
export function aggregate(
  ctx: EngineContext,
  prefixes: string[],
  period: Period,
  sign: "debit" | "credit",
): number {
  // Cache — §21 : si déjà calculé, retourner le résultat
  const cacheKey = `agg:${prefixes.join(",")}:${period}:${sign}`;
  if (ctx.cache.has(cacheKey)) return ctx.cache.get(cacheKey)!;

  const balance = getBalance(ctx, period);
  let total = 0;
  const sourceCodes: string[] = [];

  for (const row of balance) {
    const matches = prefixes.some((p) => row.code === p || row.code.startsWith(p));
    if (!matches) continue;
    if (sign === "debit") {
      total += row.debit - row.credit;
    } else {
      total += row.credit - row.debit;
    }
    sourceCodes.push(row.code);
  }

  // §24 — Traçabilité
  ctx.trace.push({
    ruleId: `AGG:${prefixes.join(",")}`,
    period,
    result: total,
    sourceCodes,
    formula: `aggregate([${prefixes.join(", ")}], ${period}, ${sign})`,
    timestamp: Date.now(),
  });

  // §21 — Mise en cache
  ctx.cache.set(cacheKey, total);
  return total;
}

/**
 * §11 — Variation N/N-1 pour une règle donnée.
 * Retourne N, N-1, la variation absolue et relative.
 * Traite explicitement N-1 = 0 → relative = null.
 */
export function variation(
  ruleFn: (ctx: EngineContext, period: Period) => number,
  ctx: EngineContext,
): { n: number; n1: number; absolute: number; relative: number | null } {
  const n = ruleFn(ctx, "N");
  const n1 = ruleFn(ctx, "N-1");
  const absolute = n - n1;
  const relative = n1 !== 0 ? absolute / Math.abs(n1) : null;
  return { n, n1, absolute, relative };
}

/**
 * §6 — Agrégation par exclusion (tous les comptes sauf ceux listés).
 * Utile pour "toutes les créances sauf les clients".
 */
export function aggregateExcept(
  ctx: EngineContext,
  includePrefixes: string[],
  excludePrefixes: string[],
  period: Period,
  sign: "debit" | "credit",
): number {
  const balance = getBalance(ctx, period);
  let total = 0;
  for (const row of balance) {
    const included = includePrefixes.some((p) => row.code === p || row.code.startsWith(p));
    const excluded = excludePrefixes.some((p) => row.code === p || row.code.startsWith(p));
    if (!included || excluded) continue;
    total += sign === "debit" ? row.debit - row.credit : row.credit - row.debit;
  }
  return total;
}

/**
 * P15 — Agrégation **par sens du solde** : seuls les comptes dont le solde va
 * dans le sens demandé sont retenus, et pour leur valeur absolue.
 *
 * Un compte 44 « État » débiteur (impôt payé d'avance) n'est pas une dette : il
 * appartient à l'actif. L'ancienne agrégation signée le retranchait des dettes
 * fiscales, si bien que ce montant disparaissait des deux côtés du bilan.
 */
export function aggregateSigned(
  ctx: EngineContext,
  includePrefixes: string[],
  excludePrefixes: string[],
  period: Period,
  sign: "debit" | "credit",
): number {
  const balance = getBalance(ctx, period);
  let total = 0;
  const sourceCodes: string[] = [];
  for (const row of balance) {
    const included = includePrefixes.some((p) => row.code === p || row.code.startsWith(p));
    const excluded = excludePrefixes.some((p) => row.code === p || row.code.startsWith(p));
    if (!included || excluded) continue;
    const solde = row.debit - row.credit;
    const retained = sign === "debit" ? Math.max(0, solde) : Math.max(0, -solde);
    if (retained === 0) continue;
    total += retained;
    sourceCodes.push(row.code);
  }
  ctx.trace.push({
    ruleId: `SIGNED:${includePrefixes.join(",")}:${sign}`,
    period,
    result: total,
    sourceCodes,
    formula: `aggregateSigned([${includePrefixes.join(", ")}], ${period}, ${sign})`,
    timestamp: Date.now(),
  });
  return total;
}

/**
 * Crée un contexte moteur fraîchement initialisé.
 */
export function createContext(
  balanceN: NormalizedBalance[],
  balanceN1: NormalizedBalance[],
  accounts: { code: string; classNumber: number; label?: string }[],
): EngineContext {
  return {
    balanceN,
    balanceN1,
    accounts: accounts as Account[],
    cache: new Map(),
    trace: [],
  };
}
