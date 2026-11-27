import type { BalanceRow } from "./liasse";
import { loadXlsxSafe } from "./xlsx-sanitizer";
// ============================================================================
// FIMAAC — Moteur d'import universel (V0.8)
// Lit n'importe quel Excel/CSV, détecte la structure, normalise vers le format
// canonique interne, puis alimente la chaîne d'édition des états financiers.
// ============================================================================

/** Parseur de montant universel → entier FCFA.
 *  "1 250 000", "1,250,000.00", "1.250,00", "(510 173)", "-12,5", "1250000" */
export function parseAmount(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return Math.round(v);
  let s = typeof v === "object" && typeof (v as { result?: unknown }).result === "number"
    ? String((v as { result: number }).result)
    : String((v as { text?: unknown })?.text ?? v);
  let negative = false;
  if (/^\(.*\)$/.test(s.trim())) negative = true;
  s = s.replace(/[()\s\u00a0]/g, "").replace(/^[−–-]+/, () => { negative = true; return ""; });
  if (s === "" || s === "-") return 0;
  // Heuristique séparateur décimal
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) {
    // virgule décimale : supprimer points (milliers), remplacer virgule par point
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma && (s.split(".").pop() ?? "").length === 3 && /\d{1,3}(\.\d{3})+/.test(s)) {
    // format 1.250.000 (milliers en points)
    s = s.replace(/\./g, "");
  } else if (lastComma > -1 && lastComma === s.length - 4) {
    // format 1,250,000 (milliers en virgules)
    s = s.replace(/,/g, "");
  }
  const n = parseFloat(s);
  if (isNaN(n)) return 0;
  return negative ? -Math.round(n) : Math.round(n);
}

export type ColRole =
  | "compte" | "libelle" | "debitN" | "creditN" | "debitN1" | "creditN1"
  | "soldeDebit" | "soldeCredit" | "ref" | "brut" | "amort" | "net"
  | "montant" | "taux" | "quantite" | "ignore";

export interface DetectedColumn { index: number; header: string; role: ColRole; }
export type DocKind = "balance" | "balance6" | "etat" | "plan" | "autre";

const ROLE_PATTERNS: { role: ColRole; re: RegExp }[] = [
  { role: "compte", re: /^(compte|n°\s*compte|n°cpte|num[ée]ro\s*de\s*compte|cpte|code\s*compte)$/i },
  { role: "libelle", re: /(libell|intitul|d[ée]signation|nom)/i },
  { role: "debitN", re: /^(d[ée]bit|mouvement.*d[ée]bit|mt.*d[ée]bit)\s*(n)?$/i },
  { role: "creditN", re: /^(cr[ée]dit|mouvement.*cr[ée]dit|mt.*cr[ée]dit)\s*(n)?$/i },
  { role: "debitN1", re: /(d[ée]bit).*(n-?1|an.*dernier|pr[ée]c[ée]dent)/i },
  { role: "creditN1", re: /(cr[ée]dit).*(n-?1|an.*dernier|pr[ée]c[ée]dent)/i },
  { role: "soldeDebit", re: /(solde|report|cumul|[àa]\s*nouveau|initial|ouverture).*(d[ée]b)/i },
  { role: "soldeCredit", re: /(solde|report|cumul|[àa]\s*nouveau|initial|ouverture).*(cr[ée]d)/i },
  { role: "ref", re: /^(r[ée]f|poste|code\s*syco|ref\.?$|ligne)/i },
  { role: "brut", re: /brut/i },
  { role: "amort", re: /(amort|d[ée]pr[ée]c|reprise)/i },
  { role: "net", re: /(net|vnc|valeur\s*nette)/i },
  { role: "montant", re: /(montant|total|valeur)/i },
  { role: "taux", re: /(taux|%)/i },
  { role: "quantite", re: /(quantit|qt[ée]|nb)/i },
];

function classifyHeader(h: string): ColRole {
  const t = (h || "").trim();
  for (const p of ROLE_PATTERNS) if (p.re.test(t)) return p.role;
  // N / N-1 brut
  if (/^n-?1$/i.test(t)) return "debitN1";
  if (/^n$/i.test(t)) return "debitN";
  return "ignore";
}

function looksLikeAccountCode(s: string): boolean { return /^\d{2,}$/.test((s || "").trim()); }
function isTotalRow(label: string): boolean { return /total|sous.?total|classe|report|cumul/i.test(label); }

export interface RawGrid { headers: string[]; rows: string[][]; sheetNames: string[]; sheetIndex: number; }

async function readCsv(file: File): Promise<RawGrid> {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  const sep = lines[0].includes(";") ? ";" : lines[0].includes("\t") ? "\t" : lines[0].includes("|") ? "|" : ",";
  const rows = lines.map((l) => l.split(sep).map((c) => c.replace(/^"|"$/g, "").trim()));
  return { headers: rows[0] || [], rows: rows.slice(1), sheetNames: ["CSV"], sheetIndex: 0 };
}

function cellText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") {
    const o = v as { text?: unknown; result?: unknown };
    if (typeof o.text === "string") return o.text;
    if (typeof o.result === "number") return String(o.result);
    return "";
  }
  return String(v);
}

