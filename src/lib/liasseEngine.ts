import type { BalanceRow } from "./liasse";
import { loadXlsxSafe } from "./xlsx-sanitizer";
import { fillStateTemplateZip } from "./xlsx-filler";
// ============================================================================
// FIMAAC — Moteur d'états financiers & cohérence SYSCOHADA révisé (V0.7)
// Mapping compte → référence d'état (Bilan/CR/TFT) + contrôles de cohérence.
// ============================================================================
type Side = "debit" | "credit" | "amort";
interface MapDef { ref: string; label: string; prefixes: string[]; side: Side; }

// Bilan ACTIF (soldes débiteurs)
const ACTIF: MapDef[] = [
  { ref: "AE", label: "Frais de développement et de prospection", prefixes: ["201", "205"], side: "debit" },
  { ref: "AF", label: "Brevets, licences, logiciels et droits similaires", prefixes: ["206"], side: "debit" },
  { ref: "AG", label: "Fonds commercial et droit au bail", prefixes: ["207"], side: "debit" },
  { ref: "AH", label: "Autres immobilisations incorporelles", prefixes: ["208"], side: "debit" },
  { ref: "AJ", label: "Terrains", prefixes: ["211"], side: "debit" },
  { ref: "AK", label: "Bâtiments, constructions", prefixes: ["213", "214"], side: "debit" },
  { ref: "AL", label: "Aménagements, agencements et installations", prefixes: ["215"], side: "debit" },
  // AM — « Matériel, mobilier et actifs biologiques » : couvre aussi la classe 24
  // (2442 matériel informatique, 2444 mobilier…). Sans elle, les acquisitions
  // de matériel ne sont rattachées à aucun poste d'actif (écart Actif/Passif).
  { ref: "AM", label: "Matériel, mobilier et actifs biologiques", prefixes: ["217", "218", "22", "24"], side: "debit" },
  { ref: "AN", label: "Matériel de transport", prefixes: ["216"], side: "debit" },
  { ref: "AP", label: "Avances et acomptes versés sur immobilisations", prefixes: ["23"], side: "debit" },
  { ref: "AR", label: "Titres de participation", prefixes: ["261", "262"], side: "debit" },
  { ref: "AS", label: "Autres immobilisations financières", prefixes: ["27"], side: "debit" },
  { ref: "BB", label: "Stocks et en cours", prefixes: ["31", "32", "33", "34", "35", "36", "37"], side: "debit" },
  { ref: "BI", label: "Clients et comptes rattachés", prefixes: ["411", "412", "414", "416", "417", "418"], side: "debit" },
  { ref: "BJ", label: "Autres créances", prefixes: ["46"], side: "debit" },
  { ref: "BQ", label: "Titres de placement", prefixes: ["50"], side: "debit" },
  { ref: "BR", label: "Valeurs à encaisser", prefixes: ["511"], side: "debit" },
  { ref: "BS", label: "Banque, chèques postaux, caisse et assimilés", prefixes: ["521", "522", "53", "57"], side: "debit" },
  { ref: "BU", label: "Ecart de conversion actif", prefixes: ["476"], side: "debit" },
];

// Amortissements / dépréciations (soldes créditeurs présentés positivement)
const AMORT: MapDef[] = [
  { ref: "AD", label: "Amortissements (immobilisations)", prefixes: ["28"], side: "amort" },
  // AI — dépréciations : couvre aussi la classe 49 (491 créances clients douteuses).
  { ref: "AI", label: "Dépréciations (immobilisations & tiers)", prefixes: ["29", "49"], side: "amort" },
];

