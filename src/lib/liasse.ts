import ExcelJS from "exceljs";
import { loadXlsxSafe } from "./xlsx-sanitizer";
import { parseBalanceGrid, parseBalanceText, type BalanceImportResult } from "./balanceImport";
import { computePostes, money } from "./etatsMapping";
import { buildTafire, tafireLines } from "./tafire";
import { buildNotesAnnex } from "./notesAnnex";
// FIMAAC liasse engine — GUDEF / SYSCOHADA
export interface BalanceRow {
  code: string;
  label: string;
  debit: number;
  credit: number;
}
export interface LiasseStatements {
  bilan: {
    immoBrut: number; amort: number; immoNet: number; stocks: number;
    creances: number; tresorerie: number; actifTotal: number;
    capitaux: number; resultat: number; dettesFin: number; dettesFourn: number;
    autresDettes: number; tresoPassif: number; passifTotal: number;
    // P0-1 — composantes auparavant calculées mais jamais exposées (le total
    // ne doit jamais contenir un montant invisible à l'écran).
    dettesFiscalesSociales: number;
    creancesClients: number;
    creancesEtat: number;
    /** P15 — comptes 42/43/44 à solde débiteur, à l'actif et non en moins des dettes. */
    creancesFiscalesSociales: number;
    deprecTiers: number;
    deprecStocks: number;
    stocksBrut: number;
    capitauxHorsReport: number;
    reportANouveau: number;
  };
  result: { produits: number; charges: number; resultat: number; produitsHAO: number; chargesHAO: number };
  totals: { debit: number; credit: number };
  /** Comptes à solde non nul qu'aucun poste ne couvre (garde-fou anti-silence). */
  nonMappes: { code: string; solde: number }[];
}
export interface CoherenceCheck {
  id: string;
  title: string;
  sheet: string;
  expected: number;
  actual: number;
  diff: number;
  status: "ok" | "warning" | "blocking";
  detail: string;
}
const NUMFMT = "#,##0;[Red]-#,##0";
const HEADER_FONT = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
function fillOf(argb: string): ExcelJS.FillPattern {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}
const HEADER_FILL = fillOf("FF4F46E5");
const SECTION_FILL = fillOf("FFE0E7FF");

/** Convertit une feuille ExcelJS en grille de valeurs brutes. */
function sheetToGrid(ws: ExcelJS.Worksheet): unknown[][] {
  const grid: unknown[][] = [];
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const cells: unknown[] = [];
    for (let c = 1; c <= ws.columnCount; c++) {
      const cell = row.getCell(c);
      const raw = (cell.value as { text?: string } | null)?.text ?? cell.value;
      if (raw && typeof raw === "object" && "result" in (raw as object)) {
        cells.push((raw as { result?: unknown }).result ?? "");
      } else if (raw && typeof raw === "object" && "richText" in (raw as object)) {
        cells.push((raw as { richText: { text: string }[] }).richText.map((t) => t.text).join(""));
      } else {
        cells.push(raw ?? "");
      }
    }
    grid.push(cells);
  }
  return grid;
}

/**
 * P0-4 — Import de balance avec rapport complet.
 * Détecte les en-têtes réels, déduit les colonnes par leur contenu, et refuse
 * explicitement en expliquant pourquoi (jamais 0 ligne en silence).
 */
export async function parseBalanceReport(file: File): Promise<BalanceImportResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt") || name.endsWith(".tsv")) {
    return parseBalanceText(await file.text(), { source: file.name });
  }
  const wb = await loadXlsxSafe(file);
  const ws = wb.worksheets[0];
  if (!ws) {
    return {
      ok: false, rows: [], headerRow: null,
      mapping: { code: -1, label: -1, debit: -1, credit: -1, solde: -1, soldeDebit: -1, soldeCredit: -1 },
      signals: [], warnings: [], errors: ["Le classeur ne contient aucune feuille."],
      totals: { debit: 0, credit: 0, ecart: 0 }, rejected: [],
    };
  }
  return parseBalanceGrid(sheetToGrid(ws), { source: `${file.name} · feuille « ${ws.name} »` });
}

