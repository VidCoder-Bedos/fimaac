// ============================================================================
// FIMAAC — Source de vérité UNIQUE des calculs fiscaux (TVA, IS)
//
// Constat d'audit (E.3) : trois implémentations coexistaient et donnaient
// trois réponses différentes pour le même dossier —
//   1. la page Fiscalité (lib/tax.ts) : IS = 0, base TVA = TVA collectée ;
//   2. le moteur factorisé (lib/engine/fiscalite.ts) : IS = minimum de
//      perception, mais jamais affiché ;
//   3. la grille TVA (lib/actions.ts :: tvaGrid) : base HT reconstituée.
// Un cabinet qui s'appuie sur l'écran sous-estimait l'impôt de 201 900 FCFA
// sur le seul dossier de démonstration.
//
// Ce module ne dépend ni de React, ni du store, ni d'un moteur particulier :
// il ne manipule que des nombres. Les quatre appelants s'y raccordent.
// ============================================================================

export interface Mouvement {
  debit: number;
  credit: number;
}

/** Grandeurs comptables dont dérivent tous les impôts. */
export interface FiscalBase {
  /** Chiffre d'affaires HT (comptes 70x, solde créditeur). */
  chiffreAffaires: number;
  /** Total des produits (classe 7). */
  produits: number;
  /** Total des charges (classe 6). */
  charges: number;
  /** Résultat comptable = produits − charges. */
  resultatComptable: number;
  /** TVA facturée (443x), solde créditeur. */
  tvaCollectee: number;
  /** TVA déductible (445x), solde débiteur, immobilisations incluses. */
  tvaDeductible: number;
  /** Part immobilisations de la TVA déductible (4451) — ventilation informative. */
  tvaDeductibleImmo: number;
}

/**
 * Extrait les grandeurs fiscales d'un ensemble de mouvements de comptes.
 * `moves` est le format retourné par `movementsByAccount` (écritures validées).
 */
export function fiscalBaseFromMoves(moves: Map<string, Mouvement>): FiscalBase {
  let chiffreAffaires = 0;
  let produits = 0;
  let charges = 0;
  let tvaCollectee = 0;
  let tvaDeductible = 0;
  let tvaDeductibleImmo = 0;

  for (const [code, m] of moves) {
    if (code.startsWith("70")) chiffreAffaires += m.credit - m.debit;
    if (code.startsWith("7")) produits += m.credit - m.debit;
    if (code.startsWith("6")) charges += m.debit - m.credit;
    if (code.startsWith("443")) tvaCollectee += m.credit - m.debit;
    if (code.startsWith("445")) {
      const deductible = m.debit - m.credit;
      tvaDeductible += deductible;
      if (code.startsWith("4451")) tvaDeductibleImmo += deductible;
    }
  }

  return {
    chiffreAffaires,
    produits,
    charges,
    resultatComptable: produits - charges,
    tvaCollectee,
    tvaDeductible,
    tvaDeductibleImmo,
  };
}

/** Arrondi « ROUNDDOWN » de tableur : tronque vers zéro au multiple 10^digits. */
export function roundDown(value: number, digits: number): number {
  if (digits >= 0) {
    const f = Math.pow(10, digits);
    return Math.trunc(value * f) / f;
  }
  const f = Math.pow(10, -digits);
  return Math.trunc(value / f) * f;
}

// ---------------------------------------------------------------------------
// TVA
// ---------------------------------------------------------------------------

export interface TvaParams {
  /** Taux normal en %. */
  rate: number;
  /** Crédit de TVA reporté de la période précédente (jamais négatif). */
  creditAnterieur?: number;
}

export interface TvaComputation {
  /** Base HT comptable (comptes 70x) — la seule base à afficher. */
  baseHT: number;
  /** Base HT reconstituée depuis la TVA collectée, si les 70x font défaut. */
  baseHTDeduite: number;
  collectee: number;
  deductible: number;
  deductibleImmo: number;
  creditAnterieur: number;
  /** Collectée − déductible − crédit antérieur (peut être négatif). */
  net: number;
  /** Montant à reverser (0 si crédit). */
  aPayer: number;
  /** Crédit de TVA à reporter sur la période suivante. */
  creditReporte: number;
}