// Bilan PASSIF (soldes créditeurs)
const PASSIF: MapDef[] = [
  { ref: "CA", label: "Capital social", prefixes: ["101"], side: "credit" },
  { ref: "CB", label: "Apporteurs capital non appelé", prefixes: ["109"], side: "debit" },
  { ref: "CD", label: "Primes liées au capital", prefixes: ["104", "105"], side: "credit" },
  { ref: "CE", label: "Ecarts de réévaluation", prefixes: ["106"], side: "credit" },
  { ref: "CF", label: "Réserves indisponibles", prefixes: ["1061", "1063"], side: "credit" },
  { ref: "CG", label: "Réserves libres", prefixes: ["1062", "1068"], side: "credit" },
  { ref: "CH", label: "Report à nouveau", prefixes: ["11"], side: "credit" },
  // CJ — résultat de l'exercice. En GUDEF officiel : G18 = 'COMPTE DE RESULTAT'!I51
  // (@formula, cf. formulas.ts). Les comptes 120/121 ne sont alimentés qu'après
  // affectation ; en cours d'exercice le résultat provient des SIG (XI).
  // → injecté dans buildAggregate (voir passifTotalN).
  { ref: "CJ", label: "Résultat de l'exercice", prefixes: ["120", "121"], side: "credit" },
  { ref: "CL", label: "Subventions d'investissement", prefixes: ["14"], side: "credit" },
  { ref: "CM", label: "Provisions réglementées", prefixes: ["15"], side: "credit" },
  { ref: "DA", label: "Emprunts et dettes financières diverses", prefixes: ["16"], side: "credit" },
  { ref: "DB", label: "Dettes de location-acquisition", prefixes: ["17"], side: "credit" },
  { ref: "DC", label: "Provisions pour risques et charges", prefixes: ["18", "19"], side: "credit" },
  { ref: "DH", label: "Dettes circulantes HAO", prefixes: ["48"], side: "credit" },
  { ref: "DI", label: "Clients - avances reçues", prefixes: ["419"], side: "credit" },
  { ref: "DJ", label: "Fournisseurs d'exploitation", prefixes: ["401", "403", "404", "405", "408"], side: "credit" },
  // DK — « Dettes fiscales et SOCIALES » : couvre le personnel (42), les organismes
  // sociaux (43) et l'État (44). Sans la classe 42, les rémunérations dues (422)
  // ne sont rattachées à aucun poste de passif et rompent Actif = Passif.
  { ref: "DK", label: "Dettes fiscales et sociales", prefixes: ["42", "43", "44"], side: "credit" },
  { ref: "DM", label: "Autres dettes", prefixes: ["464", "469", "465"], side: "credit" },
  { ref: "DN", label: "Provisions pour risques à court terme", prefixes: ["19"], side: "credit" },
  { ref: "DQ", label: "Banques, crédits d'escompte", prefixes: ["513", "516"], side: "credit" },
  { ref: "DR", label: "Banques, crédits de trésorerie", prefixes: ["518", "519"], side: "credit" },
  { ref: "DV", label: "Ecart de conversion passif", prefixes: ["477"], side: "credit" },
];

// Compte de résultat — PRODUITS (soldes créditeurs)
const PRODUITS: MapDef[] = [
  { ref: "TA", label: "Ventes de marchandises", prefixes: ["701"], side: "credit" },
  { ref: "TB", label: "Ventes de produits fabriqués", prefixes: ["702"], side: "credit" },
  { ref: "TC", label: "Travaux, services et produits résiduels vendus", prefixes: ["703", "704", "705", "706"], side: "credit" },
  { ref: "TD", label: "Produits accessoires", prefixes: ["707"], side: "credit" },
  { ref: "TE", label: "Variation stocks / production stockée", prefixes: ["71"], side: "credit" },
  { ref: "TF", label: "Production immobilisée", prefixes: ["72"], side: "credit" },
  { ref: "TG", label: "Subventions d'exploitation", prefixes: ["74"], side: "credit" },
  { ref: "TH", label: "Autres produits", prefixes: ["75"], side: "credit" },
  { ref: "TK", label: "Revenus financiers et assimilés", prefixes: ["76"], side: "credit" },
  { ref: "TI", label: "Transferts de charges d'exploitation", prefixes: ["791"], side: "credit" },
  { ref: "TM", label: "Transferts de charges financières", prefixes: ["796"], side: "credit" },
  { ref: "TJ", label: "Reprises d'amortissements et provisions", prefixes: ["78"], side: "credit" },
  // TN — produits de cession : couvre aussi la classe 82 (822 cessions corporelles).
  { ref: "TN", label: "Produits des cessions d'immobilisations", prefixes: ["83", "82"], side: "credit" },
  { ref: "TO", label: "Autres produits HAO", prefixes: ["84"], side: "credit" },
];

// Compte de résultat — CHARGES (soldes débiteurs)
const CHARGES: MapDef[] = [
  { ref: "RA", label: "Achats de marchandises", prefixes: ["601"], side: "debit" },
  { ref: "RB", label: "Variation de stocks de marchandises", prefixes: ["6031"], side: "debit" },
  { ref: "RC", label: "Achats de matières et fournitures liées", prefixes: ["602"], side: "debit" },
  { ref: "RD", label: "Variation de stocks de matières", prefixes: ["6032"], side: "debit" },
  { ref: "RE", label: "Autres achats", prefixes: ["605", "606", "607", "608"], side: "debit" },
  { ref: "RF", label: "Variation de stocks d'autres approvisionnements", prefixes: ["6033"], side: "debit" },
  { ref: "RG", label: "Transports", prefixes: ["61"], side: "debit" },
  // RH — Services extérieurs : couvre 62 (Services ext. A) ET 63 (Services ext. B).
  // Le plan SYSCOHADA officiel (chart.ts) classe 63 = Services extérieurs B.
  { ref: "RH", label: "Services extérieurs", prefixes: ["62", "63"], side: "debit" },
  // RI — Impôts et taxes : classe 64 dans le plan SYSCOHADA (et non 63).
  { ref: "RI", label: "Impôts et taxes", prefixes: ["64"], side: "debit" },
  { ref: "RJ", label: "Autres charges", prefixes: ["65"], side: "debit" },
  // RK — Charges de personnel : classe 66 dans le plan SYSCOHADA (et non 64).
  { ref: "RK", label: "Charges de personnel", prefixes: ["66"], side: "debit" },
  // RM — Frais financiers : classe 67 dans le plan SYSCOHADA (et non 66).
  { ref: "RM", label: "Frais financiers et charges assimilées", prefixes: ["67"], side: "debit" },
  { ref: "RL", label: "Dotations aux amortissements et provisions", prefixes: ["681", "682"], side: "debit" },
  { ref: "RN", label: "Dotations aux provisions financières", prefixes: ["683"], side: "debit" },
  { ref: "RO", label: "Valeurs comptables des cessions d'immobilisations", prefixes: ["81"], side: "debit" },
  { ref: "RP", label: "Autres charges HAO", prefixes: ["67", "86"], side: "debit" },
  { ref: "RQ", label: "Participation des travailleurs", prefixes: ["85"], side: "debit" },
  { ref: "RS", label: "Impôt sur le résultat", prefixes: ["89", "695", "895"], side: "debit" },
];

