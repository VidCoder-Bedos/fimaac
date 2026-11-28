// ============================================================================
// FIMAAC — Lecture d'une balance 6 colonnes (P22)
//
// Constat d'audit (§F, point 22) : `parseBalance6` gardait son **propre**
// lecteur, distinct de l'import robuste P0-4, et il faisait exactement ce que
// l'audit reprochait ailleurs :
//   · disposition supposée en dur — « SD N, SC N, SD N-1, SC N-1 » — donc une
//     balance « Débit / Crédit / Solde débiteur / Solde créditeur » était lue de
//     travers et produisait des soldes faux, sans un mot ;
//   · toute ligne dont le code ne commençait pas par un chiffre était jetée en
//     silence (comptes collectors, lignes de total, préfixes) ;
//   · un fichier incompris renvoyait une balance **vide**, indistinguable d'un
//     dossier sans activité.
//
// Ici : détection par les en-têtes, repli positionnel **annoncé**, lignes
// écartées **listées avec leur motif**, et refus explicite si rien n'est lisible.
// La grille est passée en argument : aucune dépendance au fichier, donc testable.
// ============================================================================

export interface Balance6Row {
  code: string;
  label: string;
  debit: number;
  credit: number;
}

export interface Balance6Subtotal {
  label: string;
  debit: number;
  credit: number;
}

export interface Balance6Mapping {
  code: number;
  label: number;
  /** Colonnes de l'exercice N, dans l'ordre débit puis crédit. */
  debitN: number;
  creditN: number;
  /** Colonnes de l'exercice N-1. */
  debitN1: number;
  creditN1: number;
  /** Colonnes « solde » signées, si la balance en fournit (repli débit/crédit). */
  soldeN: number;
  soldeN1: number;
}

export interface Balance6GridResult {
  ok: boolean;
  n: Balance6Row[];
  n1: Balance6Row[];
  subtotals: Balance6Subtotal[];
  headerRow: number | null;
  mapping: Balance6Mapping;
  layout: "entetes" | "positionnel" | "solde";
  signals: string[];
  warnings: string[];
  errors: string[];
  totals: { debitN: number; creditN: number; debitN1: number; creditN1: number; ecartN: number; ecartN1: number };
  rejected: { row: number; reason: string; values: string[] }[];
}

const EMPTY_MAPPING: Balance6Mapping = {
  code: -1, label: -1, debitN: -1, creditN: -1, debitN1: -1, creditN1: -1, soldeN: -1, soldeN1: -1,
};

/** Normalise un en-tête : sans accents, sans ponctuation, minuscule. */
export function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Lit un montant tel qu'un cabinet le tape ou l'exporte :
 * « 1 234 567 », « 1.234.567,89 », « (12 000) », « 500,00 D », « -3 000 ».
 */
export function parseAmount(value: unknown): { value: number; ok: boolean } {
  if (value == null || value === "") return { value: 0, ok: true };
  if (typeof value === "number") return { value: Number.isFinite(value) ? Math.round(value) : 0, ok: Number.isFinite(value) };
  let s = String(value).replace(/\u00a0/g, " ").trim();
  if (!s) return { value: 0, ok: true };

  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  // Suffixes comptables « D » / « C » / « Dr » / « Cr » : ils portent le sens, pas le signe.
  s = s.replace(/\s*(dr|cr|d|c)$/i, "");

  const digits = (s.match(/\d/g) || []).length;
  if (digits === 0) return { value: 0, ok: s.trim() === "" || /^-+$/.test(s.trim()) };
  if (s.includes("-")) { negative = true; s = s.replace(/-/g, ""); }

  const commaAt = s.lastIndexOf(",");
  const dotAt = s.lastIndexOf(".");
  let normalized: string;
  if (commaAt >= 0 && dotAt >= 0) {
    // Le séparateur décimal est le dernier rencontré ; l'autre sépare les milliers.
    if (commaAt > dotAt) normalized = s.replace(/\./g, "").replace(",", ".");
    else normalized = s.replace(/,/g, "");
  } else if (commaAt >= 0) {
    normalized = s.replace(/,/g, (_, i) => (i === commaAt ? "." : ""));
  } else if (dotAt >= 0) {
    const after = s.length - dotAt - 1;
    // « 1.234 » = milliers ; « 1234.56 » = décimales.
    const multipleDots = (s.match(/\./g) || []).length > 1;
    normalized = multipleDots || after === 3 ? s.replace(/\./g, "") : s;
  } else {
    normalized = s;
  }
  const parsed = Number.parseFloat(normalized.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(parsed)) return { value: 0, ok: false };
  return { value: Math.round(negative ? -parsed : parsed), ok: true };
}

