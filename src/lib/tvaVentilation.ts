// ============================================================================
// FIMAAC — Ventilation de la TVA par taux
//
// Le moteur fiscal ne connaissait qu'un taux. Une déclaration réelle en compte
// trois familles : 18 % (normal), 9 % (taux réduit) et les opérations exonérées
// (exportations, produits de santé, presse…). Sans ventilation, une entreprise
// mixte déclare un faux net et son crédit de TVA devient inexploitable.
//
// Principe : on ne DEVINE pas un taux. On le lit, par ordre de priorité :
//   1. le code taxe porté par la ligne d'écriture (`TVA18`, `TVA9`, `EXO`…) ;
//   2. à défaut, le taux effectif de l'écriture (TVA comptabilisée / base HT),
//      rattaché au taux paramétré le plus proche — l'écart est alors affiché ;
//   3. à défaut de TVA comptabilisée et de code, l'opération est traitée comme
//      exonérée et signalée : c'est un fait comptable, pas une hypothèse.
// ============================================================================
import type { Account, JournalEntry } from "./types";

export interface VatVentilationParams {
  /** Taux paramétrés, en %. Par défaut 18 et 9 (taux togolais), plus 0. */
  rates?: number[];
  /** Tolérance d'écart entre taux effectif et taux paramétré, en points. */
  tolerance?: number;
  /** Code taxe -> taux, pour les codes explicites. */
  codes?: Record<string, number>;
}

export interface VatBand {
  /** Taux en %. */
  rate: number;
  label: string;
  /** Base HT nette (crédits − débits des comptes 70x). */
  base: number;
  /** TVA comptabilisée sur les écritures rattachées à ce taux. */
  vat: number;
  /** TVA théorique au taux paramétré. */
  vatTheorique: number;
  /** Écart TVA comptabilisée − théorique. */
  ecart: number;
  entries: number;
  /** Écritures dont le taux a été déduit du rapport TVA/base (non codé). */
  inferred: number;
}

export interface VatControl {
  id: string;
  label: string;
  level: "ok" | "warning" | "blocking";
  detail: string;
  entries?: string[];
}

export interface VatVentilation {
  bands: VatBand[];
  totals: {
    base: number;
    collectee: number;
    theorique: number;
    ecart: number;
    deductible: number;
    deductibleImmo: number;
    net: number;
  };
  controls: VatControl[];
  blockingCount: number;
  warningCount: number;
}

/** Codes explicites reconnus. Volontairement strict : un code inconnu est signalé. */
export const DEFAULT_VAT_CODES: Record<string, number> = {
  TVA18: 18, TVA_18: 18, TVAN: 18, TVA_NORMAL: 18, "18": 18,
  TVA9: 9, TVA_9: 9, TVAR: 9, TVA_REDUIT: 9, "9": 9,
  EXO: 0, EXONERE: 0, EXONÉRÉ: 0, TVA0: 0, TVA_0: 0, HORS_CHAMP: 0, EXPORT: 0,
};

const round2 = (n: number) => Math.round(n * 100) / 100;

const isRevenue = (code: string) => code.startsWith("70");
const isVatCollected = (code: string) => code.startsWith("443");
const isVatDeductible = (code: string) => code.startsWith("445");
const isVatImmo = (code: string) => code.startsWith("4451");

/** Taux porté par un code taxe, ou null si le code n'est pas reconnu. */
export function rateFromTaxCode(code: string | null | undefined, codes: Record<string, number> = DEFAULT_VAT_CODES): number | null {
  if (!code) return null;
  const key = String(code).trim().toUpperCase();
  if (key in codes) return codes[key];
  const numeric = Number(key.replace(",", "."));
  if (Number.isFinite(numeric) && numeric >= 0 && numeric <= 30) return numeric;
  return null;
}