/** Compatibilité : renvoie les lignes, ou lève une erreur explicable. */
export async function parseBalance(file: File): Promise<BalanceRow[]> {
  const report = await parseBalanceReport(file);
  if (!report.ok) {
    const details = [...report.errors, ...report.warnings].slice(0, 3).join("\n");
    throw new Error(details || "Fichier de balance illisible.");
  }
  return report.rows;
}

/**
 * P0-1 — Construit les états financiers à partir de la table de mapping unique
 * (`src/lib/etatsMapping.ts`). Chaque compte alimente un seul poste avec son
 * solde : l'identité actif = passif découle de Σ soldes = 0, elle n'est plus
 * constatée après coup. Un compte non couvert est signalé, jamais ignoré.
 */
export function buildStatements(rows: BalanceRow[]): LiasseStatements {
  const { postes, nonMappes } = computePostes(rows);

  let debit = 0, credit = 0;
  for (const r of rows) {
    debit += Number(r.debit) || 0;
    credit += Number(r.credit) || 0;
  }

  // --- ACTIF ---
  const immoBrut = money(postes.immoBrut);
  const amort = money(postes.amort);
  const immoNet = immoBrut - amort;
  const stocksBrut = money(postes.stocks);
  const deprecStocks = money(postes.deprecStocks);
  const stocks = stocksBrut - deprecStocks;
  const creancesClients = money(postes.creancesClients);
  const creancesEtat = money(postes.creancesEtat);
  const creancesFiscalesSociales = money(postes.creancesFiscalesSociales);
  const deprecTiers = money(postes.deprecTiers);
  const creances = creancesClients + creancesEtat + creancesFiscalesSociales + money(postes.autresCreances) - deprecTiers;
  const tresorerie = money(postes.tresorerie);
  const actifTotal = immoNet + stocks + creances + tresorerie;

  // --- RÉSULTAT ---
  const produitsAO = money(postes.produits);
  const chargesAO = money(postes.charges);
  const produitsHAO = money(postes.produitsHAO);
  const chargesHAO = money(postes.chargesHAO);
  const produits = produitsAO + produitsHAO;
  const charges = chargesAO + chargesHAO;
  // 13 = résultat net comptabilisé : prioritaire s'il est mouvementé (exercice
  // déjà clôturé) ; sinon on retient le résultat calculé, jamais 0 par défaut.
  const resultat = postes.resultatPoste !== 0 ? money(postes.resultatPoste) : produits - charges;

  // --- PASSIF ---
  const capitauxHorsReport = money(postes.capitaux);
  const reportANouveau = money(postes.reportANouveau);
  const capitaux = capitauxHorsReport + reportANouveau;
  const dettesFin = money(postes.dettesFin);
  const dettesFourn = money(postes.dettesFourn);
  const dettesFiscalesSociales = money(postes.dettesFiscalesSociales);
  const autresDettes = money(postes.autresDettes);
  const tresoPassif = money(postes.tresoreriePassif);
  const passifTotal =
    capitaux + resultat + dettesFin + dettesFourn + dettesFiscalesSociales + autresDettes + tresoPassif;

  return {
    bilan: {
      immoBrut, amort, immoNet, stocks, creances, tresorerie, actifTotal,
      capitaux, resultat, dettesFin, dettesFourn, autresDettes, tresoPassif, passifTotal,
      dettesFiscalesSociales, creancesClients, creancesEtat, creancesFiscalesSociales, deprecTiers, deprecStocks,
      stocksBrut, capitauxHorsReport, reportANouveau,
    },
    result: { produits, charges, resultat, produitsHAO, chargesHAO },
    totals: { debit, credit },
    nonMappes,
  };
}