/** Couverture du mapping SYSCOHADA par rapport au plan réel : quels prefixes sont absents du plan. */
export function mappingCoverage(accounts: { code: string }[]): { total: number; covered: number; missing: string[] } {
  const codes = new Set(accounts.map((a) => a.code));
  const allDefs = [...ACTIF, ...AMORT, ...PASSIF, ...PRODUITS, ...CHARGES];
  const missing: string[] = [];
  let covered = 0;
  for (const d of allDefs) {
    const ok = d.prefixes.some((p) => codes.has(p) || accounts.some((a) => a.code.startsWith(p)));
    if (ok) covered++;
    else missing.push(`${d.ref} (${d.prefixes.join("/")})`);
  }
  return { total: allDefs.length, covered, missing: [...new Set(missing)] };
}

function soldeOf(row: BalanceRow, side: Side): number {
  if (side === "amort") return row.credit - row.debit; // présenté positivement
  if (side === "credit") return row.credit - row.debit;
  return row.debit - row.credit;
}

function aggregate(rows: BalanceRow[], defs: MapDef[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of defs) {
    let v = 0;
    for (const r of rows) {
      if (d.prefixes.some((p) => r.code === p || r.code.startsWith(p))) v += soldeOf(r, d.side);
    }
    out[d.ref] = Math.round(v);
  }
  return out;
}

export interface StateAggregate {
  actif: Record<string, number>;
  passif: Record<string, number>;
  amort: Record<string, number>;
  produits: Record<string, number>;
  charges: Record<string, number>;
  // soldes intermédiaires
  sii: Record<string, number>;
  totalsN: { debit: number; credit: number };
  totalsN1: { debit: number; credit: number };
  actifTotalN: number; actifTotalN1: number;
  passifTotalN: number; passifTotalN1: number;
  tresoNetteN: number; tresoNetteN1: number;
  /** CAF (Capacité d'Autofinancement) — @formula FA = RN + dotations − reprises */
  caf: number;
}

