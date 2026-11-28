// ============================================================================
// FIMAAC — Adaptateur d'affichage des impôts.
//
// ⚠️ Aucun calcul ne vit ici. Tout est délégué à `lib/fiscalite.ts`, seule
// source de vérité, partagée avec le moteur factorisé (`lib/engine`) et avec
// la génération de déclarations. Cette couche ne fait que mettre en forme.
// ============================================================================
import type { JournalEntry, TaxRuleRef } from "./types";
import { movementsByAccount } from "./accounting";
import {
  computeIsFiscal,
  computeTvaFiscal,
  fiscalBaseFromMoves,
  IS_PARAMS_DEFAUT,
  type IsComputation,
  type TvaComputation,
} from "./fiscalite";

export interface TaxResult {
  montant: number;
  base: number;
  rule: TaxRuleRef;
  verified: boolean;
  breakdown: { label: string; amount: number }[];
  warning?: string;
  /** Détail structuré de la TVA, si le calcul portait sur la TVA. */
  tva?: TvaComputation;
  /** Détail structuré de l'IS, si le calcul portait sur l'IS. */
  is?: IsComputation;
}

const AVERTISSEMENT =
  "Taux indicatif et paramétrable. Le barème, le minimum de perception et les abattements doivent être confirmés sur le Code général des impôts (OTR) par un humain autorisé.";

/**
 * TVA du mois.
 * `base` = chiffre d'affaires HT (comptes 70x) — et non plus la TVA collectée.
 * Un crédit de TVA n'est plus présenté comme un montant négatif « à payer » :
 * il devient un crédit à reporter.
 */
export function computeTVA(
  entries: JournalEntry[],
  rule: TaxRuleRef,
  opts: { creditAnterieur?: number } = {},
): TaxResult {
  const base = fiscalBaseFromMoves(movementsByAccount(entries));
  const t = computeTvaFiscal(base, { rate: rule.rate, creditAnterieur: opts.creditAnterieur });

  return {
    montant: t.aPayer,
    base: t.baseHT,
    rule,
    verified: rule.verified,
    breakdown: [
      { label: "Chiffre d'affaires HT (comptes 70)", amount: t.baseHT },
      { label: "TVA collectée (compte 443)", amount: t.collectee },
      { label: "TVA déductible (compte 445)", amount: -t.deductible },
      { label: "dont TVA sur immobilisations (4451)", amount: -t.deductibleImmo },
      { label: "Crédit de TVA reporté de la période précédente", amount: -t.creditAnterieur },
      { label: "TVA nette", amount: t.net },
      { label: "TVA à reverser", amount: t.aPayer },
      { label: "Crédit de TVA à reporter", amount: t.creditReporte },
    ],
    warning: rule.verified ? undefined : AVERTISSEMENT,
    tva: t,
  };
}

/**
 * Impôt sur les sociétés.
 * Le minimum de perception s'applique même en cas de perte : sans lui, un
 * dossier déficitaire affichait un IS de 0 alors qu'un impôt reste dû.
 */
export function computeIS(entries: JournalEntry[], rule: TaxRuleRef): TaxResult {
  const base = fiscalBaseFromMoves(movementsByAccount(entries));
  const is = computeIsFiscal(base.resultatComptable, base, { ...IS_PARAMS_DEFAUT, taux: rule.rate });

  return {
    montant: is.impotDu,
    base: Math.max(0, is.resultatFiscalArrondi),
    rule,
    verified: rule.verified,
    breakdown: [
      { label: "Produits (classe 7)", amount: base.produits },
      { label: "Charges (classe 6)", amount: -base.charges },
      { label: "Résultat comptable", amount: base.resultatComptable },
      { label: "Résultat fiscal arrondi au millier inférieur", amount: is.resultatFiscalArrondi },
      { label: `IS au taux de ${rule.rate} % (résultat positif seulement)`, amount: is.impotCalcule },
      { label: "Minimum de perception (assis sur le chiffre d'affaires)", amount: is.minimumPerception },
      { label: "Impôt dû (le plus élevé des deux)", amount: is.impotDu },
    ],
    warning: rule.verified ? undefined : AVERTISSEMENT,
    is,
  };
}

export function computeTax(
  taxCode: string,
  entries: JournalEntry[],
  rules: TaxRuleRef[],
  opts: { creditAnterieur?: number } = {},
): TaxResult | null {
  const rule = rules.find((r) => r.code === taxCode);
  if (!rule) return null;
  if (taxCode === "TVA") return computeTVA(entries, rule, opts);
  if (taxCode === "IS") return computeIS(entries, rule);
  return {
    montant: 0,
    base: 0,
    rule,
    verified: rule.verified,
    breakdown: [{ label: rule.name, amount: 0 }],
    warning: "Règle non encore paramétrée. À configurer dans le Regulatory Engine.",
  };
}