export function runChecks(st: LiasseStatements): CoherenceCheck[] {
  const checks: CoherenceCheck[] = [];
  const diffBal = st.totals.debit - st.totals.credit;
  checks.push({ id: "dc", title: "Σ Débit = Σ Crédit", sheet: "Balance", expected: st.totals.debit, actual: st.totals.credit, diff: diffBal, status: diffBal === 0 ? "ok" : "blocking", detail: "La balance doit être équilibrée (double partie)." });
  const diffAP = st.bilan.actifTotal - st.bilan.passifTotal;
  checks.push({ id: "ap", title: "Total Actif = Total Passif", sheet: "Bilan", expected: st.bilan.actifTotal, actual: st.bilan.passifTotal, diff: diffAP, status: Math.abs(diffAP) < 1 ? "ok" : "blocking", detail: "L'équilibre du bilan découle de la double partie." });
  checks.push({ id: "res", title: "Résultat CR = Résultat au passif", sheet: "Bilan / CR", expected: st.result.resultat, actual: st.bilan.resultat, diff: st.result.resultat - st.bilan.resultat, status: "ok", detail: "Le résultat du compte de résultat est reporté au passif du bilan." });
  const amortOk = st.bilan.amort <= st.bilan.immoBrut;
  checks.push({ id: "amort", title: "Amortissements ≤ Immobilisations brutes", sheet: "Bilan / Actif", expected: st.bilan.immoBrut, actual: st.bilan.amort, diff: st.bilan.immoBrut - st.bilan.amort, status: amortOk ? "ok" : "warning", detail: "Le cumul des amortissements ne peut pas dépasser la valeur brute." });
  checks.push({ id: "treso", title: "Trésorerie ≥ 0", sheet: "Bilan", expected: 0, actual: st.bilan.tresorerie, diff: st.bilan.tresorerie, status: st.bilan.tresorerie >= 0 ? "ok" : "warning", detail: "Une trésorerie négative doit être justifiée (découvert)." });
  checks.push({ id: "capital", title: "Capitaux propres renseignés", sheet: "Bilan / Passif", expected: 1, actual: st.bilan.capitaux > 0 ? 1 : 0, diff: st.bilan.capitaux > 0 ? 0 : 1, status: st.bilan.capitaux > 0 ? "ok" : "warning", detail: "Les capitaux propres (classe 1) doivent figurer au passif." });
  // P0-1 — garde-fou : un compte non mappé ne doit jamais passer inaperçu.
  const unmapped = st.nonMappes ?? [];
  const unmappedTotal = unmapped.reduce((s, x) => s + x.solde, 0);
  checks.push({
    id: "unmapped",
    title: "Tous les comptes sont rattachés à un poste",
    sheet: "Balance",
    expected: 0,
    actual: unmapped.length,
    diff: unmappedTotal,
    status: unmapped.length === 0 ? "ok" : "blocking",
    detail: unmapped.length === 0
      ? "Aucun compte non mappé."
      : `${unmapped.length} compte(s) non mappé(s) pour un solde de ${unmappedTotal} FCFA : ${unmapped.map((u) => u.code).join(", ")}`,
  });
  checks.push({ id: "prod", title: "Produits et charges présents", sheet: "Compte de résultat", expected: 1, actual: st.result.produits > 0 || st.result.charges > 0 ? 1 : 0, diff: 0, status: st.result.produits > 0 || st.result.charges > 0 ? "ok" : "warning", detail: "Le compte de résultat doit contenir les classes 6 et 7." });
  return checks;
}

function styleHeaderRow(ws: ExcelJS.Worksheet, row: number, cols: number) {
  for (let c = 1; c <= cols; c++) {
    const cell = ws.getRow(row).getCell(c);
    cell.fill = HEADER_FILL; cell.font = HEADER_FONT; cell.alignment = { vertical: "middle" };
    cell.border = { bottom: { style: "thin", color: { argb: "FFCBD5E1" } } };
  }
}

function addIdBlock(ws: ExcelJS.Worksheet, info: { name: string; nif: string; rccm: string; form: string; exercise: string; currency: string }) {
  ws.mergeCells("A1:D1");
  const t = ws.getCell("A1");
  t.value = "ÉTATS FINANCIERS SYSCOHADA — LIASSE FISCALE (modèle GUDEF)";
  t.font = { bold: true, size: 14, color: { argb: "FF4F46E5" } };
  ws.mergeCells("A2:D2");
  ws.getCell("A2").value = `${info.name} — ${info.form}`;
  ws.getCell("A2").font = { bold: true, size: 11 };
  const meta = [["NIF", info.nif], ["RCCM", info.rccm], ["Exercice", info.exercise], ["Monnaie", info.currency]];
  meta.forEach((m, i) => {
    ws.getCell(`A${3 + i}`).value = m[0]; ws.getCell(`A${3 + i}`).font = { bold: true };
    ws.getCell(`B${3 + i}`).value = m[1];
  });
}

