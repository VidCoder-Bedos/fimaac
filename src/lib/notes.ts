// ============================================================================
// FIMAAC — Les 35 notes annexes SYSCOHADA révisé
// Chaque module calcule ses lignes à partir des balances N et N-1.
// RÈGLE ABSOLUE : une valeur non déterminée = null, jamais 0.
// ============================================================================
import type { NoteDetail, NoteModule, NoteResult, NoteRow, ProdContext } from "./production/types";
import type { BalanceRow } from "./liasse";

/** Agrège les soldes d'une balance pour une liste de préfixes. */
function agg(rows: BalanceRow[], prefixes: string[], sign: "debit" | "credit" | "amort"): number {
  let t = 0;
  for (const r of rows) {
    if (!prefixes.some((p) => r.code === p || r.code.startsWith(p))) continue;
    t += sign === "amort" ? r.credit - r.debit : sign === "debit" ? r.debit - r.credit : r.credit - r.debit;
  }
  return Math.round(t);
}

/** Construit une ligne de note. */
function row(label: string, ref: string, n: number | null, n1: number | null, details?: NoteDetail[]): NoteRow {
  const variation = n !== null && n1 !== null ? n - n1 : null;
  return details && details.length > 0 ? { label, ref, n, n1, variation, details } : { label, ref, n, n1, variation };
}

/**
 * P16 — Détail par compte d'une ligne de note.
 *
 * Une note qui affiche « Clients 15 167 298 » sans dire *quels comptes* la
 * composent oblige le réviseur à refaire la balance à la main. Le détail est
 * produit ici, du même agrégat que la ligne : sa somme vaut la ligne, par
 * construction. Les comptes à solde nul ne sont pas listés — on n'invente pas
 * une ligne à zéro.
 */
function detailOf(ctx: ProdContext, prefixes: string[], sign: "debit" | "credit"): NoteDetail[] {
  const labelOf = (code: string) => ctx.accounts.find((a) => a.code === code)?.label || `Compte ${code}`;
  const collect = (rows: BalanceRow[]) => {
    const out: NoteDetail[] = [];
    for (const r of rows) {
      if (!prefixes.some((p) => r.code === p || r.code.startsWith(p))) continue;
      const v = Math.round(sign === "debit" ? r.debit - r.credit : r.credit - r.debit);
      if (v === 0) continue;
      out.push({ code: r.code, label: labelOf(r.code), n: v, n1: null });
    }
    return out.sort((a, b) => a.code.localeCompare(b.code));
  };
  const nDetails = collect(ctx.balances.n);
  const n1Details = new Map(collect(ctx.balances.n1).map((d) => [d.code, d.n]));
  return nDetails.map((d) => ({ ...d, n1: n1Details.get(d.code) ?? null }));
}

/** Retourne null si la valeur est 0 (règle : ne rien inventer). */
function nz(v: number): number | null {
  return v === 0 ? null : v;
}

/** Helper pour créer un NoteResult. */
function make(code: string, applicable: boolean, rows: NoteRow[], totalN: number | null, totalN1: number | null, missingInfo: string[] = [], status: NoteResult["status"] = "calculated"): NoteResult {
  return { code, applicable, rows, totalN, totalN1, status, missingInfo };
}

/** Helper : calcule le total N et N-1 d'une liste de lignes. */
function totals(rows: NoteRow[]): { totalN: number | null; totalN1: number | null } {
  const n = rows.reduce((s, r) => s + (r.n ?? 0), 0);
  const n1 = rows.reduce((s, r) => s + (r.n1 ?? 0), 0);
  return { totalN: n !== 0 ? n : null, totalN1: n1 !== 0 ? n1 : null };
}

// ============================================================================
// NOTE 1 — Capital et réserves
// ============================================================================
const NOTE_01: NoteModule = {
  code: "NOTE_01", title: "Capital et réserves",
  applicable: (ctx) => agg(ctx.balances.n, ["101", "10", "11", "12"], "credit") !== 0,
  dependencies: ["bilan_passif.CA", "bilan_passif.CF", "bilan_passif.CG"],
  compute: (ctx) => {
    const { n, n1 } = ctx.balances;
    const rows: NoteRow[] = [
      row("Capital souscrit, appelé, versé, non amorti", "1013", nz(agg(n, ["1013"], "credit")), nz(agg(n1, ["1013"], "credit"))),
      row("Capital par dotation", "102", nz(agg(n, ["102"], "credit")), nz(agg(n1, ["102"], "credit"))),
      row("Primes liées aux capitaux propres", "105", nz(agg(n, ["105"], "credit")), nz(agg(n1, ["105"], "credit"))),
      row("Écarts de réévaluation", "106", nz(agg(n, ["106"], "credit")), nz(agg(n1, ["106"], "credit"))),
      row("Réserve légale", "111", nz(agg(n, ["111"], "credit")), nz(agg(n1, ["111"], "credit"))),
      row("Réserves statutaires ou contractuelles", "112", nz(agg(n, ["112"], "credit")), nz(agg(n1, ["112"], "credit"))),
      row("Réserves réglementées", "113", nz(agg(n, ["113"], "credit")), nz(agg(n1, ["113"], "credit"))),
      row("Autres réserves", "118", nz(agg(n, ["118"], "credit")), nz(agg(n1, ["118"], "credit"))),
      row("Report à nouveau créditeur", "121", nz(agg(n, ["121"], "credit")), nz(agg(n1, ["121"], "credit"))),
      row("Report à nouveau débiteur", "129", nz(agg(n, ["129"], "debit")), nz(agg(n1, ["129"], "debit"))),
    ];
    const { totalN, totalN1 } = totals(rows);
    return make("NOTE_01", true, rows, totalN, totalN1);
  },
  deriveQuestions: () => [],
};