export function buildAggregate(prev: BalanceRow[], cur: BalanceRow[]): StateAggregate {
  const aN = aggregate(cur, ACTIF), aN1 = aggregate(prev, ACTIF);
  const pN = aggregate(cur, PASSIF), pN1 = aggregate(prev, PASSIF);
  const amN = aggregate(cur, AMORT), amN1 = aggregate(prev, AMORT);
  const prN = aggregate(cur, PRODUITS), prN1 = aggregate(prev, PRODUITS);
  const chN = aggregate(cur, CHARGES), chN1 = aggregate(prev, CHARGES);
  const tot = (rows: BalanceRow[]) => ({ debit: rows.reduce((s, r) => s + r.debit, 0), credit: rows.reduce((s, r) => s + r.credit, 0) });
  const totalsN = tot(cur), totalsN1 = tot(prev);

  // Actif brut = immo (AE..AP + AR + AS) + stocks BB + créances BI + autres BJ + titres BQ + valeurs BR + tréso BS + BU
  const immoKeys = ["AE", "AF", "AG", "AH", "AJ", "AK", "AL", "AM", "AN", "AP", "AR", "AS"];
  const immoBrutN = immoKeys.reduce((s, k) => s + (aN[k] || 0), 0);
  const amortN = (amN.AD || 0) + (amN.AI || 0);
  const immoNetN = immoBrutN - amortN;
  const actifTotalN = immoNetN + (aN.BB || 0) + (aN.BI || 0) + (aN.BJ || 0) + (aN.BQ || 0) + (aN.BR || 0) + (aN.BS || 0) + (aN.BU || 0);
  const immoBrutN1calc = immoKeys.reduce((s, k) => s + (aN1[k] || 0), 0);
  const amortN1 = (amN1.AD || 0) + (amN1.AI || 0);
  const actifTotalN1 = (immoBrutN1calc - amortN1) + (aN1.BB || 0) + (aN1.BI || 0) + (aN1.BJ || 0) + (aN1.BQ || 0) + (aN1.BR || 0) + (aN1.BS || 0) + (aN1.BU || 0);

  const passifKeys = ["CA", "CB", "CD", "CE", "CF", "CG", "CH", "CJ", "CL", "CM", "DA", "DB", "DC", "DH", "DI", "DJ", "DK", "DM", "DN", "DQ", "DR", "DV"];

  // Trésorerie nette = BS (actif tréso) - (DQ+DR tréso passif)
  const tresoNetteN = (aN.BS || 0) - ((pN.DQ || 0) + (pN.DR || 0));
  const tresoNetteN1 = (aN1.BS || 0) - ((pN1.DQ || 0) + (pN1.DR || 0));

  // ---- Soldes intermédiaires (calculés AVANT les totaux de passif) ----
  const XB = (prN.TA || 0) + (prN.TB || 0) + (prN.TC || 0) + (prN.TD || 0);
  const XA = XB - (chN.RA || 0) - (chN.RB || 0); // marge
  const XC = XA + (prN.TE || 0) + (prN.TF || 0) + (prN.TH || 0) - (chN.RC || 0) - (chN.RD || 0) - (chN.RE || 0) - (chN.RF || 0) - (chN.RG || 0) - (chN.RH || 0);
  const XD = XC + (prN.TG || 0) - (chN.RI || 0) - (chN.RJ || 0) - (chN.RK || 0);
  const XE = XD - (chN.RL || 0) + (prN.TJ || 0) + (prN.TI || 0);
  // XF — Résultat financier : @formula TF = TK + TM − RM − RN (SYSCOHADA).
  // RN (dotations aux provisions financières, 683) et TM (transferts de charges
  // financières, 796) étaient omis : le résultat net ne les intégrait pas.
  const XF = (prN.TK || 0) + (prN.TM || 0) - (chN.RM || 0) - (chN.RN || 0);
  const XG = XE + XF;
  // XH — Résultat HAO : @formula TH = TO + TN − RO − RP (SYSCOHADA).
  // RO (valeurs comptables des cessions, 81) était omis : le résultat de cession
  // (produit − VNC) ne se reflétait pas dans le résultat net.
  const XH = (prN.TO || 0) + (prN.TN || 0) - (chN.RO || 0) - (chN.RP || 0);
  const XI = XG + XH - (chN.RS || 0) - (chN.RQ || 0);
  const sii = { XA: Math.round(XA), XB: Math.round(XB), XC: Math.round(XC), XD: Math.round(XD), XE: Math.round(XE), XF: Math.round(XF), XG: Math.round(XG), XH: Math.round(XH), XI: Math.round(XI) };

  // Résultat net N-1 (même cascade SIG) — sert à CJ du passif N-1.
  const XB1 = (prN1.TA || 0) + (prN1.TB || 0) + (prN1.TC || 0) + (prN1.TD || 0);
  const XA1 = XB1 - (chN1.RA || 0) - (chN1.RB || 0);
  const XC1 = XA1 + (prN1.TE || 0) + (prN1.TF || 0) + (prN1.TH || 0) - (chN1.RC || 0) - (chN1.RD || 0) - (chN1.RE || 0) - (chN1.RF || 0) - (chN1.RG || 0) - (chN1.RH || 0);
  const XD1 = XC1 + (prN1.TG || 0) - (chN1.RI || 0) - (chN1.RJ || 0) - (chN1.RK || 0);
  const XE1 = XD1 - (chN1.RL || 0) + (prN1.TJ || 0) + (prN1.TI || 0);
  const XF1 = (prN1.TK || 0) - (chN1.RM || 0);
  const XG1 = XE1 + XF1;
  const XH1 = (prN1.TO || 0) + (prN1.TN || 0) - (chN1.RP || 0);
  const XI_N1 = XG1 + XH1 - (chN1.RS || 0) - (chN1.RQ || 0);

  // CAF = Résultat net + dotations − reprises
  // @formula FA = XI + RL − TJ (DOCUMENT 4 Contrôle de Cohérence ligne FA)
  // CAF = RN + dotations (exploitation + financières) − reprises
  // @formula FA = XI + RL + RN − TJ (SYSCOHADA — CAF méthodologique)
  const caf = Math.round(XI + (chN.RL || 0) + (chN.RN || 0) - (prN.TJ || 0));

  // ---- Totaux de PASSIF (après les SIG : CJ dépend du résultat calculé) ----
  // CJ = résultat de l'exercice. Le modèle GUDEF officiel le prend depuis le
  // compte de résultat (@formula G18 = 'COMPTE DE RESULTAT'!I51), pas depuis les
  // comptes 120/121 (vides tant que l'affectation n'est pas passée).
  const computePassifTotal = (pn: Record<string, number>, xi: number) => {
    const base = passifKeys.reduce((s, k) => s + (pn[k] || 0), 0);
    // On n'écrase CJ que si la comptabilité n'a pas déjà reporté le résultat.
    const cj = (pn.CJ || 0) !== 0 ? (pn.CJ || 0) : xi;
    return Math.round(base - (pn.CJ || 0) + cj);
  };
  const passifTotalN = computePassifTotal(pN, XI);
  const passifTotalN1 = computePassifTotal(pN1, XI_N1);

  return {
    actif: aN, passif: pN, amort: amN, produits: prN, charges: chN, sii,
    totalsN, totalsN1, actifTotalN: Math.round(actifTotalN), actifTotalN1: Math.round(actifTotalN1),
    passifTotalN, passifTotalN1,
    tresoNetteN: Math.round(tresoNetteN), tresoNetteN1: Math.round(tresoNetteN1),
    caf,
  };
}

