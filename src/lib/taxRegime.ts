// ============================================================================
// FIMAAC — Portée des règles fiscales : régime déclaré et catégorie
//
// Constat : `Company.taxRegime` existait, était saisi à la création du dossier…
// et **n'était lu par aucun calcul**. Une entreprise déclarée « exonérée » voyait
// donc un IS et une TVA à payer, et une entreprise au forfait voyait le calcul du
// régime réel présenté comme le sien. Les règles ne portaient aucune portée : le
// moteur prenait « la » règle d'un code, quelle que soit la situation du
// contribuable.
//
// Ici, la règle déclare les régimes (et catégories) qu'elle vise, et le moteur
// ne comble pas un manque par le régime du voisin : il le dit.
// ============================================================================

import type { TaxRegime, TaxRuleRef } from "./types";

/** Libellés des régimes déjà déclarés par le dossier (aucun régime inventé). */
export const TAX_REGIME_LABELS: Record<TaxRegime, string> = {
  ri: "Réel normal",
  rs: "Réel simplifié",
  rsmi: "RSMI",
  rnc: "Résultat net comptable",
  exempt: "Exonéré",
};

export const TAX_REGIME_CODES: TaxRegime[] = ["ri", "rs", "rsmi", "rnc", "exempt"];

export interface TaxProfile {
  regime: TaxRegime;
  /** Catégorie d'entreprise déclarée (supporte les taux différenciés). */
  category?: string;
}

export function profileOfCompany(company: { taxRegime: TaxRegime; taxCategory?: string }): TaxProfile {
  return { regime: company.taxRegime, category: company.taxCategory };
}

/** Une règle sans portée vaut pour tous ; une règle avec portée doit correspondre. */
export function ruleMatchesProfile(rule: TaxRuleRef, profile: TaxProfile): boolean {
  if (rule.regimes && rule.regimes.length > 0 && !rule.regimes.includes(profile.regime)) return false;
  if (rule.categories && rule.categories.length > 0) {
    const mine = (profile.category || "").toLowerCase();
    if (!mine || !rule.categories.some((c) => c.toLowerCase() === mine)) return false;
  }
  return true;
}

export type RuleResolutionStatus = "ok" | "generic" | "regime_missing" | "no_rule" | "exempt";

export interface RuleResolution {
  rule: TaxRuleRef | null;
  status: RuleResolutionStatus;
  /** Message à afficher tel quel : il doit suffire à comprendre quoi faire. */
  message: string;
  /** Vrai quand le montant ne peut pas être présenté comme celui du contribuable. */
  indicativeOnly: boolean;
  /** Faux quand aucun impôt ne doit être calculé (régime exonéré). */
  shouldCompute: boolean;
}

/**
 * Choisit la règle applicable pour un code fiscal et un profil déclaré.
 * Ordre : règle propre au régime (et à la catégorie) → exonération déclarée →
 * règle générique (annoncée comme telle) → absence explicite.
 */
export function resolveTaxRule(rules: TaxRuleRef[], code: string, profile: TaxProfile): RuleResolution {
  const sameCode = rules.filter((r) => r.code === code);
  const label = TAX_REGIME_LABELS[profile.regime];

  if (sameCode.length === 0) {
    return {
      rule: null,
      status: "no_rule",
      message: `Aucune règle « ${code} » n'est versionnée dans le moteur réglementaire.`,
      indicativeOnly: true,
      shouldCompute: false,
    };
  }

  const scoped = sameCode.filter((r) => (r.regimes?.length || r.categories?.length));
  const exact = scoped.filter((r) => ruleMatchesProfile(r, profile));
  if (exact.length > 0) {
    return {
      rule: exact[0],
      status: "ok",
      message: `Règle propre au régime ${label}${profile.category ? ` · ${profile.category}` : ""}.`,
      indicativeOnly: !exact[0].verified,
      shouldCompute: true,
    };
  }

  // Régime exonéré : aucun impôt à calculer, et on le dit au lieu d'afficher un montant.
  if (profile.regime === "exempt") {
    return {
      rule: null,
      status: "exempt",
      message:
        `Régime déclaré : exonéré. Aucun ${code} n'est calculé ni déclaré pour ce dossier. `
        + `Si cette exonération ne couvre pas la période, corrigez le régime du dossier — le calcul reprendra aussitôt.`,
      indicativeOnly: false,
      shouldCompute: false,
    };
  }

  const generic = sameCode.filter((r) => !r.regimes?.length && !r.categories?.length);
  if (generic.length > 0) {
    return {
      rule: generic[0],
      status: "generic",
      message:
        `Règle générique appliquée : aucune règle propre au régime ${label}`
        + `${profile.category ? ` ni à la catégorie « ${profile.category} »` : ""} n'est versionnée. Montants indicatifs, à confirmer (source OTR).`,
      indicativeOnly: true,
      shouldCompute: true,
    };
  }

  const other = scoped[0];
  const otherLabel = other?.regimes?.[0] ? TAX_REGIME_LABELS[other.regimes[0]] : "un autre régime";
  return {
    rule: null,
    status: "regime_missing",
    message:
      `Aucune règle « ${code} » ne couvre le régime ${label}. Les règles versionnées visent ${otherLabel} : `
      + `les appliquer ici donnerait un montant faux. Déclarez la règle applicable (source OTR) avant d'établir la déclaration.`,
    indicativeOnly: true,
    shouldCompute: false,
  };
}

/** Libellé court du profil, pour les écrans et les déclarations. */
export function describeProfile(profile: TaxProfile): string {
  return profile.category ? `Régime ${TAX_REGIME_LABELS[profile.regime]} · ${profile.category}` : `Régime ${TAX_REGIME_LABELS[profile.regime]}`;
}

/** Contrôle de saisie d'une catégorie : on refuse ce qui n'est pas exploitable. */
export function validateCategory(input: string): { ok: boolean; error?: string; value?: string } {
  const value = (input || "").trim();
  if (value.length > 40) return { ok: false, error: "Catégorie trop longue (40 caractères maximum)." };
  return { ok: true, value: value || undefined };
}