// ============================================================================
// NOTE 3A — Immobilisations incorporelles et corporelles
// ============================================================================
const NOTE_03A: NoteModule = {
  code: "NOTE_03A", title: "Immobilisations incorporelles et corporelles",
  applicable: (ctx) => agg(ctx.balances.n, ["20", "21", "22", "23", "24", "25"], "debit") !== 0,
  dependencies: ["bilan_actif.AE", "bilan_actif.AF", "bilan_actif.AG", "bilan_actif.AH", "bilan_actif.AJ", "bilan_actif.AK", "bilan_actif.AL", "bilan_actif.AM", "bilan_actif.AN", "bilan_actif.AP"],
  compute: (ctx) => {
    const { n, n1 } = ctx.balances;
    const items: { ref: string; label: string; prefixes: string[] }[] = [
      { ref: "AE", label: "Frais de développement et de prospection", prefixes: ["201"] },
      { ref: "AF", label: "Brevets, licences, logiciels et droits similaires", prefixes: ["212", "213", "214"] },
      { ref: "AG", label: "Fonds commercial et droit au bail", prefixes: ["215", "216"] },
      { ref: "AH", label: "Autres immobilisations incorporelles", prefixes: ["211", "217", "218"] },
      { ref: "AJ", label: "Terrains", prefixes: ["22"] },
      { ref: "AK", label: "Bâtiments, constructions", prefixes: ["231", "232"] },
      { ref: "AL", label: "Aménagements, agencements et installations", prefixes: ["233", "234", "235"] },
      { ref: "AM", label: "Matériel, mobilier et actifs biologiques", prefixes: ["241", "242", "243", "244"] },
      { ref: "AN", label: "Matériel de transport", prefixes: ["245"] },
      { ref: "AP", label: "Avances et acomptes versés sur immobilisations", prefixes: ["25"] },
    ];
    const rows: NoteRow[] = [];
    for (const it of items) {
      const brutN = agg(n, it.prefixes, "debit");
      const amortN = agg(n, it.prefixes.map((p) => p.startsWith("2") ? "28" + p.slice(1) : p), "amort");
      const brutN1 = agg(n1, it.prefixes, "debit");
      const amortN1 = agg(n1, it.prefixes.map((p) => p.startsWith("2") ? "28" + p.slice(1) : p), "amort");
      if (brutN === 0 && brutN1 === 0 && amortN === 0 && amortN1 === 0) continue;
      rows.push(row(it.label + " — brut", it.ref, nz(brutN), nz(brutN1)));
      rows.push(row(it.label + " — amortissements", it.ref + "-AM", nz(amortN), nz(amortN1)));
      rows.push(row(it.label + " — net", it.ref + "-NET", nz(brutN - amortN), nz(brutN1 - amortN1)));
    }
    const { totalN, totalN1 } = totals(rows.filter((r) => r.ref?.endsWith("-NET")));
    return make("NOTE_03A", true, rows, totalN, totalN1);
  },
  deriveQuestions: () => [],
};

// ============================================================================
// NOTE 3B — Immobilisations financières
// ============================================================================
const NOTE_03B: NoteModule = {
  code: "NOTE_03B", title: "Immobilisations financières",
  applicable: (ctx) => agg(ctx.balances.n, ["26", "27"], "debit") !== 0,
  dependencies: ["bilan_actif.AR", "bilan_actif.AS"],
  compute: (ctx) => {
    const { n, n1 } = ctx.balances;
    const items: { ref: string; label: string; prefixes: string[] }[] = [
      { ref: "AR", label: "Titres de participation", prefixes: ["26"] },
      { ref: "AS-271", label: "Prêts et créances non commerciales", prefixes: ["271"] },
      { ref: "AS-272", label: "Prêts au personnel", prefixes: ["272"] },
      { ref: "AS-273", label: "Créances sur l'État", prefixes: ["273"] },
      { ref: "AS-274", label: "Titres immobilisés", prefixes: ["274"] },
      { ref: "AS-275", label: "Dépôts et cautionnements versés", prefixes: ["275"] },
      { ref: "AS-277", label: "Créances rattachées à des participations", prefixes: ["277"] },
    ];
    const rows: NoteRow[] = [];
    for (const it of items) {
      const vN = nz(agg(n, it.prefixes, "debit"));
      const vN1 = nz(agg(n1, it.prefixes, "debit"));
      if (vN === null && vN1 === null) continue;
      rows.push(row(it.label, it.ref, vN, vN1));
    }
    const { totalN, totalN1 } = totals(rows);
    return make("NOTE_03B", true, rows, totalN, totalN1);
  },
  deriveQuestions: () => [],
};

// ============================================================================
// NOTE 3C — Amortissements
// ============================================================================
const NOTE_03C: NoteModule = {
  code: "NOTE_03C", title: "Amortissements",
  applicable: (ctx) => agg(ctx.balances.n, ["28"], "amort") !== 0,
  dependencies: ["resultat.RL"],
  compute: (ctx) => {
    const { n, n1 } = ctx.balances;
    const items: { ref: string; label: string; prefixes: string[] }[] = [
      { ref: "281", label: "Amortissements des immobilisations incorporelles", prefixes: ["281"] },
      { ref: "282", label: "Amortissements des terrains", prefixes: ["282"] },
      { ref: "283", label: "Amortissements des bâtiments et installations", prefixes: ["283"] },
      { ref: "284", label: "Amortissements du matériel", prefixes: ["284"] },
    ];
    const rows: NoteRow[] = [];
    for (const it of items) {
      const vN = nz(agg(n, it.prefixes, "amort"));
      const vN1 = nz(agg(n1, it.prefixes, "amort"));
      if (vN === null && vN1 === null) continue;
      rows.push(row(it.label, it.ref, vN, vN1));
    }
    // Dotation de l'exercice
    const dotationN = agg(n, ["681"], "debit");
    const dotationN1 = agg(n1, ["681"], "debit");
    rows.push(row("Dotation de l'exercice (681)", "DOT", nz(dotationN), nz(dotationN1)));
    const { totalN, totalN1 } = totals(rows.filter((r) => !r.ref?.startsWith("DOT")));
    return make("NOTE_03C", true, rows, totalN, totalN1);
  },
  deriveQuestions: () => [],
};

// ============================================================================
// NOTE 4 — Créances clients
// ============================================================================
const NOTE_04: NoteModule = {
  code: "NOTE_04", title: "Créances clients et comptes rattachés",
  applicable: (ctx) => agg(ctx.balances.n, ["411", "412", "414", "416", "417", "418"], "debit") !== 0 || agg(ctx.balances.n, ["419", "491"], "credit") !== 0,
  dependencies: ["bilan_actif.BI"],
  compute: (ctx) => {
    const { n, n1 } = ctx.balances;
    const items: { ref: string; label: string; prefixes: string[]; sign: "debit" | "credit" }[] = [
      { ref: "411", label: "Clients (dettes en compte)", prefixes: ["411"], sign: "debit" },
      { ref: "412", label: "Clients, effets à recevoir", prefixes: ["412"], sign: "debit" },
      { ref: "414", label: "Créances sur cessions d'immobilisations", prefixes: ["414"], sign: "debit" },
      { ref: "416", label: "Créances clients litigieuses ou douteuses", prefixes: ["416"], sign: "debit" },
      { ref: "418", label: "Clients, produits à recevoir", prefixes: ["418"], sign: "debit" },
      { ref: "419", label: "Clients créditeurs (avances reçues)", prefixes: ["419"], sign: "credit" },
      { ref: "491", label: "Dépréciations des comptes clients", prefixes: ["491"], sign: "credit" },
    ];
    const rows: NoteRow[] = [];
    for (const it of items) {
      const vN = nz(agg(n, it.prefixes, it.sign));
      const vN1 = nz(agg(n1, it.prefixes, it.sign));
      if (vN === null && vN1 === null) continue;
      rows.push(row(it.label, it.ref, vN, vN1, detailOf(ctx, it.prefixes, it.sign)));
    }
    const brutN = agg(n, ["411", "412", "414", "416", "418"], "debit");
    const deprN = agg(n, ["491"], "credit");
    const brutN1 = agg(n1, ["411", "412", "414", "416", "418"], "debit");
    const deprN1 = agg(n1, ["491"], "credit");
    rows.push(row("Créances clients nettes", "BI-NET", nz(brutN - deprN), nz(brutN1 - deprN1)));
    const { totalN, totalN1 } = totals(rows);
    return make("NOTE_04", true, rows, totalN, totalN1);
  },
  deriveQuestions: () => [],
};