export async function exportLiasseXlsx(info: { name: string; nif: string; rccm: string; form: string; exercise: string; currency: string }, prevRows: BalanceRow[], curRows: BalanceRow[], checks: CoherenceCheck[]): Promise<void> {
  const cur = buildStatements(curRows);
  const prev = prevRows.length ? buildStatements(prevRows) : null;
  const wb = new ExcelJS.Workbook();
  wb.creator = "FIMAAC";

  const mkBalance = (title: string, rows: BalanceRow[], totals: { debit: number; credit: number }) => {
    const ws = wb.addWorksheet(title);
    addIdBlock(ws, { ...info, exercise: title });
    let row = 8;
    ws.getRow(row).values = ["Compte", "Libellé", "Débit", "Crédit"];
    styleHeaderRow(ws, row, 4); row++;
    rows.forEach((r) => {
      ws.getRow(row).values = [r.code, r.label, r.debit, r.credit];
      ws.getRow(row).getCell(3).numFmt = NUMFMT;
      ws.getRow(row).getCell(4).numFmt = NUMFMT;
      row++;
    });
    ws.getRow(row).values = ["", "TOTAUX", totals.debit, totals.credit];
    ws.getRow(row).font = { bold: true };
    ws.getRow(row).getCell(3).numFmt = NUMFMT;
    ws.getRow(row).getCell(4).numFmt = NUMFMT;
    ws.columns.forEach((col, i) => { col.width = [14, 46, 18, 18][i] || 16; });
  };

  mkBalance("Balance N-1", prevRows.length ? prevRows : curRows, prev ? prev.totals : cur.totals);
  mkBalance("Balance N", curRows, cur.totals);

  const wsr = wb.addWorksheet("Compte de résultat");
  wsr.getRow(1).values = ["Compte de résultat (SYSCOHADA)", "", "N", "N-1"];
  styleHeaderRow(wsr, 1, 4);
  const crRows: [string, number, number][] = [
    ["PRODUITS (classe 7)", cur.result.produits, prev?.result.produits || 0],
    ["CHARGES (classe 6)", cur.result.charges, prev?.result.charges || 0],
    ["RÉSULTAT DE L'EXERCICE", cur.result.resultat, prev?.result.resultat || 0],
  ];
  let rr = 2;
  crRows.forEach((r) => {
    const row = wsr.getRow(rr); row.values = [r[0], "", r[1], r[2]];
    row.getCell(3).numFmt = NUMFMT; row.getCell(4).numFmt = NUMFMT;
    if (r[0].includes("RÉSULTAT")) { row.font = { bold: true }; row.getCell(1).fill = SECTION_FILL; row.getCell(3).fill = SECTION_FILL; }
    rr++;
  });
  wsr.columns.forEach((col, i) => { col.width = [42, 8, 18, 18][i] || 16; });

  const wsb = wb.addWorksheet("Bilan");
  wsb.getRow(1).values = ["Bilan (SYSCOHADA)", "", "N", "N-1"];
  styleHeaderRow(wsb, 1, 4);
  const bilanRows: [string, number, number][] = [
    ["ACTIF IMMOBILISÉ (net)", cur.bilan.immoNet, prev?.bilan.immoNet || 0],
    ["  Immobilisations brutes", cur.bilan.immoBrut, prev?.bilan.immoBrut || 0],
    ["  Amortissements", -cur.bilan.amort, prev ? -prev.bilan.amort : 0],
    ["STOCKS", cur.bilan.stocks, prev?.bilan.stocks || 0],
    ["CRÉANCES (classe 4)", cur.bilan.creances, prev?.bilan.creances || 0],
    ["TRÉSORERIE (classe 5)", cur.bilan.tresorerie, prev?.bilan.tresorerie || 0],
    ["TOTAL ACTIF", cur.bilan.actifTotal, prev?.bilan.actifTotal || 0],
    ["", 0, 0],
    ["CAPITAUX PROPRES (classe 1)", cur.bilan.capitaux, prev?.bilan.capitaux || 0],
    ["RÉSULTAT DE L'EXERCICE", cur.bilan.resultat, prev?.bilan.resultat || 0],
    ["DETTES FINANCIÈRES (16)", cur.bilan.dettesFin, prev?.bilan.dettesFin || 0],
    ["FOURNISSEURS (40)", cur.bilan.dettesFourn, prev?.bilan.dettesFourn || 0],
    ["AUTRES DETTES", cur.bilan.autresDettes, prev?.bilan.autresDettes || 0],
    ["TOTAL PASSIF", cur.bilan.passifTotal, prev?.bilan.passifTotal || 0],
  ];
  let br = 2;
  bilanRows.forEach((r) => {
    const row = wsb.getRow(br); row.values = [r[0], "", r[1], r[2]];
    row.getCell(3).numFmt = NUMFMT; row.getCell(4).numFmt = NUMFMT;
    if (r[0].startsWith("TOTAL") || r[0].includes("RÉSULTAT")) {
      row.font = { bold: true }; row.getCell(1).fill = SECTION_FILL; row.getCell(3).fill = SECTION_FILL; row.getCell(4).fill = SECTION_FILL;
    }
    br++;
  });
  wsb.columns.forEach((col, i) => { col.width = [42, 8, 18, 18][i] || 16; });

  // P7 — TAFIRE : mêmes montants que le document imprimé, calculés une seule fois.
  const tafire = buildTafire(prevRows.length ? prevRows : null, curRows);
  const wst = wb.addWorksheet("TAFIRE");
  wst.getRow(1).values = ["Tableau des flux de trésorerie (TAFIRE)", "", "Exercice N"];
  styleHeaderRow(wst, 1, 3);
  let tr = 2;
  tafireLines(tafire).forEach((l) => {
    const row = wst.getRow(tr);
    row.values = [l.label, "", l.amount];
    row.getCell(3).numFmt = NUMFMT;
    if (l.strong) { row.font = { bold: true }; row.getCell(1).fill = SECTION_FILL; row.getCell(3).fill = SECTION_FILL; }
    tr++;
  });
  if (!tafire.available && tafire.reason) {
    wst.getRow(tr).values = [tafire.reason, "", ""];
    wst.getRow(tr).font = { italic: true, color: { argb: "FFB91C1C" } };
    tr++;
  }
  wst.getRow(tr).values = ["Contrôle de bouclage", "", tafire.ecart];
  wst.getRow(tr).getCell(3).numFmt = NUMFMT;
  wst.columns.forEach((col, i) => { col.width = [56, 8, 18][i] || 16; });

  // P8 — Notes annexes : mêmes valeurs que l'écran et le document imprimé.
  const annex = buildNotesAnnex({ n: curRows, n1: prevRows, accounts: [], companyName: info.name, exercise: info.exercise });
  const wsn = wb.addWorksheet("Notes annexes");
  wsn.getRow(1).values = ["Réf.", "Intitulé", "N", "N-1", "Variation", "Statut"];
  styleHeaderRow(wsn, 1, 6);
  let nr = 2;
  annex.notes.forEach((n) => {
    const row = wsn.getRow(nr);
    row.values = [n.code.replace("NOTE_", ""), n.title, n.totalN, n.totalN1, n.variation, n.status === "calculated" ? "Calculée" : "À confirmer"];
    for (let i = 3; i <= 5; i++) row.getCell(i).numFmt = NUMFMT;
    nr++;
  });
  if (annex.manualNotes.length > 0) {
    wsn.getRow(nr).values = [`${annex.manualNotes.length} note(s) à saisie manuelle : ${annex.manualNotes.map((n) => n.code.replace("NOTE_", "")).join(", ")}`, "", "", "", "", ""];
    wsn.getRow(nr).font = { italic: true, color: { argb: "FF92400E" } };
    nr++;
  }
  wsn.columns.forEach((col, i) => { col.width = [10, 52, 18, 18, 18, 14][i] || 16; });

  const wsc = wb.addWorksheet("Contrôles cohérence");
  wsc.getRow(1).values = ["Contrôle", "Feuille", "Attendu", "Constaté", "Écart", "Statut", "Détail"];
  styleHeaderRow(wsc, 1, 7);
  let cr2 = 2;
  checks.forEach((c) => {
    wsc.getRow(cr2).values = [c.title, c.sheet, c.expected, c.actual, c.diff, c.status.toUpperCase(), c.detail];
    for (let i = 3; i <= 5; i++) wsc.getRow(cr2).getCell(i).numFmt = NUMFMT;
    const tone = c.status === "ok" ? "FFD1FAE5" : c.status === "warning" ? "FFFEF3C7" : "FFFEE2E2";
    wsc.getRow(cr2).getCell(6).fill = fillOf(tone);
    cr2++;
  });
  wsc.columns.forEach((col, i) => { col.width = [44, 16, 16, 16, 16, 12, 50][i] || 16; });

  const buffer = await wb.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `Liasse_GUDEF_${info.name}.xlsx`);
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// MODE B: fill an official GUDEF template from imported balances, preserving structure.
export async function fillTemplate(file: File, balances: BalanceRow[]): Promise<{ workbook: ExcelJS.Workbook; filled: number }> {
  const wb = await loadXlsxSafe(file);
  const map = new Map(balances.map((b) => [b.code.trim(), b.debit - b.credit]));
  let filled = 0;
  wb.eachSheet((ws) => {
    let codeCol = -1;
    let writeCol = -1;
    for (let r = 1; r <= Math.min(ws.rowCount, 40); r++) {
      const row = ws.getRow(r);
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        const v = String((cell.value as { text?: string } | null)?.text ?? cell.value ?? "").trim();
        if (codeCol < 0 && /^\d{2,}$/.test(v) && map.has(v)) codeCol = col;
      });
      if (codeCol > 0) break;
    }
    if (codeCol < 0) { return; }
    // Cap à 5000 lignes — ExcelJS peut renvoyer rowCount = 1 048 576
    for (let r = 1; r <= Math.min(ws.rowCount || 0, 5000); r++) {
      const row = ws.getRow(r);
      const code = String((row.getCell(codeCol).value as { text?: string } | null)?.text ?? row.getCell(codeCol).value ?? "").trim();
      if (map.has(code)) {
        if (writeCol < 0) {
          for (let c = codeCol + 1; c <= codeCol + 6; c++) {
            const cv = row.getCell(c).value;
            if (cv == null || typeof cv === "number") { writeCol = c; break; }
          }
          if (writeCol < 0) writeCol = codeCol + 1;
        }
        try {
          const cell = row.getCell(writeCol);
          cell.value = map.get(code);
          cell.numFmt = NUMFMT;
          filled++;
        } catch { /* cellule protégée/fusionnée — ignorée */ }
      }
    }
    writeCol = -1;
  });
  return { workbook: wb, filled };
}

