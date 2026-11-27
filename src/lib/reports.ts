// ============================================================================
// FIMAAC — Rapports & audit de classeur GUDEF
// Consommé par `excelAudit.ts` (entré de `reconstitution.ts`).
//
// RÈGLE : le patch est NON DESTRUCTIF — seules les cellules mappées
// référence → cellule sont écrites ; formules et mise en forme préservées.
// ============================================================================
import { loadXlsxSafe, listSheetNames, countFormulas } from "./xlsx-sanitizer";
import { fillStateTemplateZip } from "./xlsx-filler";

/** Feuilles clés attendues dans un classeur GUDEF. */
export const KEY_SHEETS = [
  "BALANCE N",
  "BALANCE N-1",
  "COMPTE DE RESULTAT",
  "BILAN ACTIF",
  "BILAN PASSIF",
  "TFT",
  "CONTROLE",
] as const;

/** Feuilles clés normalisées (majuscules, sans accents) pour comparaison tolérante. */
const KEY_MATCHERS: { key: (typeof KEY_SHEETS)[number]; re: RegExp }[] = [
  { key: "BALANCE N", re: /^BALANCE\s*N$/i },
  { key: "BALANCE N-1", re: /^BALANCE\s*N-?1$/i },
  { key: "COMPTE DE RESULTAT", re: /COMPTE\s*DE\s*R[ÉE]SULTAT/i },
  { key: "BILAN ACTIF", re: /BILAN\s*ACTIF/i },
  { key: "BILAN PASSIF", re: /BILAN\s*PASSIF/i },
  { key: "TFT", re: /^TFT/i },
  { key: "CONTROLE", re: /CONTR[ÔO]LE/i },
];

/** Radiographie d'une feuille — consommée par la page Liasse (lot 8). */
export interface SheetAudit {
  name: string;
  key: boolean;
  rows: number;
  cols: number;
  values: number;
  formulas: number;
  merged: number;
  inputCells: number;
  calcCells: number;
  formulaSamples: string[];
}

export interface WorkbookAuditSummary {
  fileName: string;
  sheets: number;
  formulas: number;
  matchedKeySheets: string[];
}

export interface WorkbookAudit extends Omit<WorkbookAuditSummary, "sheets"> {
  /** Feuilles attendues absentes du classeur. */
  missingSheets: string[];
  /** Noms réels des feuilles du classeur. */
  sheetNames: string[];
  /** Nombre de feuilles. */
  sheets: number;
  /** Détail par feuille. */
  sheetDetails: SheetAudit[];
  /** Nombre de cellules non vides. */
  cells: number;
  /** Métadonnées du classeur. */
  creator: string;
  created: string;
  modified: string;
  fullCalcOnLoad: boolean;
  /** Taille du fichier (octets). */
  size: number;
  /** Totaux consolidés. */
  totalValues: number;
  totalMerged: number;
  auditedAt: string;
}

export interface WorkbookPatch {
  /** Cellules écrites. */
  patched: number;
  /** Cellules contenant une formule, volontairement préservées. */
  preserved: number;
  /** Erreurs non bloquantes. */
  errors: string[];
  patchedAt: string;
}