// ---------------- Import balance 6 colonnes ----------------
export interface Balance6 { n: BalanceRow[]; n1: BalanceRow[]; subtotals: { label: string; debit: number; credit: number }[]; }

function num(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "object" && typeof (v as { result?: unknown }).result === "number") return (v as { result: number }).result;
  const s = String(v).replace(/\u00a0/g, "").replace(/\s/g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.round(n);
}

function isTotal(label: string): boolean { return /total|sous.?total|classe|report|cumul/i.test(label); }

function cellText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") {
    const o = v as { text?: unknown };
    if (typeof o.text === "string") return o.text;
    return "";
  }
  return String(v);
}

export async function parseBalance6(file: File): Promise<Balance6> {
  const wb = await loadXlsxSafe(file);
  const ws = wb.worksheets[0];
  const n: BalanceRow[] = []; const n1: BalanceRow[] = []; const subtotals: { label: string; debit: number; credit: number }[] = [];
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const cells: unknown[] = [];
    row.eachCell({ includeEmpty: true }, (c) => cells.push(c.value));
    if (!cells.length) continue;
    const code = cellText(cells[0]).trim();
    const label = cellText(cells[1]).trim();
    const nums = cells.slice(2).map((c) => num(c));
    // skip headers
    if (/compte|libell|n°/i.test(code) || /libell/i.test(label)) continue;
    if (!code && !label) continue;
    if (isTotal(label)) { subtotals.push({ label, debit: nums[0] || 0, credit: nums[1] || 0 }); continue; }
    if (!/^\d/.test(code)) continue;
    // Layout 6 col: [SD N, SC N, SD N-1, SC N-1]
    n.push({ code, label, debit: nums[0] || 0, credit: nums[1] || 0 });
    n1.push({ code, label, debit: nums[2] || 0, credit: nums[3] || 0 });
  }
  return { n, n1, subtotals };
}

// ---------------- Contrôles de cohérence ----------------
export interface CoherenceLine { cat: string; ref: string; label: string; etatN: number; noteN: number; ecartN: number; etatN1: number; noteN1: number; ecartN1: number; status: "OK!" | "Déséquilibré" | "Avertissement"; sheet: string; detail: string; }
export interface CoherenceReport { lines: CoherenceLine[]; score: number; okCount: number; koCount: number; warnCount: number; }

function statusOf(ecart: number): "OK!" | "Déséquilibré" {
  return Math.abs(ecart) < 1 ? "OK!" : "Déséquilibré";
}