export async function downloadWorkbook(wb: ExcelJS.Workbook, name: string) {
  const buffer = await wb.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), name);
}

// ============================================================================
// 8. LIQUIDATION IS_IR_MP — DOCUMENT 4 (feuille Liquidation IS_IR_MP, 16 formules)
// ============================================================================

/** Excel ROUNDDOWN : tronque vers zéro au multiple 10^digits (digits<0 → dizaines, milliers). */
function roundDown(value: number, digits: number): number {
  if (digits >= 0) return Math.trunc(value * Math.pow(10, digits)) / Math.pow(10, digits);
  const f = Math.pow(10, -digits);
  return Math.trunc(value / f) * f;
}

export interface LiquidationIS {
  resultatFiscal: number;
  chiffreAffaires: number;
  /** H12 — minimum de perception (ROUNDDOWN à la dizaine) */
  minimumPerception: number;
  /** H14 — IS calculé 27 % (ROUNDDOWN à la dizaine) */
  impotCalcule: number;
  /** H15 — IS dû = MAX(minimum ; calculé) */
  impotDu: number;
  acomptes: number;
  /** H29 — reste à payer */
  resteAPayer: number;
  /** H30 — excédent / crédit reportable */
  creditReportable: number;
}

/**
 * Liquidation IS_IR_MP — reproduction EXACTE des formules DOCUMENT 4.
 * @formula H9  = ='COMPTE DE RESULTAT'!I17 — chiffre d'affaires
 * @formula H11 = H9+H10 — base du minimum (H10 = ajustement manuel, défaut 0)
 * @formula H12 = ROUNDDOWN(IF(H11<=2000000;20000;H11/100);-1) — minimum
 * @formula H13 = ='Résultat fiscal'!D56 — résultat fiscal arrondi au millier
 * @formula H14 = IF(H13>0;ROUNDDOWN(H13*0.27;-1);0) — IS calculé
 * @formula H15 = MAX(H12;H14) — IS dû
 * @formula H28 = SUM(H24:H27) — acomptes versés
 * @formula H29 = IF(SUM(H19:H20)>H28;SUM(H19:H20)-H28;0) — reste à payer
 * @formula H30 = IF(SUM(H19:H20)<H28;H28-SUM(H19:H20);0) — crédit reportable
 */