/**
 * TVA du mois : collectée (443) − déductible (445) − crédit reporté.
 * Le crédit n'est jamais perdu : il devient `creditReporte` et non un montant
 * négatif présenté comme « à payer ».
 */
export function computeTvaFiscal(base: FiscalBase, params: TvaParams): TvaComputation {
  const rate = params.rate;
  const creditAnterieur = Math.max(0, params.creditAnterieur ?? 0);
  const baseHTDeduite = rate > 0 ? Math.round((base.tvaCollectee / rate) * 100) : 0;
  const net = Math.round(base.tvaCollectee - base.tvaDeductible - creditAnterieur);

  return {
    baseHT: base.chiffreAffaires || baseHTDeduite,
    baseHTDeduite,
    collectee: base.tvaCollectee,
    deductible: base.tvaDeductible,
    deductibleImmo: base.tvaDeductibleImmo,
    creditAnterieur,
    net,
    aPayer: Math.max(0, net),
    creditReporte: Math.max(0, -net),
  };
}

// ---------------------------------------------------------------------------
// Impôt sur les sociétés (IS)
// ---------------------------------------------------------------------------

export interface IsParams {
  /** Taux de l'IS en %. */
  taux: number;
  /** Seuil de CA sous lequel s'applique le minimum forfaitaire. */
  seuilCA: number;
  /** Minimum forfaitaire (dossiers sous le seuil). */
  minimumForfaitaire: number;
  /** Taux du minimum de perception appliqué au CA (%). */
  tauxMinimumCA: number;
}

/**
 * Paramètres par défaut. Tous hérités du moteur factorisé existant, tous
 * marqués non vérifiés : ils doivent être validés humainement dans le
 * Regulatory Engine avant toute production. Aucune valeur n'est inventée ici.
 */
export const IS_PARAMS_DEFAUT: IsParams = {
  taux: 27,
  seuilCA: 2_000_000,
  minimumForfaitaire: 20_000,
  tauxMinimumCA: 1,
};

export interface IsComputation {
  resultatComptable: number;
  /** Résultat fiscal, arrondi au millier inférieur (base imposable). */
  resultatFiscalArrondi: number;
  /** IS au taux normal, sur résultat positif seulement. */
  impotCalcule: number;
  /** Minimum de perception assis sur le chiffre d'affaires. */
  minimumPerception: number;
  /** IS dû = max(IS calculé, minimum de perception). */
  impotDu: number;
}

/**
 * Liquidation de l'IS : `max(IS sur résultat, minimum de perception assis
 * sur le CA)`. Le minimum de perception s'applique même en cas de perte —
 * c'est précisément ce que la page Fiscalité ignorait (IS = 0).
 */
export function computeIsFiscal(
  resultatFiscal: number,
  base: FiscalBase,
  params: IsParams = IS_PARAMS_DEFAUT,
): IsComputation {
  const resultatFiscalArrondi = roundDown(resultatFiscal, -3);
  const chiffreAffaires = base.chiffreAffaires;

  const minimumPerception = roundDown(
    chiffreAffaires <= params.seuilCA ? params.minimumForfaitaire : (chiffreAffaires * params.tauxMinimumCA) / 100,
    -1,
  );
  const impotCalcule =
    resultatFiscalArrondi > 0 ? roundDown((resultatFiscalArrondi * params.taux) / 100, -1) : 0;

  return {
    resultatComptable: base.resultatComptable,
    resultatFiscalArrondi,
    impotCalcule,
    minimumPerception,
    impotDu: Math.max(minimumPerception, impotCalcule),
  };
}

/** Montant en toutes lettres pour les mentions légales (FCFA). */
export function fcfaEntier(value: number): number {
  return Math.round(value);
}
