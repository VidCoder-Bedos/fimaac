// ============================================================================
// FIMAAC — Moteur fiscal factorisé (DOCUMENT 5 §18-19)
// Résultat fiscal et liquidations — réutilise les règles des états.
// ============================================================================
import type { EngineContext, FiscaliteResult, LiquidationISResult } from "./types";
import * as R from "./agregateurs";

/** ROUNDDOWN Excel : tronque vers zéro au multiple 10^digits. */
function roundDown(value: number, digits: number): number {
  if (digits >= 0) return Math.trunc(value * Math.pow(10, digits)) / Math.pow(10, digits);
  const f = Math.pow(10, -digits);
  return Math.trunc(value / f) * f;
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

/** §19 — Liquidation IS_IR_MP (DOCUMENT 4, feuille Liquidation IS_IR_MP, 16 formules). */
export function computeLiquidationIS(
  ctx: EngineContext,
  resultatFiscalArrondi: number,
  _acomptes: number = 0,
): LiquidationISResult {
  // H9 = CA du CR ; H11 = H9 (+ H10 = ajustement manuel, défaut 0)
  const chiffreAffaires = R.RULE_CHIFFRE_AFFAIRES(ctx, "N");

  // H12 = ROUNDDOWN(IF(H11 <= 2 000 000; 20 000; H11/100); -1)
  const minimumPerception = roundDown(chiffreAffaires <= 2_000_000 ? 20_000 : chiffreAffaires / 100, -1);

  // H14 = IF(H13 > 0; ROUNDDOWN(H13 * 0.27; -1); 0)
  const impotCalcule = resultatFiscalArrondi > 0 ? roundDown(resultatFiscalArrondi * 0.27, -1) : 0;

  // H15 = MAX(H12; H14)
  const impotDu = Math.max(minimumPerception, impotCalcule);

  return { chiffreAffaires, minimumPerception, impotCalcule, impotDu };
}

/** §18-19 — Pipeline fiscal complet. */
export function buildFiscalite(
  ctx: EngineContext,
  opts: { reintegrations?: number; deductions?: number } = {},
): FiscaliteResult {
  const rf = computeResultatFiscal(ctx, opts);
  const is = computeLiquidationIS(ctx, rf.resultatFiscalArrondi);
  const resultatComptable = R.RULE_RESULTAT_NET(ctx, "N");

  return {
    resultatComptable,
    reintegrations: opts.reintegrations ?? 0,
    deductions: opts.deductions ?? 0,
    resultatFiscal: rf.resultatFiscal,
    resultatFiscalArrondi: rf.resultatFiscalArrondi,
    is,
  };
}