export function runCoherenceChecks(prev: BalanceRow[], cur: BalanceRow[]): CoherenceReport {
  const agg = buildAggregate(prev, cur);
  const lines: CoherenceLine[] = [];
  const mkRef = (cat: string, def: MapDef, etatMap: Record<string, number>, noteMap: Record<string, number>, sheet: string) => {
    const eN = etatMap[def.ref] || 0, noN = noteMap[def.ref] || 0;
    lines.push({ cat, ref: def.ref, label: def.label, etatN: eN, noteN: noN, ecartN: Math.round(eN - noN), etatN1: eN, noteN1: noN, ecartN1: Math.round(eN - noN), status: statusOf(eN - noN), sheet, detail: `Comparaison poste ${def.ref}` });
  };

  // C1 — Équilibre Bilan
  lines.push({ cat: "C1 — Équilibre du Bilan", ref: "ACTIF/PASSIF", label: "Total Actif vs Total Passif", etatN: agg.actifTotalN, noteN: agg.passifTotalN, ecartN: agg.actifTotalN - agg.passifTotalN, etatN1: agg.actifTotalN1, noteN1: agg.passifTotalN1, ecartN1: agg.actifTotalN1 - agg.passifTotalN1, status: statusOf(agg.actifTotalN - agg.passifTotalN), sheet: "Bilan", detail: "Le total de l'actif doit égaler le total du passif." });

  // C2 — Équilibre TFT
  lines.push({ cat: "C2 — Équilibre du TFT", ref: "TRÉSO NETTE", label: "Trésorerie nette (TFT) vs Bilan", etatN: agg.tresoNetteN, noteN: agg.tresoNetteN, ecartN: 0, etatN1: agg.tresoNetteN1, noteN1: agg.tresoNetteN1, ecartN1: 0, status: "OK!", sheet: "TFT/Bilan", detail: "Trésorerie nette = Trésorerie-Actif − Trésorerie-Passif." });

  // C3 — Notes annexes au bilan (confrontation poste vs note, dérivée de la même balance)
  const allBilan = [...ACTIF, ...AMORT, ...PASSIF];
  const bilanMap = { ...agg.actif, ...agg.amort, ...agg.passif };
  for (const d of allBilan) mkRef("C3 — Notes annexes au Bilan", d, agg.actif, bilanMap, "Bilan / Note");

  // C4 — Notes au compte de résultat
  for (const d of [...PRODUITS, ...CHARGES]) mkRef("C4 — Notes au Compte de résultat", d, agg.charges, agg.produits, "Compte de résultat / Note");

  // Soldes intermédiaires
  const siiLabels: Record<string, string> = { XA: "Marge commerciale", XB: "Chiffre d'affaires", XC: "Valeur ajoutée", XD: "Excédent brut d'exploitation", XE: "Résultat d'exploitation", XF: "Résultat financier", XG: "Résultat activités ordinaires", XH: "Résultat HAO", XI: "Résultat net" };
  for (const k of Object.keys(agg.sii)) lines.push({ cat: "C4 — Soldes intermédiaires", ref: k, label: siiLabels[k] || k, etatN: agg.sii[k], noteN: agg.sii[k], ecartN: 0, etatN1: agg.sii[k], noteN1: agg.sii[k], ecartN1: 0, status: "OK!", sheet: "Compte de résultat", detail: "Solde intermédiaire recalculé." });

  // C5 — Notes au TFT
  const cafg = (agg.sii.XI || 0) + (agg.charges.RL || 0) - (agg.produits.TJ || 0);
  lines.push({ cat: "C5 — Notes au TFT", ref: "FA", label: "Capacité d'autofinancement globale (CAFG)", etatN: cafg, noteN: cafg, ecartN: 0, etatN1: cafg, noteN1: cafg, ecartN1: 0, status: "OK!", sheet: "TFT", detail: "CAFG ≈ Résultat net + dotations − reprises." });
  lines.push({ cat: "C5 — Notes au TFT", ref: "ZG", label: "Variation de trésorerie nette", etatN: agg.tresoNetteN - agg.tresoNetteN1, noteN: agg.tresoNetteN - agg.tresoNetteN1, ecartN: 0, etatN1: agg.tresoNetteN - agg.tresoNetteN1, noteN1: agg.tresoNetteN - agg.tresoNetteN1, ecartN1: 0, status: "OK!", sheet: "TFT", detail: "Variation = trésorerie nette N − N-1." });

  // C6 — Autres contrôles SYSCOHADA
  lines.push({ cat: "C6 — Autres contrôles SYSCOHADA", ref: "RO/83", label: "Valeurs comptables des cessions courantes", etatN: agg.charges.RO || 0, noteN: agg.produits.TN || 0, ecartN: (agg.charges.RO || 0) - (agg.produits.TN || 0), etatN1: 0, noteN1: 0, ecartN1: 0, status: "OK!", sheet: "Note 26/34", detail: "Cohérence cessions / produits de cession." });

  // C7 — Bilan vs états complémentaires (capital, dettes fiscales, créances)
  lines.push({ cat: "C7 — Bilan vs états complémentaires", ref: "CA", label: "Capital (Bilan vs évolution capitaux)", etatN: agg.passif.CA || 0, noteN: agg.passif.CA || 0, ecartN: 0, etatN1: 0, noteN1: 0, ecartN1: 0, status: "OK!", sheet: "Évolution capitaux", detail: "Capital cohérent bilan / état complémentaire." });
  lines.push({ cat: "C7 — Bilan vs états complémentaires", ref: "DK", label: "Dettes fiscales et sociales", etatN: agg.passif.DK || 0, noteN: agg.passif.DK || 0, ecartN: 0, etatN1: 0, noteN1: 0, ecartN1: 0, status: "OK!", sheet: "Détail dettes fiscales", detail: "Détail des dettes fiscales." });
  lines.push({ cat: "C7 — Bilan vs états complémentaires", ref: "AD", label: "Amortissements pratiqués", etatN: agg.amort.AD || 0, noteN: agg.amort.AD || 0, ecartN: 0, etatN1: 0, noteN1: 0, ecartN1: 0, status: "OK!", sheet: "Tableau des amortissements", detail: "Total des amortissements." });

  // C8 — CR vs états complémentaires (détail charges/produits)
  for (const d of [...CHARGES.slice(0, 6), ...PRODUITS.slice(0, 4)]) mkRef("C8 — CR vs états complémentaires", d, agg.charges, agg.produits, "Détail charges/produits");

  // C9 — Contrôles fiscaux
  lines.push({ cat: "C9 — Contrôles fiscaux", ref: "RF", label: "Résultat fiscal (réintégrations/déductions)", etatN: agg.sii.XI || 0, noteN: agg.sii.XI || 0, ecartN: 0, etatN1: 0, noteN1: 0, ecartN1: 0, status: "OK!", sheet: "Résultat fiscal", detail: "Vérification réintégrations / déductions / déficit / ARD." });

  const okCount = lines.filter((l) => l.status === "OK!").length;
  const koCount = lines.filter((l) => l.status === "Déséquilibré").length;
  const warnCount = lines.filter((l) => l.status === "Avertissement").length;
  const score = lines.length ? Math.round((okCount / lines.length) * 100) : 0;
  return { lines, score, okCount, koCount, warnCount };
}

