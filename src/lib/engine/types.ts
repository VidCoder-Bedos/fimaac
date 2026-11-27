// ============================================================================
// FIMAAC — Moteur factorisé DRY (DOCUMENT 5 — Matrice des flux)
// Une logique, plusieurs utilisations. BALANCE N + N-1 → États → Notes → Fiscalité → Contrôles.
// ============================================================================
import type { Account } from "../types";

/** Shape accepté en entrée (compatible BalanceRow de liasse.ts et BalanceRowLite de types.ts). */
export interface BalanceRowInput {
  code: string;
  label: string;
  debit: number;
  credit: number;
}

/** Période d'exercice — paramètre central du moteur factorisé. */
export type Period = "N" | "N-1";

/** Ligne de balance normalisée (N ou N-1). */
export interface NormalizedBalance {
  code: string;
  label: string;
  debit: number;
  credit: number;
}

/** Contexte d'exercice passé à toutes les fonctions du moteur. */
export interface EngineContext {
  balanceN: NormalizedBalance[];
  balanceN1: NormalizedBalance[];
  accounts: Account[];
  cache: Map<string, number>;
  trace: TraceEntry[];
}

/** Définition d'une règle factorisée (registre central). */
export interface RuleDefinition {
  ruleId: string;
  name: string;
  category: string;
  sourceCells: string[];
  sourceSheets: string[];
  parameters: Record<string, unknown>;
  dependencies: string[];
  status: "VALIDATED" | "REFUSED" | "PENDING";
}

/** Entrée de traçabilité (source → résultat). */
export interface TraceEntry {
  ruleId: string;
  period: Period;
  result: number;
  sourceCodes: string[];
  formula: string;
  timestamp: number;
}

/** Résultat d'une variation N/N-1. */
export interface VariationResult {
  n: number;
  n1: number;
  absolute: number;
  relative: number | null; // null quand N-1 = 0
}

/** Résultat complet du moteur pour une entreprise. */
export interface EngineResult {
  context: EngineContext;
  bilan: Record<Period, BilanResult>;
  resultat: Record<Period, ResultatResult>;
  tft: Record<Period, TFTResult>;
  variations: Record<string, VariationResult>;
  fiscalite: FiscaliteResult;
  controls: ControlResult[];
  traceability: TraceEntry[];
}

/** Bilan (actif + passif) pour une période. */
export interface BilanResult {
  immoBrut: number;
  amort: number;
  immoNet: number;
  stocks: number;
  creances: number;
  tresorerie: number;
  totalActif: number;
  capitaux: number;
  resultat: number;
  dettesFin: number;
  dettesFourn: number;
  autresDettes: number;
  tresoPassif: number;
  totalPassif: number;
}

/** Compte de résultat (SIG en cascade) pour une période. */
export interface ResultatResult {
  produits: number;
  charges: number;
  resultat: number;
}

/** TFT pour une période. */
export interface TFTResult {
  caf: number;
  variationTresorerie: number;
  soldeNet: number;
}

/** Résultat fiscal et liquidations. */
export interface FiscaliteResult {
  resultatComptable: number;
  reintegrations: number;
  deductions: number;
  resultatFiscal: number;
  resultatFiscalArrondi: number;
  is: LiquidationISResult;
}

export interface LiquidationISResult {
  chiffreAffaires: number;
  minimumPerception: number;
  impotCalcule: number;
  impotDu: number;
}

/** Résultat d'un contrôle de cohérence. */
export interface ControlResult {
  code: string;
  label: string;
  expected: number;
  actual: number;
  diff: number;
  status: "OK!" | "Déséquilibré";
  sourceFormula: string;
}

/** Convertit les BalanceRow du système existant vers le format moteur. */
export function toBalance(rows: BalanceRowInput[] | null | undefined): NormalizedBalance[] {
  if (!rows || !Array.isArray(rows)) return [];
  return rows.map((r) => ({
    code: String(r.code || "").trim(),
    label: r.label || "",
    debit: Number(r.debit) || 0,
    credit: Number(r.credit) || 0,
  }));
}