// ============================================================================
// NOTE 5 — Autres créances
// ============================================================================
const NOTE_05: NoteModule = {
  code: "NOTE_05", title: "Autres créances",
  applicable: (ctx) => agg(ctx.balances.n, ["46", "476", "478"], "debit") !== 0,
  dependencies: ["bilan_actif.BJ", "bilan_actif.BU"],
  compute: (ctx) => {
    const { n, n1 } = ctx.balances;
    const items: { ref: string; label: string; prefixes: string[]; sign: "debit" | "credit" }[] = [
      { ref: "461", label: "Associés, opérations sur le capital", prefixes: ["461"], sign: "debit" },
      { ref: "462", label: "Associés, comptes courants", prefixes: ["462"], sign: "debit" },
      { ref: "465", label: "Associés, dividendes à payer", prefixes: ["465"], sign: "debit" },
      { ref: "466", label: "Groupe, comptes courants", prefixes: ["466"], sign: "debit" },
      { ref: "471", label: "Comptes d'attente (débiteurs divers)", prefixes: ["4711"], sign: "debit" },
      { ref: "476", label: "Charges constatées d'avance", prefixes: ["476"], sign: "debit" },
      { ref: "478", label: "Écarts de conversion — Actif", prefixes: ["478"], sign: "debit" },
    ];
    const rows: NoteRow[] = [];
    for (const it of items) {
      const vN = nz(agg(n, it.prefixes, it.sign));
      const vN1 = nz(agg(n1, it.prefixes, it.sign));
      if (vN === null && vN1 === null) continue;
      rows.push(row(it.label, it.ref, vN, vN1));
    }
    const { totalN, totalN1 } = totals(rows);
    return make("NOTE_05", true, rows, totalN, totalN1);
  },
  deriveQuestions: () => [],
};

// ============================================================================
// NOTE 6 — Stocks
// ============================================================================
const NOTE_06: NoteModule = {
  code: "NOTE_06", title: "Stocks et en-cours",
  applicable: (ctx) => agg(ctx.balances.n, ["3"], "debit") !== 0,
  dependencies: ["bilan_actif.BB"],
  compute: (ctx) => {
    const { n, n1 } = ctx.balances;
    const items: { ref: string; label: string; prefixes: string[] }[] = [
      { ref: "31", label: "Marchandises", prefixes: ["31"] },
      { ref: "32", label: "Matières premières et fournitures liées", prefixes: ["32"] },
      { ref: "33", label: "Autres approvisionnements", prefixes: ["33"] },
      { ref: "34", label: "Produits en cours", prefixes: ["34"] },
      { ref: "35", label: "Services en cours", prefixes: ["35"] },
      { ref: "36", label: "Produits finis", prefixes: ["36"] },
      { ref: "37", label: "Produits intermédiaires et résiduels", prefixes: ["37"] },
    ];
    const rows: NoteRow[] = [];
    for (const it of items) {
      const vN = nz(agg(n, it.prefixes, "debit"));
      const vN1 = nz(agg(n1, it.prefixes, "debit"));
      if (vN === null && vN1 === null) continue;
      rows.push(row(it.label, it.ref, vN, vN1));
    }
    const deprecN = agg(n, ["39"], "amort");
    const deprecN1 = agg(n1, ["39"], "amort");
    if (deprecN !== 0 || deprecN1 !== 0) {
      rows.push(row("Dépréciations des stocks", "39", nz(deprecN), nz(deprecN1)));
    }
    const { totalN, totalN1 } = totals(rows.filter((r) => !r.ref?.startsWith("39")));
    return make("NOTE_06", true, rows, totalN, totalN1);
  },
  deriveQuestions: () => [],
};

// ============================================================================
// NOTE 7 — Autres immobilisations financières
// ============================================================================
const NOTE_07: NoteModule = {
  code: "NOTE_07", title: "Autres immobilisations financières",
  applicable: (ctx) => agg(ctx.balances.n, ["27"], "debit") !== 0,
  dependencies: ["bilan_actif.AS"],
  compute: (ctx) => {
    const { n, n1 } = ctx.balances;
    const items: { ref: string; label: string; prefixes: string[] }[] = [
      { ref: "271", label: "Prêts et créances non commerciales", prefixes: ["271"] },
      { ref: "272", label: "Prêts au personnel", prefixes: ["272"] },
      { ref: "273", label: "Créances sur l'État", prefixes: ["273"] },
      { ref: "274", label: "Titres immobilisés", prefixes: ["274"] },
      { ref: "275", label: "Dépôts et cautionnements versés", prefixes: ["275"] },
      { ref: "277", label: "Créances rattachées à des participations", prefixes: ["277"] },
      { ref: "278", label: "Autres immobilisations financières diverses", prefixes: ["278"] },
    ];
    const rows: NoteRow[] = [];
    for (const it of items) {
      const vN = nz(agg(n, it.prefixes, "debit"));
      const vN1 = nz(agg(n1, it.prefixes, "debit"));
      if (vN === null && vN1 === null) continue;
      rows.push(row(it.label, it.ref, vN, vN1));
    }
    const { totalN, totalN1 } = totals(rows);
    return make("NOTE_07", true, rows, totalN, totalN1);
  },
  deriveQuestions: () => [],
};

// ============================================================================
// NOTE 8 — Titres de placement
// ============================================================================
const NOTE_08: NoteModule = {
  code: "NOTE_08", title: "Titres de placement",
  applicable: (ctx) => agg(ctx.balances.n, ["50"], "debit") !== 0,
  dependencies: ["bilan_actif.BQ"],
  compute: (ctx) => {
    const { n, n1 } = ctx.balances;
    const items: { ref: string; label: string; prefixes: string[] }[] = [
      { ref: "501", label: "Titres du Trésor et bons de caisse à court terme", prefixes: ["501"] },
      { ref: "502", label: "Actions", prefixes: ["502"] },
      { ref: "503", label: "Obligations", prefixes: ["503"] },
      { ref: "504", label: "Bons de souscription", prefixes: ["504"] },
      { ref: "505", label: "Titres négociables hors Région", prefixes: ["505"] },
    ];
    const rows: NoteRow[] = [];
    for (const it of items) {
      const vN = nz(agg(n, it.prefixes, "debit"));
      const vN1 = nz(agg(n1, it.prefixes, "debit"));
      if (vN === null && vN1 === null) continue;
      rows.push(row(it.label, it.ref, vN, vN1));
    }
    const { totalN, totalN1 } = totals(rows);
    return make("NOTE_08", true, rows, totalN, totalN1);
  },
  deriveQuestions: () => [],
};

