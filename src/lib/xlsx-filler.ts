// ============================================================================
// FIMAAC — Remplisseur d'état GUDEF SANS ExcelJS (regex pur, pas de DOMParser)
// ExcelJS crash sur les shared formulas. DOMParser/XMLSerializer corrompent
// les namespaces XML du .xlsx. Cette version utilise JSZip + regex pour
// modifier UNIQUEMENT les cellules cibles, en préservant tout le reste.
// ============================================================================
import JSZip from "jszip";

interface FillResult {
  blob: Blob;
  filled: number;
  unmatched: string[];
  report: string[];
}

/**
 * Remplit un classeur GUDEF fourni en écrivant les valeurs directement dans le XML.
 *
 * @param file Fichier .xlsx du modèle GUDEF
 * @param valueByRef Map { "AE": 123456, "TA": 789000, ... }
 * @returns { blob, filled, unmatched, report }
 */
export async function fillStateTemplateZip(
  file: File,
  valueByRef: Record<string, number>,
): Promise<FillResult> {
  const rawBuf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(rawBuf);

  // ---- 1. Charger la table des chaînes partagées ----
  const ssEntry = zip.file("xl/sharedStrings.xml");
  const sharedStrings: string[] = [];
  if (ssEntry) {
    const ssXml = await ssEntry.async("string");
    const siMatches = ssXml.match(/<si\b[^>]*>[\s\S]*?<\/si>/g) || [];
    for (const si of siMatches) {
      // Un <si> peut contenir plusieurs <t> (texte riche)
      const tParts = si.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) || [];
      const fullText = tParts
        .map((t) => t.replace(/<t\b[^>]*>([\s\S]*?)<\/t>/, "$1"))
        .join("");
      sharedStrings.push(fullText);
    }
  }

  // Index inverse : quels indices de sharedStrings correspondent à des codes de réf ?
  const refStringIndices = new Map<number, string>(); // index → code (ex: 42 → "AE")
  for (let i = 0; i < sharedStrings.length; i++) {
    const text = sharedStrings[i].trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(text)) {
      refStringIndices.set(i, text);
    }
  }

  let filled = 0;
  const unmatched: string[] = [];
  const report: string[] = [];

  // ---- 2. Traiter chaque feuille de calcul ----
  const sheetFiles = Object.keys(zip.files).filter((f) =>
    /^xl\/worksheets\/sheet\d+\.xml$/i.test(f),
  );

  // Référence au workbook.xml pour le recalcul
  const wbEntry = zip.file("xl/workbook.xml");

  for (const sheetFile of sheetFiles) {
    const entry = zip.file(sheetFile);
    if (!entry) continue;
    let xml = await entry.async("string");
    let sheetModified = false;

    // Traiter ligne par ligne avec regex (préserve tout le reste intact)
    xml = xml.replace(
      /<row\b([^>]*)>([\s\S]*?)<\/row>/g,
      (fullRowMatch: string, rowAttrs: string, rowInner: string) => {
        // Extraire toutes les cellules de cette ligne
        const cells = parseCellsInRow(rowInner);
        if (cells.length === 0) return fullRowMatch;

        // ---- Trouver la cellule de référence (AE, TA, RA...) ----
        let refCellIdx = -1;
        let ref = "";
        for (let j = 0; j < cells.length; j++) {
          const text = resolveCellText(cells[j], refStringIndices);
          if (text && /^[A-Z]{2}$/.test(text)) {
            refCellIdx = j;
            ref = text;
            break;
          }
        }
        if (refCellIdx < 0 || !ref) return fullRowMatch;
        if (!(ref in valueByRef)) {
          if (!unmatched.includes(ref)) unmatched.push(ref);
          return fullRowMatch;
        }

        // ---- Trouver la colonne d'écriture ----
        // 1ère cellule non-texte à droite de la référence, en sautant les cellules de formule
        let writeIdx = -1;
        for (let j = refCellIdx + 1; j < cells.length && j <= refCellIdx + 10; j++) {
          const type = getCellType(cells[j]);
          // Sauter les cellules texte (libellés)
          if (type === "s" || type === "inlineStr" || type === "str") continue;
          // Sauter les cellules qui ont une formule <f>
          // ⚠️ Correction : `/\f/` désigne un caractère form feed (U+000C),
          //    et non la balise <f>. L'écriture aurait écrasé les formules.
          if (/<f\b/i.test(cells[j].content)) continue;
          // Cellule vide ou numérique sans formule → cible trouvée
          writeIdx = j;
          break;
        }
        if (writeIdx < 0) return fullRowMatch;

        // ---- Construire la cellule de remplacement ----
        const oldCell = cells[writeIdx];
        const rAttr = extractAttr(oldCell.attrs, "r");
        const sAttr = extractAttr(oldCell.attrs, "s");
        const value = valueByRef[ref];

        // Nouvelle cellule : préserve r et s, force t="n", insère <v>
        const newCell = `<c${rAttr}${sAttr} t="n"><v>${value}</v></c>`;

        // Remplacer dans le contenu de la ligne
        const newRowInner = rowInner.replace(oldCell.full, newCell);
        sheetModified = true;
        filled++;
        report.push(`${sheetFile} | ${ref} → ${rAttr || "?"} = ${value}`);
        return `<row${rowAttrs}>${newRowInner}</row>`;
      },
    );

    if (sheetModified) {
      zip.file(sheetFile, xml);
    }
  }

  // ---- 3. Forcer le recalcul Excel à l'ouverture ----
  if (wbEntry) {
    let wbXml = await wbEntry.async("string");
    if (!/fullCalcOnLoad/i.test(wbXml)) {
      if (/<calcPr\b/i.test(wbXml)) {
        wbXml = wbXml.replace(/<calcPr\b([^>]*)>/i, '<calcPr$1 fullCalcOnLoad="1">');
      } else {
        wbXml = wbXml.replace(
          /<\/workbook>/i,
          '<calcPr calcId="0" fullCalcOnLoad="1"/></workbook>',
        );
      }
      zip.file("xl/workbook.xml", wbXml);
    }
  }

  // ---- 4. Générer le blob ----
  const blob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  return {
    blob,
    filled,
    unmatched: [...new Set(unmatched)],
    report,
  };
}

