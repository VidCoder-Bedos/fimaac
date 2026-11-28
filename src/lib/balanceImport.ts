// ============================================================================
// FIMAAC — Import de balance robuste (P0-4)
//
// Constat d'audit : `parseBalance` refusait silencieusement ce qu'elle ne
// comprenait pas. Un CSV avec des en-têtes réels (« N° de compte », « Intitulé »,
// « Mouvement débit ») renvoyait **0 ligne sans un mot**, et l'écran affichait
// ensuite un bilan vide comme si le dossier n'avait aucune écriture. C'est le
// pire défaut possible pour un outil comptable : la perte de données est
// silencieuse et l'utilisateur ne peut pas la distinguer d'une absence
// d'activité.
//
// Principe : détecter par le CONTENU, accepter les variantes d'en-têtes,
// ET REFUSER EXPLICITEMENT en expliquant pourquoi. Aucun import ne renvoie
// une liste vide sans motif.
// ============================================================================

export interface BalanceRow {
  code: string;
  label: string;
  debit: number;
  credit: number;
}

export interface BalanceColumnMap {
  code: number;
  label: number;
  debit: number;
  credit: number;
  solde: number;
  soldeDebit: number;
  soldeCredit: number;
}

export interface BalanceImportResult {
  ok: boolean;
  rows: BalanceRow[];
  /** Index (0-based) de la ligne d'en-têtes détectée, `null` si aucune. */
  headerRow: number | null;
  mapping: BalanceColumnMap;
  /** Ce qui a été détecté et les hypothèses prises. */
  signals: string[];
  warnings: string[];
  errors: string[];
  totals: { debit: number; credit: number; ecart: number };
  /** Lignes écartées, avec la raison — visibles par l'utilisateur. */
  rejected: { row: number; reason: string; values: string[] }[];
}

const EMPTY_MAP: BalanceColumnMap = { code: -1, label: -1, debit: -1, credit: -1, solde: -1, soldeDebit: -1, soldeCredit: -1 };

/** Normalise un intitulé de colonne : sans accents, sans ponctuation, minuscule. */
export function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/** Découpe un texte délimité en grille, en respectant les guillemets. */
export function parseDelimited(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, "");
  const sample = clean.split(/\r?\n/).slice(0, 20).join("\n");
  const counts: Record<string, number> = {
    ";": (sample.match(/;/g) || []).length,
    ",": (sample.match(/,/g) || []).length,
    "\t": (sample.match(/\t/g) || []).length,
    "|": (sample.match(/\|/g) || []).length,
  };
  const delimiter = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][1] === 0 ? ";" : Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];

  const grid: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === delimiter) { row.push(field); field = ""; continue; }
    if (ch === "\n") { row.push(field); grid.push(row); row = []; field = ""; continue; }
    if (ch === "\r") continue;
    field += ch;
  }
  if (field.length || row.length) { row.push(field); grid.push(row); }
  return grid;
}

/**
 * Convertit une valeur en montant. Tolère : espaces (dont insécables), symboles
 * monétaires, séparateurs de milliers, virgule décimale, négatifs entre
 * parenthèses ou suffixés d'un « - ».
 */