/** Un montant « vide » (ni chiffre, ni signe) ne compte pas comme une donnée. */
function blank(value: unknown): boolean {
  return value == null || String(value).replace(/\s/g, "") === "";
}

const isTotalLabel = (label: string) => /total|sous.?total|classe|report|cumul|^sous total/i.test(label);

interface HeaderHints {
  code: number;
  label: number;
  /** Colonnes porteuses d'un sens et d'une période. */
  cols: { index: number; side: "debit" | "credit"; solde: boolean; period: "n" | "n1" | "unknown" }[];
}

/**
 * Classe une colonne de montant.
 * `solde` distingue la **balance des soldes** (débiteur/créditeur, ou « solde »)
 * de la **balance des mouvements** (débit/crédit de la période) : ce ne sont pas
 * les mêmes chiffres, et confondre les deux fausse tout le bilan.
 */
function classifyAmountHeader(header: string): { side: "debit" | "credit"; solde: boolean; period: "n" | "n1" | "unknown" } | null {
  const h = normalizeHeader(header);
  if (!/debit|credit|solde|debiteur|crediteur/.test(h)) return null;
  const side: "debit" | "credit" = /debit|debiteur/.test(h) ? "debit" : "credit";
  const solde = /solde|debiteur|crediteur/.test(h);
  const period: "n" | "n1" | "unknown" =
    /n1|nmoins1|anterieur|precedente?s?|passe|n1$|exerciceprecedent/.test(h)
      ? "n1"
      : /n0|exercice|encours|cloture|actuel|^n$|n$/.test(h)
        ? "n"
        : "unknown";
  return { side, solde, period };
}

function readHeader(row: string[]): HeaderHints | null {
  let code = -1;
  let label = -1;
  const cols: HeaderHints["cols"] = [];
  row.forEach((cell, i) => {
    const h = normalizeHeader(cell);
    if (!h) return;
    if (code < 0 && /^(n?compte|comptegeneral|comptes|n?comptegeneral|numero|numerodecompte|numerocompte|num|code|n)$/.test(h)) code = i;
    else if (label < 0 && /^(libelle|intitule|designation|libellecompte|nom|libelles)$/.test(h)) label = i;
    else {
      const a = classifyAmountHeader(cell);
      if (a) cols.push({ index: i, ...a });
    }
  });
  if (cols.length === 0) return null;
  if (code < 0 && label < 0) return null;
  return { code, label, cols };
}

/** Construit le mapping à partir des en-têtes reconnus, en préférant les soldes. */
function mappingFromHints(hints: HeaderHints): { mapping: Balance6Mapping; layout: Balance6GridResult["layout"]; period: string } {
  const pickPeriod = (want: "n" | "n1", solde: boolean, side: "debit" | "credit") => {
    const exact = hints.cols.find((c) => c.period === want && c.solde === solde && c.side === side);
    if (exact) return exact.index;
    if (want === "n") {
      const unknown = hints.cols.find((c) => c.period === "unknown" && c.solde === solde && c.side === side);
      if (unknown) return unknown.index;
    }
    return -1;
  };

  const hasStandaloneSolde = hints.cols.some((c) => c.solde);
  const sdN = pickPeriod("n", true, "debit");
  const scN = pickPeriod("n", true, "credit");
  const sdN1 = pickPeriod("n1", true, "debit");
  const scN1 = pickPeriod("n1", true, "credit");
  const mdN = pickPeriod("n", false, "debit");
  const mcN = pickPeriod("n", false, "credit");
  const mdN1 = pickPeriod("n1", false, "debit");
  const mcN1 = pickPeriod("n1", false, "credit");

  if (sdN >= 0 || scN >= 0) {
    return {
      mapping: {
        code: hints.code, label: hints.label,
        debitN: sdN, creditN: scN, debitN1: sdN1, creditN1: scN1,
        // Colonne signée unique : `debitN` reste vide et le signe décide.
        soldeN: sdN >= 0 ? sdN : scN,
        soldeN1: sdN1 >= 0 ? sdN1 : scN1,
      },
      layout: "solde",
      period: sdN1 >= 0 || scN1 >= 0 ? "soldes N et N-1" : "soldes N",
    };
  }
  if (mdN >= 0 || mcN >= 0) {
    return {
      mapping: { code: hints.code, label: hints.label, debitN: mdN, creditN: mcN, debitN1: mdN1, creditN1: mcN1, soldeN: -1, soldeN1: -1 },
      layout: "entetes",
      period: hasStandaloneSolde ? "mouvements N" : "mouvements N",
    };
  }
  return { mapping: { ...EMPTY_MAPPING, code: hints.code, label: hints.label }, layout: "entetes", period: "aucune" };
}