// ============================================================================
// NOTE 9 — Fournisseurs
// ============================================================================
const NOTE_09: NoteModule = {
  code: "NOTE_09", title: "Fournisseurs et comptes rattachés",
  applicable: (ctx) => agg(ctx.balances.n, ["401", "402", "408"], "credit") !== 0 || agg(ctx.balances.n, ["409", "491"], "debit") !== 0,
  dependencies: ["bilan_passif.DJ"],
  compute: (ctx) => {
    const { n, n1 } = ctx.balances;
    const items: { ref: string; label: string; prefixes: string[]; sign: "debit" | "credit" }[] = [
      { ref: "401", label: "Fournisseurs, dettes en compte", prefixes: ["401"], sign: "credit" },
      { ref: "402", label: "Fournisseurs, effets à payer", prefixes: ["402"], sign: "credit" },
      { ref: "408", label: "Fournisseurs, factures non parvenues", prefixes: ["408"], sign: "credit" },
      { ref: "409", label: "Fournisseurs débiteurs (avances versées)", prefixes: ["409"], sign: "debit" },
      { ref: "491", label: "Dépréciations des comptes fournisseurs", prefixes: ["491"], sign: "credit" },
    ];
    const rows: NoteRow[] = [];
    for (const it of items) {
      const vN = nz(agg(n, it.prefixes, it.sign));
      const vN1 = nz(agg(n1, it.prefixes, it.sign));
      if (vN === null && vN1 === null) continue;
      rows.push(row(it.label, it.ref, vN, vN1));
    }
    const brutN = agg(n, ["401", "402", "408"], "credit");
    const brutN1 = agg(n1, ["401", "402", "408"], "credit");
    rows.push(row("Fournisseurs bruts", "DJ-BRUT", nz(brutN), nz(brutN1)));
    const { totalN, totalN1 } = totals(rows.filter((r) => !r.ref?.endsWith("BRUT")));
    return make("NOTE_09", true, rows, totalN, totalN1);
  },
  deriveQuestions: () => [],
};

// ============================================================================
// NOTE 10 — Dettes financières
// ============================================================================
const NOTE_10: NoteModule = {
  code: "NOTE_10", title: "Dettes financières",
  applicable: (ctx) => agg(ctx.balances.n, ["16", "17"], "credit") !== 0,
  dependencies: ["bilan_passif.DA", "bilan_passif.DB"],
  compute: (ctx) => {
    const { n, n1 } = ctx.balances;
    const items: { ref: string; label: string; prefixes: string[] }[] = [
      { ref: "161", label: "Emprunts obligataires", prefixes: ["161"] },
      { ref: "162", label: "Emprunts auprès des établissements de crédit", prefixes: ["162"] },
      { ref: "163", label: "Avances reçues de l'État", prefixes: ["163"] },
      { ref: "165", label: "Dépôts et cautionnements reçus", prefixes: ["165"] },
      { ref: "168", label: "Autres emprunts et dettes", prefixes: ["168"] },
      { ref: "172", label: "Emprunts équivalents de crédit-bail immobilier", prefixes: ["172"] },
      { ref: "173", label: "Emprunts équivalents de crédit-bail mobilier", prefixes: ["173"] },
    ];
    const rows: NoteRow[] = [];
    for (const it of items) {
      const vN = nz(agg(n, it.prefixes, "credit"));
      const vN1 = nz(agg(n1, it.prefixes, "credit"));
      if (vN === null && vN1 === null) continue;
      rows.push(row(it.label, it.ref, vN, vN1));
    }
    const { totalN, totalN1 } = totals(rows);
    return make("NOTE_10", true, rows, totalN, totalN1);
  },
  deriveQuestions: () => [],
};

// ============================================================================
// NOTE 11 — Provisions pour risques et charges
// ============================================================================
const NOTE_11: NoteModule = {
  code: "NOTE_11", title: "Provisions pour risques et charges",
  applicable: (ctx) => agg(ctx.balances.n, ["19"], "credit") !== 0,
  dependencies: ["bilan_passif.DC", "bilan_passif.DN"],
  compute: (ctx) => {
    const { n, n1 } = ctx.balances;
    const items: { ref: string; label: string; prefixes: string[] }[] = [
      { ref: "191", label: "Provisions pour litiges", prefixes: ["191"] },
      { ref: "192", label: "Provisions pour garanties données aux clients", prefixes: ["192"] },
      { ref: "193", label: "Provisions pour pertes sur marchés à achèvement futur", prefixes: ["193"] },
      { ref: "195", label: "Provisions pour impôts", prefixes: ["195"] },
      { ref: "196", label: "Provisions pour pensions et obligations similaires", prefixes: ["196"] },
      { ref: "197", label: "Provisions pour charges à répartir sur plusieurs exercices", prefixes: ["197"] },
      { ref: "198", label: "Autres provisions financières", prefixes: ["198"] },
    ];
    const rows: NoteRow[] = [];
    for (const it of items) {
      const vN = nz(agg(n, it.prefixes, "credit"));
      const vN1 = nz(agg(n1, it.prefixes, "credit"));
      if (vN === null && vN1 === null) continue;
      rows.push(row(it.label, it.ref, vN, vN1));
    }
    const { totalN, totalN1 } = totals(rows);
    return make("NOTE_11", true, rows, totalN, totalN1);
  },
  deriveQuestions: () => [],
};

// ============================================================================
// NOTE 12 — Écarts de conversion
// ============================================================================
const NOTE_12: NoteModule = {
  code: "NOTE_12", title: "Écarts de conversion",
  applicable: (ctx) => agg(ctx.balances.n, ["478", "479"], "debit") !== 0 || agg(ctx.balances.n, ["478", "479"], "credit") !== 0,
  dependencies: ["bilan_actif.BU", "bilan_passif.DV"],
  compute: (ctx) => {
    const { n, n1 } = ctx.balances;
    const items: { ref: string; label: string; prefixes: string[]; sign: "debit" | "credit" }[] = [
      { ref: "4781", label: "Écarts de conversion — Diminution des créances", prefixes: ["4781"], sign: "debit" },
      { ref: "4782", label: "Écarts de conversion — Augmentation des dettes", prefixes: ["4782"], sign: "debit" },
      { ref: "4791", label: "Écarts de conversion — Augmentation des créances", prefixes: ["4791"], sign: "credit" },
      { ref: "4792", label: "Écarts de conversion — Diminution des dettes", prefixes: ["4792"], sign: "credit" },
    ];
    const rows: NoteRow[] = [];
    for (const it of items) {
      const vN = nz(agg(n, it.prefixes, it.sign));
      const vN1 = nz(agg(n1, it.prefixes, it.sign));
      if (vN === null && vN1 === null) continue;
      rows.push(row(it.label, it.ref, vN, vN1));
    }
    const { totalN, totalN1 } = totals(rows);
    return make("NOTE_12", true, rows, totalN, totalN1);
  },
  deriveQuestions: () => [],
};

