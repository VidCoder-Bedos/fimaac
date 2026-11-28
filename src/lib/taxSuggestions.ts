// ============================================================================
// FIMAAC — Réintégrations fiscales proposées
//
// Les réintégrations devaient être saisies de mémoire : il fallait savoir que
// les pénalités fiscales (647) et les dons (6582/6583) ne sont pas déductibles,
// retrouver leurs montants dans la balance, puis recopier le total à la main.
// Ici, rien n'est décidé à la place du fiscaliste : on **signale** un compte
// dont la nature est en principe non déductible, avec son montant, et la
// décision reste un acte humain, tracé comme tel.
// ============================================================================

import type { BalanceRow } from "./liasse";
import type { TaxAdjustment } from "./types";

export interface SuggestionRule {
  id: string;
  /** Libellé proposé pour le retraitement. */
  label: string;
  type: "reintegration" | "deduction";
  /** Comptes à examiner (préfixes). */
  prefixes: string[];
  /** Raison, affichée telle quelle : elle doit tenir sans juriste. */
  rationale: string;
  /** Valeur par défaut de la référence justificative. */
  reference: string;
}

/**
 * Catalogue volontairement court : seules les natures qui sont **en principe**
 * non déductibles. Un compte dont la déductibilité dépend d'une pièce (dons avec
 * reçu, par exemple) est proposé quand même — c'est le fiscaliste qui tranche.
 */
export const SUGGESTION_RULES: SuggestionRule[] = [
  {
    id: "penalites",
    label: "Pénalités et amendes fiscales — non déductibles",
    type: "reintegration",
    prefixes: ["647"],
    rationale: "Les pénalités et amendes fiscales ne concourent pas à la formation du résultat imposable.",
    reference: "Comptes 647x",
  },
  {
    id: "dons",
    label: "Dons et mécénat — à justifier pour être déductibles",
    type: "reintegration",
    prefixes: ["6582", "6583", "835"],
    rationale: "Un don n'est déductible que dans les conditions et limites prévues, justificatifs à l'appui.",
    reference: "Comptes 6582/6583/835",
  },
  {
    id: "jetons",
    label: "Jetons de présence et rémunérations d'administrateurs",
    type: "reintegration",
    prefixes: ["6581"],
    rationale: "Les rémunérations d'administrateurs sont déductibles dans la limite fixée par l'assemblée ; l'excédent ne l'est pas.",
    reference: "Compte 6581",
  },
];

export interface TaxSuggestion {
  /** Identifiant stable : il permet de savoir qu'une proposition a déjà été reprise. */
  id: string;
  label: string;
  type: "reintegration" | "deduction";
  amount: number;
  rationale: string;
  reference: string;
  accounts: { code: string; label: string; amount: number }[];
  /** Un retraitement de même origine a déjà été enregistré pour cet exercice. */
  alreadyRecorded: boolean;
}

/**
 * Construit les propositions pour un exercice.
 * Une proposition à montant nul n'existe pas : on ne propose pas de réintégrer 0.
 */
export function suggestAdjustments(
  balances: BalanceRow[],
  existing: TaxAdjustment[],
  exercise: string,
): TaxSuggestion[] {
  const out: TaxSuggestion[] = [];
  for (const rule of SUGGESTION_RULES) {
    const accounts = balances
      .filter((r) => rule.prefixes.some((p) => r.code === p || r.code.startsWith(p)))
      .map((r) => ({ code: r.code, label: r.label || r.code, amount: Math.round((r.debit || 0) - (r.credit || 0)) }))
      .filter((a) => a.amount !== 0)
      .sort((a, b) => a.code.localeCompare(b.code));
    if (accounts.length === 0) continue;
    const amount = accounts.reduce((s, a) => s + a.amount, 0);
    if (amount === 0) continue;
    const id = `${rule.id}/${exercise}`;
    out.push({
      id,
      label: rule.label,
      type: rule.type,
      amount,
      rationale: rule.rationale,
      reference: rule.reference,
      accounts,
      alreadyRecorded: existing.some((a) => a.companyId !== "" && a.suggestionId === id && a.exercise === exercise),
    });
  }
  return out;
}

/** Contrôle lisible : ce qui reste à décider, en clair. */
export function describeSuggestions(suggestions: TaxSuggestion[]): string {
  if (suggestions.length === 0) return "Aucun compte de nature non déductible n'a été trouvé dans la balance.";
  const pending = suggestions.filter((s) => !s.alreadyRecorded);
  if (pending.length === 0) return "Toutes les propositions ont été reprises.";
  const total = pending.reduce((s, x) => s + x.amount, 0);
  return `${pending.length} proposition(s) à décider, pour ${total.toLocaleString("fr-FR")} FCFA.`;
}