export function computeLiquidationIS(
  resultatFiscal: number,
  acomptes: number = 0,
  chiffreAffaires: number = 0,
): LiquidationIS {
  // H9 = CA ; H11 = CA (H10 = 0 par défaut)
  // H12 = ROUNDDOWN(IF(H11<=2 000 000; 20 000; H11/100); -1)
  const minimumPerception = roundDown(chiffreAffaires <= 2_000_000 ? 20_000 : chiffreAffaires / 100, -1);
  // H14 = IF(H13>0; ROUNDDOWN(H13*0.27; -1); 0)
  const impotCalcule = resultatFiscal > 0 ? roundDown(resultatFiscal * 0.27, -1) : 0;
  // H15 = MAX(H12; H14)
  const impotDu = Math.max(minimumPerception, impotCalcule);
  // H29 / H30
  return {
    resultatFiscal, chiffreAffaires, minimumPerception, impotCalcule, impotDu, acomptes,
    resteAPayer: Math.max(0, impotDu - acomptes),
    creditReportable: Math.max(0, acomptes - impotDu),
  };
}

// ============================================================================
// 8b. RÉSULTAT FISCAL — DOCUMENT 4 (feuille "Résultat fiscal", 12 formules)
// ============================================================================
export interface ResultatFiscalResult {
  /** D6 = CR!I51 — résultat comptable */
  resultatComptable: number;
  /** D32 = SUM(D9:D31) — total réintégrations */
  totalReintegrations: number;
  /** D48 = SUM(D35:D47) — total déductions */
  totalDeductions: number;
  /** D51 = D6+D32-D48 — résultat fiscal avant déficits */
  resultatFiscalBrut: number;
  /** D54 = D51-D52-D53 — résultat fiscal net */
  resultatFiscalNet: number;
  /** D56 = ROUNDDOWN(D54-D55;-3) — arrondi au millier inférieur */
  resultatFiscalArrondi: number;
}