// ============================================================================
// NOTE 13 — Capitaux propres et réserves
// ============================================================================
const NOTE_13: NoteModule = {
  code: "NOTE_13", title: "Capitaux propres et réserves",
  applicable: (ctx) => agg(ctx.balances.n, ["1"], "credit") !== 0,
  dependencies: ["bilan_passif.CAPITAUX"],
  compute: (ctx) => {
    const { n, n1 } = ctx.balances;
    const items: { ref: string; label: string; prefixes: string[]; sign: "debit" | "credit" }[] = [
      { ref: "1013", label: "Capital souscrit, appelé, versé, non amorti", prefixes: ["1013"], sign: "credit" },
      { ref: "105", label: "Primes liées aux capitaux propres", prefixes: ["105"], sign: "credit" },
      { ref: "106", label: "Écarts de réévaluation", prefixes: ["106"], sign: "credit" },
      { ref: "111", label: "Réserve légale", prefixes: ["111"], sign: "credit" },
      { ref: "112", label: "Réserves statutaires ou contractuelles", prefixes: ["112"], sign: "credit" },
      { ref: "118", label: "Autres réserves", prefixes: ["118"], sign: "credit" },
      { ref: "121", label: "Report à nouveau créditeur", prefixes: ["121"], sign: "credit" },
      { ref: "129", label: "Report à nouveau débiteur", prefixes: ["129"], sign: "debit" },
      { ref: "14", label: "Subventions d'investissement", prefixes: ["14"], sign: "credit" },
      { ref: "15", label: "Provisions réglementées", prefixes: ["15"], sign: "credit" },
    ];
    const rows: NoteRow[] = [];
    for (const it of items) {
      const vN = nz(agg(n, it.prefixes, it.sign));
      const vN1 = nz(agg(n1, it.prefixes, it.sign));
      if (vN === null && vN1 === null) continue;
      rows.push(row(it.label, it.ref, vN, vN1));
    }
    const { totalN, totalN1 } = totals(rows);
    return make("NOTE_13", true, rows, totalN, totalN1);
  },
  deriveQuestions: () => [],
};

// ============================================================================
// NOTE 14 — Emprunts et dettes financières (échéances par année)
// ============================================================================
const NOTE_14: NoteModule = {
  code: "NOTE_14", title: "Emprunts et dettes financières — échéances",
  applicable: (ctx) => agg(ctx.balances.n, ["16"], "credit") !== 0,
  dependencies: ["bilan_passif.DA"],
  compute: (ctx) => {
    const { n } = ctx.balances;
    // Cette note demande une ventilation par année d'échéance —
    // les données ne sont pas dans les balances : besoin de saisie manuelle.
    const totalEmprunts = agg(n, ["16"], "credit");
    const rows: NoteRow[] = [
      row("Total emprunts et dettes financières", "DA", nz(totalEmprunts), null),
      row("Échéance à moins d'un an", "DA-1A", null, null),
      row("Échéance de 1 à 5 ans", "DA-5A", null, null),
      row("Échéance à plus de 5 ans", "DA-5AP", null, null),
    ];
    return make("NOTE_14", true, rows, nz(totalEmprunts), null,
      ["Ventilation par année d'échéance — nécessite une saisie manuelle (les balances ne contiennent pas cette information)"],
      "to_confirm");
  },
  deriveQuestions: () => [],
};

// ============================================================================
// NOTE 15 — Subventions d'investissement
// ============================================================================
const NOTE_15: NoteModule = {
  code: "NOTE_15", title: "Subventions d'investissement",
  applicable: (ctx) => agg(ctx.balances.n, ["14"], "credit") !== 0,
  dependencies: ["bilan_passif.CL"],
  compute: (ctx) => {
    const { n, n1 } = ctx.balances;
    const items: { ref: string; label: string; prefixes: string[] }[] = [
      { ref: "141", label: "Subventions d'équipement A", prefixes: ["141"] },
      { ref: "142", label: "Subventions d'équipement B", prefixes: ["142"] },
      { ref: "148", label: "Autres subventions d'investissement", prefixes: ["148"] },
    ];
    const rows: NoteRow[] = [];
    for (const it of items) {
      const vN = nz(agg(n, it.prefixes, "credit"));
      const vN1 = nz(agg(n1, it.prefixes, "credit"));
      if (vN === null && vN1 === null) continue;
      rows.push(row(it.label, it.ref, vN, vN1));
    }
    const { totalN, totalN1 } = totals(rows);
    return make("NOTE_15", true, rows, totalN, totalN1);
  },
  deriveQuestions: () => [],
};

// ============================================================================
// NOTE 16A — Dettes fiscales et sociales
// ============================================================================
const NOTE_16A: NoteModule = {
  code: "NOTE_16A", title: "Dettes fiscales et sociales",
  applicable: (ctx) => agg(ctx.balances.n, ["42", "43", "44"], "credit") !== 0,
  dependencies: ["bilan_passif.DK"],
  compute: (ctx) => {
    const { n, n1 } = ctx.balances;
    const items: { ref: string; label: string; prefixes: string[]; sign: "debit" | "credit" }[] = [
      { ref: "421", label: "Personnel, avances et acomptes", prefixes: ["421"], sign: "debit" },
      { ref: "422", label: "Personnel, rémunérations dues", prefixes: ["422"], sign: "credit" },
      { ref: "428", label: "Personnel, charges à payer", prefixes: ["428"], sign: "credit" },
      { ref: "431", label: "Sécurité sociale (CNSS)", prefixes: ["431"], sign: "credit" },
      { ref: "432", label: "Caisses de retraite complémentaire", prefixes: ["432"], sign: "credit" },
      { ref: "433", label: "Autres organismes sociaux", prefixes: ["433"], sign: "credit" },
      { ref: "438", label: "Organismes sociaux, charges à payer", prefixes: ["438"], sign: "credit" },
      { ref: "441", label: "État, impôt sur les bénéfices", prefixes: ["441"], sign: "debit" },
      { ref: "442", label: "État, autres impôts et taxes", prefixes: ["442"], sign: "credit" },
      { ref: "443", label: "État, TVA facturée", prefixes: ["443"], sign: "credit" },
      { ref: "444", label: "État, TVA due ou crédit de TVA", prefixes: ["444"], sign: "credit" },
      { ref: "445", label: "État, TVA récupérable", prefixes: ["445"], sign: "debit" },
      { ref: "447", label: "État, impôts retenus à la source", prefixes: ["447"], sign: "credit" },
    ];
    const rows: NoteRow[] = [];
    for (const it of items) {
      const vN = nz(agg(n, it.prefixes, it.sign));
      const vN1 = nz(agg(n1, it.prefixes, it.sign));
      if (vN === null && vN1 === null) continue;
      rows.push(row(it.label, it.ref, vN, vN1, detailOf(ctx, it.prefixes, it.sign)));
    }
    const { totalN, totalN1 } = totals(rows);
    return make("NOTE_16A", true, rows, totalN, totalN1);
  },
  deriveQuestions: () => [],
};

// ============================================================================
// NOTE 16B — Autres dettes
// ============================================================================
const NOTE_16B: NoteModule = {
  code: "NOTE_16B", title: "Autres dettes",
  applicable: (ctx) => agg(ctx.balances.n, ["464", "465", "469"], "credit") !== 0,
  dependencies: ["bilan_passif.DM"],
  compute: (ctx) => {
    const { n, n1 } = ctx.balances;
    const items: { ref: string; label: string; prefixes: string[]; sign: "debit" | "credit" }[] = [
      { ref: "464", label: "Associés, opérations faites en commun", prefixes: ["464"], sign: "debit" },
      { ref: "465", label: "Associés, dividendes à payer", prefixes: ["465"], sign: "credit" },
      { ref: "469", label: "Associés, opérations courantes", prefixes: ["469"], sign: "credit" },
      { ref: "4712", label: "Comptes d'attente (créditeurs divers)", prefixes: ["4712"], sign: "credit" },
      { ref: "477", label: "Produits constatés d'avance", prefixes: ["477"], sign: "credit" },
      { ref: "479", label: "Écarts de conversion — Passif", prefixes: ["479"], sign: "credit" },
    ];
    const rows: NoteRow[] = [];
    for (const it of items) {
      const vN = nz(agg(n, it.prefixes, it.sign));
      const vN1 = nz(agg(n1, it.prefixes, it.sign));
      if (vN === null && vN1 === null) continue;
      rows.push(row(it.label, it.ref, vN, vN1));
    }
    const { totalN, totalN1 } = totals(rows);
    return make("NOTE_16B", true, rows, totalN, totalN1);
  },
  deriveQuestions: () => [],
};

