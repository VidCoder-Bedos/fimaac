// ============================================================================
// FIMAAC — Production Engine : contexte de production immuable (P0)
// Les états sont calculés par le moteur factorisé (engine/etats) à partir des
// balances N / N-1. Si aucune balance n'est fournie, le contexte reste vide.
// ============================================================================
import type { ProdContext, ProdStates, DataPoint, NoteResult } from "./types";
import { toBalance } from "../engine/types";
import type { BalanceRowInput } from "../engine/types";
import { buildAllStates } from "../engine/etats";
import { createContext as createEngineContext } from "../engine/soldes";

const EMPTY_STATES: ProdStates = {
  bilan: {
    N: zeroBilan(),
    "N-1": zeroBilan(),
  },
  resultat: {
    N: { produits: 0, charges: 0, resultat: 0 },
    "N-1": { produits: 0, charges: 0, resultat: 0 },
  },
  tft: {
    N: { caf: 0, variationTresorerie: 0, soldeNet: 0 },
    "N-1": { caf: 0, variationTresorerie: 0, soldeNet: 0 },
  },
  variations: {},
};

function zeroBilan() {
  return {
    immoBrut: 0, amort: 0, immoNet: 0, stocks: 0, creances: 0, tresorerie: 0,
    totalActif: 0, capitaux: 0, resultat: 0, dettesFin: 0, dettesFourn: 0,
    autresDettes: 0, tresoPassif: 0, totalPassif: 0,
  };
}

/** États par défaut (toutes les valeurs à zéro). */
export function emptyStates(): ProdStates {
  return EMPTY_STATES;
}

/**
 * Construit un contexte de production.
 * Si des balances sont fournies et qu'aucun état n'est imposé, elles sont
 * calculées par le moteur factorisé.
 */
export function createProdContext(partial: Partial<ProdContext> = {}): ProdContext {
  const balances = {
    n: toBalance((partial.balances?.n ?? []) as BalanceRowInput[]),
    n1: toBalance((partial.balances?.n1 ?? []) as BalanceRowInput[]),
  };

  let states = partial.states ?? EMPTY_STATES;
  const hasBalances = balances.n.length > 0 || balances.n1.length > 0;
  if (hasBalances && !partial.states) {
    const engineCtx = createEngineContext(balances.n, balances.n1, partial.accounts ?? []);
    states = buildAllStates(engineCtx);
  }

  return {
    companyName: partial.companyName || "",
    exercise: partial.exercise || "",
    balances,
    accounts: partial.accounts || [],
    states,
    dataPoints: partial.dataPoints || new Map<string, DataPoint>(),
    notes: partial.notes || new Map<string, NoteResult>(),
    fiscalOpts: partial.fiscalOpts || {},
  };
}

/** Copie immuable du contexte (propagation d'impact sans mutation). */
export function withStates(ctx: ProdContext, states: ProdStates): ProdContext {
  return { ...ctx, states };
}

export { createProdContext as buildProdContext };