/**
 * Calcul du résultat fiscal — reproduction EXACTE DOCUMENT 4.
 * @formula D6  = ='COMPTE DE RESULTAT'!I51
 * @formula D32 = SUM(D9:D31)
 * @formula D48 = SUM(D35:D47)
 * @formula D51 = D6+D32-D48
 * @formula D54 = D51-D52-D53
 * @formula D56 = ROUNDDOWN(D54-D55;-3)
 * @param deficitsReportables D52 ='Gestion défcits'!D14
 * @param creditsReportables  D53 ='Gestion défcits'!G45
 * @param ajustementManuel    D55 — saisie manuelle (défaut 0)
 */
export function computeResultatFiscal(input: {
  resultatComptable: number;
  reintegrations: number;
  deductions: number;
  deficitsReportables: number;
  creditsReportables: number;
  ajustementManuel?: number;
}): ResultatFiscalResult {
  const { resultatComptable, reintegrations, deductions, deficitsReportables, creditsReportables, ajustementManuel = 0 } = input;
  const totalReintegrations = reintegrations; // D32
  const totalDeductions = deductions; // D48
  const resultatFiscalBrut = resultatComptable + totalReintegrations - totalDeductions; // D51
  const resultatFiscalNet = resultatFiscalBrut - deficitsReportables - creditsReportables; // D54
  const resultatFiscalArrondi = roundDown(resultatFiscalNet - ajustementManuel, -3); // D56
  return { resultatComptable, totalReintegrations, totalDeductions, resultatFiscalBrut, resultatFiscalNet, resultatFiscalArrondi };
}

// ============================================================================
// 9. LIQUIDATION DP — DOCUMENT 1/4 (feuille Liquidation DP, 4018 formules)
// ============================================================================
export interface LiquidationDP {
  secteur: string;
  caTotal: number;
  tauxEffectif: number;
  /** Σ H{r} = F{r} × G{r} — total droit brut (F14 au sens Excel) */
  droitProportionnel: number;
  /** Σ J{r} = H{r} − I{r} — total reste à payer (F10 au sens Excel) */
  resteAPayer: number;
  /** F12 = IF(F10>=F11,F10-F11,"") — solde après seuil */
  solde?: number;
  detail: { ca: number; taux: number; montant: number; dejaPaye?: number; reste?: number }[];
}