/** Rattache un taux effectif au taux paramétré le plus proche (dans la tolérance). */
export function snapRate(effective: number, rates: number[], tolerance: number): { rate: number; ecart: number } | null {
  let best: { rate: number; ecart: number } | null = null;
  for (const r of rates) {
    const ecart = Math.round(Math.abs(effective - r) * 1e6) / 1e6;
    if (ecart <= tolerance && (!best || ecart < best.ecart)) best = { rate: r, ecart };
  }
  return best;
}

const rateLabel = (rate: number) =>
  rate === 0 ? "Exonéré (0 %)" : `Taux ${rate} %`;

/**
 * Ventile la TVA collectée d'un dossier par taux.
 * Périmètre : écritures **validées** uniquement (un brouillon ne se déclare pas).
 */
export function ventilateVat(
  entries: JournalEntry[],
  _accounts: Account[],
  params: VatVentilationParams = {},
): VatVentilation {
  const rates = [...new Set([...(params.rates ?? [18, 9]), 0])].sort((a, b) => b - a);
  const tolerance = params.tolerance ?? 0.5;
  const codes = params.codes ?? DEFAULT_VAT_CODES;

  const bands = new Map<number, VatBand>(
    rates.map((rate) => [rate, { rate, label: rateLabel(rate), base: 0, vat: 0, vatTheorique: 0, ecart: 0, entries: 0, inferred: 0 }]),
  );

  let deductible = 0;
  let deductibleImmo = 0;
  const unknownCodes = new Set<string>();
  const offGrid: string[] = [];
  const withoutVat: string[] = [];
  const mixedRate: string[] = [];

  for (const entry of entries) {
    if (entry.status !== "validated") continue;

    // Base et TVA de l'écriture, lues sur les comptes, jamais sur un montant saisi.
    let base = 0;
    let vat = 0;
    const lineCodes = new Set<string>();
    for (const l of entry.lines) {
      const account = l.accountId;
      if (isRevenue(account)) base += (l.credit || 0) - (l.debit || 0);
      if (isVatCollected(account)) vat += (l.credit || 0) - (l.debit || 0);
      if (isVatDeductible(account)) {
        const amount = (l.debit || 0) - (l.credit || 0);
        deductible += amount;
        if (isVatImmo(account)) deductibleImmo += amount;
      }
      if (l.taxCode) {
        const code = String(l.taxCode).trim().toUpperCase();
        if (rateFromTaxCode(code, codes) === null) unknownCodes.add(code);
        else if (isRevenue(account) || isVatCollected(account)) lineCodes.add(code);
      }
    }

    if (base <= 0) continue;

    // 1. code explicite ; 2. taux effectif ; 3. exonéré constaté.
    let rate: number | null = null;
    let inferred = false;
    const codedRates = [...lineCodes].map((c) => rateFromTaxCode(c, codes)!).filter((r) => r !== undefined);
    if (codedRates.length > 0) {
      const distinct = [...new Set(codedRates)];
      if (distinct.length > 1) mixedRate.push(entry.number);
      rate = distinct[0];
    } else if (vat > 0) {
      const snapped = snapRate((vat / base) * 100, rates, tolerance);
      if (snapped) {
        rate = snapped.rate;
        inferred = true;
      } else {
        offGrid.push(`${entry.number} (${((vat / base) * 100).toFixed(2)} %)`);
        // On rattache malgré tout au taux le plus proche pour ne rien perdre.
        rate = rates.reduce((a, b) => (Math.abs((vat / base) * 100 - b) < Math.abs((vat / base) * 100 - a) ? b : a), rates[0]);
        inferred = true;
      }
    } else {
      // Base sans TVA et sans code : exonération constatée, jamais supposée.
      rate = 0;
      withoutVat.push(entry.number);
    }

    const band = bands.get(rate) ?? { rate, label: rateLabel(rate), base: 0, vat: 0, vatTheorique: 0, ecart: 0, entries: 0, inferred: 0 };
    band.base = round2(band.base + base);
    band.vat = round2(band.vat + vat);
    band.entries += 1;
    if (inferred) band.inferred += 1;
    bands.set(rate, band);
  }

  const list = [...bands.values()]
    .sort((a, b) => b.rate - a.rate)
    .map((b) => {
      const vatTheorique = round2((b.base * b.rate) / 100);
      return { ...b, vatTheorique, ecart: round2(b.vat - vatTheorique) };
    })
    .filter((b) => b.entries > 0);

  const totals = list.reduce(
    (acc, b) => ({
      base: round2(acc.base + b.base),
      collectee: round2(acc.collectee + b.vat),
      theorique: round2(acc.theorique + b.vatTheorique),
      ecart: round2(acc.ecart + b.ecart),
      deductible: round2(deductible),
      deductibleImmo: round2(deductibleImmo),
      net: 0,
    }),
    { base: 0, collectee: 0, theorique: 0, ecart: 0, deductible: round2(deductible), deductibleImmo: round2(deductibleImmo), net: 0 },
  );
  totals.net = round2(totals.collectee - totals.deductible);

  const brokenBands = list.filter((b) => b.rate > 0 && Math.abs(b.ecart) > 1);

  const controls: VatControl[] = [
    {
      id: "ventilation",
      label: "Ventilation par taux",
      level: "ok",
      detail: list.filter((b) => b.entries > 0).map((b) => `${b.rate} % : ${b.base.toFixed(0)} de base`).join(" · ") || "Aucune vente taxée sur le périmètre.",
    },
    {
      id: "theorique",
      label: "TVA comptabilisée = base × taux",
      level: brokenBands.length === 0 ? "ok" : "warning",
      detail: brokenBands.length === 0
        ? "Chaque tranche est cohérente au franc près."
        : brokenBands.map((b) => `${b.rate} % : écart ${b.ecart.toFixed(2)}`).join(" · "),
    },
    {
      id: "codes",
      label: "Codes taxe reconnus",
      level: unknownCodes.size === 0 ? "ok" : "warning",
      detail: unknownCodes.size === 0 ? "Tous les codes portés par les lignes sont reconnus." : `Codes inconnus ignorés : ${[...unknownCodes].join(", ")}.`,
    },
    {
      id: "inference",
      label: "Taux déduits faute de code",
      level: list.some((b) => b.inferred > 0) ? "warning" : "ok",
      detail: list.some((b) => b.inferred > 0)
        ? `${list.reduce((s, b) => s + b.inferred, 0)} écriture(s) sans code taxe : taux déduit du rapport TVA/base. Renseigner le code rend la ventilation opposable.`
        : "Toutes les écritures portent un code taxe explicite.",
    },
    {
      id: "horsGrille",
      label: "Taux hors grille paramétrée",
      level: offGrid.length === 0 ? "ok" : "warning",
      detail: offGrid.length === 0 ? "Aucun taux intermédiaire détecté." : `Taux non prévus : ${offGrid.slice(0, 5).join(", ")}.`,
    },
    {
      id: "sansTva",
      label: "Ventes sans TVA",
      level: withoutVat.length === 0 ? "ok" : "warning",
      detail: withoutVat.length === 0
        ? "Toute vente validée porte de la TVA."
        : `${withoutVat.length} écriture(s) sans TVA comptabilisée, traitées comme exonérées : ${withoutVat.slice(0, 5).join(", ")}${withoutVat.length > 5 ? "…" : ""}.`,
    },
    {
      id: "mixte",
      label: "Un taux par facture",
      level: mixedRate.length === 0 ? "ok" : "warning",
      detail: mixedRate.length === 0 ? "Aucune facture ne mélange deux taux." : `Factures à deux taux ou plus : ${mixedRate.slice(0, 5).join(", ")} (ventilation à faire au niveau de la ligne).`,
    },
    {
      id: "deductible",
      label: "TVA déductible et immobilisations",
      level: "ok",
      detail: `Déductible total ${deductible.toFixed(0)}, dont immobilisations ${deductibleImmo.toFixed(0)} (comptes 4451).`,
    },
  ];

  return {
    bands: list,
    totals,
    controls,
    blockingCount: controls.filter((c) => c.level === "blocking").length,
    warningCount: controls.filter((c) => c.level === "warning").length,
  };
}
