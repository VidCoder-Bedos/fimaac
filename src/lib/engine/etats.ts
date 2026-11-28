// ============================================================================
// FIMAAC — États financiers factorisés (DOCUMENT 5 §12-15)
// Bilan Actif/Passif, Compte de Résultat, TFT — tous N et N-1 via règles factorisées.
// ============================================================================
import type { EngineContext, Period, BilanResult, ResultatResult, TFTResult } from "./types";
import * as R from "./agregateurs";

/** §12-13 — Construit le Bilan pour une période en appelant les règles factorisées. */
export function buildBilan(ctx: EngineContext, period: Period): BilanResult {
  return {
    immoBrut: R.RULE_IMMO_BRUT(ctx, period),
    amort: R.RULE_AMORT(ctx, period),
    immoNet: R.RULE_IMMO_NET(ctx, period),
    stocks: R.RULE_STOCKS(ctx, period) - R.RULE_DEPREC_STOCKS(ctx, period),
    // P0-1 : les créances incluent désormais l'État (TVA récupérable, 445/4492)
    // et sont nettes des dépréciations (49).
    creances: R.RULE_CREANCES_CLIENTS(ctx, period) + R.RULE_CREANCES_ETAT(ctx, period) +
      R.RULE_CREANCES_FISCALES_SOCIALES(ctx, period) +
      R.RULE_AUTRES_CREANCES(ctx, period) - R.RULE_DEPREC_CREANCES(ctx, period),
    // La trésorerie regroupe titres, valeurs à encaisser, banque/caisse et
    // écarts de conversion : c'est la composante exposée par le bilan.
    tresorerie: R.RULE_TITRES_PLACEMENT(ctx, period) + R.RULE_VALEURS_ENCAISSER(ctx, period) +
      R.RULE_BANQUE_CAISSE(ctx, period) + R.RULE_ECART_CONV_ACTIF(ctx, period),
    totalActif: R.RULE_TOTAL_ACTIF(ctx, period),
    capitaux: R.RULE_CAPITAUX_PROPRES(ctx, period),
    resultat: R.RULE_RESULTAT_PASSIF(ctx, period),
    dettesFin: R.RULE_DETTES_FINANCIERES(ctx, period),
    dettesFourn: R.RULE_DETTES_FOURNISSEURS(ctx, period),
    dettesFiscalesSociales: R.RULE_DETTES_FISCALES_SOCIALES(ctx, period),
    autresDettes: R.RULE_AUTRES_DETTES(ctx, period),
    tresoPassif: R.RULE_TRESORERIE_PASSIF(ctx, period),
    totalPassif: R.RULE_TOTAL_PASSIF(ctx, period),
  };
}

/** §14 — Construit le Compte de Résultat pour une période. */
export function buildResultat(ctx: EngineContext, period: Period): ResultatResult {
  return {
    produits: R.RULE_TOTAL_PRODUITS(ctx, period),
    charges: R.RULE_TOTAL_CHARGES(ctx, period),
    resultat: R.RULE_RESULTAT_NET(ctx, period),
  };
}

/** §15 — Construit le TFT pour une période (réutilise les mêmes soldes). */
export function buildTFT(ctx: EngineContext, period: Period): TFTResult {
  return {
    caf: R.RULE_CAF(ctx, period),
    variationTresorerie: R.RULE_TRESORERIE_NETTE(ctx, "N") - R.RULE_TRESORERIE_NETTE(ctx, "N-1"),
    soldeNet: R.RULE_TRESORERIE_NETTE(ctx, period),
  };
}

type VariationMap = Record<string, { n: number; n1: number; absolute: number; relative: number | null }>;

/** Construit tous les états pour les deux périodes + variations N/N-1. */
export function buildAllStates(ctx: EngineContext): {
  bilan: Record<Period, BilanResult>;
  resultat: Record<Period, ResultatResult>;
  tft: Record<Period, TFTResult>;
  variations: Record<string, { n: number; n1: number; absolute: number; relative: number | null }>;
} {
  const bilanN = buildBilan(ctx, "N");
  const bilanN1 = buildBilan(ctx, "N-1");
  const resultatN = buildResultat(ctx, "N");
  const resultatN1 = buildResultat(ctx, "N-1");
  const tftN = buildTFT(ctx, "N");
  const tftN1 = buildTFT(ctx, "N-1");

  // §11 — Variations N/N-1 pour chaque poste clé
  const varBilan = computeVariations(bilanN, bilanN1);
  const varResultat = computeVariations(resultatN, resultatN1);

  return {
    bilan: { N: bilanN, "N-1": bilanN1 },
    resultat: { N: resultatN, "N-1": resultatN1 },
    tft: { N: tftN, "N-1": tftN1 },
    variations: { ...varBilan, ...varResultat },
  };
}

/** §11 — Calcule les variations N/N-1 pour un objet de résultats. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function computeVariations(n: any, n1: any): VariationMap {
  const out: VariationMap = {};
  for (const key of Object.keys(n)) {
    const valN = n[key];
    const valN1 = n1[key] ?? 0;
    const absolute = valN - valN1;
    const relative = valN1 !== 0 ? absolute / Math.abs(valN1) : null;
    out[key] = { n: valN, n1: valN1, absolute, relative };
  }
  return out;
}