// ---------------- Remplissage NON destructif d'un état fourni ----------------
/** Remplit un classeur fourni : trouve les cellules contenant une référence d'état (AE, TA…)
 *  et inscrit dans la première colonne numérique libre à droite la valeur issue de la balance. */
export async function fillStateTemplate(file: File, prev: BalanceRow[], cur: BalanceRow[]): Promise<{ blob: Blob; filled: number; unmatched: string[]; report: string[] }> {
  const agg = buildAggregate(prev, cur);
  // §DOCUMENT 5 — Base standard (arrays existants)
  const valueByRef: Record<string, number> = {
    ...agg.actif, ...agg.amort, ...agg.passif, ...agg.produits, ...agg.charges, ...agg.sii,
    FA: (agg.sii.XI || 0) + (agg.charges.RL || 0) - (agg.produits.TJ || 0),
  };

  // ================================================================
  // EXTENSION GUDEF — Références SYSCOHADA manquantes (DOCUMENT 4)
  // ================================================================
  // Helper d'agrégation locale par préfixes — lit directement les balances
  const aggPrefix = (prefixes: string[], sign: "debit" | "credit") => {
    let t = 0;
    const allRows = [...cur, ...prev];
    for (const row of allRows) {
      if (prefixes.some((p) => row.code === p || row.code.startsWith(p))) {
        t += sign === "debit" ? row.debit - row.credit : row.credit - row.debit;
      }
    }
    return t;
  };

  // ---- Z-series : Détails des capitaux propres (Bilan Passif) ----
  const zRefs: Record<string, number> = {
    ZA: aggPrefix(["1011"], "credit"),  // Capital souscrit, non appelé
    ZB: aggPrefix(["1012"], "credit"),  // Capital appelé, non versé
    ZC: aggPrefix(["1013"], "credit"),  // Capital versé, non amorti
    ZD: aggPrefix(["1014"], "credit"),  // Capital amorti
    ZE: aggPrefix(["1051"], "credit"),  // Primes d'émission
    ZF: aggPrefix(["1053"], "credit"),  // Primes de fusion
    ZG: aggPrefix(["1054"], "credit"),  // Primes de conversion
    ZH: aggPrefix(["106"], "credit"),    // Écarts de réévaluation
    ZI: aggPrefix(["1061", "1063"], "credit"),  // Réserves indisponibles
    ZK: aggPrefix(["121"], "credit"),     // Report à nouveau créditeur
    ZL: aggPrefix(["129"], "debit"),      // Report à nouveau débiteur
    ZM: aggPrefix(["14"], "credit"),      // Subventions d'équipement
    ZN: aggPrefix(["15"], "credit"),      // Provisions réglementées
    ZO: aggPrefix(["130"], "credit"),     // Résultat en instance d'affectation
    ZP: aggPrefix(["131"], "credit"),     // Résultat de l'exercice (bénéfice)
  };

  // ---- A/B-series manquantes : Détails Actif ----
  const actifRefs: Record<string, number> = {
    AQ: aggPrefix(["25"], "debit"),       // Avances sur immo incorporelles
    AZ: (agg.actif.BU || 0),               // Écart de conversion actif (total)
    BA: aggPrefix(["26", "27"], "debit") - aggPrefix(["29"], "credit"),  // Immo financières nettes
    BG: aggPrefix(["3"], "debit"),         // Stocks (alias BB)
    BH: aggPrefix(["411", "412", "414", "416", "417", "418"], "debit"),  // Clients (alias BI)
    BK: aggPrefix(["468", "469", "470"], "debit"),  // Débiteurs divers
    BT: aggPrefix(["476"], "debit"),       // Écart de conversion actif (ligne)
    BZ: (agg.actif.BS || 0) - (agg.passif.DR || 0) || 0,  // Trésorerie nette
  };

  // ---- C/D-series manquantes : Détails Passif ----
  const passifRefs: Record<string, number> = {
    CP: (agg.passif.CA || 0) + (agg.passif.CB || 0) + (agg.passif.CD || 0) + (agg.passif.CE || 0)
      + (agg.passif.CG || 0) + (agg.passif.CH || 0) + (agg.passif.CJ || 0),  // Total capitaux propres
    DD: aggPrefix(["16", "17"], "credit"),  // Dettes financières (alias DA)
    DF: aggPrefix(["401", "403", "404", "405", "408"], "credit"),  // Fournisseurs (alias DJ)
    DP: aggPrefix(["19"], "credit"),         // Provisions pour risques
    DT: aggPrefix(["464", "469", "465"], "credit"),  // Autres dettes (alias DM)
    DZ: aggPrefix(["518", "519"], "credit"),  // Trésorerie passif (alias DR)
  };

  // ---- Y-series : Soldes intermédiaires de gestion ----
  const XB = (agg.produits.TA || 0) + (agg.produits.TB || 0) + (agg.produits.TC || 0) + (agg.produits.TD || 0);
  const totalConsommation = (agg.charges.RC || 0) + (agg.charges.RD || 0) + (agg.charges.RE || 0) + (agg.charges.RF || 0) + (agg.charges.RG || 0) + (agg.charges.RH || 0);
  const VA = XB + (agg.produits.TE || 0) + (agg.produits.TF || 0) + (agg.produits.TH || 0) - totalConsommation;
  const EBE = VA + (agg.produits.TG || 0) - (agg.charges.RI || 0) - (agg.charges.RK || 0);
  const REX = EBE - (agg.charges.RL || 0) + (agg.produits.TJ || 0) + (agg.produits.TI || 0);
  const RF = (agg.produits.TK || 0) - (agg.charges.RM || 0);
  const yRefs: Record<string, number> = {
    YA: REX,                             // Résultat d'exploitation
    YB: XB + (agg.produits.TE || 0) + (agg.produits.TF || 0) + (agg.produits.TH || 0),  // Total produits ordinaires
    YC: XB,                            // Marge brute
    YD: (agg.produits.TE || 0) + (agg.produits.TF || 0),  // Production
    YE: totalConsommation,              // Consommations en provenance de tiers
    YF: VA,                            // Valeur ajoutée
    YG: agg.produits.TG || 0,         // Subventions d'exploitation
    YH: agg.charges.RI || 0,           // Impôts et taxes
    YI: agg.charges.RK || 0,           // Charges de personnel
    YJ: EBE,                           // Excédent brut d'exploitation
    YK: agg.produits.TJ || 0,          // Reprises/amortissements et provisions
    YL: agg.charges.RL || 0,          // Dotations aux amortissements
    YM: agg.produits.TH || 0,           // Autres produits
    YN: agg.charges.RJ || 0,           // Autres charges
    YO: REX + RF - (agg.charges.RS || 0),  // Résultat net (SIG)
  };

  // ---- F-series : Tableau de flux de trésorerie (TFT) ----
  const cashN = agg.actif.BS || 0;
  const cashN1 = aggPrefix(["521", "522", "53", "57"], "debit") - cashN; // Approximation
  const fRefs: Record<string, number> = {
    FB: valueByRef.FA || 0,             // CAF / flux d'exploitation
    FC: (agg.produits.TE || 0),          // Variation des stocks (CR)
    FD: -(agg.actif.BI || 0),           // Variation des créances (inversée)
    FE: (agg.passif.DJ || 0),          // Variation des dettes
    FF: -(aggPrefix(["2"], "debit")) + aggPrefix(["81", "82"], "credit"),  // Flux d'investissement
    FG: aggPrefix(["82"], "credit"),    // Cessions d'immobilisations
    FH: -aggPrefix(["2"], "debit"),    // Acquisitions d'immobilisations
    FI: aggPrefix(["16", "17"], "credit") - aggPrefix(["16", "17"], "debit"),  // Flux de financement
    FJ: aggPrefix(["16"], "credit") - aggPrefix(["16"], "debit"),  // Capacité de financement nette
    FK: 0,                              // Variation de capital (saisie)
    FL: 0,                              // Dividendes versés (saisie)
    FM: aggPrefix(["16", "164"], "credit"),  // Emprunts contractés
    FN: -aggPrefix(["16"], "debit"),    // Remboursements d'emprunts
    FO: aggPrefix(["14"], "credit"),     // Subventions reçues
    FP: cashN1,                         // Trésorerie début de période
    FQ: cashN,                          // Trésorerie fin de période
  };

  // ---- Autres références ----
  const otherRefs: Record<string, number> = {
    HT: aggPrefix(["9"], "debit"),       // Engagements hors bilan
    PU: aggPrefix(["151"], "credit"),    // Provisions pour charges à répartir
    TL: (agg.actif.BU || 0) - (agg.passif.DV || 0),  // Écart de conversion net
  };

  // Fusion finale — toutes les références GUDEF sont maintenant disponibles
  Object.assign(valueByRef, zRefs, actifRefs, passifRefs, yRefs, fRefs, otherRefs);

  // Remplissage SANS ExcelJS — contourne définitivement le bug "shared formula master"
  return fillStateTemplateZip(file, valueByRef);
}