// ============================================================================
// NOTE 17 — Impôts sur les bénéfices
// ============================================================================
const NOTE_17: NoteModule = {
  code: "NOTE_17", title: "Impôts sur les bénéfices",
  applicable: (ctx) => agg(ctx.balances.n, ["441", "89"], "debit") !== 0 || agg(ctx.balances.n, ["89"], "debit") !== 0,
  dependencies: ["bilan_passif.DK"],
  compute: (ctx) => {
    const { n, n1 } = ctx.balances;
    const impotN = agg(n, ["891"], "debit") || agg(n, ["89"], "debit");
    const impotN1 = agg(n1, ["891"], "debit") || agg(n1, ["89"], "debit");
    const imfN = agg(n, ["895"], "debit");
    const imfN1 = agg(n1, ["895"], "debit");
    const rows: NoteRow[] = [
      row("Impôts sur les bénéfices de l'exercice", "891", nz(impotN), nz(impotN1)),
      row("Impôt minimum forfaitaire (IMF)", "895", nz(imfN), nz(imfN1)),
      row("Rappels d'impôts sur résultats antérieurs", "892", nz(agg(n, ["892"], "debit")), nz(agg(n1, ["892"], "debit"))),
      row("Dégrèvements et annulations d'impôts", "899", nz(agg(n, ["899"], "credit")), nz(agg(n1, ["899"], "credit"))),
    ];
    const { totalN, totalN1 } = totals(rows);
    return make("NOTE_17", true, rows, totalN, totalN1);
  },
  deriveQuestions: () => [],
};

// ============================================================================
// NOTE 21 — Charges de personnel (ventilation)
// ============================================================================
const NOTE_21: NoteModule = {
  code: "NOTE_21", title: "Charges de personnel (ventilation)",
  applicable: (ctx) => agg(ctx.balances.n, ["66"], "debit") !== 0,
  dependencies: ["resultat.RK"],
  compute: (ctx) => {
    const { n, n1 } = ctx.balances;
    const items: { ref: string; label: string; prefixes: string[] }[] = [
      { ref: "661", label: "Rémunérations directes — personnel national", prefixes: ["661"] },
      { ref: "662", label: "Rémunérations directes — personnel non national", prefixes: ["662"] },
      { ref: "663", label: "Indemnités forfaitaires versées au personnel", prefixes: ["663"] },
      { ref: "664", label: "Charges sociales", prefixes: ["664"] },
      { ref: "666", label: "Rémunérations de l'exploitant individuel", prefixes: ["666"] },
      { ref: "667", label: "Rémunération transférée de personnel extérieur", prefixes: ["667"] },
      { ref: "668", label: "Autres charges sociales", prefixes: ["668"] },
    ];
    const rows: NoteRow[] = [];
    for (const it of items) {
      const vN = nz(agg(n, it.prefixes, "debit"));
      const vN1 = nz(agg(n1, it.prefixes, "debit"));
      if (vN === null && vN1 === null) continue;
      rows.push(row(it.label, it.ref, vN, vN1));
    }
    const { totalN, totalN1 } = totals(rows);
    return make("NOTE_21", true, rows, totalN, totalN1);
  },
  deriveQuestions: () => [],
};

// ============================================================================
// NOTE 22 — Autres charges (ventilation)
// ============================================================================
const NOTE_22: NoteModule = {
  code: "NOTE_22", title: "Autres charges (ventilation)",
  applicable: (ctx) => agg(ctx.balances.n, ["65"], "debit") !== 0,
  dependencies: ["resultat.RJ"],
  compute: (ctx) => {
    const { n, n1 } = ctx.balances;
    const items: { ref: string; label: string; prefixes: string[] }[] = [
      { ref: "651", label: "Pertes sur créances clients et autres débiteurs", prefixes: ["651"] },
      { ref: "652", label: "Quote-part de résultat sur opérations en commun", prefixes: ["652"] },
      { ref: "654", label: "Valeur comptable des cessions courantes d'immobilisations", prefixes: ["654"] },
      { ref: "6581", label: "Jetons de présence et rémunérations d'administrateurs", prefixes: ["6581"] },
      { ref: "6582", label: "Dons", prefixes: ["6582"] },
      { ref: "6583", label: "Mécénat", prefixes: ["6583"] },
      { ref: "659", label: "Charges provisionnées d'exploitation", prefixes: ["659"] },
    ];
    const rows: NoteRow[] = [];
    for (const it of items) {
      const vN = nz(agg(n, it.prefixes, "debit"));
      const vN1 = nz(agg(n1, it.prefixes, "debit"));
      if (vN === null && vN1 === null) continue;
      rows.push(row(it.label, it.ref, vN, vN1));
    }
    const { totalN, totalN1 } = totals(rows);
    return make("NOTE_22", true, rows, totalN, totalN1);
  },
  deriveQuestions: () => [],
};

// ============================================================================
// NOTE 31 — Dotations aux amortissements (détail)
// ============================================================================
const NOTE_31: NoteModule = {
  code: "NOTE_31", title: "Dotations aux amortissements",
  applicable: (ctx) => agg(ctx.balances.n, ["681", "687"], "debit") !== 0,
  dependencies: ["resultat.RL", "resultat.RN"],
  compute: (ctx) => {
    const { n, n1 } = ctx.balances;
    const items: { ref: string; label: string; prefixes: string[] }[] = [
      { ref: "6811", label: "Dotations aux amortissements des charges immobilisées", prefixes: ["6811"] },
      { ref: "6812", label: "Dotations aux amortissements des immobilisations incorporelles", prefixes: ["6812"] },
      { ref: "6813", label: "Dotations aux amortissements des immobilisations corporelles", prefixes: ["6813"] },
      { ref: "687", label: "Dotations aux amortissements à caractère financier", prefixes: ["687"] },
    ];
    const rows: NoteRow[] = [];
    for (const it of items) {
      const vN = nz(agg(n, it.prefixes, "debit"));
      const vN1 = nz(agg(n1, it.prefixes, "debit"));
      if (vN === null && vN1 === null) continue;
      rows.push(row(it.label, it.ref, vN, vN1));
    }
    const { totalN, totalN1 } = totals(rows);
    return make("NOTE_31", true, rows, totalN, totalN1);
  },
  deriveQuestions: () => [],
};

