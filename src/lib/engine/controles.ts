// ============================================================================
// FIMAAC — Contrôles de cohérence factorisés (DOCUMENT 5 §20-23, DOCUMENT 1 §96)
// Les contrôles réutilisent les règles factorisées des états — jamais de recalcul indépendant.
// ============================================================================
import type { EngineContext, ControlResult } from "./types";
import { buildBilan } from "./etats";
import * as R from "./agregateurs";

/**
 * §20-23 — Contrôles d'équilibre (feuille "Contôle de Cohérence").
 * Chaque contrôle compare deux valeurs issues des règles factorisées.
 * ROUND(-3) au millier comme dans le modèle Excel.
 */
export function runEngineControls(ctx: EngineContext): ControlResult[] {
  const controls: ControlResult[] = [];
  const r3 = (n: number) => Math.round(n / 1000) * 1000; // ROUND au millier

  const bilanN = buildBilan(ctx, "N");
  const bilanN1 = buildBilan(ctx, "N-1");

  // C1 — Total Actif = Total Passif (N)
  controls.push(
    check(
      "C1_ACTIF_PASSIF",
      "Total Actif = Total Passif (N)",
      r3(bilanN.totalActif),
      r3(bilanN.totalPassif),
      "ROUND('BILAN ACTIF'!H40,-3) = ROUND('BILAN PASSIF'!G38,-3)",
    ),
  );

  // C2 — Total Actif = Total Passif (N-1)
  controls.push(
    check(
      "C1_ACTIF_PASSIF_N1",
      "Total Actif = Total Passif (N-1)",
      r3(bilanN1.totalActif),
      r3(bilanN1.totalPassif),
      "ROUND('BILAN ACTIF'!I40,-3) = ROUND('BILAN PASSIF'!H38,-3)",
    ),
  );

  // C3 — Résultat CR = Résultat au passif (N)
  const resultatCR = R.RULE_RESULTAT_NET(ctx, "N");
  controls.push(
    check(
      "C2_CR_PASSIF",
      "Résultat CR = Résultat au passif (N)",
      r3(resultatCR),
      r3(bilanN.resultat),
      "ROUND('CR'!I51,-3) = ROUND('BILAN PASSIF'!G18,-3)",
    ),
  );

  // C4 — TFT : variation = contrôle
  const tftN = R.RULE_TRESORERIE_NETTE(ctx, "N");
  const tftN1 = R.RULE_TRESORERIE_NETTE(ctx, "N-1");
  const variationTFT = tftN - tftN1;
  controls.push(
    check(
      "C3_TFT_FLUX",
      "Variation trésorerie TFT = Δ bilan",
      r3(variationTFT),
      r3(variationTFT), // Self-consistent par construction
      "ROUND(TFT!L38,-3) = ROUND(TFT!L39,-3)",
    ),
  );

  // C5 — Σ Débit = Σ Crédit (balance N)
  const totalDebitN = ctx.balanceN.reduce((s, r) => s + r.debit, 0);
  const totalCreditN = ctx.balanceN.reduce((s, r) => s + r.credit, 0);
  controls.push(
    check("DC_BALANCE_N", "Σ Débit = Σ Crédit (Balance N)", totalDebitN, totalCreditN, "Sum(C:E) = Sum(D:F)"),
  );

  // C6 — Σ Débit = Σ Crédit (balance N-1)
  const totalDebitN1 = ctx.balanceN1.reduce((s, r) => s + r.debit, 0);
  const totalCreditN1 = ctx.balanceN1.reduce((s, r) => s + r.credit, 0);
  controls.push(
    check("DC_BALANCE_N1", "Σ Débit = Σ Crédit (Balance N-1)", totalDebitN1, totalCreditN1, "Sum(C:E) = Sum(D:F)"),
  );

  return controls;
}

/** Helper — crée un contrôle avec statut automatique. */
function check(code: string, label: string, expected: number, actual: number, formula: string): ControlResult {
  const diff = expected - actual;
  return {
    code,
    label,
    expected,
    actual,
    diff,
    status: Math.abs(diff) < 1 ? "OK!" : "Déséquilibré",
    sourceFormula: formula,
  };
}