export function parseBalance6Grid(grid: string[][]): Balance6GridResult {
  const signals: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const rejected: { row: number; reason: string; values: string[] }[] = [];

  // 1) Chercher une ligne d'en-têtes dans les quinze premières lignes.
  let headerRow: number | null = null;
  let hints: HeaderHints | null = null;
  for (let r = 0; r < Math.min(grid.length, 15); r++) {
    const h = readHeader(grid[r] || []);
    if (h && (h.code >= 0 || h.label >= 0)) { headerRow = r; hints = h; break; }
  }

  let mapping: Balance6Mapping = { ...EMPTY_MAPPING };
  let layout: Balance6GridResult["layout"] = "positionnel";
  let described = "";

  if (hints) {
    const built = mappingFromHints(hints);
    mapping = built.mapping;
    layout = built.layout;
    described = built.period;
    signals.push(`En-têtes reconnus ligne ${headerRow! + 1} (${hints.cols.length} colonne(s) de montants).`);
    if (layout === "solde") {
      warnings.length === 0 && signals.push(`Balance des soldes lue (${described}).`);
    } else if (layout === "entetes") {
      warnings.push(
        "Aucune colonne de solde (débiteur/créditeur) : les colonnes de mouvements sont utilisées comme soldes. "
        + "Une balance de mouvements ne donne pas les soldes d'un bilan — vérifiez avant de produire la liasse.",
      );
    } else {
      errors.push("En-têtes détectés mais aucune colonne de montant exploitable (ni débit/crédit, ni solde).");
    }
    if (mapping.debitN1 < 0 && mapping.creditN1 < 0) {
      warnings.push("Aucune colonne N-1 reconnue : l'exercice précédent sera vide (les contrôles comparatifs seront sans objet).");
    }
  } else {
    // Repli historique : « Compte · Libellé · SD N · SC N · SD N-1 · SC N-1 ».
    mapping = { ...EMPTY_MAPPING, code: 0, label: 1, debitN: 2, creditN: 3, debitN1: 4, creditN1: 5 };
    warnings.push(
      "Aucun en-tête lisible : disposition supposée « Compte · Libellé · Solde débiteur N · Solde créditeur N · Solde débiteur N-1 · Solde créditeur N-1 ». "
      + "Vérifiez les soldes affichés avant de produire la liasse.",
    );
  }

  const n: Balance6Row[] = [];
  const n1: Balance6Row[] = [];
  const subtotals: Balance6Subtotal[] = [];
  const amountColumns = [...new Set([mapping.debitN, mapping.creditN, mapping.debitN1, mapping.creditN1, mapping.soldeN, mapping.soldeN1])]
    .filter((i) => i >= 0);

  const pick = (row: string[], index: number): unknown => {
    if (index < 0 || index >= row.length || blank(row[index])) return null;
    return row[index];
  };

  // 2) Lire les lignes.
  for (let r = headerRow === null ? 0 : headerRow + 1; r < grid.length; r++) {
    const row = grid[r] || [];
    if (row.every((c) => blank(c))) continue;

    const rawCode = String(pick(row, mapping.code) ?? "").trim();
    const label = String(pick(row, mapping.label) ?? "").trim();
    if (!rawCode && !label) continue;

    if (isTotalLabel(label) || isTotalLabel(rawCode)) {
      subtotals.push({
        label: label || rawCode,
        debit: parseAmount(pick(row, mapping.debitN)).value,
        credit: parseAmount(pick(row, mapping.creditN)).value,
      });
      continue;
    }

    // Un code comptable commence par un chiffre ; sinon la ligne est écartée avec son motif.
    if (!/^\d/.test(rawCode)) {
      rejected.push({
        row: r + 1,
        reason: rawCode ? `code « ${rawCode} » non comptable` : "code de compte manquant",
        values: row.slice(0, 8).map((c) => String(c ?? "")),
      });
      continue;
    }

    if (!amountColumns.some((i) => !blank(row[i]))) {
      rejected.push({ row: r + 1, reason: "aucun montant sur la ligne", values: row.slice(0, 8).map((c) => String(c ?? "")) });
      continue;
    }

    const side = (index: number): number => (index < 0 ? 0 : Math.abs(parseAmount(pick(row, index)).value));

    let debitN: number;
    let creditN: number;
    let debitN1: number;
    let creditN1: number;

    if (layout === "solde" && mapping.soldeN >= 0 && mapping.creditN === mapping.soldeN) {
      // Colonne de solde signée : le signe décide du côté.
      const sN = parseAmount(pick(row, mapping.soldeN)).value;
      const sN1 = mapping.soldeN1 >= 0 ? parseAmount(pick(row, mapping.soldeN1)).value : 0;
      debitN = sN > 0 ? sN : 0; creditN = sN < 0 ? -sN : 0;
      debitN1 = sN1 > 0 ? sN1 : 0; creditN1 = sN1 < 0 ? -sN1 : 0;
    } else {
      debitN = side(mapping.debitN);
      creditN = side(mapping.creditN);
      debitN1 = side(mapping.debitN1);
      creditN1 = side(mapping.creditN1);
    }

    n.push({ code: rawCode, label: label || rawCode, debit: debitN, credit: creditN });
    n1.push({ code: rawCode, label: label || rawCode, debit: debitN1, credit: creditN1 });
  }

  const totals = {
    debitN: n.reduce((s, x) => s + x.debit, 0),
    creditN: n.reduce((s, x) => s + x.credit, 0),
    debitN1: n1.reduce((s, x) => s + x.debit, 0),
    creditN1: n1.reduce((s, x) => s + x.credit, 0),
    ecartN: 0,
    ecartN1: 0,
  };
  totals.ecartN = totals.debitN - totals.creditN;
  totals.ecartN1 = totals.debitN1 - totals.creditN1;

  // 3) Refuser explicitement plutôt que renvoyer une balance vide.
  if (n.length === 0) {
    errors.push(
      grid.length === 0
        ? "Fichier vide : aucune ligne à lire."
        : "Aucun compte lu dans cette balance. Vérifiez qu'une colonne contient les numéros de compte et qu'une autre contient des montants.",
    );
  }
  if (n.length > 0 && Math.abs(totals.ecartN) >= 1) {
    warnings.push(`Balance N déséquilibrée : débit ${totals.debitN.toLocaleString("fr-FR")} ≠ crédit ${totals.creditN.toLocaleString("fr-FR")} (écart ${totals.ecartN.toLocaleString("fr-FR")}).`);
  }
  if (rejected.length > 0) {
    warnings.push(`${rejected.length} ligne(s) écartée(s) : elles ne sont pas comptées dans la balance (détail ci-dessous).`);
  }
  if (n.length > 0) {
    const withPrev = n1.filter((x) => x.debit !== 0 || x.credit !== 0).length;
    signals.push(`${n.length} compte(s) lu(s), ${withPrev} avec un solde N-1.`);
  }

  return {
    ok: errors.length === 0,
    n, n1, subtotals, headerRow, mapping, layout,
    signals, warnings, errors, totals, rejected,
  };
}