// ============================================================================
// NOTE 32 — Reprises de provisions
// ============================================================================
const NOTE_32: NoteModule = {
  code: "NOTE_32", title: "Reprises de provisions",
  applicable: (ctx) => agg(ctx.balances.n, ["791", "797", "798"], "credit") !== 0,
  dependencies: ["resultat.TJ"],
  compute: (ctx) => {
    const { n, n1 } = ctx.balances;
    const items: { ref: string; label: string; prefixes: string[] }[] = [
      { ref: "791", label: "Reprises de provisions d'exploitation", prefixes: ["791"] },
      { ref: "797", label: "Reprises de provisions financières", prefixes: ["797"] },
      { ref: "798", label: "Reprises d'amortissements", prefixes: ["798"] },
    ];
    const rows: NoteRow[] = [];
    for (const it of items) {
      const vN = nz(agg(n, it.prefixes, "credit"));
      const vN1 = nz(agg(n1, it.prefixes, "credit"));
      if (vN === null && vN1 === null) continue;
      rows.push(row(it.label, it.ref, vN, vN1));
    }
    const { totalN, totalN1 } = totals(rows);
    return make("NOTE_32", true, rows, totalN, totalN1);
  },
  deriveQuestions: () => [],
};

// ============================================================================
// NOTE 34 — Tableau de financement et ratios (HUB CENTRAL)
// ============================================================================
const NOTE_34: NoteModule = {
  code: "NOTE_34", title: "Tableau de financement et ratios",
  applicable: () => true,
  dependencies: ["resultat.RESULTAT_NET", "tft.CAF", "tft.TRESO_NETTE", "bilan_passif.CAPITAUX"],
  compute: (ctx) => {
    const { n, n1 } = ctx.balances;
    const RN = agg(n, ["70"], "credit") - agg(n, ["6"], "debit");
    const RN1 = agg(n1, ["70"], "credit") - agg(n1, ["6"], "debit");
    const dotations = agg(n, ["681"], "debit") + agg(n, ["687"], "debit");
    const dotationsN1 = agg(n1, ["681"], "debit") + agg(n1, ["687"], "debit");
    const reprises = agg(n, ["781"], "credit") + agg(n, ["787"], "credit");
    const reprisesN1 = agg(n1, ["781"], "credit") + agg(n1, ["787"], "credit");
    const caf = RN + dotations - reprises;
    const cafN1 = RN1 + dotationsN1 - reprisesN1;
    const capitauxN = agg(n, ["101", "10", "11", "12", "14", "15"], "credit") - agg(n, ["109", "129"], "debit");
    const dettesFinN = agg(n, ["16", "17"], "credit");
    const dettesFinN1 = agg(n1, ["16", "17"], "credit");
    const immoNetN = agg(n, ["2"], "debit") - agg(n, ["28", "29"], "amort");
    const tresoActifN = agg(n, ["50", "51", "52", "53", "57"], "debit");
    const tresoActifN1 = agg(n1, ["50", "51", "52", "53", "57"], "debit");
    const tresoPassifN = agg(n, ["513", "516", "518", "519"], "credit");
    const tresoPassifN1 = agg(n1, ["513", "516", "518", "519"], "credit");
    const tresoNetteN = tresoActifN - tresoPassifN;
    const tresoNetteN1 = tresoActifN1 - tresoPassifN1;

    const rows: NoteRow[] = [
      row("Résultat net de l'exercice", "XI", nz(RN), nz(RN1)),
      row("+ Dotations aux amortissements et provisions", "RL", nz(dotations), nz(dotationsN1)),
      row("− Reprises de provisions", "TJ", nz(-reprises), nz(-reprisesN1)),
      row("Capacité d'autofinancement (CAF)", "FA", nz(caf), nz(cafN1)),
      row("− Acquisition d'immobilisations", "FH", nz(-agg(n, ["2"], "debit")), nz(-agg(n1, ["2"], "debit"))),
      row("+ Cessions d'immobilisations", "FG", nz(agg(n, ["82"], "credit")), nz(agg(n1, ["82"], "credit"))),
      row("+ Emprunts contractés", "FM", nz(dettesFinN), nz(dettesFinN1)),
      row("Variation de trésorerie nette", "ZG", nz(tresoNetteN - tresoNetteN1), null),
      row("Trésorerie nette à la clôture", "FQ", nz(tresoNetteN), nz(tresoNetteN1)),
    ];

    // Ratios
    const totalActif = immoNetN + agg(n, ["3"], "debit") + agg(n, ["411", "412", "414", "416", "417", "418", "46", "476"], "debit") + tresoActifN;
    const ratioAutonomie = totalActif > 0 ? (capitauxN / totalActif) * 100 : null;
    const ratioLiquidite = dettesFinN > 0 ? (capitauxN / dettesFinN) : null;
    const ratioRentabilite = capitauxN > 0 ? (RN / capitauxN) * 100 : null;
    const ratioTresorerie = agg(n, ["70"], "credit") > 0 ? (tresoNetteN / agg(n, ["70"], "credit")) * 100 : null;

    rows.push(row("Ratio d'autonomie financière (Capitaux / Total actif) — %", "R1", ratioAutonomie !== null ? Math.round(ratioAutonomie * 100) / 100 : null, null));
    rows.push(row("Ratio de liquidité (Capitaux / Dettes financières)", "R2", ratioLiquidite !== null ? Math.round(ratioLiquidite * 100) / 100 : null, null));
    rows.push(row("Ratio de rentabilité financière (RN / Capitaux) — %", "R3", ratioRentabilite !== null ? Math.round(ratioRentabilite * 100) / 100 : null, null));
    rows.push(row("Ratio de trésorerie (Tréso nette / CA) — %", "R4", ratioTresorerie !== null ? Math.round(ratioTresorerie * 100) / 100 : null, null));

    const { totalN, totalN1 } = totals(rows.filter((r) => r.ref === "FA" || r.ref === "ZG" || r.ref === "FQ"));
    return make("NOTE_34", true, rows, totalN, totalN1);
  },
  deriveQuestions: () => [],
};

// ============================================================================
// NOTES DE SAISIE MANUELLE (pas de calcul comptable automatique)
// ============================================================================
function makeManualNote(code: string, title: string, rowLabels: string[], missingInfo: string[]): NoteModule {
  return {
    code, title,
    applicable: () => true,
    dependencies: [],
    compute: (): NoteResult => {
      const rows = rowLabels.map((l) => row(l, "", null, null));
      return make(code, true, rows, null, null, missingInfo, "to_confirm");
    },
    deriveQuestions: () => [],
  };
}

const NOTE_02: NoteModule = makeManualNote("NOTE_02", "Informations sur les dirigeants",
  ["Nom et prénoms du dirigeant principal", "Fonction", "Date de nomination", "Rémunération annuelle brute", "Nombre de mandats"],
  ["Informations non calculables depuis les balances — saisie manuelle requise"]);

const NOTE_18: NoteModule = makeManualNote("NOTE_18", "Engagements hors bilan",
  ["Engagements de financement obtenus", "Engagements de garantie obtenus", "Engagements réciproques", "Engagements accordés (avals, cautions, hypothèques)"],
  ["Engagements hors bilan (classe 9) — nécessite une saisie manuelle"]);

