// ============================================================================
// FIMAAC — Moteur fiscal factorisé (DOCUMENT 5 §18-19)
// Résultat fiscal et liquidations — réutilise les règles des états.
// ============================================================================
import type { EngineContext, FiscaliteResult, LiquidationISResult } from "./types";
import * as R from "./agregateurs";
import {
  computeIsFiscal,
  computeTvaFiscal,
  fiscalBaseFromMoves,
  roundDown,
  IS_PARAMS_DEFAUT,
  type FiscalBase,
  type IsParams,
  type TvaComputation,
} from "../fiscalite";

/**
 * Base fiscale calculée depuis la balance N du contexte.
 * P0-2 : le moteur ne calcule plus l'IS ni la TVA lui-même — il alimente
 * `lib/fiscalite.ts`, partagé avec la page Fiscalité et les déclarations.
 */
export function fiscalBaseFromCtx(ctx: EngineContext, p: "N" | "N-1" = "N"): FiscalBase {
  const rows = p === "N" ? ctx.balanceN : ctx.balanceN1;
  const moves = new Map<string, { debit: number; credit: number }>();
  for (const r of rows) {
    const cur = moves.get(r.code) || { debit: 0, credit: 0 };
    cur.debit += r.debit;
    cur.credit += r.credit;
    moves.set(r.code, cur);
  }
  return fiscalBaseFromMoves(moves);
}

/** §18 — Résultat fiscal = résultat net + réintégrations − déductions. */
export function computeResultatFiscal(
  ctx: EngineContext,
  opts: { reintegrations?: number; deductions?: number; deficits?: number; credits?: number; ajustement?: number },
): { resultatFiscal: number; resultatFiscalArrondi: number } {
  const resultatNet = R.RULE_RESULTAT_NET(ctx, "N");
  const reintegration = opts.reintegrations ?? 0;
  const deduction = opts.deductions ?? 0;
  const deficit = opts.deficits ?? 0;
  const credit = opts.credits ?? 0;
  const ajustement = opts.ajustement ?? 0;

  // D6 = résultat net ; D51 = D6 + réintégrations − déductions ; D54 = D51 − déficits − crédits
  const rfBrut = resultatNet + reintegration - deduction;
  const rfNet = rfBrut - deficit - credit;
  // D56 = ROUNDDOWN(D54 - D55, -3) — arrondi au millier inférieur
  const rfArrondi = roundDown(rfNet - ajustement, -3);

  return { resultatFiscal: rfNet, resultatFiscalArrondi: rfArrondi };
}

/**
 * §19 — Liquidation IS_IR_MP.
 * Formules du classeur (H12 = minimum de perception, H14 = IS au taux,
 * H15 = MAX(H12; H14)) désormais portées par `lib/fiscalite.ts` : une seule
 * implémentation pour l'écran, le moteur et les déclarations.
 */
export function computeLiquidationIS(
  ctx: EngineContext,
  resultatFiscalArrondi: number,
  _acomptes: number = 0,
  params: IsParams = IS_PARAMS_DEFAUT,
): LiquidationISResult {
  const base = fiscalBaseFromCtx(ctx, "N");
  const is = computeIsFiscal(resultatFiscalArrondi, base, params);
  return {
    chiffreAffaires: base.chiffreAffaires,
    minimumPerception: is.minimumPerception,
    impotCalcule: is.impotCalcule,
    impotDu: is.impotDu,
  };
}

/** §18-19 — Pipeline fiscal complet. */
export function buildFiscalite(
  ctx: EngineContext,
  opts: { reintegrations?: number; deductions?: number } = {},
): FiscaliteResult {
  const rf = computeResultatFiscal(ctx, opts);
  const is = computeLiquidationIS(ctx, rf.resultatFiscalArrondi);
  const resultatComptable = R.RULE_RESULTAT_NET(ctx, "N");
  const base = fiscalBaseFromCtx(ctx, "N");
  // TVA de la période — même calcul que la page Fiscalité (P0-2).
  const tva: TvaComputation = computeTvaFiscal(base, { rate: 18 });

  return {
    resultatComptable,
    reintegrations: opts.reintegrations ?? 0,
    deductions: opts.deductions ?? 0,
    resultatFiscal: rf.resultatFiscal,
    resultatFiscalArrondi: rf.resultatFiscalArrondi,
    is,
    tva,
  };
}