async function readXlsx(file: File): Promise<RawGrid> {
  const wb = await loadXlsxSafe(file);
  const sheetNames = wb.worksheets.map((w) => w.name);
  const ws = wb.worksheets[0];
  const headers: string[] = [];
  const rows: string[][] = [];
  let headerRow = 1;
  // trouver la ligne d'en-tête (contenant un mot type "compte" ou "libellé")
  for (let r = 1; r <= Math.min(10, ws.rowCount); r++) {
    const cells: string[] = [];
    ws.getRow(r).eachCell({ includeEmpty: true }, (c) => cells.push(cellText(c.value).trim()));
    if (cells.some((c) => /(compte|libell|intitul|r[ée]f|d[ée]bit|cr[ée]dit|solde|montant)/i.test(c))) { headerRow = r; break; }
  }
  ws.getRow(headerRow).eachCell({ includeEmpty: true }, (c, col) => { headers[col - 1] = cellText(c.value).trim(); });
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const cells: string[] = [];
    ws.getRow(r).eachCell({ includeEmpty: true }, (c) => cells.push(cellText(c.value).trim()));
    if (cells.some((c) => c.trim())) rows.push(cells);
  }
  return { headers, rows, sheetNames, sheetIndex: 0 };
}

export async function readAny(file: File): Promise<RawGrid> {
  return file.name.toLowerCase().endsWith(".csv") ? readCsv(file) : readXlsx(file);
}

/** Détecte les rôles des colonnes (header + contenu). */
export function detectColumns(grid: RawGrid): DetectedColumn[] {
  return grid.headers.map((h, i) => {
    let role = classifyHeader(h);
    // validation par contenu : si classé compte mais pas de codes, et la colonne est numérique → montant
    const sample = grid.rows.slice(0, 8).map((r) => r[i]).filter(Boolean);
    if (role === "ignore" || role === "compte") {
      const numericCount = sample.filter((s) => parseAmount(s) !== 0 || /^[\d\s.,()-]+$/.test(s)).length;
      if (role === "compte" && !sample.some(looksLikeAccountCode)) role = "ignore";
      else if (role === "ignore" && numericCount >= Math.max(2, sample.length / 2)) role = "montant";
    }
    return { index: i, header: h || `Col ${i + 1}`, role };
  });
}

/** Détecte le type de document. */
export function detectKind(cols: DetectedColumn[]): DocKind {
  const roles = cols.map((c) => c.role);
  const hasCompte = roles.includes("compte");
  const hasRef = roles.includes("ref");
  const has6 = (["debitN", "creditN", "debitN1", "creditN1"] as ColRole[]).filter((r) => roles.includes(r)).length >= 3;
  const numCols = cols.filter((c) => ["debitN", "creditN", "debitN1", "creditN1", "soldeDebit", "soldeCredit", "montant", "brut", "amort", "net"].includes(c.role)).length;
  if (hasCompte && has6) return "balance6";
  if (hasCompte && numCols >= 2) return "balance";
  if (hasRef) return "etat";
  if (hasCompte && roles.includes("libelle")) return "plan";
  if (numCols >= 2) return "balance";
  return "autre";
}

export interface NormalizedDoc {
  kind: DocKind;
  balanceN: BalanceRow[];
  balanceN1: BalanceRow[];
  plan: { code: string; label: string }[];
  totals: { label: string; debit: number; credit: number }[];
  detectedCols: DetectedColumn[];
  rowCount: number;
  colCount: number;
  sheetName: string;
}

/** Normalise la grille vers le format canonique. */
export function normalize(cols: DetectedColumn[], grid: RawGrid): NormalizedDoc {
  const kind = detectKind(cols);
  const idx = (r: ColRole) => cols.find((c) => c.role === r)?.index;
  const cI = idx("compte"), lI = idx("libelle");
  const dN = idx("debitN"), cN = idx("creditN"), dN1 = idx("debitN1"), cN1 = idx("creditN1");
  const sC = idx("soldeCredit");
  // fallback : si pas de débit/crédit distincts, utiliser montant → débit ; solde crédit → crédit
  const mI = idx("montant");
  const hasBAN = cols.some((c) => ["brut", "amort", "net"].includes(c.role));
  const balanceN: BalanceRow[] = [];
  const balanceN1: BalanceRow[] = [];
  const plan: { code: string; label: string }[] = [];
  const totals: { label: string; debit: number; credit: number }[] = [];

  for (const r of grid.rows) {
    const code = cI != null ? String(r[cI] ?? "").trim() : "";
    const label = lI != null ? String(r[lI] ?? "").trim() : "";
    if (isTotalRow(label) || isTotalRow(code)) {
      totals.push({ label: label || code, debit: dN != null ? parseAmount(r[dN]) : 0, credit: cN != null ? parseAmount(r[cN]) : 0 });
      continue;
    }
    if (!code || !looksLikeAccountCode(code)) continue;
    const debit = dN != null ? parseAmount(r[dN]) : (mI != null && sC == null ? parseAmount(r[mI]) : 0);
    const credit = cN != null ? parseAmount(r[cN]) : (sC != null ? parseAmount(r[sC]) : 0);
    balanceN.push({ code, label, debit, credit });
    if (dN1 != null || cN1 != null) balanceN1.push({ code, label, debit: dN1 != null ? parseAmount(r[dN1]) : 0, credit: cN1 != null ? parseAmount(r[cN1]) : 0 });
    if (kind === "plan" || (lI != null && !hasBAN)) plan.push({ code, label });
  }

  return {
    kind, balanceN, balanceN1, plan, totals,
    detectedCols: cols, rowCount: grid.rows.length, colCount: grid.headers.length, sheetName: grid.sheetNames[grid.sheetIndex],
  };
}

export const KIND_LABELS: Record<DocKind, string> = {
  balance: "Balance générale (N)", balance6: "Balance 6 colonnes (N et N-1)", etat: "Modèle d'état financier", plan: "Plan comptable", autre: "Autre document",
};