// ==================== HELPERS ====================

interface ParsedCell {
  attrs: string;   // attributs bruts (ex: ` r="E12" s="5" t="s"`)
  content: string; // contenu entre <c ...> et </c> (vide si self-closing)
  isSelfClosing: boolean;
  full: string;    // XML complet de la cellule
}

/** Extrait toutes les cellules <c> d'une ligne. */
function parseCellsInRow(rowInner: string): ParsedCell[] {
  const cells: ParsedCell[] = [];
  // Match: <c ...>content</c> OU <c .../>
  const pattern = /<c\b([^>]*?)>([\s\S]*?)<\/c>|<c\b([^>]*?)\/>/g;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(rowInner)) !== null) {
    if (m[1] !== undefined) {
      cells.push({ attrs: m[1], content: m[2] || "", isSelfClosing: false, full: m[0] });
    } else {
      cells.push({ attrs: m[3] || "", content: "", isSelfClosing: true, full: m[0] });
    }
  }
  return cells;
}

/** Résout le texte d'une cellule (shared string, inline string, ou nombre). */
function resolveCellText(
  cell: ParsedCell,
  refStringIndices: Map<number, string>,
): string {
  if (cell.isSelfClosing) return "";
  const type = getCellType(cell);
  if (type === "s") {
    // Chaîne partagée
    const vMatch = cell.content.match(/<v\b[^>]*>(\d+)<\/v>/);
    if (vMatch) {
      const idx = parseInt(vMatch[1], 10);
      return refStringIndices.get(idx) || "";
    }
    return "";
  }
  if (type === "inlineStr" || type === "str") {
    // Chaîne en ligne
    const tMatches = cell.content.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) || [];
    return tMatches
      .map((t) => t.replace(/<t\b[^>]*>([\s\S]*?)<\/t>/, "$1"))
      .join("")
      .trim()
      .toUpperCase();
  }
  // Type par défaut — vérifier si c'est du texte stocké comme nombre
  const vMatch = cell.content.match(/<v\b[^>]*>([\s\S]*?)<\/v>/);
  if (vMatch) {
    return vMatch[1].trim().toUpperCase();
  }
  return "";
}

/** Extrait l'attribut type (t) d'une cellule. */
function getCellType(cell: ParsedCell): string {
  const m = cell.attrs.match(/\bt="([^"]*)"/);
  return m ? m[1] : "";
}

/** Extrait un attribut formaté (ex: extractAttr(attrs, "r") → ' r="E12"'). */
function extractAttr(attrs: string, name: string): string {
  const m = attrs.match(new RegExp(`\\b${name}="([^"]*)"`));
  return m ? ` ${name}="${m[1]}"` : "";
}