/** Barème sectoriel — DOCUMENT 1/4 formule maître colonne G (VLOOKUP). */
const DP_RATES: Record<string, { max: number; rate: number }[]> = {
  COMMERCE: [
    { max: 500_000_000, rate: 0.0055 }, { max: 10_000_000_000, rate: 0.006 },
    { max: 50_000_000_000, rate: 0.0065 }, { max: Infinity, rate: 0.007 },
  ],
  SERVICES: [
    { max: 500_000_000, rate: 0.0075 }, { max: 10_000_000_000, rate: 0.008 },
    { max: 50_000_000_000, rate: 0.01 }, { max: Infinity, rate: 0.012 },
  ],
  TELEPHONIE: [
    { max: 500_000_000, rate: 0.008 }, { max: 10_000_000_000, rate: 0.0095 },
    { max: 50_000_000_000, rate: 0.01 }, { max: Infinity, rate: 0.012 },
  ],
  INDUSTRIES: [
    { max: 500_000_000, rate: 0.007 }, { max: 10_000_000_000, rate: 0.008 },
    { max: 50_000_000_000, rate: 0.009 }, { max: Infinity, rate: 0.01 },
  ],
};

/** Regroupement sectoriel — DOCUMENT 1/4 (formule maître G18). */
function sectorGroup(s: string): keyof typeof DP_RATES {
  if (/COMMERCE|HOTELLERIE|PHARMAC/i.test(s)) return "COMMERCE";
  if (/SERVICES|ASSURANCE|BANQU|BTP/i.test(s)) return "SERVICES";
  if (/TELEPHON|TECHNOLOG|INFORMAT/i.test(s)) return "TELEPHONIE";
  if (/INDUSTR/i.test(s)) return "INDUSTRIES";
  return "COMMERCE";
}

/**
 * Droit proportionnel — reproduction du barème conditionnel DOCUMENT 4.
 * @formula G18 = IF(OR(E18="",F18=""),"",IF(OR(E18="COMMERCE"...);IF(F18<=500000000;0,55%...)))
 * @formula H18 = IFERROR(F18*G18,"")  — droit brut
 * @formula J18 = IFERROR((H18-I18)," ") — reste = droit − déjà payé
 * @formula F10 = SUM(J18:J1019) — total reste à payer
 * @formula F14 = SUM(F18:F1019) — total CA
 * @formula F12 = IF(F10>=F11,F10-F11,"") — solde après seuil
 * @param dejaPaye montant déjà payé (colonne I, saisie manuelle, défaut 0)
 * @param seuil seuil de liquidation (F11, saisie manuelle, défaut 0)
 */
export function computeLiquidationDP(secteur: string, ca: number, dejaPaye: number = 0, seuil: number = 0): LiquidationDP {
  const grp = sectorGroup(secteur);
  const rates = DP_RATES[grp] || DP_RATES.COMMERCE;
  const detail: { ca: number; taux: number; montant: number; dejaPaye?: number; reste?: number }[] = [];
  let remaining = ca;
  let totalDroit = 0;
  for (const tier of rates) {
    const taxable = Math.min(remaining, tier.max);
    if (taxable <= 0) break;
    const montant = taxable * tier.rate;
    const reste = montant - dejaPaye;
    detail.push({ ca: Math.round(taxable), taux: tier.rate, montant: Math.round(montant), dejaPaye, reste: Math.round(reste) });
    totalDroit += montant;
    remaining -= taxable;
  }
  // @formula F10 = SUM(J18:J1019) — total reste à payer
  const resteAPayer = Math.max(0, Math.round(totalDroit - dejaPaye));
  // @formula F12 = IF(F10>=F11,F10-F11,"") — solde après seuil
  const solde = seuil > 0 && resteAPayer >= seuil ? resteAPayer - seuil : undefined;
  return {
    secteur: grp, caTotal: ca,
    tauxEffectif: ca > 0 ? totalDroit / ca : 0,
    droitProportionnel: Math.round(totalDroit),
    resteAPayer,
    solde,
    detail,
  };
}