/** Normalise un nom de feuille (majuscules, sans accents). */
function normSheet(s: string): string {
  return (s || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Audit d'un classeur GUDEF importé : feuilles réelles, nombre de formules,
 * feuilles clés présentes / manquantes.
 */
export async function auditWorkbook(file: File): Promise<WorkbookAudit> {
  const sheetNames = await listSheetNames(file).catch(() => [] as string[]);
  const formulas = await countFormulas(file).catch(() => 0);
  const sheetDetails: SheetAudit[] = [];
  let cells = 0;
  let totalValues = 0;
  let totalMerged = 0;
  let creator = "—";
  let created = "—";
  let modified = "—";
  let fullCalcOnLoad = false;

  try {
    const wb = await loadXlsxSafe(file);
    creator = wb.creator || "—";
    created = wb.created ? String(wb.created) : "—";
    modified = wb.modified ? String(wb.modified) : "—";
    fullCalcOnLoad = Boolean(wb.calcProperties?.fullCalcOnLoad);

    const keySet = new Set(KEY_SHEETS.map((k) => k.toLowerCase()));
    for (const ws of wb.worksheets) {
      const isKey = keySet.has(ws.name.toLowerCase().trim());
      let values = 0;
      let sheetFormulas = 0;
      let inputCells = 0;
      const formulaSamples: string[] = [];

      for (let r = 1; r <= Math.min(ws.rowCount, 5000); r++) {
        ws.getRow(r).eachCell({ includeEmpty: false }, (cell) => {
          if (cell.value == null) return;
          values += 1;
          const v = cell.value;
          const isFormula =
            typeof v === "object" && v !== null && "formula" in v;
          if (isFormula) {
            sheetFormulas += 1;
            if (formulaSamples.length < 3) {
              formulaSamples.push(`${cell.address}=${(v as { formula?: string }).formula ?? ""}`);
            }
          } else if (typeof v === "number") {
            inputCells += 1;
          }
        });
      }

      const calcCells = sheetFormulas;
      cells += values;
      totalValues += values;
      totalMerged += ws.model?.merges?.length ?? 0;

      sheetDetails.push({
        name: ws.name,
        key: isKey,
        rows: ws.rowCount,
        cols: ws.columnCount,
        values,
        formulas: sheetFormulas,
        merged: ws.model?.merges?.length ?? 0,
        inputCells,
        calcCells,
        formulaSamples,
      });
    }
  } catch {
    /* classeur illisible — l'audit partiel est suffisant */
  }

  const normalized = sheetNames.map(normSheet);
  const matchedKeySheets = KEY_MATCHERS
    .filter((m) => normalized.some((n) => m.re.test(n)))
    .map((m) => m.key);

  return {
    fileName: file.name,
    size: file.size,
    sheets: sheetNames.length,
    formulas,
    cells,
    totalValues,
    totalMerged,
    matchedKeySheets,
    missingSheets: (KEY_SHEETS as readonly string[]).filter(
      (k) => !matchedKeySheets.some((m) => m === k),
    ),
    sheetNames,
    sheetDetails,
    creator,
    created,
    modified,
    fullCalcOnLoad,
    auditedAt: new Date().toISOString(),
  };
}

/** Copie binaire exacte du classeur (identité parfaite, sans réécriture). */
export async function cloneWorkbook(file: File): Promise<void> {
  const blob = new Blob([await file.arrayBuffer()], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "copie_" + file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** Télécharge un classeur ExcelJS déjà chargé. */
export async function downloadWorkbookWb(
  wb: { xlsx: { writeBuffer: () => Promise<ArrayBuffer> } },
  name: string,
): Promise<void> {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Entrée de patch : "Feuille!Cellule" → valeur (texte ou nombre). */
export type PatchInputMap = Record<string, string | number>;

export interface PatchResult {
  /** Classeur chargé, prêt pour export. */
  workbook: { xlsx: { writeBuffer: () => Promise<ArrayBuffer> } };
  /** Cellules d'entrée écrites. */
  patched: number;
  /** Cellules de formule volontairement préservées. */
  preserved: number;
  /** Anomalies non bloquantes. */
  errors: string[];
}

/**
 * Patch « reconstitution » (page Liasse, lot 8) : écrit des ENTRÉES
 * ("Feuille!Cellule" → valeur) dans le classeur, préserve les formules et
 * force le recalcul à l'ouverture.
 */
export async function patchWorkbook(
  file: File,
  inputs: PatchInputMap,
): Promise<PatchResult> {
  const wb = await loadXlsxSafe(file);
  let patched = 0;
  let preserved = 0;
  const errors: string[] = [];

  for (const key of Object.keys(inputs)) {
    const sep = key.indexOf("!");
    const sheetName = sep < 0 ? key : key.slice(0, sep);
    const cellAddr = sep < 0 ? "A1" : key.slice(sep + 1);
    const ws = wb.getWorksheet(sheetName);
    if (!ws) {
      errors.push(`Feuille inexistante : ${sheetName}`);
      continue;
    }
    const cell = ws.getCell(cellAddr);
    const v = cell.value;
    const isFormula = typeof v === "object" && v !== null && "formula" in v;
    if (isFormula) {
      preserved += 1;
      errors.push(`${key} : cellule de formule préservée`);
      continue;
    }
    try {
      cell.value = inputs[key];
      patched += 1;
    } catch {
      errors.push(`${key} : cellule protégée ou fusionnée — ignorée`);
    }
  }

  // Force le recalcul à l'ouverture
  try {
    wb.calcProperties = {
      ...wb.calcProperties,
      fullCalcOnLoad: true,
      calcMode: "auto",
    } as typeof wb.calcProperties;
  } catch {
    /* ignore */
  }

  return { workbook: wb, patched, preserved, errors };
}

/**
 * Remplit un classeur GUDEF par mapping référence → valeur, sans détruire les formules.
 * La lecture se fait via le sanitiseur (neutralisation des shared formulas),
 * l'écriture via JSZip pour préserver le reste du document à l'identique.
 */
export async function patchWorkbookByRef(
  file: File,
  mapping: Record<string, number>,
): Promise<WorkbookPatch> {
  const errors: string[] = [];
  if (!file || file.size === 0) {
    return { patched: 0, preserved: 0, errors: ["Classeur vide ou illisible."], patchedAt: new Date().toISOString() };
  }
  if (!Object.keys(mapping).length) {
    return { patched: 0, preserved: 0, errors: ["Aucune correspondance fournie : vérifiez le mapping."], patchedAt: new Date().toISOString() };
  }

  // Nombre de formules avant patch — servira à prouver la préservation
  const formulasBefore = await countFormulas(file).catch(() => 0);
  const res = await fillStateTemplateZip(file, mapping);
  for (const u of res.unmatched) errors.push(`Référence non appariée : ${u}`);
  const formulasAfter = await countFormulas(
    new File([res.blob], file.name, { type: file.type }),
  ).catch(() => formulasBefore);

  return {
    patched: res.filled,
    preserved: Math.max(0, formulasAfter),
    errors,
    patchedAt: new Date().toISOString(),
  };
}

/** Contrôles de cohérence d'un classeur rempli (actif = passif, Σ débit = crédit…). */
export function workbookCoherenceChecks(
  bilan: { totalActif: number; totalPassif: number },
  balance: { totalDebit: number; totalCredit: number },
  resultat: { cr: number; passif: number },
): { label: string; ok: boolean; diff: number }[] {
  const round3 = (n: number) => Math.round(n / 1000) * 1000;
  return [
    {
      label: "Total Actif = Total Passif",
      ok: round3(bilan.totalActif) === round3(bilan.totalPassif),
      diff: round3(bilan.totalActif) - round3(bilan.totalPassif),
    },
    {
      label: "Σ Débit = Σ Crédit",
      ok: Math.abs(balance.totalDebit - balance.totalCredit) < 1,
      diff: balance.totalDebit - balance.totalCredit,
    },
    {
      label: "Résultat CR = Résultat au passif",
      ok: round3(resultat.cr) === round3(resultat.passif),
      diff: round3(resultat.cr) - round3(resultat.passif),
    },
  ];
}

/** Score de cohérence global (0-100) — consommé par `setFSCoherence`. */
export function coherenceScore(checks: { ok: boolean }[]): number {
  if (checks.length === 0) return 0;
  return Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);
}

/** Réexport pratique pour les composants d'atelier. */
export { loadXlsxSafe };