const NOTE_19: NoteModule = makeManualNote("NOTE_19", "Informations sur les parties liées",
  ["Nom et type de relation", "Nature des opérations", "Montant des transactions", "Soldes à la clôture"],
  ["Informations non calculables depuis les balances — saisie manuelle requise"]);

const NOTE_20: NoteModule = makeManualNote("NOTE_20", "Informations sur les opérations de cession",
  ["Désignation de l'immobilisation cédée", "Date de cession", "Prix de cession", "Valeur comptable nette", "Plus-value ou moins-value"],
  ["Détail des cessions — nécessite une saisie manuelle (les balances ne contiennent que les totaux)"]);

const NOTE_23: NoteModule = makeManualNote("NOTE_23", "Effectif moyen",
  ["Effectif moyen au 1er semestre", "Effectif moyen au 2e semestre", "Effectif moyen annuel", "Dont cadres", "Dont non-cadres"],
  ["Effectif non calculable depuis les balances — saisie manuelle requise"]);

const NOTE_24: NoteModule = makeManualNote("NOTE_24", "Rémunérations des dirigeants",
  ["Total rémunérations des administrateurs et dirigeants", "Dont jetons de présence (6581)", "Dont salaires et rémunérations (661)", "Dont avantages en nature (6617)"],
  ["Ventilation par dirigeant — nécessite une saisie manuelle"]);

const NOTE_25: NoteModule = makeManualNote("NOTE_25", "Répartitions de charges",
  ["Services extérieurs A (62) — détail par nature", "Services extérieurs B (63) — détail par nature", "Impôts et taxes (64) — détail par nature"],
  ["Ventilation détaillée des charges — nécessite une saisie manuelle"]);

const NOTE_26: NoteModule = makeManualNote("NOTE_26", "Échéances des créances et dettes à la clôture",
  ["Créances à moins d'un an", "Créances de 1 à 5 ans", "Créances à plus de 5 ans", "Dettes à moins d'un an", "Dettes de 1 à 5 ans", "Dettes à plus de 5 ans"],
  ["Ventilation par échéance — les balances ne contiennent pas cette information"]);

const NOTE_27: NoteModule = makeManualNote("NOTE_27", "Détail des subventions d'exploitation",
  ["Subventions à l'exportation", "Subventions à l'importation", "Subventions de péréquation", "Autres subventions d'exploitation"],
  ["Détail des subventions d'exploitation (74) — nécessite une ventilation"]);

const NOTE_28: NoteModule = makeManualNote("NOTE_28", "Détail des autres produits",
  ["Quote-part de résultat sur opérations en commun", "Produits des cessions d'immobilisations", "Indemnités d'assurances reçues", "Autres produits divers"],
  ["Détail des autres produits (75) — nécessite une ventilation"]);

const NOTE_29: NoteModule = makeManualNote("NOTE_29", "Ventilation du CA par catégorie d'activité",
  ["CA — activités de services", "CA — activités de négoce", "CA — activités industrielles", "CA — autres activités"],
  ["Ventilation du CA par activité — les balances ne contiennent pas cette ventilation"]);

const NOTE_30: NoteModule = makeManualNote("NOTE_30", "Ventilation du CA par zone géographique",
  ["CA — dans la Région OHADA", "CA — hors Région OHADA", "CA — hors Zone Franc CFA"],
  ["Ventilation du CA par zone géographique — nécessite une saisie manuelle"]);

const NOTE_33: NoteModule = makeManualNote("NOTE_33", "Informations sur les emprunts",
  ["Nom du prêteur", "Taux d'intérêt nominal", "Durée de l'emprunt (années)", "Garanties constituées", "Montant emprunté", "Capital restant dû à la clôture"],
  ["Détail des emprunts — les balances ne contiennent que les totaux"]);

const NOTE_35: NoteModule = makeManualNote("NOTE_35", "Informations diverses (complément)",
  ["Informations sur les litiges en cours", "Informations sur les garanties données", "Informations sur les événements après la clôture", "Informations sur les changements de méthodes comptables"],
  ["Informations diverses — saisie manuelle requise"]);

// ============================================================================
// REGISTRE CENTRAL — LES 35 NOTES
// ============================================================================
export const NOTE_MODULES: NoteModule[] = [
  NOTE_01, NOTE_02, NOTE_03A, NOTE_03B, NOTE_03C,
  NOTE_04, NOTE_05, NOTE_06, NOTE_07, NOTE_08,
  NOTE_09, NOTE_10, NOTE_11, NOTE_12, NOTE_13,
  NOTE_14, NOTE_15, NOTE_16A, NOTE_16B, NOTE_17,
  NOTE_18, NOTE_19, NOTE_20, NOTE_21, NOTE_22,
  NOTE_23, NOTE_24, NOTE_25, NOTE_26, NOTE_27,
  NOTE_28, NOTE_29, NOTE_30, NOTE_31, NOTE_32,
  NOTE_33, NOTE_34, NOTE_35,
];

/** Index par code — O(1). */
export const NOTE_BY_CODE: Map<string, NoteModule> = new Map(NOTE_MODULES.map((n) => [n.code, n]));

/** Calcule TOUTES les notes applicables pour un contexte. */
export function computeAllNotes(ctx: ProdContext): Map<string, NoteResult> {
  const out = new Map<string, NoteResult>();
  for (const module of NOTE_MODULES) {
    try {
      if (!module.applicable(ctx)) continue;
      const result = module.compute(ctx);
      out.set(module.code, result);
    } catch {
      // Ne bloque jamais le calcul global — la note en erreur est signalée
      out.set(module.code, {
        code: module.code, applicable: true, rows: [],
        totalN: null, totalN1: null, status: "missing",
        missingInfo: [`Erreur lors du calcul de ${module.code}`],
      });
    }
  }
  return out;
}

/** Calcule une seule note par son code. */
export function computeNote(code: string, ctx: ProdContext): NoteResult | null {
  const module = NOTE_BY_CODE.get(code);
  if (!module) return null;
  try {
    if (!module.applicable(ctx)) return null;
    return module.compute(ctx);
  } catch {
    return null;
  }
}

/** Codes des notes à saisie manuelle (pas de calcul comptable automatique). */
export const MANUAL_NOTE_CODES = new Set([
  "NOTE_02", "NOTE_18", "NOTE_19", "NOTE_20", "NOTE_23", "NOTE_24",
  "NOTE_25", "NOTE_26", "NOTE_27", "NOTE_28", "NOTE_29", "NOTE_30",
  "NOTE_33", "NOTE_35",
]);

/** Statistiques du registre de notes. */
export function noteStats(): { total: number; computed: number; manual: number; categories: string[] } {
  const computed = NOTE_MODULES.filter((n) => !MANUAL_NOTE_CODES.has(n.code));
  const manual = NOTE_MODULES.filter((n) => MANUAL_NOTE_CODES.has(n.code));
  return {
    total: NOTE_MODULES.length,
    computed: computed.length,
    manual: manual.length,
    categories: [...new Set(NOTE_MODULES.map((n) => n.code.split("_")[0]))],
  };
}