export function parseAmount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  let s = String(value ?? "").trim();
  if (!s) return null;

  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  if (/-\s*$/.test(s)) { negative = true; s = s.replace(/-\s*$/, ""); }
  s = s.replace(/(fcfa|xof|xaf|eur|usd|€|\$)/gi, "").replace(/\s|\u00a0|\u202f/g, "");
  if (s.startsWith("-")) { negative = true; s = s.slice(1); }
  if (s.startsWith("+")) s = s.slice(1);
  if (!/[\d]/.test(s)) return null;
  if (!/^[\d.,]+$/.test(s)) return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    // Le dernier séparateur rencontré est le séparateur décimal.
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    const decimals = s.length - lastComma - 1;
    s = decimals === 3 && s.length > 4 ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (lastDot >= 0) {
    const decimals = s.length - lastDot - 1;
    if (decimals === 3 && s.length > 4) s = s.replace(/\./g, "");
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/** Reconnaît un code de compte : commence par un chiffre, longueur plausible. */
export function isAccountCode(value: unknown): boolean {
  const s = String(value ?? "").trim();
  return /^\d{2,12}$/.test(s);
}

const HEADER_KEYS = {
  code: ["code", "codecompte", "compte", "ncompte", "nocompte", "numerocompte", "numcompte", "n", "no", "numero", "account", "accountcode", "codification"],
  label: ["libelle", "libellecompte", "intitule", "intitulecompte", "designation", "nom", "nomcompte", "label", "accountname", "description"],
  soldeDebit: ["soldeDebit", "soldeDebiteur", "sd", "soldeDebitN", "debitSolde"].map((k) => k.toLowerCase()),
  soldeCredit: ["soldeCredit", "soldeCrediteur", "sc", "soldeCreditN", "creditSolde"].map((k) => k.toLowerCase()),
  debit: ["debit", "mouvementdebit", "mvdebit", "cumuldebit", "totaldebit", "debitcumul", "debits"],
  credit: ["credit", "mouvementcredit", "mvcredit", "cumulcredit", "totalcredit", "creditcumul", "credits"],
  solde: ["solde", "balance", "montant", "net", "soldegeneral", "soldeperiodique"],
};

function matchHeader(normalized: string, keys: string[]): boolean {
  return keys.some((k) => normalized === normalizeHeader(k));
}

function detectHeaderRow(grid: unknown[][]): { index: number; map: BalanceColumnMap } | null {
  const limit = Math.min(grid.length, 15);
  for (let r = 0; r < limit; r++) {
    const cells = grid[r] || [];
    const map: BalanceColumnMap = { ...EMPTY_MAP };
    cells.forEach((cell, c) => {
      const key = normalizeHeader(cell);
      if (!key) return;
      // « solde débit » doit être testé avant « débit ».
      if (map.soldeDebit < 0 && matchHeader(key, HEADER_KEYS.soldeDebit)) { map.soldeDebit = c; return; }
      if (map.soldeCredit < 0 && matchHeader(key, HEADER_KEYS.soldeCredit)) { map.soldeCredit = c; return; }
      if (map.code < 0 && matchHeader(key, HEADER_KEYS.code)) { map.code = c; return; }
      if (map.label < 0 && matchHeader(key, HEADER_KEYS.label)) { map.label = c; return; }
      if (map.debit < 0 && matchHeader(key, HEADER_KEYS.debit)) { map.debit = c; return; }
      if (map.credit < 0 && matchHeader(key, HEADER_KEYS.credit)) { map.credit = c; return; }
      if (map.solde < 0 && matchHeader(key, HEADER_KEYS.solde)) { map.solde = c; }
    });
    if (map.code >= 0 || map.label >= 0) {
      return { index: r, map };
    }
  }
  return null;
}

interface ColumnStat {
  index: number;
  filled: number;
  codeHits: number;
  textHits: number;
  numberHits: number;
}

function columnStats(grid: unknown[][], start: number): ColumnStat[] {
  let width = 0;
  for (let r = start; r < grid.length; r++) width = Math.max(width, (grid[r] || []).length);
  const stats: ColumnStat[] = [];
  for (let c = 0; c < width; c++) {
    const st: ColumnStat = { index: c, filled: 0, codeHits: 0, textHits: 0, numberHits: 0 };
    for (let r = start; r < grid.length; r++) {
      const raw = (grid[r] || [])[c];
      if (raw === undefined || raw === null || String(raw).trim() === "") continue;
      st.filled++;
      if (isAccountCode(raw)) st.codeHits++;
      else if (parseAmount(raw) === null) st.textHits++;
      else st.numberHits++;
    }
    stats.push(st);
  }
  return stats;
}

/**
 * Choisit les colonnes par leur contenu.
 *
 * Piège corrigé : un montant comme « 5 000 000 » ressemble à un numéro de
 * compte. On identifie donc D'ABORD la colonne des comptes (la plus « codeuse »),
 * puis on la retire des candidates aux montants — sinon une balance sans
 * en-têtes était rejetée alors qu'elle était parfaitement lisible.
 */
function detectColumnsByContent(grid: unknown[][], start: number, map: BalanceColumnMap): void {
  const stats = columnStats(grid, start).filter((s) => s.filled > 0);
  if (!stats.length) return;
  const ratio = (n: number, s: ColumnStat): number => n / Math.max(1, s.filled);
  const used = new Set<number>([map.code, map.label].filter((c) => c >= 0));

  if (map.code < 0) {
    const best = [...stats].sort((a, b) => ratio(b.codeHits, b) - ratio(a.codeHits, a))[0];
    if (ratio(best.codeHits, best) >= 0.6) {
      map.code = best.index;
      used.add(best.index);
    }
  }
  if (map.label < 0) {
    const best = [...stats]
      .filter((s) => !used.has(s.index))
      .sort((a, b) => ratio(b.textHits, b) - ratio(a.textHits, a))[0];
    if (best && ratio(best.textHits, best) >= 0.5) {
      map.label = best.index;
      used.add(best.index);
    }
  }
}

/**
 * Analyse une grille (issue d'un CSV ou d'un classeur) et rend un rapport
 * complet — jamais un tableau vide muet.
 */
export function parseBalanceGrid(grid: unknown[][], opts: { source?: string } = {}): BalanceImportResult {
  const signals: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const rejected: BalanceImportResult["rejected"] = [];

  const nonEmpty = grid.filter((r) => (r || []).some((c) => String(c ?? "").trim() !== ""));
  if (nonEmpty.length === 0) {
    return {
      ok: false, rows: [], headerRow: null, mapping: { ...EMPTY_MAP }, signals, warnings,
      errors: ["Le fichier ne contient aucune ligne exploitable."], totals: { debit: 0, credit: 0, ecart: 0 }, rejected,
    };
  }

  const header = detectHeaderRow(grid);
  const headerRow = header ? header.index : null;
  const map: BalanceColumnMap = header ? { ...header.map } : { ...EMPTY_MAP };
  if (header) signals.push(`En-têtes reconnus ligne ${header.index + 1}.`);

  const dataStart = header ? header.index + 1 : 0;

  // Détection par le contenu pour les colonnes restantes.
  const needsContent = map.code < 0 || map.label < 0 || (map.debit < 0 && map.credit < 0 && map.solde < 0 && map.soldeDebit < 0);
  if (needsContent) {
    const before = { ...map };
    detectColumnsByContent(grid, dataStart, map);
    if (before.code < 0 && map.code >= 0) signals.push(`Colonne des comptes détectée par le contenu (colonne ${map.code + 1}).`);
    if (before.label < 0 && map.label >= 0) signals.push(`Colonne des libellés détectée par le contenu (colonne ${map.label + 1}).`);

    if (map.debit < 0 && map.credit < 0 && map.solde < 0 && map.soldeDebit < 0) {
      const stats = columnStats(grid, dataStart).filter((st) => st.filled > 0);
      const excluded = new Set<number>([map.code, map.label].filter((c) => c >= 0));
      const nums = stats
        .filter((st) => !excluded.has(st.index) && st.numberHits / Math.max(1, st.filled) >= 0.5)
        .map((st) => st.index);
      if (nums.length >= 2) {
        map.debit = nums[0];
        map.credit = nums[1];
        signals.push(
          `Hypothèse : deux colonnes de montants sans en-tête → débit (colonne ${nums[0] + 1}), crédit (colonne ${nums[1] + 1}). Vérifiez l'ordre du fichier.`,
        );
        warnings.push("Colonnes de montants déduites de leur position : contrôle visuel conseillé.");
      } else if (nums.length === 1) {
        map.solde = nums[0];
        signals.push("Hypothèse : une seule colonne de montants → solde signé (positif = débit, négatif = crédit).");
        warnings.push("Solde signé interprété : positif au débit, négatif au crédit.");
      }
    }
  }

  if (map.code < 0) {
    errors.push(
      "Aucune colonne de numéro de compte identifiable. Attendu : une colonne « Compte » / « Code » / « N° de compte ».",
    );
  }

  const rows: BalanceRow[] = [];
  const seen = new Map<string, number>();
  for (let r = dataStart; r < grid.length; r++) {
    const cells = grid[r] || [];
    if (!cells.some((c) => String(c ?? "").trim() !== "")) continue;
    const rawCode = String(cells[map.code] ?? "").trim();
    const label = map.label >= 0 ? String(cells[map.label] ?? "").trim() : "";

    // Lignes de total / de regroupement : ni compte, ni montants → ignorées sans bruit.
    const looksLikeTotal = /^(total|totaux|sous[- ]?total|somme)\b/i.test(label) || /^(total|totaux)/i.test(rawCode);
    if (!isAccountCode(rawCode)) {
      if (looksLikeTotal) continue;
      const hasNumbers = cells.some((c) => parseAmount(c) !== null);
      if (hasNumbers && rejected.length < 40) {
        rejected.push({
          row: r + 1,
          reason: /^\d/.test(rawCode) ? `numéro de compte atypique « ${rawCode} »` : "numéro de compte absent ou non numérique",
          values: cells.slice(0, 6).map((c) => String(c ?? "")),
        });
      }
      continue;
    }

    let debit = 0;
    let credit = 0;
    if (map.debit >= 0 || map.credit >= 0) {
      debit = (map.debit >= 0 ? parseAmount(cells[map.debit]) : null) ?? 0;
      credit = (map.credit >= 0 ? parseAmount(cells[map.credit]) : null) ?? 0;
    } else if (map.soldeDebit >= 0 || map.soldeCredit >= 0) {
      debit = (map.soldeDebit >= 0 ? parseAmount(cells[map.soldeDebit]) : null) ?? 0;
      credit = (map.soldeCredit >= 0 ? parseAmount(cells[map.soldeCredit]) : null) ?? 0;
    } else if (map.solde >= 0) {
      const solde = parseAmount(cells[map.solde]) ?? 0;
      if (solde >= 0) debit = solde;
      else credit = -solde;
    }

    if (!debit && !credit) {
      // Un compte à zéro n'apporte rien à la balance : on le signale une fois.
      rejected.push({ row: r + 1, reason: "aucun montant exploitable", values: cells.slice(0, 6).map((c) => String(c ?? "")) });
      continue;
    }

    if (debit < 0 || credit < 0) {
      warnings.push(`Ligne ${r + 1} : montant négatif normalisé (le solde a été basculé du bon côté).`);
      const net = debit - credit;
      debit = net > 0 ? net : 0;
      credit = net < 0 ? -net : 0;
    }

    const code = rawCode.replace(/\s/g, "");
    const previous = seen.get(code);
    if (previous !== undefined) {
      // Deux lignes pour le même compte : on cumule plutôt que d'écraser en silence.
      const target = rows[previous];
      target.debit += debit;
      target.credit += credit;
      signals.push(`Compte ${code} présent plusieurs fois : montants cumulés.`);
      continue;
    }
    seen.set(code, rows.length);
    rows.push({ code, label, debit, credit });
  }

  let debit = 0;
  let credit = 0;
  for (const r of rows) { debit += r.debit; credit += r.credit; }
  const ecart = Math.round(debit - credit);

  if (rows.length === 0) {
    errors.push(
      "Aucun compte exploitable n'a été trouvé. Le fichier n'est probablement pas une balance (colonnes attendues : Compte / Libellé / Débit / Crédit).",
    );
  }
  if (rows.length > 0 && ecart !== 0) {
    warnings.push(`Balance déséquilibrée : Σ débit ${debit} − Σ crédit ${credit} = ${ecart}. Vérifiez le fichier avant d'exploiter les états.`);
  }
  if (rejected.length > 0) {
    warnings.push(`${rejected.length} ligne(s) écartée(s) — détail consultable, aucune n'est ignorée en silence.`);
  }
  if (rows.length > 0) {
    signals.push(`${rows.length} compte(s) importé(s)${opts.source ? ` depuis ${opts.source}` : ""}.`);
  }

  return {
    ok: rows.length > 0 && errors.length === 0,
    rows,
    headerRow,
    mapping: map,
    signals,
    warnings,
    errors,
    totals: { debit, credit, ecart },
    rejected: rejected.slice(0, 40),
  };
}

/** Import depuis un texte CSV / TSV / pipe. */
export function parseBalanceText(text: string, opts: { source?: string } = {}): BalanceImportResult {
  const grid = parseDelimited(text);
  return parseBalanceGrid(grid, opts);
}
