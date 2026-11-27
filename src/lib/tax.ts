import type { JournalEntry, TaxRuleRef } from "./types";
import { movementsByAccount } from "./accounting";

export interface TaxResult {
  montant: number;
  base: number;
  rule: TaxRuleRef;
  verified: boolean;
  breakdown: { label: string; amount: number }[];
  warning?: string;
}

/** TVA = TVA collectée (443) − TVA récupérable (445). */
export function computeTVA(entries: JournalEntry[], rule: TaxRuleRef): TaxResult {
  const moves = movementsByAccount(entries);
  // Agrégation par préfixe (443 = TVA facturée/collectée, 445 = TVA récupérable)
  let collectee = 0, recuperable = 0;
  for (const [code, m] of moves) {
    if (code.startsWith("443")) collectee += m.credit - m.debit;
    if (code.startsWith("445")) recuperable += m.debit - m.credit;
  }
  const net = collectee - recuperable;
  return {
    montant: Math.max(0, net),
    base: collectee,
    rule,
    verified: rule.verified,
    breakdown: [
      { label: "TVA collectée (compte 433)", amount: collectee },
      { label: "TVA récupérable (compte 435)", amount: -recuperable },
      { label: "TVA nette à payer (ou crédit de TVA si négatif)", amount: net },
    ],
    warning: rule.verified
      ? undefined
      : "Taux non vérifié contre le texte officiel. Valeur paramétrable dans le Regulatory Engine.",
  };
}

/** IS = Résultat comptable (classe 7 − classe 6) × taux, si positif. */
export function computeIS(entries: JournalEntry[], rule: TaxRuleRef): TaxResult {
  const moves = movementsByAccount(entries);
  let produits = 0;
  let charges = 0;
  for (const [code, m] of moves) {
    if (code.startsWith("7")) produits += m.credit - m.debit;
    if (code.startsWith("6")) charges += m.debit - m.credit;
  }
  const resultat = produits - charges;
  const montant = resultat > 0 ? Math.round((resultat * rule.rate) / 100) : 0;
  return {
    montant,
    base: Math.max(0, resultat),
    rule,
    verified: rule.verified,
    breakdown: [
      { label: "Produits (classe 7)", amount: produits },
      { label: "Charges (classe 6)", amount: -charges },
      { label: "Résultat comptable", amount: resultat },
      { label: `Impôt (${rule.rate} %)`, amount: montant },
    ],
    warning: rule.verified
      ? undefined
      : "Taux indicatif et paramétrable. Le barème IS, le minimum de perception et les abattements doivent être confirmés sur le Code général des impôts (OTR).",
  };
}

export function computeTax(taxCode: string, entries: JournalEntry[], rules: TaxRuleRef[]): TaxResult | null {
  const rule = rules.find((r) => r.code === taxCode);
  if (!rule) return null;
  if (taxCode === "TVA") return computeTVA(entries, rule);
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
